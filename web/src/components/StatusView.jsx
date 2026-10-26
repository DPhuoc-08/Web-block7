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

// Khung xương khi đang tải danh sách (thực đơn, bảng admin món — plan mục 7.4): giữ chỗ đúng hình dạng kết quả,
// dữ liệu về thì thay vào mà trang không bị nhảy. Trình đọc màn hình chỉ nghe "Đang tải…", các thanh xám bị ẩn.
// Mặc định 12 dòng = một trang thực đơn: chuyển trang thì cuộn về đầu danh sách NGAY lúc đang tải; khung xương ngắn
// hơn danh sách thật làm trang thấp đi, trình duyệt không cuộn tới được đầu danh sách (đo ở bước 15).
export function SkeletonList({ rows = 12, variant = "menu" }) {
  return (
    <div className={`skeleton-list ${variant}`} role="status" aria-live="polite">
      <span className="sr-only">Đang tải…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" aria-hidden="true">
          <span className="sk sk-thumb" />
          <span className="sk-lines">
            <span className="sk sk-line" />
            <span className="sk sk-line short" />
          </span>
          <span className="sk sk-price" />
        </div>
      ))}
    </div>
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

// Điều kiện trên URL không hợp lệ (API trả VALIDATION_FAILED, vd. ?page=0 hay ?minPrice=abc do sửa tay URL):
// không phải lỗi máy chủ nên không có "Thử lại" — chỉ ra điều kiện sai và link về danh sách mặc định.
export function InvalidQuery({ fields = {}, resetTo, resetLabel = "Xoá điều kiện" }) {
  const messages = Object.values(fields);
  return (
    <div className="panel empty" role="alert">
      <strong>Điều kiện tìm không hợp lệ</strong>
      {messages.length > 0 && (
        <ul className="invalid-list">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <Link className="btn" to={resetTo}>
        {resetLabel}
      </Link>
    </div>
  );
}
