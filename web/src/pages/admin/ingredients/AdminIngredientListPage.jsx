import { Link, useSearchParams } from "react-router";
import AdminSearch from "../../../components/AdminSearch.jsx";
import { listIngredients } from "../../../api/ingredients.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { Loading, LoadError } from "../../../components/StatusView.jsx";
import AdminNav from "../../../components/AdminNav.jsx";
import { useJustSaved } from "../../../hooks/useJustSaved.js";

// Danh sách quản trị nguyên liệu (/admin/ingredients). Cùng khuôn với AdminDishListPage.
export default function AdminIngredientListPage() {
  useDocumentTitle("Quản trị nguyên liệu");
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const { status, data: ingredients, reload } = useLoad((signal) => listIngredients({ q, all: true }, { signal }).then((d) => d.items), [q]);
  const { savedId, savedRowRef } = useJustSaved();

  return (
    <>
      <AdminNav current="ingredients" />
      <div className="toolbar">
        <h1>Nguyên liệu</h1>
        <Link className="btn btn-primary" to="/admin/ingredients/new">
          + Thêm nguyên liệu
        </Link>
      </div>

      <AdminSearch label="Tìm nguyên liệu" placeholder="Tìm theo tên hoặc đơn vị" count={status === "ok" ? ingredients.length : null} />

      {status === "loading" && <Loading />}
      {status === "error" && <LoadError onRetry={reload} />}
      {status === "ok" && ingredients.length === 0 && (
        <div className="panel empty">{q ? "Không có nguyên liệu nào khớp từ khoá." : "Chưa có nguyên liệu nào."}</div>
      )}
      {status === "ok" && ingredients.length > 0 && (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tên</th>
                <th>Đơn vị</th>
                <th>Dùng trong</th>
                <th>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((i) => (
                <tr key={i.id} className={i.id === savedId ? "just-saved" : undefined} ref={i.id === savedId ? savedRowRef : undefined}>
                  <td className="num" data-label="Mã">
                    {i.id}
                  </td>
                  <td className="title" data-label="Tên">
                    {i.name}
                  </td>
                  <td data-label="Đơn vị">{i.unit ?? "—"}</td>
                  <td data-label="Dùng trong">{i.dishCount} món</td>
                  <td className="actions">
                    <Link className="btn btn-sm" to={`/admin/ingredients/${i.id}/edit`}>
                      Sửa
                    </Link>
                    <Link className="btn btn-sm danger-text" to={`/admin/ingredients/${i.id}/delete`}>
                      Xoá
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
