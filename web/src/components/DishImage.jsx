import { useState } from "react";
import DishArt from "./DishArt.jsx";

// Ảnh món (link ngoài, giấy phép mở — giữ từ block5). Không có link hoặc ảnh tải lỗi (link chết):
// - truyền `tags` (thực đơn, chi tiết, bảng admin) → hình minh hoạ theo loại món (DishArt, plan mục 13);
// - không truyền (form xem trước ảnh) → khung chữ `emptyText` như cũ.
// API chỉ nhận link http(s) nên src không thể là `javascript:`.
export default function DishImage({ src, alt = "", className, emptyText = "Chưa có ảnh", tags, label = false, ...rest }) {
  // Ghi nhớ link nào đã lỗi: đổi sang link khác (form sửa) thì tự thử tải lại.
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || failedSrc === src) {
    if (tags) return <DishArt tags={tags} className={className} label={label} />;
    return <span className={`${className ?? ""} no-photo`}>{emptyText}</span>;
  }
  return <img className={className} src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} {...rest} />;
}
