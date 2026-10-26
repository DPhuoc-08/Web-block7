// Cột Int của PostgreSQL: giá trị lớn nhất 2^31 - 1.
export const MAX_INT = 2147483647;

// Body JSON GIỮ KIỂU (khác form HTML của block5, nơi mọi giá trị là chuỗi):
// giá phải là number, id phải là number, available phải là boolean. Sai kiểu → VALIDATION_FAILED.

// Trường có được gửi lên không (PATCH chỉ kiểm tra các trường được gửi).
export const has = (body, key) => Object.hasOwn(body, key) && body[key] !== undefined;

// Bỏ trống: không gửi, null, hoặc chuỗi toàn khoảng trắng.
export const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// Id trong body (chefId, ingredientIds, transferTo): số nguyên dương trong giới hạn cột Int.
export const isIdNumber = (v) => Number.isInteger(v) && v > 0 && v <= MAX_INT;

// Trường chữ bắt buộc (name): trả { value } hoặc { error }.
export function requiredText(v, emptyMessage) {
  if (isBlank(v)) return { error: emptyMessage };
  if (typeof v !== "string") return { error: "Giá trị phải là chuỗi ký tự." };
  return { value: v.trim() };
}

// Trường chữ không bắt buộc (description, specialty, unit): chuỗi rỗng / null → lưu null, không lưu "".
export function optionalText(v) {
  if (v === null) return { value: null };
  if (typeof v !== "string") return { error: "Giá trị phải là chuỗi ký tự." };
  return { value: v.trim() || null };
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;

// Query string (?q=...): chỉ nhận khi là chuỗi. `?q=a&q=b` cho ra mảng → coi như không có (tránh lỗi 500 ở Prisma).
export const queryStr = (v) => (typeof v === "string" ? v.trim() : "");

// Điều kiện tìm kiếm: từ khoá khớp (không phân biệt hoa thường) ở BẤT KỲ cột nào trong `fields`.
// Không có từ khoá → {} (lấy tất cả). Prisma gửi `q` dạng tham số, không nối vào SQL.
export const searchWhere = (q, fields) =>
  q ? { OR: fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" } })) } : {};
