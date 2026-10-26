import { Link } from "react-router";
import { VIEWS } from "../listQuery.js";

// Công tắc cách hiển thị thực đơn (?view=pages|more|scroll). Ba cách dùng CHUNG một API server-paged
// (GET /api/dishes?page=&pageSize=), chỉ khác cách trang gọi các trang tiếp theo. Mỗi nút là link: giữ nguyên
// bộ điều kiện, bỏ ?page (đổi cách hiển thị = xem lại từ đầu).
export default function ViewSwitch({ current, hrefFor }) {
  return (
    <nav className="view-switch" aria-label="Cách hiển thị">
      {VIEWS.map((v) => (
        <Link key={v.value} className="view-btn" to={hrefFor(v.value)} aria-current={v.value === current ? "true" : undefined}>
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
