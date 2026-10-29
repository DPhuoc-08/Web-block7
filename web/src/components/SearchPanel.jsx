import { useEffect, useState } from "react";
import { MODES, TEXT_MODES, AVAILABILITY } from "../listQuery.js";

// Khung tìm của thực đơn: 4 chế độ (plan mục 6.4), bố cục gọn theo bản phác Figma (plan mục 13). Giữ giá trị đang nhập
// trong state của form; chỉ ghi lên URL khi người dùng ÁP DỤNG (không theo từng phím) → URL luôn là bộ điều kiện
// đã tìm, Reload/copy link mở lại đúng kết quả.
// - Ô chữ (từ khoá, giá) và ô chế độ: áp dụng khi Enter / Tìm.
// - Ô chọn tag, trạng thái (nhóm nâng cao): áp dụng ngay khi đổi, kèm chữ đang có trong các ô (như thực đơn block6).
// - "Bộ lọc nâng cao" (13.f): bật/tắt chế độ Nâng cao NGAY TRONG FORM (như chọn "Nâng cao" ở ô chế độ) để hiện
//   ô tag, giá, trạng thái; chưa đổi URL cho tới khi bấm Tìm.
// - Toàn văn / gần đúng mà từ khoá trống: không áp dụng (không gọi API), báo lỗi cạnh ô.
// Chip tag → CategoryBar; ô sắp xếp → thanh công cụ của danh sách (13.g).
// fieldErrors: lỗi VALIDATION_FAILED của API theo tên tham số (vd. URL sửa tay ?minPrice=abc) → hiện cạnh đúng ô.
export default function SearchPanel({ query, tags, fieldErrors = {}, onApply }) {
  const [form, setForm] = useState(query);
  const [missingQ, setMissingQ] = useState(false);
  // URL đổi (Back/Forward, danh mục, "Xoá bộ lọc") → đồng bộ lại form.
  const urlKey = JSON.stringify(query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => (setForm(query), setMissingQ(false)), [urlKey]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isText = TEXT_MODES.includes(form.mode);
  const isAdvanced = form.mode === "advanced";
  const errors = { ...fieldErrors, ...(missingQ ? { q: "Nhập từ khoá để tìm." } : {}) };

  function apply(changes = {}) {
    const next = { ...form, ...changes };
    next.q = next.q.trim();
    setForm(next);
    if (TEXT_MODES.includes(next.mode) && !next.q) return setMissingQ(true);
    setMissingQ(false);
    onApply(next);
  }

  function onSubmit(event) {
    event.preventDefault(); // không tải lại document; SPA tự đổi URL rồi gọi API
    apply();
  }

  const setMode = (mode) => (set("mode", mode), setMissingQ(false));

  return (
    <form className="search-form" role="search" aria-label="Tìm và lọc món" onSubmit={onSubmit} noValidate>
      <div className={`search-bar${errors.q ? " invalid" : ""}`}>
        <svg className="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
          <circle cx="9" cy="9" r="6" />
          <path d="M14 14l4 4" />
        </svg>
        <label className="sr-only" htmlFor="menu-q">
          {isText ? "Từ khoá (bắt buộc)" : "Tên món"}
        </label>
        <input id="menu-q" type="search" name="q" value={form.q} onChange={(e) => (set("q", e.target.value), setMissingQ(false))} placeholder={form.mode === "fuzzy" ? "Ví dụ: bò lúc lắt" : form.mode === "fulltext" ? "Ví dụ: nước dùng xương" : "Tìm món, ví dụ: phở, bún"} />
        <button type="submit" className="btn btn-primary">
          Tìm
        </button>
      </div>
      {errors.q && <span className="error">{errors.q}</span>}

      <div className="search-options">
        <label className={`mode-pick${errors.mode ? " invalid" : ""}`}>
          <span className="sr-only">Kiểu tìm</span>
          <select name="mode" value={form.mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="filter-toggle" aria-expanded={isAdvanced} aria-controls="search-advanced" onClick={() => setMode(isAdvanced ? "basic" : "advanced")}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M3 5h14" />
            <path d="M6 10h8" />
            <path d="M8.5 15h3" />
          </svg>
          {isAdvanced ? "Ẩn bộ lọc" : "Bộ lọc nâng cao"}
        </button>
        <span className="muted mode-hint">{MODES.find((m) => m.value === form.mode)?.hint ?? "Chế độ tìm không hợp lệ."}</span>
      </div>
      {errors.mode && <span className="error">{errors.mode}</span>}

      {/* Nhóm tiêu chí của advanced: các tiêu chí nối bằng AND; ô trống = không áp dụng tiêu chí đó. */}
      {isAdvanced && (
        <div className="search-advanced" id="search-advanced">
          <label className={`field${errors.tag ? " invalid" : ""}`}>
            <span>Tag</span>
            <select name="tag" value={form.tag} onChange={(e) => apply({ tag: e.target.value })}>
              <option value="">Mọi tag</option>
              {tags.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>
            {errors.tag && <span className="error">{errors.tag}</span>}
          </label>
          {/* type="number" nhưng không đặt min: giá âm / sai do API kiểm tra (VALIDATION_FAILED) như form block6. */}
          <label className={`field${errors.minPrice ? " invalid" : ""}`}>
            <span>Giá từ (đ)</span>
            <input name="minPrice" type="number" inputMode="numeric" value={form.minPrice} onChange={(e) => set("minPrice", e.target.value)} placeholder="0" />
            {errors.minPrice && <span className="error">{errors.minPrice}</span>}
          </label>
          <label className={`field${errors.maxPrice ? " invalid" : ""}`}>
            <span>Giá đến (đ)</span>
            <input name="maxPrice" type="number" inputMode="numeric" value={form.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} placeholder="100000" />
            {errors.maxPrice && <span className="error">{errors.maxPrice}</span>}
          </label>
          <label className={`field${errors.available ? " invalid" : ""}`}>
            <span>Trạng thái</span>
            <select name="available" value={form.available} onChange={(e) => apply({ available: e.target.value })}>
              {AVAILABILITY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            {errors.available && <span className="error">{errors.available}</span>}
          </label>
        </div>
      )}
    </form>
  );
}
