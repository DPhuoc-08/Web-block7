import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getIngredient, createIngredient, updateIngredient } from "../../../api/ingredients.js";
import { isBusiness } from "../../../api/client.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { useFocusFirstError } from "../../../hooks/useFocusFirstError.js";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges.js";
import LeaveConfirm from "../../../components/LeaveConfirm.jsx";
import { Loading, LoadError, NotFoundMessage } from "../../../components/StatusView.jsx";
import { FieldError, FormAlert, generalMessage } from "../../../components/FormBits.jsx";

// Form thêm (/admin/ingredients/new) và sửa (/admin/ingredients/:id/edit) nguyên liệu. Cùng khuôn với ChefFormPage.
export default function IngredientFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  useDocumentTitle(isEdit ? "Sửa nguyên liệu" : "Thêm nguyên liệu");
  const { status, data: ingredient, reload } = useLoad(
    (signal) => (isEdit ? getIngredient(id, { signal }) : Promise.resolve(null)),
    [id],
  );

  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError onRetry={reload} />;
  if (status === "notFound") {
    return (
      <NotFoundMessage title="Không tìm thấy nguyên liệu" text="Nguyên liệu cần sửa không tồn tại hoặc đã bị xoá." backTo="/admin/ingredients" backLabel="Về danh sách nguyên liệu" />
    );
  }
  return <IngredientForm key={id ?? "new"} id={id} ingredient={ingredient} />;
}

function IngredientForm({ id, ingredient }) {
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const [initial] = useState({ name: ingredient?.name ?? "", unit: ingredient?.unit ?? "" });
  const [values, setValues] = useState(initial);
  const { blocker, allowLeave } = useUnsavedChanges(values.name !== initial.name || values.unit !== initial.unit);
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
      setErrors({ name: "Tên nguyên liệu không được để trống." });
      showFirstError();
      return;
    }

    busy.current = true;
    setSubmitting(true);
    const body = { name: values.name, unit: values.unit.trim() === "" ? null : values.unit };
    try {
      const saved = isEdit ? await updateIngredient(id, body) : await createIngredient(body);
      allowLeave(); // đã lưu → không hỏi "rời trang khi chưa lưu"
      navigate(`/admin/ingredients?msg=${isEdit ? "ingredient-updated" : "ingredient-created"}&id=${saved.id}`);
    } catch (err) {
      if (isBusiness(err, "VALIDATION_FAILED")) setErrors(err.fields);
      else if (isBusiness(err, "NOT_FOUND")) setGeneralError("Nguyên liệu này không còn tồn tại (có thể vừa bị xoá ở nơi khác).");
      else setGeneralError(generalMessage(err));
      showFirstError();
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link className="back" to="/admin/ingredients">
        ← Danh sách nguyên liệu
      </Link>
      <div className="panel form-panel" ref={panelRef}>
        <h1>{isEdit ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}</h1>
        {isEdit && <p className="muted no-margin">Nguyên liệu #{id}</p>}
        <FormAlert fieldErrors={errors} generalError={generalError} />

        <form className="form" onSubmit={onSubmit} noValidate>
          <label className={`field${errors.name ? " invalid" : ""}`}>
            <span>Tên nguyên liệu</span>
            <input name="name" value={values.name} onChange={(e) => set("name", e.target.value)} />
            <FieldError message={errors.name} />
          </label>
          <label className={`field${errors.unit ? " invalid" : ""}`}>
            <span>Đơn vị</span>
            <input name="unit" value={values.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Ví dụ: kg, bó, lít" />
            <FieldError message={errors.unit} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : isEdit ? "Lưu" : "Thêm"}
            </button>
            <Link className="btn" to="/admin/ingredients">
              Huỷ
            </Link>
          </div>
        </form>
      </div>
      <LeaveConfirm blocker={blocker} />
    </>
  );
}
