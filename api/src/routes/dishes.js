// REST API cho tài nguyên món ăn: /api/dishes. Mọi kết quả handler xử lý được đều trả 200 + ok.
import { Router } from "express";
import { prisma, isNotFound, isForeignKeyViolation } from "../db.js";
import { ok, notFound, validationFailed } from "../http/respond.js";
import { jsonBody } from "../http/json-body.js";
import { parseId } from "../validators/id.js";
import { hasErrors } from "../validators/common.js";
import { validateDish, checkDishRefs } from "../validators/dish.js";
import { parseMenuFilters } from "../validators/menu-filters.js";
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

// Danh sách. ?q= tìm theo tên (đúng đề bài); mở rộng từ block5: ?tag=&price=&available=1&sort=,
// và ?searchIn=name,tag cho trang admin. Danh sách rỗng vẫn là thành công: data = [].
// (Bước 7 của plan đổi sang phân trang + 4 chế độ search; bước 3 chỉ đổi loại món → tag.)
router.get("/", async (req, res) => {
  const { where, orderBy } = parseMenuFilters(req.query);
  const dishes = await prisma.dish.findMany({ where, include: listInclude, orderBy });
  ok(res, dishes.map(toListItem));
});

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
