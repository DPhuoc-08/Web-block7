import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getDish, deleteDish } from "../../../api/dishes.js";
import { isBusiness } from "../../../api/client.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { Loading, LoadError, NotFoundMessage } from "../../../components/StatusView.jsx";
import { generalMessage } from "../../../components/FormBits.jsx";

// Trang xác nhận xoá (/admin/dishes/:id/delete). Mở trang chỉ GET món; CHỈ nút "Xoá" gửi DELETE.
export default function DishDeletePage() {
  const { id } = useParams();
  useDocumentTitle("Xoá món");
  const navigate = useNavigate();
  const { status, data: dish, reload } = useLoad((signal) => getDish(id, { signal }), [id]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const busy = useRef(false); // chặn bấm "Xoá" hai lần trước khi nút kịp bị khoá

  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError onRetry={reload} />;
  if (status === "notFound") {
    return <NotFoundMessage title="Không tìm thấy món" text="Món cần xoá không tồn tại hoặc đã bị xoá." backTo="/admin/dishes" backLabel="Về danh sách món" />;
  }

  async function onDelete() {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await deleteDish(id);
      // Xoá xong → về danh sách (trang chi tiết không còn); danh sách tự tải lại từ API.
      navigate("/admin/dishes?msg=dish-deleted");
    } catch (err) {
      setError(isBusiness(err, "NOT_FOUND") ? "Món này đã bị xoá trước đó." : generalMessage(err));
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link className="back" to="/admin/dishes">
        ← Danh sách món
      </Link>
      <div className="panel confirm">
        <h1>Xoá món “{dish.name}”?</h1>
        <p className="muted">Món sẽ bị xoá khỏi thực đơn (kèm danh sách nguyên liệu của món) và không khôi phục được.</p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={submitting}>
            {submitting ? "Đang xoá…" : "Xoá"}
          </button>
          <Link className="btn" to="/admin/dishes">
            Huỷ
          </Link>
        </div>
      </div>
    </>
  );
}
