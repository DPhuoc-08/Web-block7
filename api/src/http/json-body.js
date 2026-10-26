import express from "express";

// Lỗi kỹ thuật "body không đọc được" → 400, body KHÔNG theo response shape (không có `ok`).
class BodyError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.expose = true;
  }
}

// Bước 2 trong "một request đi qua API": chỉ chạy SAU khi route đã khớp (gắn vào từng route POST/PATCH,
// không đặt toàn cục) → sai URL luôn là 404 trước, dù body có hỏng.
// - Thiếu `Content-Type: application/json` (hoặc không có body): server không biết cách đọc body → 400.
// - JSON hỏng: express.json() ném lỗi status 400 → error handler trả 400.
// - JSON hợp lệ nhưng không phải object (mảng, số...): coi như {} → các trường thiếu thành VALIDATION_FAILED.
export const jsonBody = [
  (req, res, next) => {
    if (!req.is("application/json")) {
      return next(new BodyError("Body phải là JSON và có header Content-Type: application/json."));
    }
    next();
  },
  express.json(),
  (req, res, next) => {
    const b = req.body;
    if (b === null || typeof b !== "object" || Array.isArray(b)) req.body = {};
    next();
  },
];
