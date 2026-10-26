// Thành phần nhỏ dùng chung cho các form quản trị.
// Lỗi do SPA phát hiện (ô bắt buộc bỏ trống) và lỗi API trả về (VALIDATION_FAILED → error.fields)
// hiển thị cùng một cách: dòng đỏ ngay dưới ô có khoá trùng tên trường.

export function FieldError({ message }) {
  if (!message) return null;
  return <span className="error">{message}</span>;
}

// Thông báo đầu form: lỗi theo trường (nhắc người dùng xem các ô bên dưới) hoặc lỗi chung (kỹ thuật / mạng).
export function FormAlert({ fieldErrors, generalError }) {
  if (generalError) {
    return (
      <p className="alert" role="alert">
        {generalError}
      </p>
    );
  }
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return (
      <p className="alert" role="alert">
        Dữ liệu chưa hợp lệ, vui lòng sửa các trường bên dưới.
      </p>
    );
  }
  return null;
}

// Câu hiển thị cho lỗi không thuộc ô nào. Câu chữ do SPA quyết định (không in nguyên message của API).
export function generalMessage(err) {
  if (err?.kind === "network") return "Không kết nối được tới máy chủ. Dữ liệu bạn nhập vẫn được giữ, vui lòng thử lại.";
  if (err?.kind === "http") return "Máy chủ đang gặp sự cố, chưa lưu được. Dữ liệu bạn nhập vẫn được giữ, vui lòng thử lại.";
  return "Không thực hiện được yêu cầu, vui lòng thử lại.";
}
