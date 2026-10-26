import { api } from "./client.js";

// { all: [...] } — danh sách loại cố định cho form; { used: [...] } — loại đang có món, cho chip lọc.
export const getCategories = (opts) => api.get("/api/categories", opts);
