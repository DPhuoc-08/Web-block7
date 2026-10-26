# Bằng chứng nộp — Block 7 (tìm kiếm và phân trang)

Thu ngày 26/10/2026 trên dữ liệu seed chuẩn (`npx prisma db seed`, tất định), API :3000 và bản production của SPA (`vite build` + `vite preview` :5173). Thư mục này **không** chứa `.env`, chuỗi kết nối, host hay mật khẩu database. Log SQL chỉ có câu SQL và giá trị tham số (từ khoá, số trang).

## Đối chiếu với yêu cầu của đề

| Đề yêu cầu | File chứng minh | Đọc ở đâu |
| :--- | :--- | :--- |
| Số bản ghi trong Supabase, script seed ≥ 1.000 món | [sql-results/count-rows.txt](sql-results/count-rows.txt) (chạy [`api/prisma/sql/count-rows.sql`](../api/prisma/sql/count-rows.sql)); script [`api/prisma/seed.js`](../api/prisma/seed.js) | `dishes 1200`, `chefs 60`, `ingredients 250`, `tags 16`, `dish_tags 2106`, `chef_tags 106`, `dish_ingredients 5357` |
| Demo ba kiểu phân trang | [network/network-log.md](network/network-log.md) mục Số trang / Tải thêm / Cuộn vô hạn; ảnh `screens/so-trang-2.png`, `tai-them.png`, `cuon-vo-han.png` | Mỗi lần chuyển trang / tải thêm / cuộn tới cuối: **một** `GET /api/dishes?page=N&pageSize=12`, nhận 12 món JSON (≈ 6 KB) kèm `total: 1200` — không tải cả 1.200 món (≈ 480 KB) |
| Filter / sort | `network-log.md` mục Nâng cao; [sql-log/advanced.txt](sql-log/advanced.txt) | Các tiêu chí nối bằng `AND`, `ORDER BY price ASC, id ASC`, `COUNT(*)` cùng điều kiện → `total: 14`; trang 2 có 2 món |
| URL search, Network, query tại PostgreSQL — **mỗi chế độ** | Bảng dưới | URL trang ↔ request API ↔ SQL thật |
| Kết quả truy vấn mẫu chạy lại được | [sql-results/search-examples.txt](sql-results/search-examples.txt) (chạy [`api/prisma/sql/search-examples.sql`](../api/prisma/sql/search-examples.sql)) | 14 kết quả, so với các dòng `-- Kỳ vọng` trong file `.sql` |
| Một lỗi đã phát hiện, cách tái hiện, bằng chứng sau khi sửa | [sql-results/wildcard-escape.txt](sql-results/wildcard-escape.txt) (chạy [`api/prisma/sql/wildcard-escape.sql`](../api/prisma/sql/wildcard-escape.sql)); [sql-log/basic-wildcard.txt](sql-log/basic-wildcard.txt); ảnh `screens/basic-wildcard.png`; BUILD_LOG bước 7 "Lỗi đã phát hiện" | Xem mục "Lỗi đã phát hiện" bên dưới |

### Bốn chế độ search

| Chế độ | URL trang | Request API (SPA gửi) | Kết quả | SQL thật (`LOG_SQL=1`) |
| :--- | :--- | :--- | :--- | :--- |
| Cơ bản | `/dishes?q=phở` | `GET /api/dishes?mode=basic&q=phở&pageSize=12` | 12/54 món | [sql-log/basic.txt](sql-log/basic.txt): `"name" ILIKE ('%' \|\| $1 \|\| '%')`, `COUNT(*)`, `ORDER BY id ASC LIMIT $1 OFFSET $2` |
| Nâng cao | `/dishes?mode=advanced&q=gỏi&tag=12&minPrice=50000&maxPrice=150000&available=true&sort=gia-tang&page=2` | `GET /api/dishes?mode=advanced&q=gỏi&page=2&pageSize=12&sort=gia-tang&tag=12&minPrice=50000&maxPrice=150000&available=true` | 2/14 món (trang 2) | [sql-log/advanced.txt](sql-log/advanced.txt): `ILIKE … AND EXISTS (dish_tags …) AND price >= $3 AND price <= $4 AND available = $5` |
| Toàn văn | `/dishes?mode=fulltext&q=nước dùng xương` | `GET /api/dishes?mode=fulltext&q=nước+dùng+xương&pageSize=12` | 12/62 món, xếp theo `ts_rank` | [sql-log/fulltext.txt](sql-log/fulltext.txt): `to_tsvector('simple', …) @@ plainto_tsquery('simple', $…)`, `ts_rank`, `ORDER BY score DESC, id ASC LIMIT … OFFSET …` |
| Gần đúng | `/dishes?mode=fuzzy&q=bò lúc lắt` | `GET /api/dishes?mode=fuzzy&q=bò+lúc+lắt&pageSize=12` | 6 món, "Bò lúc lắc" đầu (0.667) | [sql-log/fuzzy.txt](sql-log/fuzzy.txt): `set_config('pg_trgm.similarity_threshold', '0.3', true)` rồi `name % $2`, `similarity(name, $1)` — cùng transaction (kết thúc bằng `COMMIT`) |

