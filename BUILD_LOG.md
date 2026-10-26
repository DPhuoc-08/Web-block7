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

## Bước 4 — SPA theo tag
**Đã làm:**
- `api/tags.js` thay `api/categories.js` (đã xoá): `listTags`, `createTag`.
- `components/QuickAdd.jsx` (đổi tên từ `QuickAddIngredient.jsx`, viết lại dạng dùng chung): nhận `fields` (ô nào có `requiredMessage` là bắt buộc) và `create(values)`. Dùng cho thêm nhanh nguyên liệu (tên + đơn vị) và thêm nhanh tag (tên). Id tiêu đề lấy từ `useId` vì form món có thể mở cùng lúc hai khung.
- `components/TagPicker.jsx` (mới): tick nhiều tag, ô lọc tại chỗ (không dấu), "Đã chọn N tag", "+ Thêm tag" → `POST /api/tags` → tag mới vào danh sách và được tick sẵn.
- Form món: ô chọn loại → `TagPicker` (bắt buộc ≥ 1, SPA chặn khi trống); gửi `tagIds`. Danh sách đầu bếp: người có chuyên môn trùng tag đang chọn lên đầu, kèm nhãn "Đúng chuyên môn" và dòng chuyên môn; khi chưa chọn tag có câu gợi ý.
- Form đầu bếp: ô chữ "Chuyên môn" → `TagPicker` (bắt buộc ≥ 1); gửi `{ name, tagIds }`; trang tải thêm `GET /api/tags`.
- Hiển thị tag: thẻ món ở thực đơn, trang chi tiết (tag của món, chuyên môn của đầu bếp, nút "Xem thêm <tag loại món>" → `/dishes?tag=<id>`), bảng admin món (cột Tag), bảng admin đầu bếp (cột Chuyên môn).
- Thực đơn: chip = tag đang có món (`dishCount > 0`), lọc bằng `?tag=<id>`; nhóm theo tag đầu tiên (loại món), dòng món không lặp lại tag của nhóm. Admin món tìm bằng `searchIn=name,tag`.
- `format.js`: thêm `plain` (chuyển từ form món, dùng chung cho ô lọc nguyên liệu và tag), `tagNames` ("Món nước · Miền Bắc"). CSS: nhãn `.fit-label`, khung thêm nhanh một ô.

**Quyết định và lý do:**
- **Gom hai khung thêm nhanh về một component** (plan mục 6.6): hai khung giống nhau trừ số ô; giữ hai bản sẽ phải sửa lỗi hai lần.
- **Đầu bếp phù hợp lên đầu, không ẩn người khác**: API không bắt buộc đúng chuyên môn (nhóm chốt), admin vẫn chọn được bất kỳ ai.
- **Nhóm thực đơn theo tag đầu tiên** để trang vẫn giống block6 ở bước này. Bước 10 bỏ nhóm khi thực đơn có phân trang (plan mục 10.8).
- **Nút "Xem thêm Món nước"** thay cho "Xem thêm món cùng loại": tên tag đã chứa chữ "Món", ghép kiểu "Xem thêm món món nước" bị lặp.

**Đã kiểm tra** (Chrome headless qua DevTools Protocol, kịch bản tự viết, API :3000 + Vite :5173):
- Kịch bản chính: **22/22 đạt**. Thực đơn 20 món nhóm theo tag; chip không có Lẩu, Hải sản; chip Miền Trung → `?tag=15`, 3 món; chi tiết `/dishes/2` có tag + chuyên môn; form món trống → lỗi tag; tick Miền Trung → Võ Thị Mai lên đầu có nhãn; thêm tag mới từ ô tìm → tick sẵn; lưu → dòng mới có cột Tag đúng; sửa tag → bảng đổi; admin tìm "miền trung" → 3 món; form đầu bếp thiếu chuyên môn → lỗi; lưu → "Món nướng · Hải sản"; form sửa tick sẵn; xoá món và đầu bếp test; không lỗi console.
- Kịch bản hồi quy: **8/8 đạt**. Thêm nhanh nguyên liệu (tên trống → lỗi SPA; "tỏi" → lỗi trùng từ API; tên mới → tick sẵn); form món 375px không cuộn ngang; trang xoá đầu bếp còn món vẫn liệt kê món + ô chọn người nhận; bảng đầu bếp có chuyên môn dạng tag.
- `vite build` thành công. Seed lại sau khi test.

**Lỗi trong kịch bản kiểm tra (không phải lỗi app):** `waitFor` dùng `returnByValue` nên `querySelector(...)` (phần tử DOM) luôn ra `undefined` → chờ mãi; sửa bằng `!!(…)`. Ô lọc "mien" ra 4 tag chứ không phải 3: "Tráng miệng" bỏ dấu thành "trang mieng" chứa "mien" — app đúng, kỳ vọng của kịch bản sai.

**Phát hiện: độ trễ của database ở Sydney.** Kịch bản chờ 10s vẫn hết giờ ở lần đầu mở thực đơn. Đo:
- Mở kết nối TCP tới pooler: block7 (ap-southeast-2, Sydney) trung bình **322ms**; block6 (ap-southeast-1, Singapore) **132ms**.
- API khi kết nối đã "ấm": `/api/tags` (1 truy vấn) 0,27s; `/api/dishes` (4 truy vấn: món, đầu bếp, liên kết tag, tag) ~1s; `/api/dishes/2` ~1,2s. Lần đầu sau khi pool nguội: 2,1–2,7s.
- Mỗi truy vấn tốn ít nhất một vòng mạng, nên phân trang (đếm `total` + lấy `items` + tag + đầu bếp) sẽ chậm tương ứng. Đã báo nhóm để chọn: tạo lại project ở Singapore (DB mới chỉ có schema + seed tạo bằng script) hoặc giữ Sydney.
