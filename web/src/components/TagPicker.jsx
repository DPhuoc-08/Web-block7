import { useState } from "react";
import { createTag } from "../api/tags.js";
import { plain } from "../format.js";
import QuickAdd from "./QuickAdd.jsx";

const TAG_FIELDS = [{ key: "name", label: "Tên tag", placeholder: "Ví dụ: Món chay", requiredMessage: "Tên tag không được để trống." }];

// Chọn nhiều tag (loại món của món, hoặc chuyên môn của đầu bếp): tick ô → mảng id gửi lên API (`tagIds`).
// - tags:      danh sách tag đã tải khi mở form (GET /api/tags)
// - selected:  mảng id đang chọn (state của form bên ngoài, gửi khi lưu)
// - onToggle(id), onCreated(tag): form bên ngoài cập nhật `selected`
// Ô tìm chỉ lọc danh sách đã tải (không gọi API); tag đã tick mà bị ẩn vẫn nằm trong `selected` → vẫn được gửi.
// Tag chưa có → "+ Thêm tag": POST /api/tags ngay trong form, tag mới vào danh sách và được tick sẵn.
export default function TagPicker({ legend, tags, selected, error, onToggle, onCreated }) {
  // Danh sách của form: bắt đầu từ dữ liệu đã tải, thêm tag mới tạo (state cục bộ, không phải kho dùng chung).
  const [list, setList] = useState(tags);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(null);
  const q = query.trim();
  const shown = q ? list.filter((t) => plain(t.name).includes(plain(q))) : list;

  function created(tag) {
    setList((l) => [...l, tag]);
    onCreated(tag);
    setAdding(false);
    setQuery(""); // xoá chữ tìm để thấy tag mới (đã tick) trong danh sách
    setAdded(tag.name);
  }

  return (
    <fieldset className={`choice-group${error ? " invalid" : ""}`}>
      <legend>
        {legend} <small className="muted">(chọn ít nhất 1)</small>
      </legend>
      {error && <p className="error">{error}</p>}
      <div className="choice-tools">
        {/* Enter trong ô tìm không được gửi form bên ngoài. */}
        <input
          type="search"
          aria-label="Tìm tag"
          placeholder="Tìm tag, ví dụ: nước, miền"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          data-skip-error-focus
        />
        <button type="button" className="btn" onClick={() => (setAdding(true), setAdded(null))} disabled={adding} aria-expanded={adding}>
          + Thêm tag
        </button>
      </div>
      {adding && (
        // Tên lấy sẵn từ ô tìm (thường admin vừa tìm không thấy).
        <QuickAdd
          title="Thêm tag mới"
          fields={TAG_FIELDS}
          initialValues={{ name: q }}
          create={(v) => createTag({ name: v.name })}
          onCreated={created}
          onCancel={() => setAdding(false)}
        />
      )}
      {added && (
        <p className="choice-added" role="status">
          Đã thêm và chọn tag “{added}”.
        </p>
      )}
      <p className="muted choice-summary" role="status">
        Đã chọn {selected.length} tag
        {q && ` · đang hiện ${shown.length}/${list.length}`}
      </p>
      {q && shown.length === 0 && <p className="muted">Không có tag nào khớp “{q}”.</p>}
      <div className="choice-grid compact">
        {shown.map((t) => (
          <label key={t.id} className="choice">
            <input type="checkbox" name="tagIds" value={t.id} checked={selected.includes(t.id)} onChange={() => onToggle(t.id)} />
            <span>{t.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
