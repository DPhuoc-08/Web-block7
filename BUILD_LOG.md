# BUILD_LOG — Block 7

Plan: `../block7-plan.md`. Quy ước làm việc: `../CLAUDE.md`.

## Bước 0 — Khởi tạo repo
**Đã làm:** tạo `Week5/block7/`, `git init` (nhánh `main`), `.gitignore` chép từ block6.

**Quyết định và lý do:**
- **Repo mới, không tiếp nối lịch sử block6**: mỗi block một repo (yêu cầu của giảng viên). Lịch sử block6 vẫn nằm ở `Week4/block6/`.
- **`.gitignore` tạo trước mọi `npm install`** (bài học block5): tránh VS Code báo vượt 10000 thay đổi. Giữ nguyên nội dung của block6 vì cấu trúc `api/` + `web/` không đổi: `node_modules/`, `generated/`, `dist/`, `.env`, `.env.*` (trừ `.env.example`), `*.zip`.

**Đã kiểm tra:** `git status` chỉ thấy `.gitignore` và `BUILD_LOG.md`.

## Bước 1 — Chép nền block6
**Đã làm:**
- Chép `api/` và `web/` từ `Week4/block6` bằng `git archive HEAD` (commit `6b5ae78`, cây làm việc block6 sạch). Cách này chỉ lấy file đã commit, nên tự động bỏ `.git`, `node_modules/`, `generated/`, `dist/`, `.env`.
- Đổi tên gói: `block6-api` → `block7-api`, `block6-web` → `block7-web`, cập nhật mô tả. `npm install` ghi lại tên mới vào `package-lock.json`, phiên bản các gói giữ nguyên như block6.
- `api/.env.example`: ghi rõ dùng project Supabase riêng của block7 (seed xoá sạch database đang trỏ tới).
- `web/.env` tạo từ `.env.example` (chỉ có `VITE_API_URL`, không bí mật, không commit).

**Quyết định và lý do:**
- **`git archive` thay vì copy thư mục**: không thể lỡ chép `.env` có chuỗi kết nối của DB block5/block6 sang block7.
- **Chưa tạo `api/.env`**: chuỗi kết nối phải là của project Supabase mới (bước 2). Chép `.env` của block6 sẽ làm app trỏ vào DB dùng chung, đúng thứ CLAUDE.md cấm.
- **Chưa sửa code**: bước này chỉ là bản sao chạy được của block6, để bước sau có mốc so sánh.

**Đã kiểm tra:**
- `npm install` ở `api/` (224 gói) và `web/` (23 gói); `postinstall` sinh Prisma Client 7.10.0 vào `generated/prisma`.
- `npx prisma validate`: schema hợp lệ. Import `generated/prisma/client.ts` được (đường import của `src/db.js`).
- `npx vite build` thành công.
- `git status --ignored`: `node_modules/`, `generated/`, `dist/`, `web/.env` đều bị bỏ qua.

**Chưa kiểm tra được:** chạy API và đọc dữ liệu. Cần `DATABASE_URL` của project Supabase mới (bước 2).

## Bước 2 — Database mới: schema 7 bảng, pg_trgm, seed nhỏ
**Bối cảnh:** nhóm tạo project Supabase mới (ref `txjghunmumpwgwikguyo`, region ap-southeast-2) và điền `api/.env`. Trước mọi lệnh ghi, đã in host/user của `DATABASE_URL` và so với project của block5/block6 (`kkolfprjugtinnzsmwia`): khác nhau. DB lúc đầu: schema `public` trống, PostgreSQL 17.11, UTF8, locale `en_US.UTF-8`, `search_path` có `extensions`.

**Đã làm:**
- `prisma/schema.prisma`: bỏ `dishes.category`, `chefs.specialty`; thêm `Tag` (`tags`), `DishTag` (`dish_tags`), `ChefTag` (`chef_tags`). Xoá món/đầu bếp → liên kết tag tự xoá (Cascade); tag đang dùng không xoá được (Restrict); index `tagId` ở cả hai bảng liên kết.
- In SQL dự kiến bằng `prisma migrate diff --from-empty`: chỉ có `CREATE TABLE/INDEX` và khoá ngoại, không có lệnh xoá. Rồi `prisma db push` lên DB trống, `prisma generate`.
- `prisma/sql/setup-search.sql`: `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions`, chạy bằng `prisma db execute --file`.
- Seed tách dữ liệu ra `prisma/seed-data/base.js` (16 tag, 7 đầu bếp kèm chuyên môn, 30 nguyên liệu, 20 món của block6 kèm tag). `prisma/seed.js` viết lại: một transaction, `TRUNCATE` cả 7 bảng `RESTART IDENTITY`, ghi theo lô bằng `createManyAndReturn` / `createMany`, in host trước khi xoá, in thống kê sau khi xong.

