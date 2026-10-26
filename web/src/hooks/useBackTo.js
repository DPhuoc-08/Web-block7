import { useLocation } from "react-router";

// URL danh sách để quay về sau khi sửa / xoá: bảng admin truyền URL đang xem (có ?page=, ?q=) qua state của Link
// → admin quay về đúng trang đang làm việc, không bị đưa về trang 1. Mở thẳng / tab mới thì không có state → `base`.
// state có thể bị sửa (history API) → chỉ nhận URL bắt đầu bằng `base` (không điều hướng ra trang lạ).
export function useBackTo(base) {
  const backTo = useLocation().state?.backTo;
  return typeof backTo === "string" && (backTo === base || backTo.startsWith(`${base}?`)) ? backTo : base;
}

// Gắn thông báo sau khi lưu vào URL danh sách: thay ?msg=, ?id= cũ (nếu có), giữ các tham số khác (page, q).
export function withFlash(url, flash) {
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.delete("msg");
  params.delete("id");
  for (const [key, value] of Object.entries(flash)) params.set(key, value);
  return `${path}?${params}`;
}
