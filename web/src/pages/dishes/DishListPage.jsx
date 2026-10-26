import { useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { listDishes } from "../../api/dishes.js";
import { listTags } from "../../api/tags.js";
import { isBusiness, toQuery } from "../../api/client.js";
import { useLoad } from "../../hooks/useLoad.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { SkeletonList, LoadError, InvalidQuery } from "../../components/StatusView.jsx";
import DishRow from "../../components/DishRow.jsx";
import SearchPanel from "../../components/SearchPanel.jsx";
import Pagination from "../../components/Pagination.jsx";
import ViewSwitch from "../../components/ViewSwitch.jsx";
import LoadMore from "../../components/LoadMore.jsx";
import InfiniteSentinel from "../../components/InfiniteSentinel.jsx";
import { useAppendList } from "../../hooks/useAppendList.js";
import { useListTop } from "../../hooks/useListTop.js";
import { readQuery, toApiParams, toPageParams, conditionKey, isFiltered, TEXT_MODES, PAGE_SIZE } from "../../listQuery.js";

// Thực đơn (/dishes). Điều kiện tìm/lọc/sắp xếp nằm trên URL của TRANG (listQuery.js): Reload, copy link,
// Back/Forward mở lại đúng điều kiện. Phân trang tại server cho cả 3 cách hiển thị (plan mục 0): mỗi request
// GET /api/dishes chỉ nhận 12 món dạng JSON.
// - view=pages (mặc định): đổi trang THAY danh sách; ?page= nằm trên URL.
// - view=more / scroll:     NỐI trang tiếp vào danh sách (useAppendList); URL không ghi page → mở lại link thì tải
//                           lại từ đầu với cùng điều kiện (plan mục 10.11).
export default function DishListPage() {
  const [searchParams] = useSearchParams();
  const view = readQuery(searchParams).view;
  // Đổi cách hiển thị = dựng lại phần kết quả (state của kiểu này không dùng cho kiểu kia).
  return view === "pages" ? <PagedMenu /> : <AppendMenu key={view} infinite={view === "scroll"} />;
}

// Phần đầu trang + khung tìm + công tắc cách hiển thị: dùng chung cho cả 3 cách.
function MenuHead({ query, tagList, fieldErrors, onApply }) {
  const viewHref = (v) => `/dishes${toQuery(toPageParams({ ...query, view: v, page: "" }))}`;
  return (
    <>
      <div className="page-head">
        <h1>Thực đơn</h1>
        <p>Tìm món theo tên, tag, khoảng giá; chọn món để xem mô tả, giá và tình trạng phục vụ.</p>
      </div>
      <SearchPanel query={query} tags={tagList} fieldErrors={fieldErrors} onApply={onApply} />
      <ViewSwitch current={query.view} hrefFor={viewHref} />
    </>
  );
}

function useMenuBase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = readQuery(searchParams);
  const tags = useLoad((signal) => listTags({ signal }), []);
  const tagList = tags.status === "ok" ? tags.data.filter((t) => t.dishCount > 0) : [];
  // Áp dụng điều kiện mới → URL mới, về trang 1 (kết quả mới); giữ cách hiển thị đang chọn.
  const apply = (next) => navigate(`/dishes${toQuery(toPageParams({ ...next, view: query.view, page: "" }))}`);
  const clearUrl = `/dishes${toQuery(toPageParams({ mode: "basic", q: "", view: query.view, page: "" }))}`;
  // Toàn văn / gần đúng mà URL không có từ khoá: không gọi API (API sẽ báo lỗi q), form tự báo "Nhập từ khoá".
  const needsQ = TEXT_MODES.includes(query.mode) && !query.q;
  return { query, searchParams, tagList, apply, clearUrl, needsQ };
}

// Dòng "N món khớp điều kiện cho “…”" + Xoá bộ lọc; trạng thái rỗng (không có kết quả là thành công, không phải lỗi).
function ResultLine({ query, total, clearUrl }) {
  return (
    <div className="result-line" role="status" aria-live="polite">
      <span>
        {total} món{isFiltered(query) ? " khớp điều kiện" : ""}
        {query.q && <> cho “{query.q}”</>}
        {TEXT_MODES.includes(query.mode) && total > 0 && " · xếp theo độ phù hợp"}
      </span>
      {isFiltered(query) && <Link to={clearUrl}>Xoá bộ lọc</Link>}
    </div>
  );
}

function NoResults({ query, clearUrl }) {
  return (
    <div className="empty">
      <strong>{isFiltered(query) ? "Không có món nào khớp điều kiện." : "Chưa có món nào."}</strong>
      {query.mode === "fuzzy" && "Tìm gần đúng không bỏ dấu: thử gõ có dấu, hoặc dùng chế độ Cơ bản. "}
      {isFiltered(query) && (
        <>
          Thử bỏ bớt tiêu chí hoặc <Link to={clearUrl}>xem toàn bộ thực đơn</Link>.
        </>
      )}
    </div>
  );
}

