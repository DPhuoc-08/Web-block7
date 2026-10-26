import { useEffect, useRef } from "react";

// Phần tử canh (sentinel) đặt SAU danh sách: đi vào vùng nhìn (sớm 200px) → gọi onVisible() = loadNext() dùng chung
// với nút Tải thêm. Theo dõi một phần tử duy nhất, không gắn observer cho từng món.
// - disabled (đang có lỗi hoặc đã hết): ngắt observer → không tự gọi API liên tục khi mạng lỗi.
// - Danh sách chưa đủ cao (sentinel vẫn nằm trong vùng nhìn sau khi nối): observer không báo lại vì trạng thái
//   "đang giao" không đổi → sau mỗi lần tải xong (itemCount đổi) tự kiểm tra lại và tải tiếp, tuần tự từng trang.
// - Rời trang / đổi điều kiện: cleanup disconnect.
export default function InfiniteSentinel({ onVisible, disabled, itemCount }) {
  const ref = useRef(null);
  const visible = useRef(false);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    if (disabled || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        visible.current = entries.some((entry) => entry.isIntersecting);
        if (visible.current) onVisibleRef.current();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [disabled]);

  useEffect(() => {
    if (!disabled && visible.current) onVisibleRef.current();
  }, [itemCount, disabled]);

  return <div ref={ref} className="sentinel" aria-hidden="true" />;
}
