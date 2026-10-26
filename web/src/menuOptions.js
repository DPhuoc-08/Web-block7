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

// Đọc bộ lọc từ URL của trang (/dishes?q=&category=&price=&available=1&sort=).
// Giá trị giá / sắp xếp lạ (?price=abc) bị bỏ qua như API → không hiện "khớp bộ lọc" khi thực ra không lọc.
const oneOf = (value, options) => (options.some((o) => o.value === value) ? value : "");
export function readFilters(searchParams) {
  return {
    q: searchParams.get("q")?.trim() ?? "",
    category: searchParams.get("category") ?? "",
    price: oneOf(searchParams.get("price") ?? "", PRICE_RANGES),
    available: searchParams.get("available") === "1",
    sort: oneOf(searchParams.get("sort") ?? "", SORTS),
  };
}

// Dựng query cho URL trang (và cho API — cùng tên tham số), bỏ giá trị mặc định để URL gọn.
export function filtersToParams(f) {
  const p = {};
  if (f.q) p.q = f.q;
  if (f.category) p.category = f.category;
  if (f.price) p.price = f.price;
  if (f.available) p.available = "1";
  if (f.sort) p.sort = f.sort;
  return p;
}

export const isFiltered = (f) => Boolean(f.q || f.category || f.price || f.available || f.sort);

// Gom món theo loại, giữ thứ tự loại xuất hiện; món không có loại xếp cuối vào nhóm "Khác" (như block5).
export function groupByCategory(dishes) {
  const groups = new Map();
  for (const dish of dishes) {
    const key = dish.category ?? "Khác";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(dish);
  }
  return [...groups]
    .map(([name, items]) => ({ name, dishes: items }))
    .sort((a, b) => (a.name === "Khác") - (b.name === "Khác"));
}
