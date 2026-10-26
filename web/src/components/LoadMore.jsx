import { generalMessage } from "./FormBits.jsx";

// Cuối danh sách nối thêm (Tải thêm / Cuộn vô hạn): nút "Tải thêm", trạng thái đang tải, hết dữ liệu, lỗi + Thử lại.
// Ở chế độ cuộn vô hạn nút vẫn hiện làm lối dự phòng (bàn phím, trình đọc màn hình, khi muốn tới footer).
// Đang tải thì khoá nút; loadNext() cũng tự chặn gửi trùng (useAppendList), nút khoá chỉ để người dùng thấy.
export default function LoadMore({ pending, end, error, shown, total, onLoad }) {
  if (end) {
    return (
      <p className="load-end muted" role="status">
        Đã hiện hết {total} món.
      </p>
    );
  }
  return (
    <div className="load-more">
      {error && (
        <p className="alert" role="alert">
          {generalMessage(error)} Các món đã hiện vẫn được giữ.
        </p>
      )}
      <button type="button" className="btn" onClick={onLoad} disabled={pending} aria-busy={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? "Đang tải thêm…" : error ? "Thử lại" : "Tải thêm"}
      </button>
      {total !== null && (
        <span className="muted load-count" role="status" aria-live="polite">
          Đã hiện {shown}/{total} món
        </span>
      )}
    </div>
  );
}
