// REST API cho tài nguyên món ăn: /api/dishes. Mọi kết quả handler xử lý được đều trả 200 + ok.
import { Router } from "express";
import { prisma, isNotFound, isForeignKeyViolation } from "../db.js";
import { ok, notFound, validationFailed } from "../http/respond.js";
import { jsonBody } from "../http/json-body.js";
import { parseId } from "../validators/id.js";
import { hasErrors } from "../validators/common.js";
import { validateDish, checkDishRefs } from "../validators/dish.js";
import { parseMenuFilters } from "../validators/menu-filters.js";

const router = Router();

// Dạng chi tiết: kèm đầu bếp phụ trách và nguyên liệu (bảng liên kết được "làm phẳng" thành mảng nguyên liệu).
const detailInclude = {
  chef: { select: { id: true, name: true, specialty: true } },
  ingredients: {
    select: { ingredient: { select: { id: true, name: true, unit: true } } },
    orderBy: { ingredient: { name: "asc" } },
  },
};
const toDetail = ({ ingredients, ...dish }) => ({ ...dish, ingredients: ingredients.map((link) => link.ingredient) });

// Danh sách. ?q= tìm theo tên (đúng đề bài); mở rộng từ block5: ?category=&price=&available=1&sort=,
// và ?searchIn=name,category cho trang admin. Danh sách rỗng vẫn là thành công: data = [].
router.get("/", async (req, res) => {
  // Loại đang có món trong DB: chỉ nhận ?category= thuộc danh sách này.
  const rows = await prisma.dish.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } });
  const { where, orderBy } = parseMenuFilters(req.query, rows.map((r) => r.category));
  const dishes = await prisma.dish.findMany({
    where,
    include: { chef: { select: { id: true, name: true } } },
    orderBy,
  });
  ok(res, dishes);
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
    // Nested create: món và các dòng liên kết nguyên liệu ghi trong cùng một lệnh (một transaction).
    const created = await prisma.dish.create({
      data: { ...input.data, ingredients: { create: input.ingredientIds.map((ingredientId) => ({ ingredientId })) } },
      include: detailInclude,
    });
    ok(res, toDetail(created));
  } catch (err) {
    // Đầu bếp/nguyên liệu vừa bị xoá ở tab khác giữa lúc kiểm tra và lúc ghi → khoá ngoại từ chối.
    if (isForeignKeyViolation(err)) return refsChanged(res, input);
    throw err;
  }
});

// Sửa (PATCH): chỉ các trường gửi lên được kiểm tra và ghi. Có `ingredientIds` → thay toàn bộ liên kết.
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
