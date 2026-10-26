import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { listDishes } from "../../api/dishes.js";
import { listTags } from "../../api/tags.js";
import { isBusiness, toQuery } from "../../api/client.js";
import { useLoad } from "../../hooks/useLoad.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { Loading, LoadError, InvalidQuery } from "../../components/StatusView.jsx";
import DishRow from "../../components/DishRow.jsx";
import SearchPanel from "../../components/SearchPanel.jsx";
import Pagination from "../../components/Pagination.jsx";
import { readQuery, toApiParams, toPageParams, isFiltered, TEXT_MODES } from "../../listQuery.js";

// Thực đơn (/dishes). Điều kiện tìm/lọc/sắp xếp và số trang nằm trên URL của TRANG (listQuery.js):
// Reload, copy link, Back/Forward mở lại đúng kết quả. Trang đọc URL rồi gọi GET /api/dishes cho ĐÚNG MỘT trang
// (phân trang tại server — plan mục 0): Network chỉ nhận 12 món dạng JSON mỗi lần, không tải cả 1.200 món.
export default function DishListPage() {
  useDocumentTitle("Thực đơn");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = readQuery(searchParams);
  const urlKey = searchParams.toString();

  // Tag tải một lần khi mở trang (chip, ô chọn tag); danh sách món tải lại mỗi khi URL đổi.
  const tags = useLoad((signal) => listTags({ signal }), []);
  const tagList = tags.status === "ok" ? tags.data.filter((t) => t.dishCount > 0) : [];

  // Toàn văn / gần đúng mà URL không có từ khoá: không gọi API (API sẽ báo lỗi q), form tự báo "Nhập từ khoá".
  const needsQ = TEXT_MODES.includes(query.mode) && !query.q;
  const list = useLoad((signal) => (needsQ ? Promise.resolve(null) : listDishes(toApiParams(query), { signal })), [urlKey]);
  const invalid = list.status === "error" && isBusiness(list.error, "VALIDATION_FAILED");
  const data = list.status === "ok" ? list.data : null;
  const dishes = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  // Áp dụng điều kiện mới → URL mới, về trang 1 (kết quả mới); giữ cách hiển thị đang chọn.
  const apply = (next) => navigate(`/dishes${toQuery(toPageParams({ ...next, view: query.view, page: "" }))}`);
  // Link trang n: giữ nguyên bộ điều kiện, chỉ đổi page.
  const hrefFor = (n) => `/dishes${toQuery(toPageParams({ ...query, page: n > 1 ? String(n) : "" }))}`;
  const clearUrl = `/dishes${toQuery(toPageParams({ mode: "basic", q: "", view: query.view, page: "" }))}`;

  // Đổi trang → đưa đầu danh sách vào màn hình (nút phân trang ở cuối). Lần mở đầu không cuộn.
  const listTopRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) return void (firstRender.current = false);
    listTopRef.current?.scrollIntoView({ block: "start" });
  }, [query.page]);

  return (
    <>
      <div className="page-head">
        <h1>Thực đơn</h1>
        <p>Tìm món theo tên, tag, khoảng giá; chọn món để xem mô tả, giá và tình trạng phục vụ.</p>
      </div>

      <SearchPanel query={query} tags={tagList} fieldErrors={invalid ? list.error.fields : {}} onApply={apply} />

      <div ref={listTopRef} className="list-anchor" />
      {list.status === "loading" && <Loading />}
      {invalid && <InvalidQuery fields={list.error.fields} resetTo={clearUrl} resetLabel="Xoá bộ lọc" />}
      {list.status === "error" && !invalid && <LoadError onRetry={list.reload} />}
      {data && (
        <>
          <div className="result-line" role="status" aria-live="polite">
            <span>
              {data.total} món{isFiltered(query) ? " khớp điều kiện" : ""}
              {query.q && <> cho “{query.q}”</>}
              {TEXT_MODES.includes(query.mode) && data.total > 0 && " · xếp theo độ phù hợp"}
            </span>
            {isFiltered(query) && <Link to={clearUrl}>Xoá bộ lọc</Link>}
          </div>

          {data.total === 0 ? (
            // Không có kết quả là thành công (items: [], total: 0), không phải lỗi.
            <div className="empty">
              <strong>{isFiltered(query) ? "Không có món nào khớp điều kiện." : "Chưa có món nào."}</strong>
              {query.mode === "fuzzy" && "Tìm gần đúng không bỏ dấu: thử gõ có dấu, hoặc dùng chế độ Cơ bản. "}
              {isFiltered(query) && (
                <>
                  Thử bỏ bớt tiêu chí hoặc <Link to={clearUrl}>xem toàn bộ thực đơn</Link>.
                </>
              )}
            </div>
          ) : dishes.length === 0 ? (
            // Trang vượt phạm vi (sửa tay URL): thành công nhưng items rỗng.
            <div className="empty">
              <strong>Trang {data.page} không có món nào.</strong>
              <Link to={hrefFor(totalPages)}>Về trang cuối ({totalPages})</Link>
            </div>
          ) : (
            <>
              <section className="menu-group">
                <h2 className="sr-only">Kết quả</h2>
                <div className="menu-grid flat">
                  {dishes.map((dish) => (
                    <DishRow key={dish.id} dish={dish} />
                  ))}
                </div>
              </section>
              <p className="muted page-summary">
                Món {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + dishes.length} trong {data.total} món
              </p>
              <Pagination page={data.page} totalPages={totalPages} hrefFor={hrefFor} label="Phân trang thực đơn" />
            </>
          )}
        </>
      )}
    </>
  );
}
