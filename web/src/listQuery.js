// Điều kiện của thực đơn nằm trên URL của TRANG (/dishes?mode=&by=&q=&tag=&minPrice=&maxPrice=&available=&sort=&view=&page=).
// Trang đọc URL → dựng tham số API → gọi GET /api/dishes. URL trang và URL API là hai thứ khác nhau:
// URL trang có `view` (cách hiển thị) mà API không cần; API có `pageSize` mà URL trang không ghi.
// Giá trị gửi API nguyên văn (không tự sửa): API validate, sai thì trả VALIDATION_FAILED → trang hiện lỗi cạnh ô.

export const MODES = [
  { value: "basic", label: "Cơ bản", hint: "Chứa đúng từ khoá" },
  { value: "advanced", label: "Nâng cao", hint: "Từ khoá + tag + khoảng giá + trạng thái" },
  { value: "fulltext", label: "Toàn văn", hint: "Các từ trong tên và mô tả món, không cần liền nhau" },
  { value: "fuzzy", label: "Gần đúng", hint: "Gần giống khi gõ sai" },
];
export const TEXT_MODES = ["fulltext", "fuzzy"];

// "Tìm theo" (plan mục 14): từ khoá so với tên món (mặc định), tên nguyên liệu hoặc tên đầu bếp — `value` là hợp đồng
// với API (`by`). Dùng ở cơ bản, nâng cao, gần đúng; toàn văn luôn tìm trong tên + mô tả món.
export const SEARCH_BY = [
  { value: "name", label: "Theo tên món", noun: "" },
  { value: "ingredient", label: "Theo nguyên liệu", noun: "nguyên liệu " },
  { value: "chef", label: "Theo đầu bếp", noun: "đầu bếp " },
];
export const usesBy = (mode) => mode !== "fulltext";

// `value` là hợp đồng với API (api/src/validators/list-query.js → SORTS).
export const SORTS = [
  { value: "", label: "Mặc định" },
  { value: "ten", label: "Tên A → Z" },
  { value: "gia-tang", label: "Giá thấp → cao" },
  { value: "gia-giam", label: "Giá cao → thấp" },
];

export const AVAILABILITY = [
  { value: "", label: "Mọi trạng thái" },
  { value: "true", label: "Còn phục vụ" },
  { value: "false", label: "Tạm hết" },
];

export const VIEWS = [
  { value: "pages", label: "Số trang" },
  { value: "more", label: "Tải thêm" },
  { value: "scroll", label: "Cuộn vô hạn" },
];

export const PAGE_SIZE = 12;

const FIELDS = ["mode", "by", "q", "tag", "minPrice", "maxPrice", "available", "sort"];

// Đọc điều kiện từ URL trang. Giá trị thiếu → mặc định; giá trị lạ GIỮ NGUYÊN để gửi API (API báo lỗi).
export function readQuery(searchParams) {
  const get = (k) => searchParams.get(k)?.trim() ?? "";
  const view = get("view");
  return {
    mode: get("mode") || "basic",
    by: get("by") || "name",
    q: get("q"),
    tag: get("tag"),
    minPrice: get("minPrice"),
    maxPrice: get("maxPrice"),
    available: get("available"),
    sort: get("sort"),
    view: VIEWS.some((v) => v.value === view) ? view : "pages",
    page: get("page"),
  };
}

// Tham số API theo chế độ: basic chỉ q + sort; advanced thêm tag, giá, trạng thái; fulltext/fuzzy chỉ q
// (xếp theo điểm). `by` gửi khi khác tên món, trừ toàn văn. Không gửi tham số không thuộc chế độ → URL API gọn,
// Network dễ đọc khi demo.
export function toApiParams(query, { page = query.page, pageSize = PAGE_SIZE } = {}) {
  const p = { mode: query.mode, q: query.q, page, pageSize };
  if (usesBy(query.mode) && query.by !== "name") p.by = query.by;
  if (!TEXT_MODES.includes(query.mode)) p.sort = query.sort;
  if (query.mode === "advanced") Object.assign(p, { tag: query.tag, minPrice: query.minPrice, maxPrice: query.maxPrice, available: query.available });
  return p;
}

// Tham số URL trang: bỏ giá trị mặc định (mode basic, view pages, page 1) và tham số không thuộc chế độ.
export function toPageParams(query) {
  const api = toApiParams(query, { page: query.page, pageSize: "" });
  const p = {};
  for (const k of FIELDS) if (api[k]) p[k] = api[k];
  if (p.mode === "basic") delete p.mode;
  if (query.view !== "pages") p.view = query.view;
  if (query.page && query.page !== "1") p.page = query.page;
  return p;
}

// Khoá của bộ điều kiện (không gồm page, view): đổi khoá = kết quả mới → về đầu danh sách.
export const conditionKey = (query) => JSON.stringify(FIELDS.map((k) => toApiParams(query)[k] ?? ""));

export const isFiltered = (query) => Boolean(query.q || (query.mode === "advanced" && (query.tag || query.minPrice || query.maxPrice || query.available)) || query.sort);
