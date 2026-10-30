import { Link, useLocation, useSearchParams } from "react-router";
import AdminSearch, { adminModeParam } from "../../../components/AdminSearch.jsx";
import { listIngredients } from "../../../api/ingredients.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { SkeletonList, LoadError, InvalidQuery } from "../../../components/StatusView.jsx";
import Pagination from "../../../components/Pagination.jsx";
import { isBusiness, toQuery } from "../../../api/client.js";
import AdminNav from "../../../components/AdminNav.jsx";
import { useJustSaved } from "../../../hooks/useJustSaved.js";
import { useListTop } from "../../../hooks/useListTop.js";

const PAGE_SIZE = 20;

// Kiểu tìm (plan 14.f): Cơ bản như cũ; Gần đúng theo tên (pg_trgm) — q bắt buộc, xếp điểm giảm dần rồi id, cột Điểm.
const MODES = [
  { value: "basic", label: "Cơ bản", placeholder: "Tìm theo tên hoặc đơn vị" },
  { value: "fuzzy", label: "Gần đúng", placeholder: "Tên gõ sai vẫn ra — ví dụ: Nước mắn" },
];

// Danh sách quản trị nguyên liệu (/admin/ingredients?q=&page=). Cùng khuôn với AdminDishListPage: phân trang tại server
// (mỗi lần 20 nguyên liệu, id tăng dần), q và page nằm trên URL của trang. Plan mục 12.
// ?mode=fuzzy: gần đúng theo tên, xếp theo điểm (plan 14.f, 14.g); mode giữ trên URL như q.
export default function AdminIngredientListPage() {
  useDocumentTitle("Quản trị nguyên liệu");
  const { pathname, search } = useLocation();
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  // page gửi nguyên văn cho API: API là nơi kiểm tra (page=0, page=abc → VALIDATION_FAILED → InvalidQuery).
  const rawPage = searchParams.get("page") ?? "";
  const mode = adminModeParam(searchParams);
  const { status, data, error, reload } = useLoad(
    (signal) => listIngredients({ mode, q, page: rawPage, pageSize: PAGE_SIZE }, { signal }),
    [q, rawPage, mode],
  );
  const { savedId, savedRowRef } = useJustSaved();
  const ingredients = data?.items ?? [];
  const scored = ingredients.some((i) => i.score !== undefined);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const hrefFor = (n) => `${pathname}${toQuery({ q, mode, page: n > 1 ? n : "" })}`;
  // Sửa/xoá xong quay về đúng URL danh sách này (giữ trang, từ khoá).
  const backState = { backTo: pathname + search };
  const topRef = useListTop(rawPage);

  const invalid = status === "error" && isBusiness(error, "VALIDATION_FAILED");

  return (
    <>
      <AdminNav current="ingredients" />
      <div className="toolbar">
        <h1 ref={topRef} tabIndex={-1} className="list-anchor">
          Nguyên liệu
        </h1>
        <Link className="btn btn-primary" to="/admin/ingredients/new" state={backState}>
          + Thêm nguyên liệu
        </Link>
      </div>

      <AdminSearch label="Tìm nguyên liệu" placeholder="Tìm theo tên hoặc đơn vị" count={status === "ok" ? data.total : null} modes={MODES} />

      {status === "loading" && <SkeletonList rows={8} variant="table" />}
      {invalid && <InvalidQuery fields={error.fields} resetTo={pathname} resetLabel="Về trang 1" />}
      {status === "error" && !invalid && <LoadError onRetry={reload} />}
      {status === "ok" && data.total === 0 && (
        <div className="panel empty">{q ? "Không có nguyên liệu nào khớp từ khoá." : "Chưa có nguyên liệu nào."}</div>
      )}
      {/* Trang vượt phạm vi (sửa tay URL, hoặc vừa xoá dòng cuối của trang cuối): thành công nhưng items rỗng. */}
      {status === "ok" && data.total > 0 && ingredients.length === 0 && (
        <div className="panel empty">
          <strong>Trang {data.page} không có nguyên liệu nào.</strong>
          <Link to={hrefFor(totalPages)}>Về trang cuối ({totalPages})</Link>
        </div>
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
                {scored && <th>Điểm</th>}
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
                  {scored && (
                    <td className="num" data-label="Điểm">
                      {i.score.toFixed(3)}
                    </td>
                  )}
                  <td className="actions">
                    <Link className="btn btn-sm" to={`/admin/ingredients/${i.id}/edit`} state={backState}>
                      Sửa
                    </Link>
                    <Link className="btn btn-sm danger-text" to={`/admin/ingredients/${i.id}/delete`} state={backState}>
                      Xoá
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status === "ok" && ingredients.length > 0 && (
        <>
          <p className="muted page-summary" role="status">
            Nguyên liệu {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + ingredients.length} trong {data.total} nguyên liệu
          </p>
          <Pagination page={data.page} totalPages={totalPages} hrefFor={hrefFor} label="Phân trang nguyên liệu" />
        </>
      )}
    </>
  );
}
