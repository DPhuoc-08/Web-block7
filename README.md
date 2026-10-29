# Block 7 — Ứng dụng nhà hàng: tìm kiếm và phân trang

Mở rộng ứng dụng block6 (REST API + SPA ở hai origin) với **1.200 món**, **phân trang tại server** cho ba cách hiển thị và **bốn chế độ tìm kiếm tại PostgreSQL**:

| Phần | Thư mục | Địa chỉ | Công nghệ |
| :--- | :--- | :--- | :--- |
| Backend — REST API, chỉ trả JSON | `api/` | http://localhost:3000 | Express 5, Prisma 7.10, Supabase PostgreSQL (`pg_trgm`), `cors` |
| Frontend — SPA chạy trong browser | `web/` | http://localhost:5173 | React 19, Vite 8, React Router 8 (chế độ thư viện), CSS thuần |

Database là **project Supabase riêng của block7** (schema 7 bảng, khác block6: loại món và chuyên môn đầu bếp thành **tag** nhiều-nhiều). Quá trình làm và lý do từng quyết định: `BUILD_LOG.md`. Tài liệu trình bày: `hotrotrinhbay.html`, `kichban.html`. Bằng chứng nộp: `evidence/README.md`.

## Chạy ứng dụng

Cần Node ≥ 22.22 (máy phát triển: Node 25). Mở hai terminal.

**1. API**
```bash
cd api
cp .env.example .env      # điền DATABASE_URL của project Supabase block7 (Connect → Session pooler, cổng 5432)
npm install               # tự chạy `prisma generate`
npm run dev               # http://localhost:3000
```

**2. SPA**
```bash
cd web
cp .env.example .env      # VITE_API_URL=http://localhost:3000 (địa chỉ công khai, không phải bí mật)
npm install
npm run dev               # http://localhost:5173
```

Chạy bản build (dùng khi nghiệm thu): `npm run build && npm run preview` trong `web/` (cổng 5173, cùng cấu hình CORS).

**Dựng database lần đầu** (project Supabase **trống** của block7 — không trỏ vào database block5/block6), trong `api/`:
```bash
npx prisma db push                                         # tạo 7 bảng
npx prisma db execute --file prisma/sql/setup-search.sql   # bật pg_trgm (một lần)
npx prisma db seed                                         # nạp dữ liệu mẫu
```
`npx prisma db seed` in host của `DATABASE_URL` rồi **xoá toàn bộ dữ liệu** của 7 bảng (`TRUNCATE … RESTART IDENTITY`) và nạp lại: 1.200 món, 60 đầu bếp, 250 nguyên liệu, 16 tag. Seed tất định (không ngẫu nhiên): chạy lại luôn ra cùng dữ liệu, id bắt đầu từ 1.

**Biến môi trường của API** (`api/.env`): `DATABASE_URL`, `PORT` (mặc định 3000), `CORS_ORIGIN` (origin của SPA, vd. `http://localhost:5173` — không `*`, không `/` cuối; sai thì API dừng khi khởi động), `LOG_SQL=1` *(tuỳ chọn)* in từng câu SQL thật kèm tham số ra terminal — dùng lấy bằng chứng, mặc định tắt.

## Kiểm tra

```bash
cd api
./scripts/check-api.sh        # 251 kiểm tra (cần curl, jq; API đang chạy)
./scripts/check-api.sh A      # 74 — bảng REST của đề block6 + kỹ thuật + CORS
./scripts/check-api.sh B      # 34 — mở rộng block6 (quan hệ, ảnh, tìm admin, IN_USE, chuyển món)
./scripts/check-api.sh C      # 24 — phân trang: metadata, trang vượt phạm vi, page/pageSize sai, sort qua mọi trang
./scripts/check-api.sh D      # 44 — search 4 chế độ: escape % _ \, basic = advanced, 0 và false, fulltext, fuzzy (cùng điểm → id)
./scripts/check-api.sh E      # 35 — tag: GET/POST /api/tags, tagIds của món và đầu bếp
./scripts/check-api.sh F      # 40 — phân trang admin /api/chefs, /api/ingredients: metadata, all=true, tham số sai, gom mọi trang, escape % _ \
```
Kiểm tra 500 (mất kết nối DB): `DATABASE_URL="postgresql://u:p@127.0.0.1:1/x" PORT=3001 node src/app.js &` rồi `API_BROKEN=http://localhost:3001 ./scripts/check-api.sh A`. Script tự tạo rồi xoá bản ghi test (tag mới thì không xoá được) → **seed lại sau khi test**.