// appearFrom: món từ vị trí này trở đi là món nối thêm → có hiệu ứng hiện dần; trang đầu hiện ngay, không hiệu ứng.
// Hiệu ứng chỉ chạy khi phần tử được gắn vào trang (key = id món), các món đã có không chạy lại khi nối trang sau.
function DishGrid({ dishes, appearFrom = Infinity }) {
  return (
    <section className="menu-group">
      <h2 className="sr-only">Kết quả</h2>
      <div className="menu-grid flat">
        {dishes.map((dish, i) => (
          <DishRow key={dish.id} dish={dish} appear={i >= appearFrom} />
        ))}
      </div>
    </section>
  );
}

// Tải thêm / Cuộn vô hạn: danh sách nối thêm, dùng chung loadNext() (useAppendList).
function AppendMenu({ infinite }) {
  useDocumentTitle("Thực đơn");
  const { query, tagList, apply, clearUrl, needsQ } = useMenuBase();
  const key = conditionKey(query);
  // Một trang của API cho bộ điều kiện hiện tại; useAppendList truyền số trang và signal huỷ.
  const loadPage = useCallback(
    (page, signal) => (needsQ ? Promise.resolve({ items: [], total: 0, page: 1, pageSize: 12 }) : listDishes(toApiParams(query, { page }), { signal })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, needsQ],
  );
  const list = useAppendList(loadPage, key);
  const invalid = isBusiness(list.error, "VALIDATION_FAILED");
  const firstLoad = list.total === null;

  return (
    <>
      <MenuHead query={query} tagList={tagList} fieldErrors={invalid ? list.error.fields : {}} onApply={apply} />
      {invalid && <InvalidQuery fields={list.error.fields} resetTo={clearUrl} resetLabel="Xoá bộ lọc" />}
      {!invalid && firstLoad && list.pending && <SkeletonList />}
      {!invalid && firstLoad && list.error && <LoadError onRetry={list.loadNext} />}
      {!firstLoad && (
        <>
          <ResultLine query={query} total={list.total} clearUrl={clearUrl} />
          {list.total === 0 ? (
            <NoResults query={query} clearUrl={clearUrl} />
          ) : (
            <>
              <DishGrid dishes={list.items} appearFrom={PAGE_SIZE} />
              {infinite && <InfiniteSentinel onVisible={list.loadNext} disabled={list.end || Boolean(list.error)} itemCount={list.items.length} />}
              <LoadMore pending={list.pending} end={list.end} error={list.error} shown={list.items.length} total={list.total} onLoad={list.loadNext} />
            </>
          )}
        </>
      )}
    </>
  );
}

// Số trang: đổi trang THAY danh sách, page trên URL.
function PagedMenu() {
  useDocumentTitle("Thực đơn");
  const { query, searchParams, tagList, apply, clearUrl, needsQ } = useMenuBase();
  const urlKey = searchParams.toString();
  const list = useLoad((signal) => (needsQ ? Promise.resolve(null) : listDishes(toApiParams(query), { signal })), [urlKey]);
  const invalid = list.status === "error" && isBusiness(list.error, "VALIDATION_FAILED");
  const data = list.status === "ok" ? list.data : null;
  const dishes = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  // Link trang n: giữ nguyên bộ điều kiện, chỉ đổi page.
  const hrefFor = (n) => `/dishes${toQuery(toPageParams({ ...query, page: n > 1 ? String(n) : "" }))}`;

  // Đổi trang → cuộn mượt về đầu danh sách và đưa focus tới đó (nút phân trang ở cuối).
  const listTopRef = useListTop(query.page);

  return (
    <>
      <MenuHead query={query} tagList={tagList} fieldErrors={invalid ? list.error.fields : {}} onApply={apply} />

      <div ref={listTopRef} className="list-anchor" tabIndex={-1}>
        <span className="sr-only">Danh sách món, trang {query.page || 1}</span>
      </div>
      {list.status === "loading" && <SkeletonList />}
      {invalid && <InvalidQuery fields={list.error.fields} resetTo={clearUrl} resetLabel="Xoá bộ lọc" />}
      {list.status === "error" && !invalid && <LoadError onRetry={list.reload} />}
      {data && (
        <>
          <ResultLine query={query} total={data.total} clearUrl={clearUrl} />

          {data.total === 0 ? (
            <NoResults query={query} clearUrl={clearUrl} />
          ) : dishes.length === 0 ? (
            // Trang vượt phạm vi (sửa tay URL): thành công nhưng items rỗng.
            <div className="empty">
              <strong>Trang {data.page} không có món nào.</strong>
              <Link to={hrefFor(totalPages)}>Về trang cuối ({totalPages})</Link>
            </div>
          ) : (
            <>
              <DishGrid dishes={dishes} />
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
