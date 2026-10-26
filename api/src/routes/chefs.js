// REST API cho tài nguyên đầu bếp: /api/chefs. Cùng khuôn với dishes.js.
// Khác biệt do giữ khoá ngoại của block5 (dishes.chefId, onDelete: Restrict):
//   - tên đầu bếp không được trùng (để danh sách chọn đầu bếp trong form món không bị lẫn)
//   - xoá đầu bếp còn món: phải chọn người nhận (?transferTo=<id>), chuyển món + xoá trong một transaction
import { Router } from "express";
import { prisma, isNotFound, isUniqueViolation, isForeignKeyViolation, nameTaken } from "../db.js";
import { ok, notFound, validationFailed, inUse } from "../http/respond.js";
import { jsonBody } from "../http/json-body.js";
import { parseId } from "../validators/id.js";
import { hasErrors, queryStr, searchWhere } from "../validators/common.js";
import { validateChef } from "../validators/chef.js";

const router = Router();

const NOT_FOUND = "Không tìm thấy đầu bếp.";
const DUPLICATE = "Đã có đầu bếp tên này.";
const withCount = { _count: { select: { dishes: true } } };
const toChef = ({ _count, ...chef }) => ({ ...chef, dishCount: _count.dishes });
const dishesOf = (chefId) =>
  prisma.dish.findMany({ where: { chefId }, select: { id: true, name: true }, orderBy: { name: "asc" } });

// Danh sách, mỗi đầu bếp kèm số món đang phụ trách (cột "Phụ trách N món" ở trang quản trị).
// ?q= (tìm kiếm admin, giữ từ block5): khớp tên HOẶC chuyên môn, không phân biệt hoa thường.
router.get("/", async (req, res) => {
  const chefs = await prisma.chef.findMany({
    where: searchWhere(queryStr(req.query.q), ["name", "specialty"]),
    include: withCount,
    orderBy: { id: "asc" },
  });
  ok(res, chefs.map(toChef));
});

// Chi tiết kèm các món đang phụ trách: trang xác nhận xoá dùng để liệt kê món cần chuyển.
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, NOT_FOUND);
  const chef = await prisma.chef.findUnique({ where: { id }, include: withCount });
  if (!chef) return notFound(res, NOT_FOUND);
  ok(res, { ...toChef(chef), dishes: await dishesOf(id) });
});

router.post("/", jsonBody, async (req, res) => {
  const { data, errors } = validateChef(req.body);
  // Trùng tên (không phân biệt hoa thường) là lỗi của ô "Tên" → VALIDATION_FAILED, hiện cạnh ô nhập.
  if (!errors.name && (await nameTaken(prisma.chef, data.name))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return validationFailed(res, errors);

  try {
    const created = await prisma.chef.create({ data, include: withCount });
    ok(res, toChef(created));
  } catch (err) {
    // Hai request cùng lưu một tên gần như cùng lúc: @unique ở database chặn request sau.
    if (isUniqueViolation(err)) return validationFailed(res, { name: DUPLICATE });
    throw err;
  }
});

router.patch("/:id", jsonBody, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, NOT_FOUND);

  const { data, errors } = validateChef(req.body, { partial: true });
  if (data.name !== undefined && (await nameTaken(prisma.chef, data.name, id))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return validationFailed(res, errors);

  try {
    const updated = await prisma.chef.update({ where: { id }, data, include: withCount });
    ok(res, toChef(updated));
  } catch (err) {
    if (isNotFound(err)) return notFound(res, NOT_FOUND);
    if (isUniqueViolation(err)) return validationFailed(res, { name: DUPLICATE });
    throw err;
  }
});

// Xoá. ?transferTo=<id> là ĐIỀU KIỆN của thao tác xoá (đầu bếp nhận món), nên đi qua query string, không qua body.
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res, NOT_FOUND);

  const chef = await prisma.chef.findUnique({ where: { id }, include: withCount });
  if (!chef) return notFound(res, NOT_FOUND);

  // Không còn món nào: xoá thẳng (transferTo nếu có thì bỏ qua).
  if (chef._count.dishes === 0) {
    try {
      await prisma.chef.delete({ where: { id } });
      return ok(res, null);
    } catch (err) {
      if (isNotFound(err)) return notFound(res, NOT_FOUND);
      // Vừa có món được gán cho đầu bếp này ở tab khác → khoá ngoại Restrict chặn.
      if (isForeignKeyViolation(err)) return blockedByDishes(res, id);
      throw err;
    }
  }

  // Còn món mà chưa chọn người nhận → IN_USE kèm danh sách món (lỗi nghiệp vụ: 200, không phải 409 như block5).
  const rawTarget = queryStr(req.query.transferTo);
  if (!rawTarget) return blockedByDishes(res, id);

  const targetId = parseId(rawTarget);
  const target =
    targetId !== null && targetId !== id
      ? await prisma.chef.findUnique({ where: { id: targetId }, select: { id: true } })
      : null;
  if (!target) return validationFailed(res, { transferTo: "Đầu bếp nhận món không hợp lệ, vui lòng chọn lại." });

  try {
    // Một transaction: chuyển TẤT CẢ món hiện có (kể cả món vừa được gán) sang người nhận, rồi xoá đầu bếp.
    // Bước nào lỗi thì cả hai cùng huỷ — không bao giờ có cảnh đã chuyển món mà chưa xoá, hay ngược lại.
    await prisma.$transaction([
      prisma.dish.updateMany({ where: { chefId: id }, data: { chefId: targetId } }),
      prisma.chef.delete({ where: { id } }),
    ]);
    ok(res, null);
  } catch (err) {
    if (isNotFound(err)) return notFound(res, NOT_FOUND);
    // Người nhận vừa bị xoá ở tab khác → khoá ngoại chặn khi chuyển món.
    if (isForeignKeyViolation(err)) {
      return validationFailed(res, { transferTo: "Đầu bếp nhận món vừa bị xoá, vui lòng chọn người khác." });
    }
    throw err;
  }
});

async function blockedByDishes(res, id) {
  return inUse(
    res,
    "Đầu bếp đang phụ trách món. Hãy chọn người nhận các món trước khi xoá.",
    await dishesOf(id),
  );
}

export default router;
