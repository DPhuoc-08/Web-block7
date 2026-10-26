import { Link, useLocation } from "react-router";
import { formatPrice } from "../format.js";
import DishImage from "./DishImage.jsx";

// Một dòng món trên thực đơn. Link chỉ mang id (path param /dishes/:id);
// trang chi tiết tự tải lại món từ API theo id, không nhận object món từ trang danh sách.
// state.backTo: URL danh sách đang lọc → nút "← Thực đơn" ở trang chi tiết quay về đúng bộ lọc này.
export default function DishRow({ dish, showCategory = true }) {
  const { pathname, search } = useLocation();
  return (
    <Link className={`dish-row${dish.available ? "" : " unavailable"}`} to={`/dishes/${dish.id}`} state={{ backTo: pathname + search }}>
      <DishImage className="dish-thumb" src={dish.imageUrl} alt={dish.name} loading="lazy" width="120" height="90" />
      <span>
        <span className="dish-name">{dish.name}</span>
        {dish.description && <span className="dish-desc">{dish.description}</span>}
        <span className="dish-meta">
          {showCategory && dish.category && <span className="tag">{dish.category}</span>}
          {!dish.available && <span className="badge off">Tạm hết</span>}
        </span>
      </span>
      <span className="dish-price">{formatPrice(dish.price)}</span>
    </Link>
  );
}
