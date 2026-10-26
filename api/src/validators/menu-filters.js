import { queryStr } from "./common.js";
import { parseId } from "./id.js";

// Bộ lọc thực đơn (mở rộng giữ từ block5) đi qua query string của GET /api/dishes: điều kiện hiển thị, không phải dữ liệu ghi.
// Giá trị lạ hoặc sai (?price=abc, ?sort=xyz, ?tag=abc) bị BỎ QUA → dùng mặc định, không trả lỗi (như block6).
// Bước 7 của plan thay file này bằng list-query.js: phân trang + 4 chế độ search, tham số sai → VALIDATION_FAILED.
// Giá trị `value` dưới đây là hợp đồng với SPA (web/src/menuOptions.js dùng đúng các giá trị này).

export const PRICE_RANGES = [
  { value: "duoi-40k", where: { lt: 40000 } },
  { value: "40k-60k", where: { gte: 40000, lte: 60000 } },
  { value: "tren-60k", where: { gt: 60000 } },
];

export const SORTS = [
  { value: "", orderBy: { id: "asc" } },
  { value: "gia-tang", orderBy: { price: "asc" } },
  { value: "gia-giam", orderBy: { price: "desc" } },
  { value: "ten", orderBy: { name: "asc" } },
];

// Tìm theo từ khoá: mặc định chỉ theo TÊN (đúng đề bài). Trang admin gửi thêm ?searchIn=name,tag
// để tìm cả tên tag (thay cho tìm theo loại món của block6). Chỉ nhận các khoá trong bảng này; giá trị lạ bị bỏ qua.
const SEARCHABLE = {
  name: (q) => ({ name: { contains: q, mode: "insensitive" } }),
  tag: (q) => ({ tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } }),
};

export function parseMenuFilters(query) {
  const q = queryStr(query.q);
  const searchIn = queryStr(query.searchIn).split(",").filter((f) => Object.hasOwn(SEARCHABLE, f));
  const fields = searchIn.length ? [...new Set(searchIn)] : ["name"];
  // ?tag=<id>: món có tag đó (một món có nhiều tag → "some"). Id sai định dạng bị bỏ qua;
  // id không tồn tại thì không món nào khớp → [] (khác block6 vốn bỏ qua loại không có món).
  const tagId = parseId(queryStr(query.tag));
  const price = PRICE_RANGES.find((p) => p.value === queryStr(query.price));
  const sort = SORTS.find((s) => s.value === queryStr(query.sort)) ?? SORTS[0];
  const onlyAvailable = query.available === "1";

  // Các điều kiện ghép bằng AND: món phải thoả tất cả tiêu chí đang chọn.
  const conditions = [];
  if (q) conditions.push({ OR: fields.map((f) => SEARCHABLE[f](q)) });
  if (tagId !== null) conditions.push({ tags: { some: { tagId } } });
  if (price) conditions.push({ price: price.where });
  if (onlyAvailable) conditions.push({ available: true });

  return {
    where: conditions.length ? { AND: conditions } : {},
    orderBy: [sort.orderBy, { id: "asc" }],
  };
}
