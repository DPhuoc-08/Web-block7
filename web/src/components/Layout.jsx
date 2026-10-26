import { Link, Outlet, useLocation } from "react-router";
import Flash from "./Flash.jsx";

// Khung chung của mọi trang. <Outlet /> là chỗ router đặt trang khớp với URL hiện tại.
// Bấm link trong khung (Link) chỉ đổi URL bằng History API — không có document request mới.
export default function Layout() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className={isAdmin ? "admin app" : "app"}>
      <header className="site-header">
        <div className="container">
          <Link className="brand" to="/dishes">
            Nhà hàng{isAdmin && <span> / Quản trị</span>}
          </Link>
          <nav className="site-nav" aria-label="Điều hướng chính">
            <Link to="/dishes" aria-current={isAdmin ? undefined : "page"}>
              Thực đơn
            </Link>
            <Link to="/admin/dishes" aria-current={isAdmin ? "page" : undefined}>
              Quản trị
            </Link>
          </nav>
        </div>
      </header>

      <main className="container">
        <Flash />
        <Outlet />
      </main>

      {!isAdmin && (
        <footer className="site-footer">
          <div className="container">
            <span>Nhà hàng · Giao diện SPA, dữ liệu đọc từ REST API ở mỗi lần mở trang.</span>
          </div>
        </footer>
      )}
    </div>
  );
}
