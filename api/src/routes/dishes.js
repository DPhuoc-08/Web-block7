// REST API cho tài nguyên món ăn: /api/dishes. Mọi kết quả handler xử lý được đều trả 200 + ok.
import { Router } from "express";
import { prisma, isNotFound, isForeignKeyViolation } from "../db.js";
import { ok, notFound, validationFailed } from "../http/respond.js";
import { jsonBody } from "../http/json-body.js";
import { parseId } from "../validators/id.js";
import { hasErrors } from "../validators/common.js";
import { validateDish, checkDishRefs } from "../validators/dish.js";
import { parseListQuery, basicAdvancedWhere, SORTS, TEXT_MODES } from "../validators/list-query.js";
import { fulltextPage } from "../search/fulltext.js";
import { fuzzyPage } from "../search/fuzzy.js";
import { TAG_SELECT, flatTags } from "../http/shapes.js";

const router = Router();

// Dạng chi tiết: kèm đầu bếp phụ trách (và chuyên môn), tag, nguyên liệu.
// Các bảng liên kết được "làm phẳng" thành mảng: tags: [{id, name}], ingredients: [{id, name, unit}].
const detailInclude = {
  chef: { select: { id: true, name: true, tags: TAG_SELECT } },
  tags: TAG_SELECT,
  ingredients: {
    select: { ingredient: { select: { id: true, name: true, unit: true } } },
    orderBy: { ingredient: { name: "asc" } },
  },
};
const toDetail = ({ ingredients, tags, chef, ...dish }) => ({
  ...dish,
  chef: { ...chef, tags: flatTags(chef.tags) },
  tags: flatTags(tags),
  ingredients: ingredients.map((link) => link.ingredient),
});

// Dạng danh sách: thẻ món ở thực đơn / dòng bảng admin cần tag và tên đầu bếp, không cần nguyên liệu.
const listInclude = { chef: { select: { id: true, name: true } }, tags: TAG_SELECT };
const toListItem = ({ tags, ...dish }) => ({ ...dish, tags: flatTags(tags) });

// Danh sách có phân trang + tìm kiếm tại server (plan mục 5.2–5.4):
//   ?mode=basic|advanced &q= &page= &pageSize= &sort=      (basic: thêm ?searchIn=name,tag cho trang admin)
//   advanced thêm: &tag=<id> &minPrice= &maxPrice= &available=true|false
//   ?mode=fulltext|fuzzy &q= (bắt buộc) &page= &pageSize=   — xếp theo điểm phù hợp, mỗi món có thêm `score`
// Trả data: { items, total, page, pageSize }. Không có kết quả / trang vượt phạm vi vẫn là thành công (items: []).
router.get("/", async (req, res) => {
  const query = parseListQuery(req.query);
  const { errors } = query;
  // Tag phải có thật: lọc theo tag không tồn tại là điều kiện sai, không phải "0 kết quả".
  if (query.tagId !== null && !errors.tag && !(await prisma.tag.findUnique({ where: { id: query.tagId }, select: { id: true } }))) {
    errors.tag = "Tag không tồn tại.";
  }
  if (hasErrors(errors)) return validationFailed(res, errors);

  const { page, pageSize } = query;
  if (TEXT_MODES.includes(query.mode)) return textSearch(res, query);

  const where = basicAdvancedWhere(query);
  // `total` đếm CÙNG điều kiện với `items` (không đếm cả bảng). Hai câu chạy trong một transaction RepeatableRead
  // → cùng một ảnh chụp dữ liệu: không có cảnh total nói 37 mà items lại thiếu/thừa vì có người vừa thêm/xoá món.
  // Lọc + sắp xếp chạy trong SQL TRƯỚC LIMIT/OFFSET (take/skip) → sort áp dụng cho toàn bộ kết quả, không riêng trang này.
  const [total, rows] = await prisma.$transaction(
    [
      prisma.dish.count({ where }),
      prisma.dish.findMany({ where, include: listInclude, orderBy: SORTS[query.sort], skip: (page - 1) * pageSize, take: pageSize }),
    ],
    // maxWait: lần đầu sau khi pool nguội, mở kết nối + bắt đầu transaction có thể quá 2s mặc định (P2028 → 500).
    { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 15_000 },
  );
  // Trang vượt phạm vi: giữ `page` như yêu cầu, items rỗng, total thật — không tự sửa về trang cuối.
  ok(res, { items: rows.map(toListItem), total, page, pageSize });
});

