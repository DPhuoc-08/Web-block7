import { useEffect, useState } from "react";
import { isBusiness } from "../api/client.js";

const LOADING = { status: "loading", data: null, error: null };

// Mỗi trang tự tải dữ liệu của nó khi mở (không dùng kho trạng thái toàn cục): dữ liệu luôn đọc lại từ API,
// sửa ở trang khác xong quay lại không bị hiện bản cũ.
//
// `load(signal)` gọi hàm trong api/*.js; `deps` là các giá trị lấy từ URL (id, query) — đổi thì tải lại.
// Trạng thái trả về:
//   loading  — đang chờ API (trang đã hiện trước khi có dữ liệu)
//   ok       — có data (danh sách rỗng vẫn là ok; trang tự hiện trạng thái rỗng)
//   notFound — API trả lỗi nghiệp vụ NOT_FOUND (theo error.code, KHÔNG theo status 404)
//   error    — lỗi kỹ thuật (tầng 1, 2) hoặc lỗi nghiệp vụ khác → thông báo chung + nút Thử lại
export function useLoad(load, deps) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...deps, attempt]);
  // Kết quả gắn với `key` của lần tải tạo ra nó.
  const [result, setResult] = useState({ key: null, ...LOADING });

  useEffect(() => {
    // Đổi id/query khi request cũ chưa về: huỷ request cũ để response cũ không ghi đè response mới.
    const controller = new AbortController();

    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key, status: "ok", data, error: null });
      },
      (error) => {
        if (controller.signal.aborted) return;
        const status = isBusiness(error, "NOT_FOUND") ? "notFound" : "error";
        setResult({ key, status, data: null, error });
      },
    );

    // React StrictMode (chế độ dev) chạy effect 2 lần: request đầu bị huỷ ở đây → Network thấy 2 request, không phải lỗi.
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Kết quả của URL cũ (id/query trước) không bao giờ được hiện cho URL mới: deps đã đổi mà chưa có kết quả mới
  // → "loading" ngay trong lần render đầu tiên sau khi URL đổi.
  const state = result.key === key ? result : LOADING;
  return { status: state.status, data: state.data, error: state.error, reload: () => setAttempt((n) => n + 1) };
}
