import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

// Tìm kiếm trong trang quản trị (giữ từ block5): từ khoá nằm trên URL của trang (?q=...), trang tự gọi API theo q.
// modes (plan mục 14): danh sách kiểu tìm [{ value, label, placeholder }] — "basic" là tìm chứa từ khoá như cũ,
// các kiểu khác (toàn văn, gần đúng) ghi thêm ?mode= và BẮT BUỘC có từ khoá: trống thì báo lỗi cạnh ô, không đổi URL
// (không gọi API). Không truyền modes → chỉ có ô chữ như trước.
export default function AdminSearch({ label, placeholder, count, modes = null }) {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const urlMode = searchParams.get("mode")?.trim() || "basic";
  const [text, setText] = useState(q);
  const [mode, setMode] = useState(urlMode);
  const [missingQ, setMissingQ] = useState(false);
  // URL đổi (Back/Forward, "Xoá tìm kiếm") → đồng bộ lại form.
  useEffect(() => (setText(q), setMode(urlMode), setMissingQ(false)), [q, urlMode]);

  const current = modes?.find((m) => m.value === mode);

  function onSubmit(event) {
    event.preventDefault();
    const next = text.trim();
    if (mode !== "basic" && !next) return setMissingQ(true);
    // Chỉ giữ q (+ mode): thông báo ?msg= của lần lưu trước không hiện lại khi tìm kiếm (như form GET của block5).
    // Tìm mới → không ghi page → về trang 1.
    setSearchParams({ ...(next ? { q: next } : {}), ...(mode !== "basic" ? { mode } : {}) });
  }

  const urlCurrent = modes?.find((m) => m.value === urlMode);
  return (
    <>
      <form className="admin-search" role="search" onSubmit={onSubmit} noValidate>
        <label className="sr-only" htmlFor="admin-q">
          {label}
        </label>
        <input
          id="admin-q"
          type="search"
          name="q"
          value={text}
          onChange={(e) => (setText(e.target.value), setMissingQ(false))}
          placeholder={current?.placeholder ?? placeholder}
          aria-invalid={missingQ}
          aria-describedby={missingQ ? "admin-q-error" : undefined}
        />
        {modes && (
          <label className="admin-mode">
            <span className="sr-only">Kiểu tìm</span>
            <select name="mode" value={mode} onChange={(e) => (setMode(e.target.value), setMissingQ(false))}>
              {modes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="btn">
          Tìm
        </button>
        {(q || urlMode !== "basic") && (
          <Link className="btn" to={pathname}>
            Xoá tìm kiếm
          </Link>
        )}
      </form>
      {missingQ && (
        <p className="error search-count" id="admin-q-error">
          Nhập từ khoá để tìm {current?.label.toLowerCase()}.
        </p>
      )}
      {q && count !== null && (
        <p className="muted search-count" role="status">
          Tìm thấy {count} kết quả cho “{q}”{urlCurrent && urlMode !== "basic" ? ` · ${urlCurrent.label.toLowerCase()}, xếp theo độ phù hợp` : ""}.
        </p>
      )}
    </>
  );
}

// Tham số API cho danh sách admin: kiểu "basic" giữ đúng request cũ (không gửi mode); kiểu khác gửi mode nguyên văn
// (API kiểm tra: mode lạ, thiếu q → VALIDATION_FAILED → InvalidQuery).
export function adminModeParam(searchParams) {
  const mode = searchParams.get("mode")?.trim() ?? "";
  return mode === "" || mode === "basic" ? "" : mode;
}
