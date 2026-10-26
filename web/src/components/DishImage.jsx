import { useState } from "react";

// Ảnh món (link ngoài, giấy phép mở — giữ từ block5). Không có link hoặc ảnh tải lỗi (link chết)
// → khung "Chưa có ảnh" thay vì icon ảnh vỡ. API chỉ nhận link http(s) nên src không thể là `javascript:`.
export default function DishImage({ src, alt = "", className, emptyText = "Chưa có ảnh", ...rest }) {
  // Ghi nhớ link nào đã lỗi: đổi sang link khác (form sửa) thì tự thử tải lại.
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || failedSrc === src) {
    return <span className={`${className ?? ""} no-photo`}>{emptyText}</span>;
  }
  return <img className={className} src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} {...rest} />;
}
