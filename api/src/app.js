import "dotenv/config";
import express from "express";
import cors from "cors";
import dishesRouter from "./routes/dishes.js";
import tagsRouter from "./routes/tags.js";
import chefsRouter from "./routes/chefs.js";
import ingredientsRouter from "./routes/ingredients.js";

// Origin của SPA đọc từ cấu hình (đổi khi triển khai, không sửa code).
// Kiểm tra ngay lúc khởi động: thiếu, dùng "*" hoặc có "/" cuối đều làm CORS sai một cách khó thấy.
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin || corsOrigin.includes("*") || corsOrigin.endsWith("/")) {
  throw new Error('CORS_ORIGIN trong .env phải là origin cụ thể của SPA, vd. "http://localhost:5173" (không "*", không "/" cuối).');
}

const app = express();

// CORS đặt ĐẦU TIÊN: mọi response (kể cả 404, 500) đều có Access-Control-Allow-Origin,
// nếu không SPA sẽ thấy lỗi hệ thống thành "lỗi CORS" và không đọc được status.
// Preflight OPTIONS được trả lời 204 kèm Allow-Methods và Allow-Headers (cần cho body JSON).
// `origin` dạng mảng: chỉ gửi Access-Control-Allow-Origin khi Origin của request khớp; origin lạ không nhận header nào.
app.use(
  cors({
    origin: [corsOrigin],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  }),
);

// Tài nguyên REST: URL là danh từ số nhiều, method HTTP cho biết thao tác.
app.use("/api/dishes", dishesRouter);
app.use("/api/chefs", chefsRouter);
app.use("/api/ingredients", ingredientsRouter);
app.use("/api/tags", tagsRouter);

// Bước 1: không route nào khớp URL + method → lỗi kỹ thuật 404, body không theo response shape.
app.use((req, res) => {
  res.status(404).json({ message: `Không có endpoint ${req.method} ${req.path}` });
});

// Express 5 tự chuyển lỗi của handler async tới đây.
// - Lỗi có status 4xx do middleware đặt (body không đọc được) → giữ status đó.
// - Còn lại (mất kết nối DB, bug) → 500. Không bọc thành ok:false: đó là lỗi hệ thống, không phải nghiệp vụ.
// Stack chỉ ghi log server; response chỉ có câu chung, không lộ chi tiết DB hay chuỗi kết nối.
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) {
    console.error(err);
    return res.status(500).json({ message: "Lỗi hệ thống." });
  }
  res.status(status).json({ message: err.expose ? err.message : "Request không hợp lệ." });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API chạy tại http://localhost:${port} (CORS cho ${corsOrigin})`);
});
