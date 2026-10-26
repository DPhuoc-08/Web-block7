import { Link } from "react-router";

const TABS = [
  ["dishes", "Món ăn"],
  ["chefs", "Đầu bếp"],
  ["ingredients", "Nguyên liệu"],
];

// Thanh chuyển giữa 3 trang quản trị (giữ từ block5).
export default function AdminNav({ current }) {
  return (
    <nav className="admin-nav" aria-label="Quản trị">
      {TABS.map(([key, label]) => (
        <Link key={key} to={`/admin/${key}`} className={key === current ? "current" : undefined} aria-current={key === current ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
