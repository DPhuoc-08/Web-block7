import { useRef, useState } from "react";
import { createIngredient } from "../api/ingredients.js";
import { isBusiness } from "../api/client.js";
import { FieldError, generalMessage } from "./FormBits.jsx";

// Thêm nhanh nguyên liệu ngay trong form món: admin không phải rời form món (mất dữ liệu đang nhập) để sang
// /admin/ingredients/new rồi quay lại. Cùng request với form nguyên liệu: POST /api/ingredients.
//
// Không dùng <form>: khung này nằm trong <form> của món, HTML không cho lồng form → nút type="button",
// Enter trong ô được chặn rồi tự gọi add() (nếu không chặn, Enter sẽ gửi luôn form món).
// Nguyên liệu được lưu ngay khi bấm "Thêm và chọn" — huỷ form món sau đó thì nguyên liệu vẫn còn (bản ghi độc lập).
export default function QuickAddIngredient({ initialName, onCreated, onCancel }) {
  const [values, setValues] = useState({ name: initialName, unit: "" });
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false); // chặn bấm hai lần trước khi nút kịp bị khoá
  const nameRef = useRef(null);
  const unitRef = useRef(null);

  function set(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  async function add() {
    if (busy.current) return;
    setGeneralError(null);

    // Như form nguyên liệu: SPA chỉ chặn tên trống; trùng tên do API kiểm tra (VALIDATION_FAILED, fields.name).
    if (!values.name.trim()) {
      setErrors({ name: "Tên nguyên liệu không được để trống." });
      nameRef.current?.focus();
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      const created = await createIngredient({ name: values.name, unit: values.unit.trim() === "" ? null : values.unit });
      // Form món thêm nguyên liệu mới vào danh sách, tick sẵn và đóng khung này.
      onCreated(created);
    } catch (err) {
      if (isBusiness(err, "VALIDATION_FAILED")) {
        setErrors(err.fields);
        (err.fields.name ? nameRef : unitRef).current?.focus();
      } else {
        setGeneralError(generalMessage(err));
      }
      busy.current = false;
      setSubmitting(false);
    }
  }

  function onEnter(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  }

  // data-skip-error-focus: lỗi của form món không kéo con trỏ vào khung phụ này.
  return (
    <div className="quick-add" role="group" aria-labelledby="quick-add-title">
      <p id="quick-add-title" className="quick-add-title">
        Thêm nguyên liệu mới
      </p>
      {generalError && (
        <p className="alert" role="alert">
          {generalError}
        </p>
      )}
      <div className="quick-add-fields">
        <label className={`field${errors.name ? " invalid" : ""}`}>
          <span>Tên nguyên liệu</span>
          <input ref={nameRef} autoFocus value={values.name} onChange={(e) => set("name", e.target.value)} onKeyDown={onEnter} data-skip-error-focus />
          <FieldError message={errors.name} />
        </label>
        <label className={`field${errors.unit ? " invalid" : ""}`}>
          <span>Đơn vị</span>
          <input ref={unitRef} value={values.unit} onChange={(e) => set("unit", e.target.value)} onKeyDown={onEnter} placeholder="Ví dụ: kg, bó" data-skip-error-focus />
          <FieldError message={errors.unit} />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={submitting}>
          {submitting ? "Đang thêm…" : "Thêm và chọn"}
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={submitting}>
          Huỷ
        </button>
      </div>
    </div>
  );
}
