// REST API cho tag: /api/tags. Tag dùng chung cho loại món và chuyên môn đầu bếp.
// Chỉ có đọc danh sách và thêm mới (nhóm chốt: tag không sửa, không xoá) → không có /:id.
import { Router } from "express";
import { prisma, isUniqueViolation, nameTaken } from "../db.js";
import { ok, validationFailed } from "../http/respond.js";
import { jsonBody } from "../http/json-body.js";
import { hasErrors } from "../validators/common.js";
import { validateTag } from "../validators/tag.js";

const router = Router();

const DUPLICATE = "Đã có tag tên này.";
const withCount = { _count: { select: { dishes: true, chefs: true } } };
const toTag = ({ _count, ...tag }) => ({ ...tag, dishCount: _count.dishes, chefCount: _count.chefs });

// Danh sách A→Z, kèm số món / số đầu bếp dùng tag:
// SPA dùng cho ô chọn tag trong form, và chip lọc ở thực đơn (chỉ tag có dishCount > 0).
router.get("/", async (req, res) => {
  const tags = await prisma.tag.findMany({ include: withCount, orderBy: { name: "asc" } });
  ok(res, tags.map(toTag));
});

// Thêm tag mới ngay trong form món / form đầu bếp. Trùng tên không phân biệt hoa thường
// ("món nước" trùng "Món nước") → VALIDATION_FAILED cạnh ô tên, không tạo tag thứ hai.
router.post("/", jsonBody, async (req, res) => {
  const { data, errors } = validateTag(req.body);
  if (!errors.name && (await nameTaken(prisma.tag, data.name))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return validationFailed(res, errors);

  try {
    const created = await prisma.tag.create({ data, include: withCount });
    ok(res, toTag(created));
  } catch (err) {
    // Hai người cùng thêm một tên gần như cùng lúc: @unique ở database chặn request sau.
    if (isUniqueViolation(err)) return validationFailed(res, { name: DUPLICATE });
    throw err;
  }
});

export default router;