**Quyết định và lý do:**
- **Chuyển loại món cũ sang tag:** mỗi món giữ loại cũ làm tag loại món, thêm tag vùng miền / đặc điểm khi hợp (vd. "Bún chả Hà Nội": Món nước, Món nướng, Miền Bắc). Chuyên môn cũ (chuỗi tự do) tách thành tag. "Bùi Thanh Tâm" (Phụ bếp, 0 món) phải có ≥ 1 chuyên môn theo quy tắc nhóm chốt, nên nhận Món hấp, Lẩu: hai tag chưa có món nào, đầu bếp này vẫn xoá được ngay.
- **Trần Thị Bích thêm chuyên môn "Món cuốn"**, và "Cơm chiên Dương Châu" có tag Món cơm + Món chiên: để mọi món của block6 đều có đầu bếp đúng chuyên môn (quy tắc của seed, mục 4 plan). Seed tự kiểm tra quy tắc này bằng một câu SQL và in số món sai.
- **Ghi theo lô thay vì tạo từng món** (block6 tạo từng món bằng nested create): bước 5 có 1.200 món, tạo từng món qua pooler ở Sydney sẽ rất chậm. `createManyAndReturn` trả id đúng thứ tự gửi, nên nối bảng liên kết theo vị trí.
- **Một transaction cho cả seed:** lỗi giữa chừng không để lại DB nửa cũ nửa mới.
- **Trùng tên tag không phân biệt hoa thường** sẽ do API kiểm tra (bước 3); `@unique` ở DB chỉ chặn trùng đúng từng chữ.
- **Không thêm cột/index tìm kiếm** (plan mục 3.2).

**Lỗi gặp và cách sửa:** lần seed đầu báo `P2028 Unable to start a transaction in the given time`. `maxWait` mặc định của transaction là 2s, không đủ để lấy kết nối tới pooler ở ap-southeast-2. Đặt `maxWait: 30_000` thì chạy được (khoảng 13s cả lệnh).

**Đã kiểm tra:**
- `pg_trgm` 1.6 nằm trong schema `extensions`, gọi `similarity()` và `%` không cần tên schema. `show_trgm('Phở')` có trigram chứa "ở" (hiện dạng mã băm), tức là chữ có dấu được tính là chữ cái.
- Số đo thực tế: `similarity('Phở bò tái', 'Phở bò táii')` = 0.769; `similarity('Phở bò tái', 'Pho bo tai')` = 0.222 (dưới ngưỡng 0.3: gõ không dấu không tìm ra, đúng giới hạn đã ghi trong plan).
- Seed: 20 món, 7 đầu bếp, 30 nguyên liệu, 16 tag; 40 món–tag, 13 đầu bếp–tag, 71 món–nguyên liệu; 2 món tạm hết; 0 món có đầu bếp sai chuyên môn.
- Id 1 = "Phở bò tái", id 20 = "Sinh tố bơ" (giữ thứ tự block6). Seed hai lần liên tiếp cho cùng hash của toàn bộ dữ liệu.

**Trạng thái của API/SPA sau bước này:** code chép từ block6 vẫn đọc/ghi `category`, `specialty`, `GET /api/categories`, nên các route món, đầu bếp, loại món **chưa chạy với schema mới** (lỗi 500). Bước 3 (API theo tag) và bước 4 (SPA theo tag) sửa phần này. Commit bước 2 chỉ chứa phần database (schema, SQL, seed) đã chạy được.

