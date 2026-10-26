import { useSearchParams } from "react-router";

// Thông báo sau khi lưu (giữ logic block5): ghi xong SPA điều hướng tới trang đích kèm ?msg=<mã>,
// trang đích tra bảng cố định này. Chỉ nhận mã có trong bảng — KHÔNG BAO GIỜ in thẳng nội dung từ URL ra trang
// (ai cũng sửa được URL). Reload vẫn thấy thông báo, như block5.
const FLASH = {
  "dish-created": "Đã thêm món mới.",
  "dish-updated": "Đã lưu thay đổi của món.",
  "dish-deleted": "Đã xoá món.",
  "chef-created": "Đã thêm đầu bếp.",
  "chef-updated": "Đã lưu thay đổi của đầu bếp.",
  "chef-deleted": "Đã xoá đầu bếp.",
  "chef-transferred": "Đã chuyển các món sang đầu bếp mới và xoá đầu bếp cũ.",
  "ingredient-created": "Đã thêm nguyên liệu.",
  "ingredient-updated": "Đã lưu thay đổi của nguyên liệu.",
  "ingredient-deleted": "Đã xoá nguyên liệu.",
};

export default function Flash() {
  const [searchParams, setSearchParams] = useSearchParams();
  const message = Object.hasOwn(FLASH, searchParams.get("msg") ?? "") ? FLASH[searchParams.get("msg")] : null;
  if (!message) return null;

  // Đóng = bỏ msg (và id của dòng được tô) khỏi URL. replace: không thêm mục lịch sử → Back không hiện lại
  // thông báo vừa đóng; Reload sau khi đóng cũng không hiện nữa. Các tham số khác (vd. q) giữ nguyên.
  function close() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("msg");
        next.delete("id");
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="flash" role="status">
      <span>{message}</span>
      <button type="button" className="flash-close" onClick={close} aria-label="Đóng thông báo">
        ×
      </button>
    </div>
  );
}
