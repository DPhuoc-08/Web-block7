import { Link, useLocation } from "react-router";
import { formatPrice, tagNames } from "../format.js";
import DishImage from "./DishImage.jsx";

// Một dòng món trên thực đơn. Link chỉ mang id (path param /dishes/:id);
// trang chi tiết tự tải lại món từ API theo id, không nhận object món từ trang danh sách.
// state.backTo: URL danh sách đang lọc → nút "← Thực đơn" ở trang chi tiết quay về đúng bộ lọc này.
// hideTagId: khi thực đơn nhóm theo tag, tag của nhóm đã là tiêu đề → không lặp lại trên từng dòng.
export default function DishRow({ dish, hideTagId = null }) {
  const { pathname, search } = useLocation();
  const tags = dish.tags.filter((t) => t.id !== hideTagId);
  return (
    <Link className={`dish-row${dish.available ? "" : " unavailable"}`} to={`/dishes/${dish.id}`} state={{ backTo: pathname + search }}>
      <DishImage className="dish-thumb" src={dish.imageUrl} alt={dish.name} loading="lazy" width="120" height="90" />
      <span>
        <span className="dish-name">{dish.name}</span>
        {dish.description && <span className="dish-desc">{dish.description}</span>}
        <span className="dish-meta">
          {tags.length > 0 && <span className="tag">{tagNames(tags)}</span>}
          {!dish.available && <span className="badge off">Tạm hết</span>}
        </span>
      </span>
      <span className="dish-price">{formatPrice(dish.price)}</span>
    </Link>
  );
}