## Bước 3 — API theo tag
**Đã làm:**
- `routes/tags.js` (mới, thay `routes/categories.js` đã xoá): `GET /api/tags` → `[{ id, name, dishCount, chefCount }]` sắp A→Z; `POST /api/tags { name }`. Không có `/:id` (tag không sửa, không xoá — nhóm chốt).
- `validators/tag.js` (mới): `validateTag`, `tagIdList` (quy tắc chung cho `tagIds` của món và đầu bếp), `allTagsExist`.
- `validators/common.js`: thêm `idList` — mảng số nguyên dương, ≥ 1 phần tử, bỏ trùng. `ingredientIds` của món chuyển sang dùng hàm này (hành vi như cũ).
- `http/shapes.js` (mới): `TAG_SELECT`, `flatTags` — đọc bảng liên kết và làm phẳng thành `tags: [{ id, name }]`, dùng chung cho món và đầu bếp.
- Món: `category` → `tagIds` (bắt buộc ≥ 1, id phải có thật; PATCH có `tagIds` → thay toàn bộ). Chi tiết trả `tags` và `chef.tags`; danh sách trả `tags` cho từng món.
- Đầu bếp: `specialty` → `tagIds` (bắt buộc ≥ 1 kể cả PATCH gửi `[]`). Trả `tags`. `?q=` khớp tên hoặc tên một chuyên môn.
- Bộ lọc danh sách món (`menu-filters.js`): `?category=` → `?tag=<id>`; `searchIn=name,category` → `searchIn=name,tag` (tìm theo tên tag). Chỉ sửa tối thiểu: bước 7 thay file này bằng `list-query.js` (phân trang, 4 chế độ search).
- `scripts/check-api.sh`: body của món dùng `tagIds`, đầu bếp có `tagIds`; `simple_resource` nhận thêm đoạn JSON bắt buộc và danh sách khoá lỗi khi body rỗng (đầu bếp: `name`, `tagIds`; nguyên liệu: `name`); bỏ kiểm tra `/api/categories`; số nguyên liệu không còn cố định 30 (đếm trước khi so). Thêm **phần E** (tag): 39 request.

**Quyết định và lý do:**
- **Tag sắp theo id khi trả kèm món/đầu bếp** (danh sách `/api/tags` mới sắp A→Z): id nhỏ là loại món (seed tạo trước), rồi đặc điểm, vùng miền → hiển thị tự nhiên "Món nước · Miền Bắc".
- **`?tag=<id>` không tồn tại → `[]`**, không bỏ qua như loại món lạ của block6: lọc theo tag là lọc trên bảng liên kết, tag không có thì không món nào khớp. Id sai định dạng (`abc`) vẫn bỏ qua như block6. Bước 7 sẽ đổi cả hai trường hợp thành `VALIDATION_FAILED` theo hợp đồng block7.
- **Kiểm tra trùng tên tag không phân biệt hoa thường** bằng `nameTaken` đã có (dùng chung với đầu bếp, nguyên liệu); `@unique` ở DB chặn hai request cùng lúc → `P2002` → `VALIDATION_FAILED`.
- **Ghi tag trong cùng lệnh với món/đầu bếp** (nested `create`, `deleteMany + create` khi sửa): một transaction, không có lúc món mất hết tag.
- **API không kiểm tra đầu bếp có đúng chuyên môn với món** (nhóm chốt): chỉ seed tuân theo, form món sẽ ưu tiên hiện đầu bếp phù hợp (bước 4).

**Đã kiểm tra:**
- `./scripts/check-api.sh`: **154 đạt, 0 chưa đạt** (A 75, B 40, E 39).
- `API_BROKEN=http://localhost:3001 ./scripts/check-api.sh A` (API thứ hai với `DATABASE_URL` sai): `GET /api/dishes` → 500 không theo response shape; `GET /api/tags` → 500. **75/75 đạt**.
- Thử tay: `/api/dishes/2` có `tags` [Món nước, Món nướng, Miền Bắc] và `chef.tags`; `?tag=15` (Miền Trung) ra đúng 3 món; `/api/chefs?q=lẩu` ra "Bùi Thanh Tâm".
- Seed lại sau khi test (tag test không xoá được qua API): 20/7/30/16, 0 món sai chuyên môn.

**Trạng thái:** SPA vẫn đọc `category`, `specialty`, `/api/categories` → trang thực đơn, form món, form đầu bếp chưa chạy với API mới. Sửa ở bước 4.
