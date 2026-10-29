import { useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { listDishes } from "../../api/dishes.js";
import { listTags } from "../../api/tags.js";
import { isBusiness, toQuery } from "../../api/client.js";
import { useLoad } from "../../hooks/useLoad.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { SkeletonList, LoadError, InvalidQuery } from "../../components/StatusView.jsx";
import DishCard from "../../components/DishCard.jsx";
import SearchPanel from "../../components/SearchPanel.jsx";
import Pagination from "../../components/Pagination.jsx";
import ViewSwitch from "../../components/ViewSwitch.jsx";
import MenuHero from "../../components/MenuHero.jsx";
import CategoryBar from "../../components/CategoryBar.jsx";
import LoadMore from "../../components/LoadMore.jsx";
import InfiniteSentinel from "../../components/InfiniteSentinel.jsx";
import { useAppendList } from "../../hooks/useAppendList.js";
import { useListTop } from "../../hooks/useListTop.js";
import { readQuery, toApiParams, toPageParams, conditionKey, isFiltered, TEXT_MODES, SORTS, PAGE_SIZE } from "../../listQuery.js";

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

// Đầu trang (có khung tìm) + thanh danh mục: dùng chung cho cả 3 cách hiển thị (plan mục 13).
// Đầu trang đầy đủ chỉ ở trang 1 khi chưa có điều kiện; có từ khoá / bộ lọc / sắp xếp hoặc page ≥ 2 → thu gọn.
// dishes, loading: danh sách đang hiện → ảnh ghép của đầu trang (13.d), không gọi thêm API.
function MenuHead({ query, tagList, fieldErrors, onApply, dishes, loading }) {
  const full = !isFiltered(query) && (query.page === "" || query.page === "1");
  return (
    <>
      <MenuHero full={full} dishes={dishes} loading={loading}>
        <SearchPanel query={query} tags={tagList} fieldErrors={fieldErrors} onApply={onApply} />
      </MenuHero>
      <CategoryBar tags={tagList} query={query} />
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

// Thanh công cụ trên danh sách: dòng kết quả + Xoá bộ lọc (bên trái); công tắc cách hiển thị + ô sắp xếp (bên phải, 13.g).
// Trang khách không hiện số đếm (plan 13.4): chỉ khi đang tìm/lọc mới có dòng chữ "Kết quả cho “…”", và chỉ sau khi
// response đã về (`total` ≠ null) — vùng role=status để trình đọc màn hình biết danh sách vừa đổi.
// Ô sắp xếp áp dụng ngay trên bộ điều kiện ĐÃ ÁP DỤNG (URL), về trang 1; toàn văn / gần đúng xếp theo điểm → khoá ô.
function MenuToolbar({ query, total, clearUrl, onApply, fieldErrors }) {
  const viewHref = (v) => `/dishes${toQuery(toPageParams({ ...query, view: v, page: "" }))}`;
  const isText = TEXT_MODES.includes(query.mode);
  return (
    <div className="menu-toolbar">
      <div className="result-line" role="status" aria-live="polite">
        {total !== null && isFiltered(query) && (
          <span>
            {query.q ? <>Kết quả cho “{query.q}”</> : "Kết quả theo bộ lọc"}
            {isText && total > 0 && " · xếp theo độ phù hợp"}
          </span>
        )}
        {isFiltered(query) && <Link to={clearUrl}>Xoá bộ lọc</Link>}
      </div>
      <div className="toolbar-tools">
        <ViewSwitch current={query.view} hrefFor={viewHref} />
        <label className={`sort-pick${fieldErrors.sort ? " invalid" : ""}`}>
          <span>Sắp xếp</span>
          <select name="sort" value={isText ? "" : query.sort} disabled={isText} onChange={(e) => onApply({ ...query, sort: e.target.value })}>
            {isText ? (
              <option value="">Theo độ phù hợp</option>
            ) : (
              SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      {fieldErrors.sort && <span className="error">{fieldErrors.sort}</span>}
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
      <div className="menu-cards">
        {dishes.map((dish, i) => (
          <DishCard key={dish.id} dish={dish} appear={i >= appearFrom} />
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

  const fieldErrors = invalid ? list.error.fields : {};

  return (
    <>
      <MenuHead query={query} tagList={tagList} fieldErrors={fieldErrors} onApply={apply} dishes={list.items} loading={firstLoad && list.pending} />
      <MenuToolbar query={query} total={list.total} clearUrl={clearUrl} onApply={apply} fieldErrors={fieldErrors} />
      {invalid && <InvalidQuery fields={list.error.fields} resetTo={clearUrl} resetLabel="Xoá bộ lọc" />}
      {!invalid && firstLoad && list.pending && <SkeletonList />}
      {!invalid && firstLoad && list.error && <LoadError onRetry={list.loadNext} />}
      {!firstLoad && (
        <>
          {list.total === 0 ? (
            <NoResults query={query} clearUrl={clearUrl} />
          ) : (
            <>
              <DishGrid dishes={list.items} appearFrom={PAGE_SIZE} />
              {infinite && <InfiniteSentinel onVisible={list.loadNext} disabled={list.end || Boolean(list.error)} itemCount={list.items.length} />}
              <LoadMore pending={list.pending} end={list.end} error={list.error} onLoad={list.loadNext} />
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

  const fieldErrors = invalid ? list.error.fields : {};

  return (
    <>
      <MenuHead query={query} tagList={tagList} fieldErrors={fieldErrors} onApply={apply} dishes={dishes} loading={list.status === "loading"} />

      <div ref={listTopRef} className="list-anchor" tabIndex={-1}>
        <span className="sr-only">Danh sách món, trang {query.page || 1}</span>
      </div>
      <MenuToolbar query={query} total={data?.total ?? null} clearUrl={clearUrl} onApply={apply} fieldErrors={fieldErrors} />
      {list.status === "loading" && <SkeletonList />}
      {invalid && <InvalidQuery fields={list.error.fields} resetTo={clearUrl} resetLabel="Xoá bộ lọc" />}
      {list.status === "error" && !invalid && <LoadError onRetry={list.reload} />}
      {data && (
        <>
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
              <Pagination page={data.page} totalPages={totalPages} hrefFor={hrefFor} label="Phân trang thực đơn" />
            </>
          )}
        </>
      )}
    </>
  );
}
