import { Link } from "react-router";

// Dải số trang rút gọn: luôn có trang đầu, trang cuối và các trang quanh trang hiện tại; chỗ bị lược thay bằng "…".
// pageWindow(5, 100) → [1, "…", 4, 5, 6, "…", 100]
export function pageWindow(page, totalPages, around = 1) {
  const pages = new Set([1, totalPages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= totalPages) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("…");
    result.push(p);
  });
  return result;
}

// Phân trang dạng số trang (view=pages ở thực đơn, bảng admin món). Mỗi nút là LINK tới URL của trang có ?page=N
// (không phải nút gọi API): copy link, mở tab mới, Back/Forward đều ra đúng trang; trang tự gọi API theo URL.
// - hrefFor(n): URL trang thứ n, giữ nguyên các điều kiện tìm/lọc/sắp xếp đang có.
// - ≤ 600px: CSS ẩn dải số, chỉ còn Trước · "Trang 4/100" · Sau.
export default function Pagination({ page, totalPages, hrefFor, label = "Phân trang" }) {
  if (totalPages <= 1) return null;
  const prev = page > 1 && page <= totalPages ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  return (
    <nav className="pagination" aria-label={label}>
      {prev ? (
        <Link className="page-btn" to={hrefFor(prev)} rel="prev">
          ← Trước
        </Link>
      ) : (
        <span className="page-btn" aria-disabled="true">
          ← Trước
        </span>
      )}
      <ol className="page-list">
        {pageWindow(Math.min(page, totalPages), totalPages).map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} className="page-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link className="page-num" to={hrefFor(p)} aria-current={p === page ? "page" : undefined} aria-label={`Trang ${p}`}>
                {p}
              </Link>
            </li>
          ),
        )}
      </ol>
      <span className="page-status">
        Trang {page}/{totalPages}
      </span>
      {next ? (
        <Link className="page-btn" to={hrefFor(next)} rel="next">
          Sau →
        </Link>
      ) : (
        <span className="page-btn" aria-disabled="true">
          Sau →
        </span>
      )}
    </nav>
  );
}
