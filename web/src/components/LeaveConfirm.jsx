import { useEffect, useRef } from "react";

// Hộp xác nhận khi rời form chưa lưu (blocker lấy từ hooks/useUnsavedChanges.js).
// <dialog> + showModal(): browser tự khoá phần nền, giữ focus trong hộp, Esc = huỷ → coi như "Ở lại".
// Nút mặc định (được focus) là "Ở lại": bấm Enter vội cũng không làm mất dữ liệu.
export default function LeaveConfirm({ blocker }) {
  const ref = useRef(null);
  const open = blocker.state === "blocked";

  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="leave-confirm"
      aria-labelledby="leave-title"
      onCancel={(event) => {
        event.preventDefault();
        blocker.reset();
      }}
    >
      <h2 id="leave-title">Rời trang khi chưa lưu?</h2>
      <p className="muted">Những thay đổi bạn vừa nhập trong form sẽ bị mất.</p>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" autoFocus onClick={() => blocker.reset()}>
          Ở lại sửa tiếp
        </button>
        <button type="button" className="btn btn-danger" onClick={() => blocker.proceed()}>
          Rời trang
        </button>
      </div>
    </dialog>
  );
}
