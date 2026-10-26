import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Cổng cố định: origin http://localhost:5173 phải khớp CORS_ORIGIN của api.
  // strictPort: cổng bận thì báo lỗi thay vì tự chuyển sang 5174 (origin khác → bị CORS chặn).
  // Không cấu hình proxy `/api`: SPA gọi thẳng API ở origin khác, CORS do API xử lý (yêu cầu của bài).
  // Fallback index.html cho URL sâu (/dishes/2, /admin/...) là mặc định của Vite (appType "spa").
  server: { port: 5173, strictPort: true },
  // `vite preview` (chạy bản build) dùng cùng cổng để dùng chung cấu hình CORS của api.
  preview: { port: 5173, strictPort: true },
});
