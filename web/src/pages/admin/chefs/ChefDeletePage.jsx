import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getChef, listAllChefs, deleteChef } from "../../../api/chefs.js";
import { isBusiness } from "../../../api/client.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { Loading, LoadError, NotFoundMessage } from "../../../components/StatusView.jsx";
import { FieldError, generalMessage } from "../../../components/FormBits.jsx";
import { useBackTo, withFlash } from "../../../hooks/useBackTo.js";

// Trang xác nhận xoá đầu bếp (/admin/chefs/:id/delete). Giữ quy tắc của block5 (khoá ngoại Restrict):
// - không phụ trách món nào → nút Xoá
// - còn món → liệt kê món + chọn đầu bếp nhận → một request DELETE /api/chefs/:id?transferTo=<id>
//   (API chuyển món + xoá trong một transaction)
export default function ChefDeletePage() {
  const { id } = useParams();
  useDocumentTitle("Xoá đầu bếp");
  const navigate = useNavigate();
  // Xoá xong / Huỷ: về đúng URL danh sách đã mở (giữ page, q) — như DishDeletePage.
  const listUrl = useBackTo("/admin/chefs");
  const { status, data, reload } = useLoad((signal) => Promise.all([getChef(id, { signal }), listAllChefs({ signal })]), [id]);
  const [transferTo, setTransferTo] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);
  // Nếu API trả IN_USE (vừa có món được gán ở nơi khác) → dùng danh sách món mới nhất từ lỗi.
  const [blockedDishes, setBlockedDishes] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError onRetry={reload} />;
  if (status === "notFound") {
    return <NotFoundMessage title="Không tìm thấy đầu bếp" text="Đầu bếp cần xoá không tồn tại hoặc đã bị xoá." backTo="/admin/chefs" backLabel="Về danh sách đầu bếp" />;
  }

  const [chef, allChefs] = data;
  const dishes = blockedDishes ?? chef.dishes;
  const otherChefs = allChefs.filter((c) => c.id !== chef.id);

  async function onDelete(event) {
    event.preventDefault();
    if (busy.current) return;
    setError(null);
    setFieldError(null);
    // Còn món mà chưa chọn người nhận: SPA chặn ô bỏ trống, không gửi request.
    if (dishes.length > 0 && !transferTo) {
      setFieldError("Vui lòng chọn đầu bếp nhận món.");
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      await deleteChef(id, dishes.length > 0 ? transferTo : undefined);
      navigate(withFlash(listUrl, { msg: dishes.length > 0 ? "chef-transferred" : "chef-deleted" }));
    } catch (err) {
      if (isBusiness(err, "IN_USE")) {
        setBlockedDishes(err.dishes);
        setError("Đầu bếp vừa được gán món mới. Hãy chọn người nhận các món rồi xoá.");
      } else if (isBusiness(err, "VALIDATION_FAILED")) {
        setFieldError(err.fields.transferTo ?? "Dữ liệu không hợp lệ.");
      } else if (isBusiness(err, "NOT_FOUND")) {
        setError("Đầu bếp này đã bị xoá trước đó.");
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
        ← Danh sách đầu bếp
      </Link>
      <div className="panel confirm">
        <h1>Xoá đầu bếp “{chef.name}”?</h1>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {dishes.length === 0 ? (
          <>
            <p className="muted">Đầu bếp không phụ trách món nào. Thao tác này không khôi phục được.</p>
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
              Đầu bếp đang phụ trách <strong>{dishes.length} món</strong>. Món thuộc về nhà hàng nên không bị xoá theo: cần chuyển các món sang
              đầu bếp khác trước.
            </p>
            <ul className="related-list">
              {dishes.map((d) => (
                <li key={d.id}>
                  <span>{d.name}</span> <Link to={`/admin/dishes/${d.id}/edit`}>Đổi đầu bếp riêng món này</Link>
                </li>
              ))}
            </ul>

            {otherChefs.length === 0 ? (
              <>
                <p className="muted">
                  Chưa có đầu bếp nào khác để nhận món. <Link to="/admin/chefs/new">Thêm đầu bếp mới</Link> trước.
                </p>
                <Link className="btn" to={listUrl}>
                  Quay lại
                </Link>
              </>
            ) : (
              <form className="form" onSubmit={onDelete} noValidate>
                <label className={`field${fieldError ? " invalid" : ""}`}>
                  <span>Chuyển toàn bộ {dishes.length} món sang</span>
                  <select name="transferTo" value={transferTo} onChange={(e) => (setTransferTo(e.target.value), setFieldError(null))}>
                    <option value="">— Chọn đầu bếp nhận món —</option>
                    {otherChefs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={fieldError} />
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn-danger" disabled={submitting}>
                    {submitting ? "Đang xử lý…" : "Chuyển món và xoá đầu bếp"}
                  </button>
                  <Link className="btn" to={listUrl}>
                    Huỷ
                  </Link>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </>
  );
}
