import { useCallback } from "react";
import { useSearchParams } from "react-router";

// Dòng vừa thêm/sửa trong bảng admin: form điều hướng về danh sách kèm ?msg=...&id=<id> → bảng tô nhẹ dòng đó
// để admin thấy ngay bản ghi mình vừa lưu. Chỉ tô khi còn thông báo (đóng thông báo = bỏ cả msg lẫn id).
// id trên URL ai cũng sửa được → chỉ nhận số nguyên dương và chỉ dùng để so sánh, không in ra trang.
export function useJustSaved() {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get("id") ?? "";
  const savedId = searchParams.has("msg") && /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;

  // Gắn vào <tr> được tô: dòng nằm ngoài màn hình (vd. món mới ở cuối bảng) thì cuộn tới; đang thấy thì đứng yên.
  // useCallback: ref ổn định → chỉ cuộn khi dòng xuất hiện, không cuộn lại mỗi lần render.
  const savedRowRef = useCallback((row) => row?.scrollIntoView({ block: "nearest" }), []);

  return { savedId, savedRowRef };
}
