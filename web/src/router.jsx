import { createBrowserRouter, Navigate } from "react-router";
import Layout from "./components/Layout.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import DishListPage from "./pages/dishes/DishListPage.jsx";
import DishDetailPage from "./pages/dishes/DishDetailPage.jsx";
import AdminDishListPage from "./pages/admin/dishes/AdminDishListPage.jsx";
import DishFormPage from "./pages/admin/dishes/DishFormPage.jsx";
import DishDeletePage from "./pages/admin/dishes/DishDeletePage.jsx";
import AdminChefListPage from "./pages/admin/chefs/AdminChefListPage.jsx";
import ChefFormPage from "./pages/admin/chefs/ChefFormPage.jsx";
import ChefDeletePage from "./pages/admin/chefs/ChefDeletePage.jsx";
import AdminIngredientListPage from "./pages/admin/ingredients/AdminIngredientListPage.jsx";
import IngredientFormPage from "./pages/admin/ingredients/IngredientFormPage.jsx";
import IngredientDeletePage from "./pages/admin/ingredients/IngredientDeletePage.jsx";

// Routing phía client: router đọc URL trên thanh địa chỉ và chọn trang ngay trong browser.
// URL của TRANG (/dishes/2) khác URL của API (/api/dishes/2): trang do router quyết định, API do backend quyết định.
// React Router ở chế độ thư viện (createBrowserRouter): không dùng loader/action hay render ở server —
// mỗi trang tự gọi API qua api/*.js.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dishes" replace /> },

      // Trang người dùng (chỉ đọc)
      { path: "dishes", element: <DishListPage /> },
      // Path param: /dishes/2 → useParams().id = "2"
      { path: "dishes/:id", element: <DishDetailPage /> },

      // Trang quản trị. Form và trang xác nhận xoá là trang của SPA; việc ghi là request tới API.
      { path: "admin", element: <Navigate to="/admin/dishes" replace /> },
      { path: "admin/dishes", element: <AdminDishListPage /> },
      { path: "admin/dishes/new", element: <DishFormPage /> },
      { path: "admin/dishes/:id/edit", element: <DishFormPage /> },
      { path: "admin/dishes/:id/delete", element: <DishDeletePage /> },
      // Đầu bếp, nguyên liệu: cùng cấu trúc URL; không có trang chi tiết (thêm/sửa/xoá xong về danh sách).
      { path: "admin/chefs", element: <AdminChefListPage /> },
      { path: "admin/chefs/new", element: <ChefFormPage /> },
      { path: "admin/chefs/:id/edit", element: <ChefFormPage /> },
      { path: "admin/chefs/:id/delete", element: <ChefDeletePage /> },
      { path: "admin/ingredients", element: <AdminIngredientListPage /> },
      { path: "admin/ingredients/new", element: <IngredientFormPage /> },
      { path: "admin/ingredients/:id/edit", element: <IngredientFormPage /> },
      { path: "admin/ingredients/:id/delete", element: <IngredientDeletePage /> },

      // Không route nào khớp → trang "không tìm thấy" do SPA tự hiện.
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
