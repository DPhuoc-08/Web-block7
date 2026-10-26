import { Link } from "react-router";

// Giao diện cho các trạng thái tải dữ liệu không phải "ok". Trang tồn tại TRƯỚC khi có dữ liệu,
// nên phải có hình dạng cho lúc chờ, lúc không tìm thấy và lúc lỗi — tránh trang trắng khi API tắt.

export function Loading({ text = "Đang tải…" }) {
  return (
    <p className="loading" role="status" aria-live="polite">
      {text}
    </p>
  );
}

// Lỗi kỹ thuật (API tắt, sai URL, lỗi máy chủ): thông báo chung + Thử lại. Không hiện "không tìm thấy".
export function LoadError({ onRetry }) {
  return (
    <div className="message" role="alert">
      <div className="code">!</div>
      <h1>Không tải được dữ liệu</h1>
      <p className="muted">Máy chủ đang gặp sự cố hoặc không kết nối được. Vui lòng thử lại.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

// Không tìm thấy: route của SPA không khớp, hoặc API trả NOT_FOUND cho id trên URL.
export function NotFoundMessage({ title = "Không tìm thấy trang", text = "Trang hoặc bản ghi bạn tìm không tồn tại.", backTo = "/dishes", backLabel = "Về thực đơn" }) {
  return (
    <div className="message">
      <div className="code">404</div>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      <Link className="btn btn-primary" to={backTo}>
        {backLabel}
      </Link>
    </div>
  );
}
