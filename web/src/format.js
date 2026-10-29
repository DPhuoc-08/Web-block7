// Giá lưu bằng số nguyên (đồng): 55000 → "55.000đ"
export const formatPrice = (price) => `${price.toLocaleString("vi-VN")}đ`;

// Tìm tại chỗ trong form (nguyên liệu, tag): so khớp không phân biệt hoa thường và dấu
// ("tom" khớp "Tôm", "hanh" khớp "Hành lá", "mien" khớp "Miền Trung").
export const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

// Tên các tag nối bằng dấu chấm giữa: "Món nước · Miền Bắc".
export const tagNames = (tags) => tags.map((t) => t.name).join(" · ");

// Giá ở thực đơn và trang chi tiết (plan 13.h): món 0đ (trà đá, đá viên tặng kèm) ghi "Miễn phí". Admin vẫn dùng formatPrice.
export const formatMenuPrice = (price) => (price === 0 ? "Miễn phí" : formatPrice(price));
