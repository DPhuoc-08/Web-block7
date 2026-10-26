// Một PrismaClient dùng chung cho cả app: tạo nhiều client sẽ mở nhiều pool kết nối tới Supabase.
// Chỉ dùng ở server: chuỗi kết nối nằm trong api/.env, không bao giờ xuất hiện trong response JSON hay mã của SPA.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

// Supabase pooler bắt buộc SSL và dùng chứng chỉ do Supabase tự cấp (Node không tin sẵn).
// Nạp CA của Supabase để kết nối vừa mã hoá vừa xác minh đúng server, thay vì tắt kiểm tra chứng chỉ.
const ca = readFileSync(new URL("../certs/supabase-ca.crt", import.meta.url), "utf8");

// Prisma 7 bắt buộc driver adapter; adapter-pg dùng thư viện `pg` để nói chuyện với PostgreSQL.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { ca } });

// LOG_SQL=1 trong .env: in từng câu SQL Prisma thực sự gửi tới PostgreSQL (kèm tham số và thời gian) — bằng chứng nộp
// cho thấy LIMIT/OFFSET, COUNT, ILIKE, tsquery, similarity chạy TẠI DATABASE (plan mục 5, 9). Mặc định tắt.
// Log chỉ có câu SQL và giá trị tham số (từ khoá, số trang), không có chuỗi kết nối.
const logSql = process.env.LOG_SQL === "1";
export const prisma = new PrismaClient({ adapter, log: logSql ? [{ emit: "event", level: "query" }] : [] });
if (logSql) {
  prisma.$on("query", (e) => console.log(`[SQL ${Math.round(Number(e.duration))}ms] ${e.query}\n          params: ${e.params}`));
}

// Ba lỗi Prisma dưới đây là lỗi NGHIỆP VỤ đã biết trước (do dữ liệu, không phải hệ thống hỏng),
// nên route bắt riêng và trả 200 + ok:false. Mọi lỗi khác để đi tới error handler chung → 500.
// P2025: update/delete vào bản ghi không còn tồn tại (vd. vừa bị xoá ở tab khác) → NOT_FOUND.
export const isNotFound = (err) => err?.code === "P2025";
// P2002: vi phạm @unique (vd. 2 người cùng lưu một tên ở 2 tab) → VALIDATION_FAILED, fields.name.
export const isUniqueViolation = (err) => err?.code === "P2002";
// P2003: vi phạm khoá ngoại → khi xoá: IN_USE; khi tạo/sửa món (đầu bếp/nguyên liệu vừa bị xoá): VALIDATION_FAILED.
export const isForeignKeyViolation = (err) => err?.code === "P2003";

// Tên đã có (không phân biệt hoa thường) ở bản ghi khác chưa? `delegate` = prisma.chef / prisma.ingredient / prisma.tag.
// @unique trong schema phân biệt hoa thường, nên kiểm tra thêm ở app để "tỏi" không trùng với "Tỏi".
export async function nameTaken(delegate, name, excludeId = null) {
  const found = await delegate.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}
