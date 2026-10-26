import { queryStr } from "./common.js";

// Bộ lọc thực đơn (mở rộng giữ từ block5) đi qua query string của GET /api/dishes: điều kiện hiển thị, không phải dữ liệu ghi.
// Giá trị lạ hoặc sai (?price=abc, ?sort=xyz, loại không có món) bị BỎ QUA → dùng mặc định, không trả lỗi:
// danh sách không có lỗi nghiệp vụ (bảng REST của đề), người dùng sửa tay URL sai vẫn thấy thực đơn.
// Giá trị `value` dưới đây là hợp đồng với SPA (web/src/menuOptions.js dùng đúng các giá trị này).

export const PRICE_RANGES = [
  { value: "duoi-40k", where: { lt: 40000 } },
  { value: "40k-60k", where: { gte: 40000, lte: 60000 } },
  { value: "tren-60k", where: { gt: 60000 } },
];

export const SORTS = [
  { value: "", orderBy: { id: "asc" } }, // mặc định: SPA nhóm theo loại
  { value: "gia-tang", orderBy: { price: "asc" } },
  { value: "gia-giam", orderBy: { price: "desc" } },
  { value: "ten", orderBy: { name: "asc" } },
];

// Tìm theo từ khoá: mặc định chỉ theo TÊN (đúng đề bài). Trang admin gửi thêm ?searchIn=name,category
// để tìm cả loại như admin block5. Chỉ nhận các cột trong danh sách này; giá trị lạ bị bỏ qua.
const SEARCHABLE = ["name", "category"];

// `usedCategories`: các loại đang có món trong DB — chỉ nhận ?category= nằm trong danh sách này (như block5).
export function parseMenuFilters(query, usedCategories) {
  const q = queryStr(query.q);
  const searchIn = queryStr(query.searchIn).split(",").filter((f) => SEARCHABLE.includes(f));
  const fields = searchIn.length ? [...new Set(searchIn)] : ["name"];
  const category = usedCategories.includes(queryStr(query.category)) ? queryStr(query.category) : "";
  const price = PRICE_RANGES.find((p) => p.value === queryStr(query.price));
  const sort = SORTS.find((s) => s.value === queryStr(query.sort)) ?? SORTS[0];
  const onlyAvailable = query.available === "1";

  // Các điều kiện ghép bằng AND: món phải thoả tất cả tiêu chí đang chọn.
  const conditions = [];
  if (q) conditions.push({ OR: fields.map((f) => ({ [f]: { contains: q, mode: "insensitive" } })) });
  if (category) conditions.push({ category });
  if (price) conditions.push({ price: price.where });
  if (onlyAvailable) conditions.push({ available: true });

  return {
    where: conditions.length ? { AND: conditions } : {},
    orderBy: [sort.orderBy, { id: "asc" }],
  };
}
