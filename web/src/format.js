// Giá lưu bằng số nguyên (đồng): 55000 → "55.000đ"
export const formatPrice = (price) => `${price.toLocaleString("vi-VN")}đ`;

// Tìm tại chỗ trong form (nguyên liệu, tag): so khớp không phân biệt hoa thường và dấu
// ("tom" khớp "Tôm", "hanh" khớp "Hành lá", "mien" khớp "Miền Trung").
export const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

// Tên các tag nối bằng dấu chấm giữa: "Món nước · Miền Bắc".
export const tagNames = (tags) => tags.map((t) => t.name).join(" · ");
