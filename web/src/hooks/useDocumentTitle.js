import { useEffect } from "react";

// SPA không tải trang mới nên <title> không tự đổi: mỗi trang tự đặt tiêu đề tab.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Nhà hàng` : "Nhà hàng";
  }, [title]);
}
