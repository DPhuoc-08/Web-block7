import { useState } from "react";
import { Link } from "react-router";
import { toQuery } from "../api/client.js";
import { toPageParams } from "../listQuery.js";
import { ArtIcon, hasArt } from "./DishArt.jsx";

const SHOWN = 5;

// Thanh danh mục của thực đơn (plan mục 13, thay hàng chip tag cũ). Mỗi nút là lối tắt của chế độ Nâng cao:
// link tới URL có mode=advanced&tag=<id>, giữ các điều kiện ĐÃ ÁP DỤNG trên URL (từ khoá, giá…), về trang 1.
// - Hiện sẵn 5 loại món có nhiều món nhất (13.b); nút "N tag khác" mở phần còn lại: loại món khác, rồi Hải sản,
//   Món chay, vùng miền (đủ 16 tag như hàng chip cũ — không mất lối tắt nào).
// - Tag đang lọc nằm trong phần ẩn → phần ẩn mở sẵn để thấy nút đang chọn.
// - Số trên nút = dishCount của tag (đếm toàn bộ món, không theo bộ lọc đang áp dụng — 13.c).
export default function CategoryBar({ tags, query }) {
  const [open, setOpen] = useState(false);
  if (tags.length === 0) return null;

  const activeTag = query.mode === "advanced" ? query.tag : "";
  const byCount = (a, b) => b.dishCount - a.dishCount || a.id - b.id;
  const kinds = tags.filter((t) => hasArt(t.name)).sort(byCount);
  const shown = kinds.slice(0, SHOWN);
  const hidden = [...kinds.slice(SHOWN), ...tags.filter((t) => !hasArt(t.name)).sort(byCount)];
  const activeHidden = hidden.some((t) => String(t.id) === activeTag);
  const expanded = open || activeHidden;

  const url = (tag) => `/dishes${toQuery(toPageParams({ ...query, mode: "advanced", tag, page: "" }))}`;
  const pill = (t) => (
    <Link key={t.id} className="cat-pill" to={url(String(t.id))} aria-current={activeTag === String(t.id) ? "true" : "false"}>
      {hasArt(t.name) && <ArtIcon name={t.name} className="cat-icon" />}
      <span>{t.name}</span>
      <span className="cat-count">{t.dishCount}</span>
    </Link>
  );

  return (
    <nav className="cat-bar" aria-label="Lọc theo tag">
      <Link className="cat-pill" to={url("")} aria-current={activeTag ? "false" : "true"}>
        Tất cả
      </Link>
      {shown.map(pill)}
      {expanded && hidden.map(pill)}
      {/* Đang lọc theo tag ở phần ẩn thì không cho thu gọn (nút đang chọn phải luôn thấy được). */}
      {hidden.length > 0 && !activeHidden && (
        <button type="button" className="cat-more" aria-expanded={expanded} onClick={() => setOpen(!open)}>
          {expanded ? "Thu gọn" : `${hidden.length} tag khác`}
        </button>
      )}
    </nav>
  );
}
