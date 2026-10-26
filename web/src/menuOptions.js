// Lựa chọn của bộ lọc thực đơn (giữ từ block5). `value` là hợp đồng với API:
// phải trùng với api/src/validators/menu-filters.js (PRICE_RANGES, SORTS). Giá trị lạ API bỏ qua.
export const PRICE_RANGES = [
  { value: "duoi-40k", label: "Dưới 40.000đ" },
  { value: "40k-60k", label: "40.000đ – 60.000đ" },
  { value: "tren-60k", label: "Trên 60.000đ" },
];

export const SORTS = [
  { value: "", label: "Theo loại món" },
  { value: "gia-tang", label: "Giá thấp → cao" },
  { value: "gia-giam", label: "Giá cao → thấp" },
  { value: "ten", label: "Tên A → Z" },
];

// Đọc bộ lọc từ URL của trang (/dishes?q=&tag=&price=&available=1&sort=). `tag` là id tag (chuỗi số).
// Giá trị giá / sắp xếp lạ (?price=abc) bị bỏ qua như API → không hiện "khớp bộ lọc" khi thực ra không lọc.
const oneOf = (value, options) => (options.some((o) => o.value === value) ? value : "");
export function readFilters(searchParams) {
  return {
    q: searchParams.get("q")?.trim() ?? "",
    tag: searchParams.get("tag") ?? "",
    price: oneOf(searchParams.get("price") ?? "", PRICE_RANGES),
    available: searchParams.get("available") === "1",
    sort: oneOf(searchParams.get("sort") ?? "", SORTS),
  };
}

// Dựng query cho URL trang (và cho API — cùng tên tham số), bỏ giá trị mặc định để URL gọn.
export function filtersToParams(f) {
  const p = {};
  if (f.q) p.q = f.q;
  if (f.tag) p.tag = f.tag;
  if (f.price) p.price = f.price;
  if (f.available) p.available = "1";
  if (f.sort) p.sort = f.sort;
  return p;
}

export const isFiltered = (f) => Boolean(f.q || f.tag || f.price || f.available || f.sort);

// Gom món theo tag đầu tiên (id nhỏ nhất = loại món), giữ thứ tự nhóm xuất hiện. Một món có nhiều tag nhưng chỉ
// nằm trong một nhóm. (Bước 10 của plan bỏ nhóm theo loại khi thực đơn có phân trang — plan mục 10.8.)
export function groupByMainTag(dishes) {
  const groups = new Map();
  for (const dish of dishes) {
    const tag = dish.tags[0] ?? { id: null, name: "Khác" };
    if (!groups.has(tag.id)) groups.set(tag.id, { tag, dishes: [] });
    groups.get(tag.id).dishes.push(dish);
  }
  return [...groups.values()].sort((a, b) => (a.tag.id === null) - (b.tag.id === null));
}
