// Response shape dùng chung cho MỌI kết quả do handler xử lý (hợp đồng giữa API và SPA):
//   thành công:     200 { ok: true,  data }
//   lỗi nghiệp vụ:  200 { ok: false, error: { code, message, fields?, dishes? } }
// Status 200 nghĩa là "API đã chạy được yêu cầu"; kết quả nằm trong `ok`.
// Lỗi kỹ thuật (sai URL 404, body không đọc được 400, hệ thống hỏng 500) KHÔNG đi qua file này
// mà do app.js trả, body không có `ok` — để SPA phân biệt được hai loại lỗi.

// Mã lỗi nghiệp vụ cố định: SPA rẽ nhánh theo `code`, không theo `message` (câu chữ có thể đổi).
export const CODES = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  // Mở rộng do giữ khoá ngoại của block5: xoá bị chặn vì bản ghi đang được món dùng.
  IN_USE: "IN_USE",
};

export const ok = (res, data) => res.status(200).json({ ok: true, data });

export const fail = (res, code, message, extra = {}) =>
  res.status(200).json({ ok: false, error: { code, message, ...extra } });

export const notFound = (res, message = "Không tìm thấy bản ghi.") => fail(res, CODES.NOT_FOUND, message);

// `fields`: { tênTrường: thông báo } — khoá trùng tên ô nhập để SPA hiện lỗi cạnh đúng ô.
export const validationFailed = (res, fields) =>
  fail(res, CODES.VALIDATION_FAILED, "Dữ liệu không hợp lệ.", { fields });

// `dishes`: các món đang dùng bản ghi, để SPA liệt kê cho người dùng xử lý trước khi xoá.
export const inUse = (res, message, dishes) => fail(res, CODES.IN_USE, message, { dishes });
