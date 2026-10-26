// REST API cho tài nguyên nguyên liệu: /api/ingredients. Cùng khuôn với chefs.js.
// Khác biệt do giữ khoá ngoại của block5 (dish_ingredients.ingredientId, onDelete: Restrict):
//   - tên nguyên liệu không được trùng
//   - nguyên liệu đang được món nào dùng thì KHÔNG cho xoá → IN_USE kèm danh sách món
import { Router } from "express";
import { prisma, isNotFound, isUniqueViolation, isForeignKeyViolation, nameTaken } from "../db.js";
import { ok, notFound, validationFailed, inUse } from "../http/respond.js";
import { jsonBody } from "../http/json-body.js";
import { parseId } from "../validators/id.js";
import { hasErrors, queryStr, searchWhere } from "../validators/common.js";
import { validateIngredient } from "../validators/ingredient.js";

const router = Router();

const NOT_FOUND = "Không tìm thấy nguyên liệu.";
const DUPLICATE = "Đã có nguyên liệu tên này.";
const withCount = { _count: { select: { dishes: true } } };
const toIngredient = ({ _count, ...ingredient }) => ({ ...ingredient, dishCount: _count.dishes });
const dishesUsing = (ingredientId) =>
  prisma.dish.findMany({
    where: { ingredients: { some: { ingredientId } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

// Danh sách, mỗi nguyên liệu kèm số món đang dùng (cột "Dùng trong N món" ở trang quản trị).
// ?q= (tìm kiếm admin, giữ từ block5): khớp tên HOẶC đơn vị, không phân biệt hoa thường.
router.get("/", async (req, res) => {
  const ingredients = await prisma.ingredient.findMany({
    where: searchWhere(queryStr(req.query.q), ["name", "unit"]),
    include: withCount,
    orderBy: { id: "asc" },
  });
  ok(res, ingredients.map(toIngredient));
});

// Chi tiết kèm các món đang dùng: trang xác nhận xoá dùng để liệt kê món cần bỏ nguyên liệu này trước.
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, NOT_FOUND);
  const ingredient = await prisma.ingredient.findUnique({ where: { id }, include: withCount });
  if (!ingredient) return notFound(res, NOT_FOUND);
  ok(res, { ...toIngredient(ingredient), dishes: await dishesUsing(id) });
});

router.post("/", jsonBody, async (req, res) => {
  const { data, errors } = validateIngredient(req.body);
  // Trùng tên (không phân biệt hoa thường: "tỏi" trùng "Tỏi") → VALIDATION_FAILED cạnh ô "Tên".
  if (!errors.name && (await nameTaken(prisma.ingredient, data.name))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return validationFailed(res, errors);

  try {
    const created = await prisma.ingredient.create({ data, include: withCount });
    ok(res, toIngredient(created));
  } catch (err) {
    if (isUniqueViolation(err)) return validationFailed(res, { name: DUPLICATE });
    throw err;
  }
});

router.patch("/:id", jsonBody, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, NOT_FOUND);

  const { data, errors } = validateIngredient(req.body, { partial: true });
  if (data.name !== undefined && (await nameTaken(prisma.ingredient, data.name, id))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return validationFailed(res, errors);

  try {
    const updated = await prisma.ingredient.update({ where: { id }, data, include: withCount });
    ok(res, toIngredient(updated));
  } catch (err) {
    if (isNotFound(err)) return notFound(res, NOT_FOUND);
    if (isUniqueViolation(err)) return validationFailed(res, { name: DUPLICATE });
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, NOT_FOUND);

  const ingredient = await prisma.ingredient.findUnique({ where: { id }, include: withCount });
  if (!ingredient) return notFound(res, NOT_FOUND);

  // Lớp 1 (app): còn món dùng → IN_USE, không gửi lệnh xoá xuống DB.
  if (ingredient._count.dishes > 0) return blockedByDishes(res, id);

  try {
    await prisma.ingredient.delete({ where: { id } });
    ok(res, null);
  } catch (err) {
    if (isNotFound(err)) return notFound(res, NOT_FOUND);
    // Lớp 2 (database): món vừa được gán nguyên liệu này ở tab khác → khoá ngoại Restrict chặn → IN_USE.
    if (isForeignKeyViolation(err)) return blockedByDishes(res, id);
    throw err;
  }
});

async function blockedByDishes(res, id) {
  return inUse(
    res,
    "Nguyên liệu đang được dùng trong món ăn nên không thể xoá. Hãy bỏ nguyên liệu khỏi các món này trước.",
    await dishesUsing(id),
  );
}

export default router;
