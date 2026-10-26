import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toQuery } from "../api/client.js";
import { MODES, TEXT_MODES, SORTS, AVAILABILITY, toPageParams } from "../listQuery.js";

// Khung tìm của thực đơn: 4 chế độ (plan mục 6.4). Giữ giá trị đang nhập trong state của form; chỉ ghi lên URL khi
// người dùng ÁP DỤNG (không theo từng phím) → URL luôn là bộ điều kiện đã tìm, Reload/copy link mở lại đúng kết quả.
// - Ô chữ (từ khoá, giá) và ô chế độ: áp dụng khi Enter / Tìm.
// - Ô chọn (tag, trạng thái, sắp xếp) và chip: áp dụng ngay khi đổi, kèm chữ đang có trong các ô (như thực đơn block6).
// - Toàn văn / gần đúng mà từ khoá trống: không áp dụng (không gọi API), báo lỗi cạnh ô.
// fieldErrors: lỗi VALIDATION_FAILED của API theo tên tham số (vd. URL sửa tay ?minPrice=abc) → hiện cạnh đúng ô.
export default function SearchPanel({ query, tags, fieldErrors = {}, onApply }) {
  const [form, setForm] = useState(query);
  const [missingQ, setMissingQ] = useState(false);
  // URL đổi (Back/Forward, chip, "Xoá bộ lọc") → đồng bộ lại form.
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

  // Chip tag = lối tắt của advanced: link (mở tab mới được) tới URL có mode=advanced&tag=<id>, giữ từ khoá.
  const chipUrl = (tag) => `/dishes${toQuery(toPageParams({ ...query, ...form, q: form.q.trim(), mode: "advanced", tag, page: "" }))}`;
  const activeTag = query.mode === "advanced" ? query.tag : "";

  return (
    <section className="filters" aria-label="Tìm và lọc món">
      {tags.length > 0 && (
        <nav className="chips" aria-label="Lọc theo tag">
          <Link className="chip" to={chipUrl("")} aria-current={activeTag ? "false" : "true"}>
            Tất cả
          </Link>
          {tags.map((t) => (
            <Link key={t.id} className="chip" to={chipUrl(String(t.id))} aria-current={activeTag === String(t.id) ? "true" : "false"}>
              {t.name}
            </Link>
          ))}
        </nav>
      )}

      <form className="search-form" role="search" onSubmit={onSubmit} noValidate>
        <div className="search-main">
          <label className="field fixed">
            <span>Kiểu tìm</span>
            <select name="mode" value={form.mode} onChange={(e) => (set("mode", e.target.value), setMissingQ(false))}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div className={`field grow${errors.q ? " invalid" : ""}`}>
            <label htmlFor="menu-q">{isText ? "Từ khoá (bắt buộc)" : "Tên món"}</label>
            <div className="search-box">
              <input id="menu-q" type="search" name="q" value={form.q} onChange={(e) => (set("q", e.target.value), setMissingQ(false))} placeholder={form.mode === "fuzzy" ? "Ví dụ: bò lúc lắt" : form.mode === "fulltext" ? "Ví dụ: nước dùng xương" : "Ví dụ: phở, bún, cơm"} />
              <button type="submit" className="btn btn-primary">
                Tìm
              </button>
            </div>
            {errors.q && <span className="error">{errors.q}</span>}
          </div>
        </div>
        <p className="muted mode-hint">{MODES.find((m) => m.value === form.mode)?.hint ?? "Chế độ tìm không hợp lệ."}</p>

        {/* Nhóm tiêu chí của advanced: các tiêu chí nối bằng AND; ô trống = không áp dụng tiêu chí đó. */}
        {isAdvanced && (
          <div className="search-advanced">
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

        <div className="search-sort">
          <label className={`field fixed${errors.sort ? " invalid" : ""}`}>
            <span>Sắp xếp</span>
            {/* Toàn văn / gần đúng xếp theo điểm phù hợp: khoá ô sắp xếp (plan mục 10.7). */}
            <select name="sort" value={isText ? "" : form.sort} disabled={isText} onChange={(e) => apply({ sort: e.target.value })}>
              {isText ? (
                <option value="">Theo độ phù hợp</option>
              ) : (
                SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))
              )}
            </select>
            {errors.sort && <span className="error">{errors.sort}</span>}
          </label>
        </div>
      </form>
    </section>
  );
}