Truy vấn mẫu chạy thẳng trên database, in kết quả để so với các dòng `-- Kỳ vọng`:
```bash
node scripts/run-sql.js prisma/sql/search-examples.sql   # 4 chế độ search
node scripts/run-sql.js prisma/sql/count-rows.sql        # số bản ghi từng bảng
node scripts/run-sql.js prisma/sql/wildcard-escape.sql   # lỗi wildcard trước / sau khi sửa
```

## Database: 7 bảng

```
chefs 1 ───< n dishes              dishes.chefId → chefs.id                (Restrict)
dishes n >───< n ingredients       dish_ingredients (dishId Cascade, ingredientId Restrict)
dishes n >───< n tags              dish_tags        (dishId Cascade, tagId Restrict)
chefs  n >───< n tags              chef_tags        (chefId Cascade, tagId Restrict)
```
- `dishes`: `id`, `name`, `description?`, `price` (Int, đồng, ≥ 0), `available` (mặc định true), `imageUrl?`, `imageCredit?`, `createdAt`, `chefId`. Bỏ `category` của block6.
- `chefs` (`name` unique), `ingredients` (`name` unique, `unit?`), `tags` (`name` unique). Bỏ `specialty` của block6.
- Xoá món / đầu bếp → dòng liên kết tag, nguyên liệu tự xoá (Cascade); tag đang dùng không bị xoá theo (Restrict).
- Không thêm cột / index cho search: document full-text tính ngay trong câu truy vấn; `pg_trgm` ở schema `extensions`.

## Hợp đồng API

**Response shape** giữ block6 — mọi kết quả do handler xử lý có **status 200**:
```json
{ "ok": true, "data": ... }
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "Dữ liệu không hợp lệ.", "fields": { "page": "Số trang phải là số nguyên dương." } } }
```
Lỗi kỹ thuật không theo shape này: sai URL → **404**, body JSON hỏng → **400**, lỗi hệ thống (mất DB) → **500**. Mã nghiệp vụ: `NOT_FOUND`, `VALIDATION_FAILED` (kèm `fields`), `IN_USE` (kèm `dishes`).

### `GET /api/dishes` — danh sách có phân trang và tìm kiếm

```json
{ "ok": true, "data": { "items": [ { "id": 13, "name": "...", "price": 45000, "available": false,
    "chef": { "id": 1, "name": "..." }, "tags": [ { "id": 5, "name": "Món chiên" } ] } ],
  "total": 1200, "page": 2, "pageSize": 12 } }
```
`total` đếm **cùng điều kiện** với `items`. Còn trang sau khi `page × pageSize < total`. Không có kết quả → `items: []`, `total: 0` (không phải `NOT_FOUND`). Trang vượt phạm vi → `items: []`, `total` thật, `page` giữ như yêu cầu.

