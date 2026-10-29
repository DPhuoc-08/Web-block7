import { Link, useSearchParams } from "react-router";
import AdminSearch from "../../../components/AdminSearch.jsx";
import { listChefs } from "../../../api/chefs.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { Loading, LoadError } from "../../../components/StatusView.jsx";
import AdminNav from "../../../components/AdminNav.jsx";
import { useJustSaved } from "../../../hooks/useJustSaved.js";
import { tagNames } from "../../../format.js";

// Danh sách quản trị đầu bếp (/admin/chefs). Cùng khuôn với AdminDishListPage.
export default function AdminChefListPage() {
  useDocumentTitle("Quản trị đầu bếp");
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const { status, data: chefs, reload } = useLoad((signal) => listChefs({ q, all: true }, { signal }).then((d) => d.items), [q]);
  const { savedId, savedRowRef } = useJustSaved();

  return (
    <>
      <AdminNav current="chefs" />
      <div className="toolbar">
        <h1>Đầu bếp</h1>
        <Link className="btn btn-primary" to="/admin/chefs/new">
          + Thêm đầu bếp
        </Link>
      </div>

      <AdminSearch label="Tìm đầu bếp" placeholder="Tìm theo tên hoặc chuyên môn" count={status === "ok" ? chefs.length : null} />

      {status === "loading" && <Loading />}
      {status === "error" && <LoadError onRetry={reload} />}
      {status === "ok" && chefs.length === 0 && <div className="panel empty">{q ? "Không có đầu bếp nào khớp từ khoá." : "Chưa có đầu bếp nào."}</div>}
      {status === "ok" && chefs.length > 0 && (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tên</th>
                <th>Chuyên môn</th>
                <th>Phụ trách</th>
                <th>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {chefs.map((c) => (
                <tr key={c.id} className={c.id === savedId ? "just-saved" : undefined} ref={c.id === savedId ? savedRowRef : undefined}>
                  <td className="num" data-label="Mã">
                    {c.id}
                  </td>
                  <td className="title" data-label="Tên">
                    {c.name}
                  </td>
                  <td data-label="Chuyên môn">{tagNames(c.tags)}</td>
                  <td data-label="Phụ trách">{c.dishCount} món</td>
                  <td className="actions">
                    <Link className="btn btn-sm" to={`/admin/chefs/${c.id}/edit`}>
                      Sửa
                    </Link>
                    <Link className="btn btn-sm danger-text" to={`/admin/chefs/${c.id}/delete`}>
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
