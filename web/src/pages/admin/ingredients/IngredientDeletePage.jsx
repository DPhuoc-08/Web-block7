import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getIngredient, deleteIngredient } from "../../../api/ingredients.js";
import { isBusiness } from "../../../api/client.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { Loading, LoadError, NotFoundMessage } from "../../../components/StatusView.jsx";
import { generalMessage } from "../../../components/FormBits.jsx";
import { useBackTo, withFlash } from "../../../hooks/useBackTo.js";

// Trang xác nhận xoá nguyên liệu (/admin/ingredients/:id/delete). Giữ quy tắc của block5:
// nguyên liệu đang được món nào dùng thì KHÔNG có nút Xoá — liệt kê các món để người dùng bỏ nguyên liệu trước.
// (API cũng chặn: DELETE khi còn món dùng → IN_USE.)
export default function IngredientDeletePage() {
  const { id } = useParams();
  useDocumentTitle("Xoá nguyên liệu");
  const navigate = useNavigate();
  // Xoá xong / Huỷ: về đúng URL danh sách đã mở (giữ page, q) — như DishDeletePage.
  const listUrl = useBackTo("/admin/ingredients");
  const { status, data: ingredient, reload } = useLoad((signal) => getIngredient(id, { signal }), [id]);
  const [error, setError] = useState(null);
  // API trả IN_USE (món vừa được gán nguyên liệu ở nơi khác) → chuyển sang hiện danh sách món mới nhất.
  const [blockedDishes, setBlockedDishes] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError onRetry={reload} />;
  if (status === "notFound") {
    return (
      <NotFoundMessage title="Không tìm thấy nguyên liệu" text="Nguyên liệu cần xoá không tồn tại hoặc đã bị xoá." backTo="/admin/ingredients" backLabel="Về danh sách nguyên liệu" />
    );
  }

  const dishes = blockedDishes ?? ingredient.dishes;

  async function onDelete() {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await deleteIngredient(id);
      navigate(withFlash(listUrl, { msg: "ingredient-deleted" }));
    } catch (err) {
      if (isBusiness(err, "IN_USE")) {
        setBlockedDishes(err.dishes);
        setError("Nguyên liệu vừa được thêm vào món ăn nên không thể xoá.");
      } else if (isBusiness(err, "NOT_FOUND")) {
        setError("Nguyên liệu này đã bị xoá trước đó.");
      } else {
        setError(generalMessage(err));
      }
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link className="back" to={listUrl}>
        ← Danh sách nguyên liệu
      </Link>
      <div className="panel confirm">
        <h1>Xoá nguyên liệu “{ingredient.name}”?</h1>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {dishes.length === 0 ? (
          <>
            <p className="muted">Không món nào dùng nguyên liệu này. Thao tác này không khôi phục được.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-danger" onClick={onDelete} disabled={submitting}>
                {submitting ? "Đang xoá…" : "Xoá"}
              </button>
              <Link className="btn" to={listUrl}>
                Huỷ
              </Link>
            </div>
          </>
        ) : (
          <>
            <p>
              Không thể xoá: nguyên liệu đang được dùng trong <strong>{dishes.length} món</strong>. Bỏ nguyên liệu khỏi các món này (trong form sửa
              món) rồi quay lại xoá.
            </p>
            <ul className="related-list">
              {dishes.map((d) => (
                <li key={d.id}>
                  <span>{d.name}</span> <Link to={`/admin/dishes/${d.id}/edit`}>Sửa món</Link>
                </li>
              ))}
            </ul>
            <Link className="btn" to={listUrl}>
              Quay lại
            </Link>
          </>
        )}
      </div>
    </>
  );
}
