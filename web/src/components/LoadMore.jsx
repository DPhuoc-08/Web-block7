import { generalMessage } from "./FormBits.jsx";

// Cuối danh sách nối thêm (Tải thêm / Cuộn vô hạn): nút "Tải thêm", trạng thái đang tải, hết dữ liệu, lỗi + Thử lại.
// Ở chế độ cuộn vô hạn nút vẫn hiện làm lối dự phòng (bàn phím, trình đọc màn hình, khi muốn tới footer).
// Đang tải thì khoá nút; loadNext() cũng tự chặn gửi trùng (useAppendList), nút khoá chỉ để người dùng thấy.
// Trang khách không hiện số đếm (plan 13.4): bỏ "Đã hiện N/total món"; hết danh sách ghi một câu không số.
export default function LoadMore({ pending, end, error, onLoad }) {
  if (end) {
    return (
      <p className="load-end muted" role="status">
        Bạn đã xem hết danh sách.
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
    </div>
  );
}
