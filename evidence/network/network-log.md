# Bản ghi Network theo từng thao tác demo

Ghi bằng Chrome headless qua DevTools Protocol (sự kiện `Network.requestWillBeSent` / `responseReceived` / `loadingFinished`, nội dung lấy bằng `Network.getResponseBody`) trên bản production của SPA (`vite build` + `vite preview`), API :3000, dữ liệu seed chuẩn. Chỉ liệt kê request tới API; mọi request đều là `fetch` trả JSON, không có request tải lại document.

Đọc bảng: mỗi lần chuyển trang / tải thêm / cuộn tới cuối chỉ có **một request `GET /api/dishes` nhận đúng `pageSize` món** (12 ở thực đơn, 20 ở admin) kèm `total` của toàn bộ điều kiện → phân trang tại server, không tải cả 1.200 món. `/api/tags` (16 tag, cho chip lọc) tải một lần khi mở trang.

### Số trang — mở thực đơn (trang 1)

URL trang: `/dishes` · ảnh: [screens/so-trang-1.png](../screens/so-trang-1.png) · SQL: [sql-log/so-trang-1.txt](../sql-log/so-trang-1.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 1.3 KB | mảng 16 tag |
| `/api/dishes?mode=basic&pageSize=12` | 200 | application/json | 6.9 KB | items 12, total 1200, page 1, pageSize 12 |

### Số trang — bấm trang 2 (thay danh sách, page lên URL)

URL trang: `/dishes?page=2` · ảnh: [screens/so-trang-2.png](../screens/so-trang-2.png) · SQL: [sql-log/so-trang-2.txt](../sql-log/so-trang-2.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=basic&pageSize=12` | 200 | application/json | 0.2 KB | items 12, total 1200, page 1, pageSize 12 |
| `/api/dishes?mode=basic&page=2&pageSize=12` | 200 | application/json | 6.0 KB | items 12, total 1200, page 2, pageSize 12 |

### Tải thêm — mở rồi bấm Tải thêm 2 lần (nối 12 + 12 + 12)

URL trang: `/dishes?view=more` · ảnh: [screens/tai-them.png](../screens/tai-them.png) · SQL: [sql-log/tai-them.txt](../sql-log/tai-them.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=basic&page=1&pageSize=12` | 200 | application/json | 6.9 KB | items 12, total 1200, page 1, pageSize 12 |
| `/api/dishes?mode=basic&page=2&pageSize=12` | 200 | application/json | 0.2 KB | items 12, total 1200, page 2, pageSize 12 |
| `/api/dishes?mode=basic&page=3&pageSize=12` | 200 | application/json | 5.4 KB | items 12, total 1200, page 3, pageSize 12 |

### Cuộn vô hạn — cuộn xuống cuối 2 lần

URL trang: `/dishes?view=scroll` · ảnh: [screens/cuon-vo-han.png](../screens/cuon-vo-han.png) · SQL: [sql-log/cuon-vo-han.txt](../sql-log/cuon-vo-han.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=basic&page=1&pageSize=12` | 200 | application/json | 0.2 KB | items 12, total 1200, page 1, pageSize 12 |
| `/api/dishes?mode=basic&page=2&pageSize=12` | 200 | application/json | 0.2 KB | items 12, total 1200, page 2, pageSize 12 |
| `/api/dishes?mode=basic&page=3&pageSize=12` | 200 | application/json | 0.2 KB | items 12, total 1200, page 3, pageSize 12 |
| `/api/dishes?mode=basic&page=4&pageSize=12` | 200 | application/json | 4.7 KB | items 12, total 1200, page 4, pageSize 12 |

### Cơ bản — tên chứa “phở”

URL trang: `/dishes?q=phở` · ảnh: [screens/basic.png](../screens/basic.png) · SQL: [sql-log/basic.txt](../sql-log/basic.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=basic&q=phở&pageSize=12` | 200 | application/json | 6.9 KB | items 12, total 54, page 1, pageSize 12 |

### Cơ bản — “100%” (ký tự % là chữ thường, sau khi sửa lỗi)

URL trang: `/dishes?q=100%` · ảnh: [screens/basic-wildcard.png](../screens/basic-wildcard.png) · SQL: [sql-log/basic-wildcard.txt](../sql-log/basic-wildcard.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=basic&q=100%&pageSize=12` | 200 | application/json | 0.7 KB | items 1, total 1, page 1, pageSize 12 |

### Nâng cao — “gỏi” + tag Hải sản + giá 50.000–150.000 + đang phục vụ, giá tăng dần, trang 2

URL trang: `/dishes?mode=advanced&q=gỏi&tag=12&minPrice=50000&maxPrice=150000&available=true&sort=gia-tang&page=2` · ảnh: [screens/advanced.png](../screens/advanced.png) · SQL: [sql-log/advanced.txt](../sql-log/advanced.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=advanced&q=gỏi&page=2&pageSize=12&sort=gia-tang&tag=12&minPrice=50000&maxPrice=150000&available=true` | 200 | application/json | 1.1 KB | items 2, total 14, page 2, pageSize 12 |

### Toàn văn — “nước dùng xương” (tên + mô tả, xếp theo ts_rank)

URL trang: `/dishes?mode=fulltext&q=nước dùng xương` · ảnh: [screens/fulltext.png](../screens/fulltext.png) · SQL: [sql-log/fulltext.txt](../sql-log/fulltext.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=fulltext&q=nước+dùng+xương&pageSize=12` | 200 | application/json | 6.4 KB | items 12, total 62, page 1, pageSize 12 |

### Gần đúng — “bò lúc lắt” (gõ sai, pg_trgm similarity ≥ 0.3)

URL trang: `/dishes?mode=fuzzy&q=bò lúc lắt` · ảnh: [screens/fuzzy.png](../screens/fuzzy.png) · SQL: [sql-log/fuzzy.txt](../sql-log/fuzzy.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=fuzzy&q=bò+lúc+lắt&pageSize=12` | 200 | application/json | 3.5 KB | items 6, total 6, page 1, pageSize 12 |

### Trang vượt phạm vi — ?page=101 (ok, items rỗng, total thật)

URL trang: `/dishes?page=101` · ảnh: [screens/vuot-pham-vi.png](../screens/vuot-pham-vi.png) · SQL: [sql-log/vuot-pham-vi.txt](../sql-log/vuot-pham-vi.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=basic&page=101&pageSize=12` | 200 | application/json | 0.4 KB | items 0, total 1200, page 101, pageSize 12 |

### Tham số sai — giá “abc” (VALIDATION_FAILED)

URL trang: `/dishes?mode=advanced&minPrice=abc` · ảnh: [screens/tham-so-sai.png](../screens/tham-so-sai.png) · SQL: [sql-log/tham-so-sai.txt](../sql-log/tham-so-sai.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/tags` | 200 | application/json | 0.2 KB | mảng 16 tag |
| `/api/dishes?mode=advanced&pageSize=12&minPrice=abc` | 200 | application/json | 0.5 KB | ok: false, VALIDATION_FAILED (minPrice) |

### Admin món — tìm “lẩu”, trang 2 (20 món/trang, mới nhất trước)

URL trang: `/admin/dishes?q=lẩu&page=2` · ảnh: [screens/admin.png](../screens/admin.png) · SQL: [sql-log/admin.txt](../sql-log/admin.txt)

| Request (fetch) | Status | Kiểu | Dung lượng | Nội dung |
| :--- | :--- | :--- | :--- | :--- |
| `/api/dishes?q=lẩu&searchIn=name,tag&sort=moi-nhat&page=2&pageSize=20` | 200 | application/json | 7.2 KB | items 20, total 61, page 2, pageSize 20 |
