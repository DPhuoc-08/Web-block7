import { useEffect, useRef } from "react";

// Chuyển trang (số trang ở thực đơn, bảng admin món): nút phân trang nằm cuối danh sách → đưa đầu danh sách vào
// màn hình và chuyển focus tới đó, để người dùng bàn phím / trình đọc màn hình bắt đầu từ kết quả mới thay vì
// đứng ở cái nút vừa biến mất cùng trang cũ. Lần mở trang đầu tiên không cuộn, không cướp focus.
// Cuộn mượt (plan mục 7.4), trừ khi người dùng bật "giảm chuyển động" trong hệ điều hành.
// Phần tử gắn ref cần tabIndex={-1} để nhận focus bằng code mà không thêm một điểm dừng Tab.
export function useListTop(page) {
  const ref = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) return void (firstRender.current = false);
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [page]);
  return ref;
}