Ngoài ra: trang vượt phạm vi `?page=101` → `ok: true, items: [], total: 1200, page: 101` ([sql-log/vuot-pham-vi.txt](sql-log/vuot-pham-vi.txt)); tham số sai `?minPrice=abc` → `VALIDATION_FAILED`, `fields.minPrice`, **không có câu SQL nào** (API dừng ở bước kiểm tra, [sql-log/tham-so-sai.txt](sql-log/tham-so-sai.txt)); admin món tìm "lẩu" trang 2 → 20/61 món, mới nhất trước ([sql-log/admin.txt](sql-log/admin.txt)).

**Cách đọc log SQL.** Mỗi request danh sách gồm: (1) `COUNT(*)` với **cùng điều kiện** → `total`; (2) truy vấn món của trang có `ORDER BY … id ASC LIMIT $n OFFSET $m` — tham số cuối là `pageSize` và `(page − 1) × pageSize` (trang 2: `["12","12"]`); (3) ba truy vấn nạp đầu bếp, tag của đúng các món trên trang (`WHERE id IN (…)`). Chế độ cơ bản / nâng cao chạy (1) và (2) trong một transaction `REPEATABLE READ` để `total` và `items` nhìn cùng một trạng thái dữ liệu; log của Prisma không in `BEGIN`, chỉ in `COMMIT` ở cuối. Toàn văn / gần đúng gộp `total` và id của trang vào **một** câu SQL (CTE `matched`).

## Lỗi đã phát hiện: ký tự người dùng gõ bị hiểu là wildcard

- **Tái hiện** (trước khi sửa): API đưa từ khoá nguyên văn vào `contains` của Prisma → PostgreSQL nhận `"name" ILIKE ('%' || $1 || '%')`. Tìm `%` hoặc `_` trả **cả 1.200 món**; tìm `Trà_` trả nhiều món "Trà …" thay vì chỉ "Trà_sữa nhà làm". `wildcard-escape.txt` dòng [1]–[3] chạy đúng câu đó trên database: 1200, 1200, 23 món.
- **Nguyên nhân:** Prisma không escape `%`, `_`, `\` trong `contains`. Parameter binding chỉ chống SQL injection, không giữ nghĩa "chứa đúng chuỗi".
- **Cách sửa:** `escapeLike` trong [`api/src/validators/list-query.js`](../api/src/validators/list-query.js) đổi `\` → `\\`, `%` → `\%`, `_` → `\_` trước khi đưa vào `contains`.
- **Sau khi sửa:** `wildcard-escape.txt` dòng [4]–[7]: mỗi trường hợp đúng 1 món (id 560 "Combo 100% bò", 700 "Trà_sữa nhà làm", 960 "Cơm \ cháo tuỳ chọn"); `sql-log/basic-wildcard.txt`: SPA gửi `q=100%`, tham số SQL là `100\%` (log in dạng JSON nên hiện `"100\\%"`), kết quả 1 món; `check-api.sh` phần D kiểm tra lại mỗi lần chạy.
- Ghi chú: BUILD_LOG bước 7 ghi "Trà_ → 24 món" — đo trên seed lúc đó; bước 8 bỏ các tên lặp chữ trong bộ sinh nên seed hiện tại còn 23.

## Cách chạy lại

```bash
cd block7/api
node scripts/run-sql.js prisma/sql/count-rows.sql        # số bản ghi
node scripts/run-sql.js prisma/sql/search-examples.sql   # 4 chế độ search, so với "Kỳ vọng"
node scripts/run-sql.js prisma/sql/wildcard-escape.sql   # lỗi wildcard trước / sau khi sửa
```

Log SQL: thêm `LOG_SQL=1` vào `api/.env` (hoặc `LOG_SQL=1 npm run dev`), mở URL trang ở bảng trên, đọc terminal của API. Tắt lại sau khi lấy bằng chứng.

`network-log.md`, `sql-log/`, `screens/` được tạo bằng Chrome headless điều khiển qua DevTools Protocol: mở từng URL trang, làm thao tác (bấm trang 2, Tải thêm, cuộn), ghi request tới API; rồi gửi lại đúng các URL API đó tới một API phụ bật `LOG_SQL=1` và cắt log của từng request.

## Phần nhóm tự chụp trên trình duyệt thật (headless không chụp được giao diện DevTools / Supabase)

Lưu vào `evidence/manual/`, đánh dấu khi xong:

- [ ] `supabase-table-editor.png` — Supabase → Table Editor → `dishes` (góc dưới hiện 1200 rows), hoặc SQL Editor chạy `count-rows.sql`.
- [ ] `network-so-trang.png` — DevTools → Network, lọc **Fetch/XHR**, bấm trang 2: thấy 1 request `dishes?…page=2&pageSize=12`, tab Preview mở `data.items` (12) và `total` (1200).
- [ ] `network-tai-them.png` — như trên ở `?view=more`, bấm Tải thêm 2 lần: 3 request `page=1,2,3`, URL trang không đổi.
- [ ] `network-cuon-vo-han.png` — `?view=scroll`, cuộn xuống: request `page=2,3…` tự gửi, mỗi trang một lần.
- [ ] `network-4-che-do.png` (hoặc 4 ảnh) — mỗi chế độ ở bảng trên: URL trang + request API + Preview.
- [ ] `network-mang-cham.png` *(tuỳ chọn)* — Network → Slow 3G, bấm Tải thêm rồi bấm chip khác ngay: request cũ bị huỷ (canceled), danh sách chỉ có kết quả mới.
- [ ] `terminal-log-sql.png` — terminal API khi bật `LOG_SQL=1` và mở `/dishes?page=2` (thấy `LIMIT $1 OFFSET $2`, `params: ["12","12"]`).
