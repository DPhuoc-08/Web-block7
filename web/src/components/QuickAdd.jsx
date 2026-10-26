import { useId, useRef, useState } from "react";
import { isBusiness } from "../api/client.js";
import { FieldError, generalMessage } from "./FormBits.jsx";

// Thêm nhanh một bản ghi nhỏ ngay trong form khác: nguyên liệu (trong form món), tag (trong form món, form đầu bếp).
// Admin không phải rời form đang nhập (mất dữ liệu) để sang trang thêm riêng rồi quay lại.
//
// - fields: [{ key, label, placeholder?, requiredMessage? }] — ô có requiredMessage là ô bắt buộc (SPA chặn trống);
//           định dạng / trùng tên do API kiểm tra (VALIDATION_FAILED, fields theo đúng `key`).
// - create(values): gọi API tạo bản ghi, trả về bản ghi vừa tạo (có id).
//
// Không dùng <form>: khung này nằm trong <form> của trang, HTML không cho lồng form → nút type="button",
// Enter trong ô được chặn rồi tự gọi add() (nếu không chặn, Enter sẽ gửi luôn form bên ngoài).
// Bản ghi được lưu ngay khi bấm "Thêm và chọn" — huỷ form bên ngoài sau đó thì bản ghi vẫn còn (độc lập).
export default function QuickAdd({ title, fields, initialValues, create, onCreated, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, initialValues?.[f.key] ?? ""])));
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false); // chặn bấm hai lần trước khi nút kịp bị khoá
  const inputs = useRef({});
  // Form món có thể mở cùng lúc khung thêm nguyên liệu và khung thêm tag → id tiêu đề không được trùng.
  const titleId = useId();

  function set(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors(({ [key]: _removed, ...rest }) => rest);
  }

  const focus = (key) => inputs.current[key]?.focus();

  async function add() {
    if (busy.current) return;
    setGeneralError(null);

    const missing = Object.fromEntries(
      fields.filter((f) => f.requiredMessage && !values[f.key].trim()).map((f) => [f.key, f.requiredMessage]),
    );
    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      focus(Object.keys(missing)[0]);
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      // Trang bên ngoài thêm bản ghi mới vào danh sách, tick sẵn và đóng khung này.
      onCreated(await create(values));
    } catch (err) {
      if (isBusiness(err, "VALIDATION_FAILED")) {
        setErrors(err.fields);
        focus(fields.find((f) => err.fields[f.key])?.key ?? fields[0].key);
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

  // data-skip-error-focus: lỗi của form bên ngoài không kéo con trỏ vào khung phụ này.
  return (
    <div className="quick-add" role="group" aria-labelledby={titleId}>
      <p id={titleId} className="quick-add-title">
        {title}
      </p>
      {generalError && (
        <p className="alert" role="alert">
          {generalError}
        </p>
      )}
      <div className={`quick-add-fields${fields.length === 1 ? " single" : ""}`}>
        {fields.map((f, index) => (
          <label key={f.key} className={`field${errors[f.key] ? " invalid" : ""}`}>
            <span>{f.label}</span>
            <input
              ref={(el) => (inputs.current[f.key] = el)}
              autoFocus={index === 0}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              onKeyDown={onEnter}
              placeholder={f.placeholder}
              data-skip-error-focus
            />
            <FieldError message={errors[f.key]} />
          </label>
        ))}
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
