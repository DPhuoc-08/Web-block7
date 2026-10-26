import { Link, useLocation, useParams } from "react-router";
import { getDish } from "../../api/dishes.js";
import { useLoad } from "../../hooks/useLoad.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { Loading, LoadError, NotFoundMessage } from "../../components/StatusView.jsx";
import { formatPrice, tagNames } from "../../format.js";
import DishImage from "../../components/DishImage.jsx";
import TagList from "../../components/TagList.jsx";

// Chi tiết món (/dishes/:id). Id đọc từ URL → mở tab mới, gửi link, Reload hay Back đều ra đúng món.
// Trang không nhận object món từ danh sách mà tự gọi GET /api/dishes/:id.
export default function DishDetailPage() {
  const { id } = useParams();
  // deps [id]: đổi sang món khác khi request cũ chưa về → useLoad huỷ request cũ.
  const { status, data: dish, reload } = useLoad((signal) => getDish(id, { signal }), [id]);
  // Quay lại đúng danh sách đang lọc (DishRow gửi qua state của Link, giữ cả khi Reload).
  // Mở thẳng / tab mới thì không có state → /dishes. Chỉ nhận URL của thực đơn.
  const backTo = useLocation().state?.backTo;
  const backUrl = typeof backTo === "string" && /^\/dishes(\?|$)/.test(backTo) ? backTo : "/dishes";
  useDocumentTitle(status === "ok" ? dish.name : status === "notFound" ? "Không tìm thấy món" : "Chi tiết món");

  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError onRetry={reload} />;
  // NOT_FOUND từ error.code (id không có hoặc sai kiểu như /dishes/abc) → trang không tìm thấy.
  if (status === "notFound") {
    return <NotFoundMessage title="Không tìm thấy món" text="Món ăn này không tồn tại hoặc đã bị xoá." />;
  }

  return (
    <>
      <Link className="back" to={backUrl}>
        ← Thực đơn
      </Link>

      <div className="detail">
        <figure className="detail-photo">
          <DishImage src={dish.imageUrl} alt={dish.name} width="960" height="720" emptyText="Chưa có ảnh cho món này" />
          {/* CC BY / BY-SA yêu cầu ghi công tác giả và giấy phép. */}
          {dish.imageUrl && dish.imageCredit && <figcaption>Ảnh: {dish.imageCredit}</figcaption>}
        </figure>

        <div className="detail-info">
          {/* Chip tag là link lọc thực đơn theo tag đó. */}
          <TagList tags={dish.tags} linked />
          <h1>{dish.name}</h1>
          <div className="price-line">
            <span className="detail-price">{formatPrice(dish.price)}</span>
            {dish.available ? <span className="badge on">Đang phục vụ</span> : <span className="badge off">Tạm hết</span>}
          </div>
          <p className="detail-desc">{dish.description ?? "Chưa có mô tả cho món này."}</p>

          <dl className="facts">
            <dt>Mã món</dt>
            <dd>#{dish.id}</dd>
            <dt>Đầu bếp</dt>
            <dd>
              {dish.chef.name}
              <span className="muted normal"> · {tagNames(dish.chef.tags)}</span>
            </dd>
            <dt>Tình trạng</dt>
            <dd>{dish.available ? "Đang phục vụ" : "Tạm hết"}</dd>
          </dl>

          {dish.ingredients.length > 0 && (
            <section aria-labelledby="ingredients-title">
              <h2 id="ingredients-title" className="section-label">
                Nguyên liệu
              </h2>
              <ul className="ingredient-tags">
                {dish.ingredients.map((ingredient) => (
                  <li key={ingredient.id}>{ingredient.name}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Tag đầu tiên (id nhỏ nhất) là loại món → gợi ý xem các món cùng loại. */}
          {dish.tags.length > 0 && (
            <Link className="btn" to={`/dishes?tag=${dish.tags[0].id}`}>
              Xem thêm {dish.tags[0].name}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
