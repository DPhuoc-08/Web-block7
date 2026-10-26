// GET /api/categories — chỉ đọc. Giữ đúng hai cách dùng loại món của block5:
// - all:  danh sách cố định CATEGORIES → select trong form thêm/sửa món (cũng là danh sách API dùng để validate)
// - used: các loại đang có món trong DB, sắp A→Z (như `distinct` của block5) → chip lọc ở thực đơn
import { Router } from "express";
import { prisma } from "../db.js";
import { ok } from "../http/respond.js";
import { CATEGORIES } from "../validators/dish.js";

const router = Router();

router.get("/", async (req, res) => {
  const rows = await prisma.dish.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  ok(res, { all: CATEGORIES, used: rows.map((row) => row.category) });
});

export default router;
