import { useEffect, useRef, useState } from "react";

// Gửi form bị lỗi → đưa người dùng tới chỗ lỗi đầu tiên. Form món dài: nút Lưu ở cuối, lỗi có thể nằm giữa
// hoặc thông báo ở đầu form đã khuất khỏi màn hình.
//
// `panelRef` gắn vào khung chứa cả thông báo đầu form và các ô; gọi `showFirstError()` mỗi lần gửi bị lỗi
// (SPA chặn ô trống, API trả VALIDATION_FAILED, lỗi kỹ thuật). Phải chờ render xong mới có class `invalid`
// trên ô → tìm trong effect, không tìm ngay trong onSubmit. Sửa từng ô không gọi lại nên con trỏ không bị kéo đi.
export function useFocusFirstError() {
  const panelRef = useRef(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt === 0 || !panelRef.current) return;
    // Ô lỗi đầu tiên theo thứ tự trên trang (với nhóm radio/checkbox: ô đầu của nhóm).
    // Ô phụ trợ nằm trong nhóm (ô tìm nguyên liệu, khung thêm nhanh) đánh dấu data-skip-error-focus để bị bỏ qua.
    const field = panelRef.current.querySelector(".invalid :is(input, select, textarea):not([data-skip-error-focus])");
    if (field) {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ block: "center" });
      return;
    }
    // Lỗi không thuộc ô nào (mạng, máy chủ, khoá lạ trong fields) → cuộn tới thông báo đầu form.
    panelRef.current.querySelector(".alert")?.scrollIntoView({ block: "center" });
  }, [attempt]);

  return { panelRef, showFirstError: () => setAttempt((n) => n + 1) };
}
