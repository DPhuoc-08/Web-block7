// Cách đọc và "làm phẳng" các bảng liên kết khi trả JSON — dùng chung cho món và đầu bếp.
// Bảng dish_tags / chef_tags chỉ có cặp id; SPA cần mảng tag gọn: tags: [{ id, name }].

// Sắp theo id tag: id nhỏ là loại món (seed tạo trước), rồi đặc điểm, vùng miền → "Món nước · Miền Bắc".
export const TAG_SELECT = { select: { tag: { select: { id: true, name: true } } }, orderBy: { tagId: "asc" } };

export const flatTags = (links) => links.map((link) => link.tag);
