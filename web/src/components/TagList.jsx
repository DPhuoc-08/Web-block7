import { Link } from "react-router";

// Tag của món dạng chip nhỏ. Tag loại món (`mainId`, mặc định tag đầu tiên — API sắp theo id, loại món đứng trước)
// có màu nhấn. Thực đơn nhóm theo loại thì ẩn tag loại trên từng dòng nhưng vẫn truyền mainId → tag còn lại không bị tô nhầm.
// - linked = false: dùng bên trong thẻ món (cả thẻ đã là một link) → chỉ là <span>, không lồng link trong link.
// - linked = true:  trang chi tiết → mỗi chip là link lọc thực đơn theo tag đó (/dishes?tag=<id>).
export default function TagList({ tags, linked = false, mainId = tags[0]?.id }) {
  if (tags.length === 0) return null;
  const cls = (t) => `tag-chip${t.id === mainId ? " main" : ""}`;
  if (!linked) {
    return (
      <span className="tag-list">
        {tags.map((t) => (
          <span key={t.id} className={cls(t)}>
            {t.name}
          </span>
        ))}
      </span>
    );
  }
  return (
    <ul className="tag-list" aria-label="Tag của món">
      {tags.map((t) => (
        <li key={t.id}>
          <Link className={cls(t)} to={`/dishes?tag=${t.id}`}>
            {t.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