| Tham số | Chế độ | Quy tắc |
| :--- | :--- | :--- |
| `mode` | — | `basic` (mặc định) \| `advanced` \| `fulltext` \| `fuzzy`; khác → `VALIDATION_FAILED` |
| `page`, `pageSize` | mọi chế độ | số nguyên dương; `pageSize` ≤ 100, mặc định 12; sai (0, âm, `1.5`, `abc`) → `VALIDATION_FAILED` |
| `q` | basic, advanced | tên **chứa** chuỗi, không phân biệt hoa thường; `%`, `_`, `\` là ký tự thường; trống → không có tiêu chí tên |
| `q` | fulltext, fuzzy | **bắt buộc** (trống → `VALIDATION_FAILED`) |
| `sort` | basic, advanced | `ten` \| `gia-tang` \| `gia-giam` \| `moi-nhat` (id giảm, giữ trong API; trang admin không dùng nữa); trống = `id` tăng dần. Luôn thêm `id ASC` làm thứ tự phụ |
| `tag` | advanced | id tag có thật |
| `minPrice`, `maxPrice` | advanced | số nguyên ≥ 0 (`0` là tiêu chí có hiệu lực); `minPrice > maxPrice` → lỗi ở `maxPrice` |
| `available` | advanced | `true` \| `false` (`false` là tiêu chí có hiệu lực); giá trị khác → lỗi |
| `searchIn` | basic | `name,tag` — trang admin tìm cả theo tên tag |

Tiêu chí của advanced nối bằng **AND**. Lọc và sắp xếp chạy trong SQL **trước** `LIMIT/OFFSET`, áp dụng cho toàn bộ kết quả.

| Chế độ | Ở PostgreSQL |
| :--- | :--- |
| `basic` | `name ILIKE '%' \|\| q_đã_escape \|\| '%'` (Prisma `contains` + `escapeLike`) |
| `advanced` | như basic + `EXISTS (dish_tags …)`, `price >=`, `price <=`, `available =` |
| `fulltext` | `setweight(to_tsvector('simple', coalesce(name,'')), 'A') \|\| setweight(to_tsvector('simple', coalesce(description,'')), 'D') @@ plainto_tsquery('simple', q)`; `score` = `ts_rank` |
| `fuzzy` | `set_config('pg_trgm.similarity_threshold', '0.3', true)` rồi `name % q` trong **cùng transaction**; `score` = `similarity(name, q)` |

`fulltext`, `fuzzy`: xếp theo `score` giảm dần rồi `id` tăng dần (không nhận `sort`); mỗi món có thêm `score`. Basic/advanced: `COUNT` và trang chạy trong một transaction `REPEATABLE READ`. Raw SQL chỉ qua tagged template `prisma.$queryRaw` (tham số hoá).

### Tag — `/api/tags` (thay `/api/categories` của block6)

| Request | `data` | Lỗi |
| :--- | :--- | :--- |
| `GET /api/tags` | `[{ id, name, dishCount, chefCount }]`, A→Z | — |
| `POST /api/tags` `{ "name": "Món Huế" }` | tag vừa tạo | `VALIDATION_FAILED` `fields.name` (trống, trùng không phân biệt hoa thường) |

Tag chỉ thêm, không sửa / xoá (nhóm chốt).

### Món, đầu bếp, nguyên liệu — như block6, đổi phần tag

- `GET /api/dishes/:id` → món + `chef { id, name, tags }` + `tags: [{ id, name }]` + `ingredients`.
- `POST` / `PATCH /api/dishes` nhận `tagIds` (mảng id, ≥ 1, mọi id phải có thật, trùng được gộp) thay cho `category`. PATCH có `tagIds` → thay toàn bộ liên kết. Body mẫu:
  ```json
  { "name": "Bún riêu", "price": 45000, "tagIds": [2, 14], "chefId": 1, "ingredientIds": [11, 18], "available": true }
  ```
- `POST` / `PATCH /api/chefs` nhận `{ name, tagIds }` (chuyên môn, ≥ 1) thay cho `specialty`. `GET /api/chefs?q=` khớp tên **hoặc** tên chuyên môn; mỗi đầu bếp có `tags`, `dishCount`.
- `DELETE /api/chefs/:id?transferTo=`, `IN_USE`, CORS: giữ nguyên block6.

### `GET /api/chefs`, `GET /api/ingredients` — phân trang cho trang quản trị

- Trả `data: { items, total, page, pageSize }` như `/api/dishes`, xếp `id` tăng dần. `total` đếm cùng điều kiện `q`, cùng transaction với `items`.
- `?q=`: đầu bếp khớp tên hoặc tên chuyên môn; nguyên liệu khớp tên hoặc đơn vị. Không phân biệt hoa thường, `%` `_` `\` là chữ thường (`escapeLike`).
- `?page=` (mặc định 1), `?pageSize=` (mặc định 20, tối đa 100). Sai → `VALIDATION_FAILED` kèm `fields`; trang vượt phạm vi → `items: []`, `total` thật, `page` giữ nguyên.
- `?all=true`: bỏ phân trang, trả mọi bản ghi khớp (`page: 1`, `pageSize: total`). Dùng cho form món (chọn đầu bếp, nguyên liệu) và trang xoá đầu bếp (chọn người nhận món). `all` khác `true` → `VALIDATION_FAILED`.

## Các trang của SPA

| URL | Nội dung | Gọi API |
| :--- | :--- | :--- |
| `/dishes` | Thực đơn: khung tìm 4 chế độ, chip tag, sắp xếp; công tắc **Số trang / Tải thêm / Cuộn vô hạn** | `GET /api/dishes?…&pageSize=12`, `GET /api/tags` |
| `/dishes/:id` | Chi tiết: ảnh, giá, tag (link lọc), đầu bếp, nguyên liệu | `GET /api/dishes/:id` |
| `/admin/dishes?q=&page=` | Quản trị món: 20 món/trang, id tăng dần, tìm theo tên hoặc tag | `GET /api/dishes?searchIn=name,tag&pageSize=20` |
| `/admin/dishes/new`, `/:id/edit`, `/:id/delete` | Form món (chọn nhiều tag, thêm tag mới, đầu bếp đúng chuyên môn lên đầu), xác nhận xoá | `/api/dishes…`, `/api/tags` |
| `/admin/chefs?q=&page=`, `/admin/ingredients?q=&page=` | Quản trị đầu bếp / nguyên liệu: 20 dòng/trang, id tăng dần, tìm | `GET /api/chefs?q=&page=&pageSize=20`, `GET /api/ingredients?…` |
| `/admin/chefs/…`, `/admin/ingredients/…` (form, xoá) | Như block6; đầu bếp chọn chuyên môn bằng tag | `/api/chefs…`, `/api/ingredients…`, `?all=true` cho danh sách chọn |

**Sau khi lưu ở trang quản trị:** sửa / xoá / Huỷ → về đúng trang danh sách đang xem (giữ `page`, `q`), dòng vừa sửa được tô. Thêm mới → về trang 1 + thông báo (bản ghi mới nằm ở trang cuối).

**URL của thực đơn** chứa toàn bộ điều kiện đã áp dụng: `/dishes?mode=&q=&tag=&minPrice=&maxPrice=&available=&sort=&view=&page=` (giá trị mặc định không ghi).
- Áp dụng điều kiện khi bấm Tìm / Enter (ô chữ) hoặc khi đổi ô chọn, chip — không theo từng phím. Đổi điều kiện → về trang 1 / danh sách mới. Chuyển trang → giữ điều kiện, chỉ đổi `page`.
- `view=pages` (mặc định): `page` nằm trên URL → Reload, copy link, Back/Forward mở lại đúng trang.
- `view=more`, `view=scroll`: `page` không ghi lên URL → mở lại link thì **tải lại từ đầu** với cùng điều kiện. Hai kiểu dùng chung `loadNext()`: không gửi trùng, bỏ response của điều kiện cũ, lỗi thì giữ danh sách và cho Thử lại. Cuộn vô hạn có nút "Tải thêm" dự phòng.
- URL sửa tay sai (`?page=0`, `?minPrice=abc`) → lỗi cạnh ô + "Xoá bộ lọc", không trang trắng.

## Cấu trúc

```
block7/
├── api/
│   ├── prisma/schema.prisma              7 bảng (tag nhiều-nhiều cho món và chuyên môn đầu bếp)
│   ├── prisma/seed.js, seed-data/        seed tất định 1.200 món (bộ sinh có tự kiểm tra)
│   ├── prisma/sql/                       setup-search (pg_trgm), search-examples, count-rows, wildcard-escape
│   ├── scripts/check-api.sh, run-sql.js  251 kiểm tra API; chạy file .sql và in kết quả
│   └── src/
│       ├── db.js                         PrismaClient dùng chung (SSL có CA), LOG_SQL
│       ├── routes/                       dishes (phân trang + search), chefs, ingredients, tags
│       ├── validators/list-query.js      đọc query danh sách (page/pageSize dùng chung), escapeLike, điều kiện tìm
│       └── search/fulltext.js, fuzzy.js  $queryRaw: total + id/score của trang trong một câu SQL
├── web/src/
│   ├── listQuery.js                      URL trang ↔ tham số API
│   ├── hooks/useAppendList.js            Tải thêm / Cuộn vô hạn: loadNext() dùng chung
│   ├── hooks/useLoad.js, useListTop.js   tải theo URL (huỷ request cũ); cuộn + focus đầu danh sách khi chuyển trang
│   ├── components/                       SearchPanel, Pagination, ViewSwitch, LoadMore, InfiniteSentinel, TagPicker, TagList, QuickAdd…
│   ├── pages/                            dishes/, admin/{dishes,chefs,ingredients}/
│   └── styles/style.css                  CSS của block6 + phần mới, responsive 1024 / 820 / 600px, hiệu ứng cơ bản
└── evidence/                             bằng chứng nộp (Network, SQL thật, kết quả truy vấn mẫu, ảnh)
```
