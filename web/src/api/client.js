// Lớp gọi API DUY NHẤT của SPA. Các trang không gọi fetch trực tiếp mà gọi hàm trong api/*.js → đi qua đây.
// Một chỗ giữ URL gốc, một chỗ kiểm tra đủ 3 tầng lỗi:
//   Tầng 1 — không nhận được response (API tắt, mất mạng, bị CORS chặn)      → ApiError kind "network"
//   Tầng 2 — có response nhưng status không 2xx, hoặc body không đúng shape  → ApiError kind "http"
//   Tầng 3 — status 200 nhưng ok: false (lỗi nghiệp vụ)                      → ApiError kind "business" + code, fields
// Thành công → trả về `data`. Không chỉ kiểm tra status: lỗi nghiệp vụ cũng có status 200.

// URL gốc của API: địa chỉ công khai, không phải bí mật (biến VITE_ được nhúng vào mã gửi cho browser).
const BASE_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(kind, { message, status = null, code = null, fields = {}, dishes = [] }) {
    super(message);
    this.name = "ApiError";
    this.kind = kind; // "network" | "http" | "business"
    this.status = status;
    this.code = code; // chỉ có với "business": NOT_FOUND | VALIDATION_FAILED | IN_USE
    this.fields = fields; // { tênTrường: thông báo } — hiện lỗi cạnh đúng ô nhập
    this.dishes = dishes; // với IN_USE: các món đang dùng bản ghi
  }
}

export const isBusiness = (err, code) => err instanceof ApiError && err.kind === "business" && err.code === code;

export async function request(method, path, { body, signal } = {}) {
  const init = { method, signal, headers: {} };
  // Chỉ đặt Content-Type khi có body: GET không kèm header này nên không phải preflight.
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  // Tầng 1: fetch chỉ ném lỗi khi không có response. Lỗi CORS cũng rơi vào đây và không cho biết chi tiết
  // (chi tiết chỉ có trong Console của browser).
  let res;
  try {
    res = await fetch(BASE_URL + path, init);
  } catch (err) {
    if (err.name === "AbortError") throw err; // request bị huỷ có chủ đích (đổi trang/đổi id) — không phải lỗi
    throw new ApiError("network", { message: "Không kết nối được tới máy chủ." });
  }

  // Tầng 2: status phải 2xx và body phải là JSON có trường ok. Ví dụ server trả index.html (status 200)
  // cho một URL API gõ sai → không phải JSON → vẫn là lỗi kỹ thuật.
  let json = null;
  if ((res.headers.get("Content-Type") ?? "").includes("application/json")) {
    json = await res.json().catch(() => null);
  }
  if (!res.ok || json === null || typeof json.ok !== "boolean") {
    throw new ApiError("http", { status: res.status, message: `Máy chủ trả lỗi (HTTP ${res.status}).` });
  }

  // Tầng 3: rẽ nhánh theo error.code (giá trị cố định), không theo message.
  if (!json.ok) {
    const e = json.error ?? {};
    throw new ApiError("business", {
      status: res.status,
      code: e.code ?? null,
      message: e.message ?? "Yêu cầu không thực hiện được.",
      fields: e.fields ?? {},
      dishes: e.dishes ?? [],
    });
  }
  return json.data;
}

// Dựng query string, bỏ các giá trị rỗng: { q: "phở", sort: "" } → "?q=ph%E1%BB%9F"
export function toQuery(params = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// Id lấy từ URL của trang (có thể là "abc") được mã hoá trước khi ghép vào URL API; API tự trả NOT_FOUND.
export const idPath = (id) => encodeURIComponent(String(id));

export const api = {
  get: (path, opts) => request("GET", path, opts),
  post: (path, body, opts) => request("POST", path, { ...opts, body }),
  patch: (path, body, opts) => request("PATCH", path, { ...opts, body }),
  del: (path, opts) => request("DELETE", path, opts),
};
