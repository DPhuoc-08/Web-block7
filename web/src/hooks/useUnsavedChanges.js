import { useEffect, useRef } from "react";
import { useBlocker } from "react-router";

// Form đang sửa dở (`dirty`) mà người dùng rời trang → hỏi trước, tránh mất dữ liệu đã nhập.
// - Đổi trang trong app (link, Huỷ, tab, Back): useBlocker chặn điều hướng phía client → trang hiện hộp xác nhận
//   (components/LeaveConfirm.jsx).
// - Reload, đóng tab, gõ URL khác: document bị thay, router không chặn được → beforeunload, browser tự hiện hộp hỏi
//   (chữ trong hộp do browser quyết định, không đổi được).
//
// Lưu thành công rồi navigate → gọi allowLeave() ngay trước: lúc đó `dirty` vẫn là true (state chưa kịp render lại),
// nên phải dùng ref để bỏ chặn ngay lập tức.
export function useUnsavedChanges(dirty) {
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event) => {
      // Đã lưu: form có thể chưa kịp gỡ khỏi trang (URL đổi trước, trang mới render sau) → không hỏi nữa.
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = ""; // browser cũ cần gán returnValue mới hiện hộp hỏi
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return {
    blocker,
    allowLeave: () => {
      leaving.current = true;
    },
  };
}
