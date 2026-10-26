import { has, requiredText, optionalText } from "./common.js";

// Cùng khuôn với validateDish: POST kiểm tra đủ, PATCH chỉ kiểm tra trường được gửi.
// Trả `data` chỉ gồm cột của Chef (không đưa nguyên body vào Prisma) và `errors`.
export function validateChef(body, { partial = false } = {}) {
  const data = {};
  const errors = {};

  if (!partial || has(body, "name")) {
    const r = requiredText(body.name, "Tên đầu bếp không được để trống.");
    if (r.error) errors.name = r.error;
    else data.name = r.value;
  }

  if (has(body, "specialty")) {
    const r = optionalText(body.specialty);
    if (r.error) errors.specialty = r.error;
    else data.specialty = r.value;
  }

  return { data, errors };
}
