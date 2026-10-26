import { api } from "./client.js";

// [{ id, name, dishCount, chefCount }] sắp A→Z — ô chọn tag trong form, chip lọc ở thực đơn (tag có dishCount > 0).
export const listTags = (opts) => api.get("/api/tags", opts);
// Thêm tag mới ngay trong form món / form đầu bếp. Tag không sửa, không xoá.
export const createTag = (body) => api.post("/api/tags", body);
