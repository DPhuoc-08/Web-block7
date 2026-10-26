import { api, toQuery, idPath } from "./client.js";

export const listIngredients = (params, opts) => api.get(`/api/ingredients${toQuery(params)}`, opts);
export const getIngredient = (id, opts) => api.get(`/api/ingredients/${idPath(id)}`, opts);
export const createIngredient = (body) => api.post("/api/ingredients", body);
export const updateIngredient = (id, body) => api.patch(`/api/ingredients/${idPath(id)}`, body);
export const deleteIngredient = (id) => api.del(`/api/ingredients/${idPath(id)}`);
