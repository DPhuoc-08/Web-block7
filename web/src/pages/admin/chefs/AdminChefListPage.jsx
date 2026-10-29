import { Link, useLocation, useSearchParams } from "react-router";
import AdminSearch from "../../../components/AdminSearch.jsx";
import { listChefs } from "../../../api/chefs.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { SkeletonList, LoadError, InvalidQuery } from "../../../components/StatusView.jsx";
import Pagination from "../../../components/Pagination.jsx";
import { isBusiness, toQuery } from "../../../api/client.js";
import AdminNav from "../../../components/AdminNav.jsx";
import { useJustSaved } from "../../../hooks/useJustSaved.js";
import { useListTop } from "../../../hooks/useListTop.js";
import { tagNames } from "../../../format.js";

const PAGE_SIZE = 20;

// Danh sách quản trị đầu bếp (/admin/chefs?q=&page=). Cùng khuôn với AdminDishListPage: phân trang tại server
// (mỗi lần 20 đầu bếp, id tăng dần), q và page nằm trên URL của trang. Plan mục 12.
export default function AdminChefListPage() {
  useDocumentTitle("Quản trị đầu bếp");
  const { pathname, search } = useLocation();
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  // page gửi nguyên văn cho API: API là nơi kiểm tra (page=0, page=abc → VALIDATION_FAILED → InvalidQuery).
  const rawPage = searchParams.get("page") ?? "";
  const { status, data, error, reload } = useLoad((signal) => listChefs({ q, page: rawPage, pageSize: PAGE_SIZE }, { signal }), [q, rawPage]);
  const { savedId, savedRowRef } = useJustSaved();
  const chefs = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const hrefFor = (n) => `${pathname}${toQuery({ q, page: n > 1 ? n : "" })}`;
  // Sửa/xoá xong quay về đúng URL danh sách này (giữ trang, từ khoá).
  const backState = { backTo: pathname + search };
  const topRef = useListTop(rawPage);

  const invalid = status === "error" && isBusiness(error, "VALIDATION_FAILED");

  return (
    <>
      <AdminNav current="chefs" />
      <div className="toolbar">
        <h1 ref={topRef} tabIndex={-1} className="list-anchor">
          Đầu bếp
        </h1>
        <Link className="btn btn-primary" to="/admin/chefs/new" state={backState}>
          + Thêm đầu bếp
        </Link>
      </div>

      <AdminSearch label="Tìm đầu bếp" placeholder="Tìm theo tên hoặc chuyên môn" count={status === "ok" ? data.total : null} />

      {status === "loading" && <SkeletonList rows={8} variant="table" />}
      {invalid && <InvalidQuery fields={error.fields} resetTo={pathname} resetLabel="Về trang 1" />}
      {status === "error" && !invalid && <LoadError onRetry={reload} />}
      {status === "ok" && data.total === 0 && <div className="panel empty">{q ? "Không có đầu bếp nào khớp từ khoá." : "Chưa có đầu bếp nào."}</div>}
      {/* Trang vượt phạm vi (sửa tay URL, hoặc vừa xoá dòng cuối của trang cuối): thành công nhưng items rỗng. */}
      {status === "ok" && data.total > 0 && chefs.length === 0 && (
        <div className="panel empty">
          <strong>Trang {data.page} không có đầu bếp nào.</strong>
          <Link to={hrefFor(totalPages)}>Về trang cuối ({totalPages})</Link>
        </div>
      )}
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
                    <Link className="btn btn-sm" to={`/admin/chefs/${c.id}/edit`} state={backState}>
                      Sửa
                    </Link>
                    <Link className="btn btn-sm danger-text" to={`/admin/chefs/${c.id}/delete`} state={backState}>
                      Xoá
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status === "ok" && chefs.length > 0 && (
        <>
          <p className="muted page-summary" role="status">
            Đầu bếp {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + chefs.length} trong {data.total} đầu bếp
          </p>
          <Pagination page={data.page} totalPages={totalPages} hrefFor={hrefFor} label="Phân trang đầu bếp" />
        </>
      )}
    </>
  );
}
