import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

// Tìm kiếm trong trang quản trị (giữ từ block5): từ khoá nằm trên URL của trang (?q=...), trang tự gọi API theo q.
export default function AdminSearch({ label, placeholder, count }) {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  function onSubmit(event) {
    event.preventDefault();
    const next = text.trim();
    // Chỉ giữ q: thông báo ?msg= của lần lưu trước không hiện lại khi tìm kiếm (như form GET của block5).
    setSearchParams(next ? { q: next } : {});
  }

  return (
    <>
      <form className="admin-search" role="search" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="admin-q">
          {label}
        </label>
        <input id="admin-q" type="search" name="q" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <button type="submit" className="btn">
          Tìm
        </button>
        {q && (
          <Link className="btn" to={pathname}>
            Xoá tìm kiếm
          </Link>
        )}
      </form>
      {q && count !== null && (
        <p className="muted search-count" role="status">
          Tìm thấy {count} kết quả cho “{q}”.
        </p>
      )}
    </>
  );
}
