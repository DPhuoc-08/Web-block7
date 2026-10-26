import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { listDishes } from "../../api/dishes.js";
import { getCategories } from "../../api/categories.js";
import { toQuery } from "../../api/client.js";
import { useLoad } from "../../hooks/useLoad.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { Loading, LoadError } from "../../components/StatusView.jsx";
import DishRow from "../../components/DishRow.jsx";
import { PRICE_RANGES, SORTS, readFilters, filtersToParams, isFiltered, groupByCategory } from "../../menuOptions.js";

// Thực đơn (/dishes). Mọi tiêu chí lọc nằm trên URL của TRANG (/dishes?q=&category=&price=&available=1&sort=):
// lưu/gửi được link kết quả, Reload hay Back vẫn ra đúng kết quả. Trang đọc URL rồi gọi
// GET /api/dishes với cùng các tham số (URL trang và URL API là hai thứ khác nhau).
export default function DishListPage() {
  useDocumentTitle("Thực đơn");
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const key = searchParams.toString();

  // Chỉ ô tên món giữ chữ đang gõ (áp dụng khi Enter / Tìm); đồng bộ lại khi URL đổi (Back/Forward, "Xoá bộ lọc").
  // Các ô chọn đọc thẳng từ URL.
  const [q, setQ] = useState(filters.q);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setQ(readFilters(searchParams).q), [key]);

  // Hai lần tải riêng: loại món (cho chip) tải một lần khi mở trang; danh sách món tải lại mỗi khi bộ lọc trên URL đổi
  // → chip không bị ẩn/hiện mỗi lần lọc.
  const cats = useLoad((signal) => getCategories({ signal }), []);
  const { status, data: dishes, reload } = useLoad((signal) => listDishes(filtersToParams(filters), { signal }), [key]);

  // Mọi điều khiển lọc áp dụng cùng một cách: đổi query trên URL → trang tự gọi lại API. Đi kèm chữ đang có
  // trong ô tên món, để danh sách luôn khớp với những gì người dùng thấy trên form.
  const next = (changes) => filtersToParams({ ...filters, q: q.trim(), ...changes });

  // Chip loại: link tới URL trang với loại mới, giữ nguyên các tiêu chí khác.
  const chipUrl = (category) => `/dishes${toQuery(next({ category }))}`;
  // Khoảng giá, sắp xếp, "còn phục vụ": áp dụng ngay khi đổi, như bấm chip.
  const apply = (changes) => setSearchParams(next(changes));

  function onSearch(event) {
    // Chặn form tải lại trang; ô tên món chỉ áp dụng khi Enter / Tìm (không gọi API theo từng phím).
    event.preventDefault();
    apply({});
  }

  const groups = status === "ok" && !filters.sort ? groupByCategory(dishes) : null;

  return (
    <>
      <div className="page-head">
        <h1>Thực đơn</h1>
        <p>Chọn món để xem mô tả, giá và tình trạng phục vụ.</p>
      </div>

      <section className="filters" aria-label="Lọc món">
        {cats.status === "ok" && (
          <nav className="chips" aria-label="Lọc theo loại">
            <Link className="chip" to={chipUrl("")} aria-current={filters.category ? "false" : "true"}>
              Tất cả
            </Link>
            {cats.data.used.map((c) => (
              <Link key={c} className="chip" to={chipUrl(c)} aria-current={filters.category === c ? "true" : "false"}>
                {c}
              </Link>
            ))}
          </nav>
        )}

        <form className="filter-row" role="search" onSubmit={onSearch}>
          {/* Nút Tìm đặt sát ô tên: nó chỉ áp dụng ô này (các ô chọn bên cạnh tự áp dụng khi đổi). */}
          <div className="field grow">
            <label htmlFor="menu-q">Tên món</label>
            <div className="search-box">
              <input id="menu-q" type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ví dụ: phở, bún, cơm" />
              <button type="submit" className="btn btn-primary">
                Tìm
              </button>
            </div>
          </div>
          <label className="field fixed">
            <span>Khoảng giá</span>
            <select name="price" value={filters.price} onChange={(e) => apply({ price: e.target.value })}>
              <option value="">Mọi mức giá</option>
              {PRICE_RANGES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field fixed">
            <span>Sắp xếp</span>
            <select name="sort" value={filters.sort} onChange={(e) => apply({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" name="available" checked={filters.available} onChange={(e) => apply({ available: e.target.checked })} />
            Chỉ món còn phục vụ
          </label>
        </form>
      </section>

      {status === "loading" && <Loading />}
      {status === "error" && <LoadError onRetry={reload} />}
      {status === "ok" && (
        <>
          <div className="result-line" role="status">
            <span>
              {dishes.length} món{isFiltered(filters) ? " khớp bộ lọc" : ""}
              {filters.q && <> cho “{filters.q}”</>}
            </span>
            {isFiltered(filters) && <Link to="/dishes">Xoá bộ lọc</Link>}
          </div>

          {dishes.length === 0 ? (
            // Danh sách rỗng là kết quả thành công (data = []), không phải lỗi.
            <div className="empty">
              <strong>{isFiltered(filters) ? "Không có món nào khớp bộ lọc." : "Chưa có món nào."}</strong>
              {isFiltered(filters) && (
                <>
                  Thử bỏ bớt tiêu chí hoặc <Link to="/dishes">xem toàn bộ thực đơn</Link>.
                </>
              )}
            </div>
          ) : groups ? (
            // Sắp xếp mặc định → nhóm theo loại như thực đơn in; chọn sắp xếp khác → một danh sách phẳng.
            <div className="menu-columns">
              {groups.map((g) => (
                <section key={g.name} className="menu-group">
                  <h2>
                    {g.name} <small>{g.dishes.length} món</small>
                  </h2>
                  <div className="menu-grid">
                    {g.dishes.map((dish) => (
                      <DishRow key={dish.id} dish={dish} showCategory={false} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section className="menu-group">
              <h2 className="sr-only">Kết quả</h2>
              <div className="menu-grid flat">
                {dishes.map((dish) => (
                  <DishRow key={dish.id} dish={dish} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
