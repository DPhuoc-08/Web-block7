import { Link, useLocation } from "react-router";
import { formatPrice } from "../format.js";
import DishImage from "./DishImage.jsx";
import TagList from "./TagList.jsx";

// Một dòng món trên thực đơn. Link chỉ mang id (path param /dishes/:id);
// trang chi tiết tự tải lại món từ API theo id, không nhận object món từ trang danh sách.
// state.backTo: URL danh sách đang lọc → nút "← Thực đơn" ở trang chi tiết quay về đúng bộ lọc này.
// dish.score (chỉ có ở toàn văn / gần đúng): điểm phù hợp API trả về → hiện nhỏ để thấy vì sao món đứng ở vị trí đó.
export default function DishRow({ dish }) {
  const { pathname, search } = useLocation();
  return (
    <Link className={`dish-row${dish.available ? "" : " unavailable"}`} to={`/dishes/${dish.id}`} state={{ backTo: pathname + search }}>
      {/* Không có ảnh → khung ghi loại món (tag đầu tiên) thay vì để trống. */}
      <DishImage className="dish-thumb" src={dish.imageUrl} alt={dish.name} loading="lazy" width="120" height="90" emptyText={dish.tags[0]?.name ?? "Chưa có ảnh"} />
      <span>
        <span className="dish-name">{dish.name}</span>
        {dish.description && <span className="dish-desc">{dish.description}</span>}
        <span className="dish-meta">
          <TagList tags={dish.tags} />
          {!dish.available && <span className="badge off">Tạm hết</span>}
          {dish.score !== undefined && <span className="score">phù hợp {dish.score.toFixed(3)}</span>}
        </span>
      </span>
      <span className="dish-price">{formatPrice(dish.price)}</span>
    </Link>
  );
}