// Full-text / fuzzy: câu SQL (search/*.js) trả total + id và điểm của trang, đã xếp theo điểm.
// Prisma nạp phần hiển thị (tag, đầu bếp) theo danh sách id, rồi giữ đúng thứ tự điểm của SQL.
async function textSearch(res, { mode, q, page, pageSize }) {
  const search = mode === "fulltext" ? fulltextPage : fuzzyPage;
  const { total, hits } = await search(prisma, q, (page - 1) * pageSize, pageSize);
  const rows = hits.length ? await prisma.dish.findMany({ where: { id: { in: hits.map((h) => h.id) } }, include: listInclude }) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  // Món vừa bị xoá giữa hai câu truy vấn → bỏ qua, không làm hỏng cả trang.
  const items = hits
    .filter((h) => byId.has(h.id))
    .map((h) => ({ ...toListItem(byId.get(h.id)), score: Math.round(h.score * 1000) / 1000 }));
  ok(res, { items, total, page, pageSize });
}

// Chi tiết. Id sai định dạng ("abc", "2.5") → NOT_FOUND ngay, không truy vấn (tránh lỗi kiểu dữ liệu thành 500).
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, "Không tìm thấy món.");
  const dish = await prisma.dish.findUnique({ where: { id }, include: detailInclude });
  if (!dish) return notFound(res, "Không tìm thấy món.");
  ok(res, toDetail(dish));
});

// Thêm. Validate (không cần DB) → kiểm tra id đầu bếp/nguyên liệu có thật → ghi → trả bản ghi vừa tạo (có id)
// để SPA điều hướng sang trang chi tiết.
router.post("/", jsonBody, async (req, res) => {
  const input = validateDish(req.body);
  if (hasErrors(input.errors)) return validationFailed(res, input.errors);
  await checkDishRefs(prisma, input);
  if (hasErrors(input.errors)) return validationFailed(res, input.errors);

  try {
    // Nested create: món và các dòng liên kết nguyên liệu, tag ghi trong cùng một lệnh (một transaction).
    const created = await prisma.dish.create({
      data: {
        ...input.data,
        ingredients: { create: input.ingredientIds.map((ingredientId) => ({ ingredientId })) },
        tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
      },
      include: detailInclude,
    });
    ok(res, toDetail(created));
  } catch (err) {
    // Đầu bếp/nguyên liệu vừa bị xoá ở tab khác giữa lúc kiểm tra và lúc ghi → khoá ngoại từ chối.
    if (isForeignKeyViolation(err)) return refsChanged(res, input);
    throw err;
  }
});

// Sửa (PATCH): chỉ các trường gửi lên được kiểm tra và ghi. Có `ingredientIds` / `tagIds` → thay toàn bộ liên kết đó.
router.patch("/:id", jsonBody, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, "Không tìm thấy món.");

  const input = validateDish(req.body, { partial: true });
  if (hasErrors(input.errors)) return validationFailed(res, input.errors);
  await checkDishRefs(prisma, input);
  if (hasErrors(input.errors)) return validationFailed(res, input.errors);

  const data = { ...input.data };
  if (input.ingredientIds !== undefined) {
    // deleteMany + create trong cùng lệnh update → Prisma chạy trong một transaction, không có lúc món mất hết nguyên liệu.
    data.ingredients = { deleteMany: {}, create: input.ingredientIds.map((ingredientId) => ({ ingredientId })) };
  }
  if (input.tagIds !== undefined) {
    data.tags = { deleteMany: {}, create: input.tagIds.map((tagId) => ({ tagId })) };
  }

  try {
    const updated = await prisma.dish.update({ where: { id }, data, include: detailInclude });
    ok(res, toDetail(updated));
  } catch (err) {
    // P2025: id không có bản ghi (hoặc vừa bị xoá) → lỗi nghiệp vụ NOT_FOUND, không phải 500.
    if (isNotFound(err)) return notFound(res, "Không tìm thấy món.");
    if (isForeignKeyViolation(err)) return refsChanged(res, input);
    throw err;
  }
});

// Xoá. Các dòng liên kết món–nguyên liệu tự xoá theo (onDelete: Cascade). Thành công: data = null.
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, "Không tìm thấy món.");
  try {
    await prisma.dish.delete({ where: { id } });
    ok(res, null);
  } catch (err) {
    if (isNotFound(err)) return notFound(res, "Không tìm thấy món.");
    throw err;
  }
});

// Kiểm tra lại để biết trường nào vừa thay đổi; nếu không tìm ra thì để error handler trả 500.
async function refsChanged(res, input) {
  await checkDishRefs(prisma, input);
  if (!hasErrors(input.errors)) throw new Error("Vi phạm khoá ngoại không xác định khi ghi món.");
  return validationFailed(res, input.errors);
}

export default router;
