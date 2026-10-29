import { Link, useLocation } from "react-router";
import { formatMenuPrice, tagNames } from "../format.js";
import DishImage from "./DishImage.jsx";

// Một thẻ món trên thực đơn (plan mục 13, bản phác Figma). Một component cho mọi cỡ màn hình, CSS đổi bố cục:
// ≥ 1024px lưới 3 cột, 601–1023px 2 cột, ≤ 600px dòng món ảnh 96px (13.i).
// Link chỉ mang id (path param /dishes/:id); trang chi tiết tự tải lại món từ API theo id.
// state.backTo: URL danh sách đang lọc → nút "← Thực đơn" ở trang chi tiết quay về đúng bộ lọc này.
// Tag đầu tiên (loại món — API sắp tags theo id) là chip; các tag còn lại (vùng miền, Hải sản…) ghi bằng chữ cho gọn.
// dish.score (chỉ có ở toàn văn / gần đúng): điểm phù hợp API trả về → hiện nhỏ để thấy vì sao món đứng ở vị trí đó.
// appear: món vừa được nối thêm (Tải thêm / Cuộn vô hạn) → hiện dần một lần khi gắn vào trang (plan mục 7.4).
export default function DishCard({ dish, appear = false }) {
  const { pathname, search } = useLocation();
  const [mainTag, ...otherTags] = dish.tags;
  return (
    <Link className={`dish-card${dish.available ? "" : " unavailable"}${appear ? " appear" : ""}`} to={`/dishes/${dish.id}`} state={{ backTo: pathname + search }}>
      <span className="card-media">
        {/* Không có ảnh / ảnh lỗi → hình minh hoạ theo loại món (DishArt). */}
        <DishImage className="card-img" src={dish.imageUrl} alt={dish.name} loading="lazy" width="344" height="230" tags={dish.tags} label />
        {!dish.available && <span className="sold-badge">Tạm hết</span>}
      </span>
      <span className="card-body">
        <span className="card-title">
          <span className="dish-name">{dish.name}</span>
          <span className={`dish-price${dish.price === 0 ? " free" : ""}`}>{formatMenuPrice(dish.price)}</span>
        </span>
        {dish.description && <span className="dish-desc">{dish.description}</span>}
        <span className="dish-meta">
          {mainTag && <span className="tag-chip main">{mainTag.name}</span>}
          {otherTags.length > 0 && <span className="meta-text">{tagNames(otherTags)}</span>}
          {dish.score !== undefined && <span className="score">phù hợp {dish.score.toFixed(3)}</span>}
        </span>
      </span>
    </Link>
  );
}
