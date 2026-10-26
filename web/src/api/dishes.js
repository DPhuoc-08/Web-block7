import { api, toQuery, idPath } from "./client.js";

export const listDishes = (params, opts) => api.get(`/api/dishes${toQuery(params)}`, opts);
export const getDish = (id, opts) => api.get(`/api/dishes/${idPath(id)}`, opts);
export const createDish = (body) => api.post("/api/dishes", body);
export const updateDish = (id, body) => api.patch(`/api/dishes/${idPath(id)}`, body);
export const deleteDish = (id) => api.del(`/api/dishes/${idPath(id)}`);
