// Giá lưu bằng số nguyên (đồng): 55000 → "55.000đ"
export const formatPrice = (price) => `${price.toLocaleString("vi-VN")}đ`;
