import { MAX_INT } from "./common.js";
import { parseId } from "./id.js";

// Đọc + validate query string của GET /api/dishes (plan mục 5.3). Query string luôn là CHUỖI (hoặc mảng khi lặp
// tham số), nên mọi giá trị đều phải parse rõ ràng:
// - thiếu hoặc chuỗi trắng → "không có tiêu chí" (dùng mặc định), KHÔNG phải lỗi;
// - có giá trị mà sai định dạng → VALIDATION_FAILED kèm fields theo đúng tên tham số (SPA hiện lỗi cạnh ô).
// Khác bộ lọc block6 (bỏ qua giá trị lạ): block7 báo lỗi để người dùng biết điều kiện của mình không được áp dụng.
// Không dùng `if (value)` cho giá trị đã parse: false và 0 là tiêu chí có hiệu lực.

export const PAGE_SIZE_DEFAULT = 12;
export const PAGE_SIZE_MAX = 100;

// Bước 8 thêm "fulltext", "fuzzy".
export const MODES = ["basic", "advanced"];

// Giá trị `sort` là hợp đồng với SPA. Luôn thêm id làm thứ tự phụ → thứ tự xác định, các trang chia cùng một danh sách.
export const SORTS = {
  "": [{ id: "asc" }],
  ten: [{ name: "asc" }, { id: "asc" }],
  "gia-tang": [{ price: "asc" }, { id: "asc" }],
  "gia-giam": [{ price: "desc" }, { id: "asc" }],
  "moi-nhat": [{ id: "desc" }], // admin: món vừa thêm nằm ở trang 1 (plan mục 10.9)
};

// Trang admin tìm thêm theo tên tag (giữ từ block6, mở rộng của basic). Khoá lạ bị bỏ qua như block6.
const SEARCHABLE = ["name", "tag"];

const NON_NEGATIVE_INT = /^(0|[1-9]\d*)$/;

// Trả { value } — value = null khi thiếu/trắng — hoặc { error } khi là mảng (?x=a&x=b) hay kiểu lạ.
function text(raw) {
  if (raw === undefined) return { value: null };
  if (typeof raw !== "string") return { error: "Tham số chỉ được gửi một lần." };
  const v = raw.trim();
  return { value: v === "" ? null : v };
}

export function parseListQuery(query) {
  const errors = {};
  const read = (key) => {
    const r = text(query[key]);
    if (r.error) errors[key] = r.error;
    return r.value ?? null;
  };

  const raw = {
    mode: read("mode"), q: read("q"), page: read("page"), pageSize: read("pageSize"), sort: read("sort"),
    tag: read("tag"), minPrice: read("minPrice"), maxPrice: read("maxPrice"), available: read("available"),
    searchIn: read("searchIn"),
  };

  const mode = raw.mode ?? "basic";
  if (!MODES.includes(mode)) errors.mode = `Chế độ tìm phải là một trong: ${MODES.join(", ")}.`;

  let page = 1;
  if (raw.page !== null) {
    page = parseId(raw.page);
    if (page === null) errors.page = "Số trang phải là số nguyên dương.";
  }

  let pageSize = PAGE_SIZE_DEFAULT;
  if (raw.pageSize !== null) {
    pageSize = parseId(raw.pageSize);
    if (pageSize === null || pageSize > PAGE_SIZE_MAX) errors.pageSize = `Số món mỗi trang phải từ 1 đến ${PAGE_SIZE_MAX}.`;
  }

  const sort = raw.sort ?? "";
  if (!Object.hasOwn(SORTS, sort)) errors.sort = "Cách sắp xếp không hợp lệ.";

  const result = { mode, q: raw.q, page, pageSize, sort, searchIn: ["name"], tagId: null, minPrice: null, maxPrice: null, available: null, errors };

  // Basic chỉ đọc q (+ searchIn của admin). Tham số của advanced gửi kèm basic bị bỏ qua, không lỗi.
  if (mode === "basic" && raw.searchIn !== null) {
    const fields = raw.searchIn.split(",").filter((f) => SEARCHABLE.includes(f));
    if (fields.length) result.searchIn = [...new Set(fields)];
  }

  if (mode === "advanced") {
    if (raw.tag !== null) {
      result.tagId = parseId(raw.tag);
      if (result.tagId === null) errors.tag = "Tag không hợp lệ.";
    }
    for (const key of ["minPrice", "maxPrice"]) {
      if (raw[key] === null) continue;
      // Chỉ nhận số nguyên không âm viết bằng chữ số: "0" hợp lệ; "-1", "1.5", "1e3", "abc" là lỗi.
      if (!NON_NEGATIVE_INT.test(raw[key]) || Number(raw[key]) > MAX_INT) errors[key] = "Giá phải là số nguyên không âm (đồng).";
      else result[key] = Number(raw[key]);
    }
    if (result.minPrice !== null && result.maxPrice !== null && result.minPrice > result.maxPrice) {
      errors.maxPrice = "Giá đến phải lớn hơn hoặc bằng giá từ.";
    }
    if (raw.available !== null) {
      // Không dùng Boolean("false") (= true): chỉ nhận đúng hai chuỗi.
      if (raw.available === "true") result.available = true;
      else if (raw.available === "false") result.available = false;
      else errors.available = "Trạng thái phải là true hoặc false.";
    }
  }

  return result;
}

// Literal contains: Prisma 7 đưa chuỗi của `contains` vào ILIKE '%…%' NGUYÊN VẸN — đã kiểm chứng bằng request thật:
// q=% và q=_ trả cả 1.200 món, q=Trà_ khớp "Trà matcha sữa" (_ thành "một ký tự bất kỳ").
// → Escape trước: `\` thành `\\`, `%` thành `\%`, `_` thành `\_` (một lượt thay thế duy nhất → không ký tự nào bị thoát hai lần).
// PostgreSQL dùng `\` làm ký tự escape mặc định của LIKE/ILIKE, nên chỉ hai dấu % do Prisma thêm ở hai đầu là wildcard.
// Parameter binding (Prisma) chống SQL injection; escaping này giữ đúng NGHĨA "chứa đúng chuỗi người dùng nhập".
export const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Điều kiện Prisma cho basic / advanced. Các tiêu chí nối bằng AND; tiêu chí null = không áp dụng.
// `q` là literal contains trên tên, không phân biệt hoa thường (ILIKE, tham số bind).
export function basicAdvancedWhere({ q, searchIn, tagId, minPrice, maxPrice, available }) {
  const nameOrTag = {
    name: (s) => ({ name: { contains: s, mode: "insensitive" } }),
    tag: (s) => ({ tags: { some: { tag: { name: { contains: s, mode: "insensitive" } } } } }),
  };
  const conditions = [];
  if (q !== null) conditions.push({ OR: searchIn.map((f) => nameOrTag[f](escapeLike(q))) });
  if (tagId !== null) conditions.push({ tags: { some: { tagId } } });
  if (minPrice !== null) conditions.push({ price: { gte: minPrice } });
  if (maxPrice !== null) conditions.push({ price: { lte: maxPrice } });
  if (available !== null) conditions.push({ available });
  return conditions.length ? { AND: conditions } : {};
}
