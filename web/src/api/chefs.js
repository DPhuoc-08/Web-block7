import { api, toQuery, idPath } from "./client.js";

export const listChefs = (params, opts) => api.get(`/api/chefs${toQuery(params)}`, opts);
export const getChef = (id, opts) => api.get(`/api/chefs/${idPath(id)}`, opts);
export const createChef = (body) => api.post("/api/chefs", body);
export const updateChef = (id, body) => api.patch(`/api/chefs/${idPath(id)}`, body);
// Đầu bếp còn món: phải chọn người nhận → DELETE /api/chefs/:id?transferTo=<id>
export const deleteChef = (id, transferTo) => api.del(`/api/chefs/${idPath(id)}${toQuery({ transferTo })}`);
