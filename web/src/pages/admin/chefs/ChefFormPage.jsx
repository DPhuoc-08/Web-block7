import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getChef, createChef, updateChef } from "../../../api/chefs.js";
import { isBusiness } from "../../../api/client.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { useFocusFirstError } from "../../../hooks/useFocusFirstError.js";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges.js";
import LeaveConfirm from "../../../components/LeaveConfirm.jsx";
import { Loading, LoadError, NotFoundMessage } from "../../../components/StatusView.jsx";
import { FieldError, FormAlert, generalMessage } from "../../../components/FormBits.jsx";

// Form thêm (/admin/chefs/new) và sửa (/admin/chefs/:id/edit) đầu bếp. Cùng khuôn với DishFormPage.
export default function ChefFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  useDocumentTitle(isEdit ? "Sửa đầu bếp" : "Thêm đầu bếp");
  const { status, data: chef, reload } = useLoad((signal) => (isEdit ? getChef(id, { signal }) : Promise.resolve(null)), [id]);

  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError onRetry={reload} />;
  if (status === "notFound") {
    return <NotFoundMessage title="Không tìm thấy đầu bếp" text="Đầu bếp cần sửa không tồn tại hoặc đã bị xoá." backTo="/admin/chefs" backLabel="Về danh sách đầu bếp" />;
  }
  return <ChefForm key={id ?? "new"} id={id} chef={chef} />;
}

function ChefForm({ id, chef }) {
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const [initial] = useState({ name: chef?.name ?? "", specialty: chef?.specialty ?? "" });
  const [values, setValues] = useState(initial);
  const { blocker, allowLeave } = useUnsavedChanges(values.name !== initial.name || values.specialty !== initial.specialty);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const { panelRef, showFirstError } = useFocusFirstError();

  function set(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy.current) return;
    setGeneralError(null);

    // SPA chỉ chặn ô bắt buộc bỏ trống; trùng tên do API kiểm tra (VALIDATION_FAILED, fields.name).
    if (!values.name.trim()) {
      setErrors({ name: "Tên đầu bếp không được để trống." });
      showFirstError();
      return;
    }

    busy.current = true;
    setSubmitting(true);
    const body = { name: values.name, specialty: values.specialty.trim() === "" ? null : values.specialty };
    try {
      const saved = isEdit ? await updateChef(id, body) : await createChef(body);
      // Đầu bếp không có trang chi tiết → về danh sách (danh sách tự tải lại từ API).
      allowLeave(); // đã lưu → không hỏi "rời trang khi chưa lưu"
      navigate(`/admin/chefs?msg=${isEdit ? "chef-updated" : "chef-created"}&id=${saved.id}`);
    } catch (err) {
      if (isBusiness(err, "VALIDATION_FAILED")) setErrors(err.fields);
      else if (isBusiness(err, "NOT_FOUND")) setGeneralError("Đầu bếp này không còn tồn tại (có thể vừa bị xoá ở nơi khác).");
      else setGeneralError(generalMessage(err));
      showFirstError();
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link className="back" to="/admin/chefs">
        ← Danh sách đầu bếp
      </Link>
      <div className="panel form-panel" ref={panelRef}>
        <h1>{isEdit ? "Sửa đầu bếp" : "Thêm đầu bếp"}</h1>
        {isEdit && <p className="muted no-margin">Đầu bếp #{id}</p>}
        <FormAlert fieldErrors={errors} generalError={generalError} />

        <form className="form" onSubmit={onSubmit} noValidate>
          <label className={`field${errors.name ? " invalid" : ""}`}>
            <span>Tên đầu bếp</span>
            <input name="name" value={values.name} onChange={(e) => set("name", e.target.value)} />
            <FieldError message={errors.name} />
          </label>
          <label className={`field${errors.specialty ? " invalid" : ""}`}>
            <span>Chuyên môn</span>
            <input name="specialty" value={values.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="Ví dụ: Món nước miền Bắc" />
            <FieldError message={errors.specialty} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : isEdit ? "Lưu" : "Thêm"}
            </button>
            <Link className="btn" to="/admin/chefs">
              Huỷ
            </Link>
          </div>
        </form>
      </div>
      <LeaveConfirm blocker={blocker} />
    </>
  );
}
