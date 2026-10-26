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

## Bước 4b — Chuyển database sang Singapore
**Bối cảnh:** nhóm chọn tạo lại project ở Singapore (phát hiện ở cuối bước 4). Project mới: ref `ovirbpyprylgaqgvgzil`, host `aws-0-ap-southeast-1.pooler.supabase.com`. Đã so ref với block5/block6 (`kkolfprjugtinnzsmwia`) và project Sydney (`txjghunmumpwgwikguyo`): khác cả hai. DB lúc đầu trống, PostgreSQL 17.11, UTF8, `en_US.UTF-8`.

**Đã làm:** dừng API cũ (pool còn trỏ Sydney), chạy lại đúng các lệnh của bước 2: `prisma migrate diff --from-empty` (không có lệnh xoá) → `prisma db push` → `prisma db execute --file prisma/sql/setup-search.sql` → `prisma db seed`. Không đổi code.

**Lần chạy đầu không rõ kết quả:** lệnh gộp (`db push` + seed, có lọc `grep`) không in dòng "in sync" của `db push`, và seed dừng sau dòng "Seed vào". Lỗi bị `grep` ẩn nên không biết chính xác nguyên nhân. Chạy lại từng lệnh riêng: `db push` báo "in sync" (3,8s), seed in đủ thống kê. Bài học: không lọc output của lệnh ghi DB lần đầu chạy.

**Đã kiểm tra:**
- `pg_trgm` 1.6 ở schema `extensions`; `similarity` cho cùng số đo như ở Sydney (0.769 gõ thừa chữ, 0.222 không dấu).
- Seed 20/7/30/16, 0 món sai chuyên môn; **hash toàn bộ dữ liệu `145ca853d87d7c35` trùng với DB Sydney** → seed tất định, chuyển region không đổi dữ liệu.
- Độ trễ: mở kết nối TCP **63ms** (Sydney 322ms). API khi kết nối đã ấm: `/api/tags` 0,08s (Sydney 0,27s), `/api/dishes` 0,24s (~1s), `/api/dishes/2` 0,29–0,34s (~1,2s). Lần đầu sau khi pool nguội: 0,6–0,8s (Sydney 2,1–2,7s).
- `check-api.sh`: **154/154 đạt**. Kịch bản trình duyệt bước 4: **22/22** và **8/8 đạt**. Seed lại sau khi test.

**Việc của nhóm:** xoá project Sydney trên dashboard Supabase (không còn dùng).

## Bước 5 — Seed đầy đủ: 1.200 món, 60 đầu bếp, 250 nguyên liệu
**Đã làm:**
- `prisma/seed-data/catalog.js` (mới): họ/tên đệm/tên đầu bếp; 221 nguyên liệu bổ sung (cộng 30 của block6 = 250); bảng từ khoá trong tên món → nguyên liệu; tinh bột theo chữ đầu tên; kho nguyên liệu phụ theo loại món; họ món của 11 loại (nền × phần chính × kiểu, kèm khoảng giá và mẫu mô tả); từ khoá → tag vùng miền / Hải sản / Món chay; 7 món đặc biệt ở vị trí cố định.
- `prisma/seed-data/generate.js` (mới): bộ sinh tất định (PRNG mulberry32, hạt giống cố định `20261026`, không `Math.random`).
  - 20 món block6 giữ id 1–20, 7 món đặc biệt chèn đúng id (300, 420, 560, 700, 830, 960, 1100), 1.173 món sinh xen kẽ các loại.
  - Tag món: tag loại + vùng miền (theo từ khoá hoặc 25% ngẫu nhiên) + Hải sản / Món chay (theo từ khoá).
  - Đầu bếp: 7 của block6 + 53 sinh; chuyên môn chính chia theo tỉ lệ số món của từng loại (mỗi loại ≥ 3 người), thêm 0–2 chuyên môn phụ; 2 người có chuyên môn nhưng 0 món ("Bùi Thanh Tâm" và người sinh cuối cùng).
  - Gán đầu bếp: người **cùng chuyên môn** đang phụ trách ít món nhất → chia đều.
  - Nguyên liệu mỗi món 3–6: tinh bột + 1 nguyên liệu cho mỗi từ khoá khớp + bù từ kho theo loại; sau đó "phủ": nguyên liệu nào chưa ai dùng được thêm vào món đầu tiên cùng loại còn chỗ → chỉ còn đúng 5 nguyên liệu cố ý không dùng.
  - Tự kiểm tra và dừng với thông báo rõ khi: tên nguyên liệu trùng, catalog nhắc tới nguyên liệu không có, một loại không ghép đủ tên, không có đầu bếp đúng chuyên môn, có nguyên liệu không phủ được, tổng khác 1.200.
- `prisma/seed.js`: lấy dữ liệu từ `buildSeed()`; in thêm số món mỗi đầu bếp (min–max, số người 0 món), số nguyên liệu không dùng, số món mỗi tag.
- `scripts/check-api.sh`: 2 kỳ vọng phụ thuộc seed nhỏ (Lẩu chưa có món) đổi thành `?tag=999999` → `[]` và "tag Lẩu có món, có đầu bếp".

**Quyết định và lý do:**
- **Số lượng cân đối thay vì nhân tỉ lệ block6** (plan mục 10.4): khoảng 20 món mỗi đầu bếp; nhân đúng tỉ lệ 20:7:30 sẽ ra 420 đầu bếp, 1.800 nguyên liệu.
- **Tên món ghép từ danh mục có thật theo từng loại** (vd. "Bún riêu cua Hà Nội", "Mực xào sả ớt", "Lẩu cá kèo 4 người"), không ghép chéo loại → kết quả tìm kiếm khi demo đọc được.
- **Tên không trùng**: dễ đối chiếu kết quả search và phân trang bằng tên.
- **Món đặc biệt cố định id** (giá 0; "Combo 100% bò", "Trà_sữa nhà làm", "Cơm \ cháo tuỳ chọn" để thử escape `%`, `_`, `\`; mô tả `NULL`) nằm xa trang đầu → phát hiện lọc chỉ trên dữ liệu chưa đủ.
- **Ảnh**: món sinh cùng họ với món block6 có ảnh thì dùng lại ảnh đó kèm ghi công (khoảng 246 món); còn lại để trống, giao diện hiện khung "Chưa có ảnh".

**Lỗi phát hiện và cách sửa (trong lúc viết bộ sinh):**
1. *Một số loại không ghép đủ tên*: Món nước 206/220, Món xào 125/140, Món chiên 108/120 (tự kiểm tra của bộ sinh báo). Thêm kiểu và món chính có thật (Hủ tiếu Sa Đéc/Mỹ Tho, Bánh canh ghẹ/mực, Thịt heo/Lòng heo xào, Cá lóc/Cá trê chiên).
2. *"Cánh gà" bị gắn tag Hải sản*: chuỗi "cá" nằm trong "Cánh". `\b` của JavaScript không hiểu chữ có dấu → đổi mọi so khớp từ khoá (Hải sản, thịt, Món chay, từ khoá nguyên liệu) sang so khớp nguyên từ bằng lookaround `(?<!\p{L})…(?!\p{L})` với cờ `u`.
3. *55 nguyên liệu không món nào dùng, mới có 229 nguyên liệu* (plan: 250, 5 không dùng): thêm 21 nguyên liệu, đưa mọi nguyên liệu vào kho theo loại, thêm bước phủ; bước phủ báo đúng "Măng tây" chỉ có trong một tên món có thể bị loại khi bốc ngẫu nhiên → thêm vào kho Khai vị và từ khoá riêng.
4. *Nguyên liệu thiếu so với tên* ("Sò điệp nướng phô mai" không có Phô mai) → thêm từ khoá "phô mai", "trứng muối". Mẫu mô tả món nướng lặp chữ ("… nướng phô mai nướng tới đâu…") → viết lại câu.

**Đã kiểm tra:**
- Seed (~11s): **1.200 món, 60 đầu bếp, 250 nguyên liệu, 16 tag**; 2.165 món–tag, 106 đầu bếp–tag, 5.360 món–nguyên liệu; 4 món giá 0; 159 món tạm hết; **0 món sai chuyên môn**; món mỗi đầu bếp 19–22 (2 người 0 món); **5 nguyên liệu không dùng** (Nấm hương, Lá é, Đường thốt nốt, Váng đậu, Sầu riêng).
- Món mỗi tag: Khai vị 82, Món nước 224, Món cơm 165, Món xào 139, Món chiên 123, Món nướng 123, Món hấp 70, Món cuốn 61, Lẩu 61, Tráng miệng 72, Đồ uống 86, Hải sản 383, Món chay 101, Miền Bắc 144, Miền Trung 119, Miền Nam 212.
- 1.200 tên không trùng; chỉ 2 món đặc biệt có dưới 3 nguyên liệu (Trà đá, Đá viên).
- Seed 2 lần liên tiếp: cùng hash `01ea4578accfced3`. Id 1–20 đúng món block6; 7 món đặc biệt đúng id.
- `check-api.sh`: **154/154 đạt** (sau khi sửa 2 kỳ vọng phụ thuộc seed nhỏ). Seed lại sau khi test.

**Mốc "trước phân trang"** (để so sánh ở bước 7–10): `GET /api/dishes` trả cả 1.200 món, **495KB**, 0,35–1,1s. Trong Chrome headless, `/dishes` cần **~34s** mới hiện đủ 1.200 dòng, `/admin/dishes` ~14s; form món (60 đầu bếp, 250 nguyên liệu) ~5s. Không lỗi console. Đây là lý do thực tế cho phân trang tại server (plan mục 0).

## Bước 6 — Giao diện cho phần tag, ảnh với 1.200 món
**Đã làm:**
- `components/TagList.jsx` (mới): tag dạng chip nhỏ; tag loại món (`mainId`) có màu nhấn. Trong thẻ món chỉ là `<span>` (cả thẻ đã là link); ở trang chi tiết mỗi chip là link `/dishes?tag=<id>`.
- Thẻ món (`DishRow`): chip tag thay cho chuỗi "Món nước · Miền Bắc". Món không có ảnh → khung ghi tên loại món (tag đầu tiên) thay cho "Chưa có ảnh".
- Trang chi tiết: chip tag (link) ở đầu, bỏ dòng "Tag" trùng trong bảng thông tin.
- CSS: `.tag-list`, `.tag-chip` (chip là link cao 32px để dễ chạm), khung "chưa có ảnh" của thẻ món tô màu nhấn nhạt.

**Quyết định và lý do:**
- **Truyền `mainId` thay vì luôn tô tag đầu danh sách:** khi thực đơn nhóm theo loại, tag loại bị ẩn trên từng dòng; nếu tô tag đầu thì "Miền Bắc" sẽ bị tô như loại món.
- **Bảng admin giữ dạng chữ "A · B"** (không đổi sang chip): bảng cần gọn, chip làm dòng cao hơn.
- Phần còn lại của mục 7.2 (khung tìm, công tắc kiểu hiển thị, phân trang, Tải thêm, điểm phù hợp) làm cùng các bước 9–12 của chức năng đó.

**Đã kiểm tra** (Chrome headless): ở 1280 / 820 / 375px, `/dishes?tag=9` (61 món) và `/dishes/22` không cuộn ngang; chip ở trang chi tiết đều là link `/dishes?tag=<id>`; nhóm Lẩu không có chip nào bị tô nhầm màu loại món; không lỗi console; `vite build` thành công. Một kiểm tra báo chưa đạt do kỳ vọng sai: khung "chưa có ảnh" trong `?tag=9` ghi "Lẩu" cho 60 món và "Món nướng" cho "Combo 100% bò" — món này có tag loại đầu tiên là Món nướng, app hiển thị đúng.

## Bước 7 — API phân trang + search basic/advanced
**Đã làm:**
- `validators/list-query.js` (mới, thay `menu-filters.js` đã xoá): đọc và validate `mode`, `q`, `page`, `pageSize`, `sort`, `searchIn` (basic, admin), `tag`, `minPrice`, `maxPrice`, `available` (advanced) theo plan mục 5.3. Thiếu/chuỗi trắng → không có tiêu chí; có mà sai (kể cả tham số lặp `?q=a&q=b`) → `VALIDATION_FAILED` kèm `fields` theo đúng tên tham số. Tham số của advanced gửi kèm basic bị bỏ qua.
- `GET /api/dishes` trả `data: { items, total, page, pageSize }`. `count` và `findMany` (skip/take) chạy trong một transaction `RepeatableRead` → cùng ảnh chụp dữ liệu. Thứ tự: `sort` + `id` làm thứ tự phụ; thêm `sort=moi-nhat` (id giảm, cho admin — plan mục 10.9). Tag không tồn tại → `VALIDATION_FAILED fields.tag`.
- `scripts/check-api.sh`: phần A đọc `data.items`/`data.total`, `?q=a&q=b` nay là `VALIDATION_FAILED`; bỏ các test bộ lọc cũ của block6 ở phần B (`price=duoi-40k`, `available=1`, tham số sai bị bỏ qua); thêm **phần C** (phân trang, 34 kiểm tra) và **phần D** (search basic/advanced, 25 kiểm tra); hàm `collect` gom id qua mọi trang để chứng minh không mất/lặp món.

**Lỗi đã phát hiện (bằng chứng nộp — plan mục 9):** *ký tự đặc biệt người dùng nhập bị hiểu là wildcard.*
- *Tái hiện* (trước khi sửa, `name: { contains: q, mode: "insensitive" }`): `GET /api/dishes?q=%` và `?q=_` trả **cả 1.200 món**; `?q=Trà_` trả **24 món** ("Trà matcha sữa", "Trà chanh dây size lớn"…) thay vì chỉ "Trà_sữa nhà làm".
- *Nguyên nhân:* Prisma 7 đưa chuỗi của `contains` vào `ILIKE '%…%'` nguyên vẹn, không escape `%`, `_`, `\`. Parameter binding chỉ chống SQL injection, không giữ nghĩa "chứa đúng chuỗi".
- *Cách sửa:* `escapeLike` thay `\` → `\\`, `%` → `\%`, `_` → `\_` (một lượt) trước khi đưa vào `contains`. PostgreSQL dùng `\` làm ký tự escape mặc định của LIKE/ILIKE.
- *Bằng chứng sau khi sửa:* `q=%` → 1 món (#560 "Combo 100% bò"); `q=_`, `q=Trà_` → 1 món (#700 "Trà_sữa nhà làm"); `q=\` → 1 món (#960 "Cơm \ cháo tuỳ chọn"); `q=100%` → #560. Năm trường hợp này nằm trong `check-api.sh D`.
- *Khác plan mục 5.4:* plan ghi "nếu Prisma không escape thì chuyển sang `$queryRaw` với `ESCAPE '!'`". Đã chọn escape trước khi đưa vào Prisma: cùng ngữ nghĩa với `literal_pattern` của giảng viên, nhưng giữ được điều kiện tag (bảng liên kết), khoảng giá, trạng thái và `include` của Prisma, không phải viết lại thành SQL thô. Nếu bản Prisma sau tự escape, kiểm tra D sẽ báo (thoát hai lần → không tìm ra).

**Lỗi kỹ thuật khác:** lần gọi đầu sau khi pool nguội báo `P2028 Unable to start a transaction in the given time` → 500 (như lần seed ở bước 2). Đặt `maxWait: 10_000, timeout: 15_000` cho transaction của danh sách.

**Đã kiểm tra:**
- `check-api.sh`: **192/192 đạt** (A 75, B 19, C 34, D 25, E 39). Lần chạy đầu 191/192: kiểm tra `minPrice > maxPrice` viết `%26` thay vì `&` nên server nhận `minPrice="50000&maxPrice=10000"` và báo lỗi định dạng (đúng) → sửa script.
- Phân trang: mặc định id 1–12, page 2 → 13–24, page 100 → 1189–1200; page 101 và 2147483647 → `items: []`, total 1200, page giữ nguyên; page/pageSize sai (0, -1, abc, 2.5, 01, 1e2, vượt Int, 101, lặp) → `VALIDATION_FAILED`.
- Gom 12 trang × 100: đủ 1.200 id, không trùng. `sort=gia-tang` qua mọi trang: giá không giảm, cùng giá thì id tăng.
- Advanced: Lẩu → 61 món (có id > 12); `available=false` → mọi món tạm hết; `minPrice=0&maxPrice=0` → 4 món giá 0; Hải sản + 50.000–100.000 + còn phục vụ → mọi món thoả cả 3 điều kiện, `total` = số món gom qua các trang. Basic và advanced chỉ có `q=phở` → cùng total, cùng id.
- Mỗi trang ~6,7KB (trước phân trang: 495KB cho cả danh sách), 0,5–0,9s (có lần 1,76s). Chậm hơn danh sách không phân trang (0,24s) vì transaction thêm vòng mạng (BEGIN, đặt isolation, COUNT, SELECT, nạp tag/đầu bếp, COMMIT; ~63ms mỗi vòng). Giữ transaction vì `total` phải khớp `items`; ghi lại để cân nhắc ở bước nghiệm thu.
- Seed lại sau khi test.

**Trạng thái:** SPA (thực đơn, admin món) vẫn đọc `data` là mảng và gửi tham số cũ (`price=`, `available=1`) → hai trang danh sách chưa chạy cho tới bước 9 (admin) và 10 (thực đơn). Chi tiết món, form, đầu bếp, nguyên liệu không bị ảnh hưởng.

## Bước 8 — API full-text + fuzzy
**Đã làm:**
- `src/search/fulltext.js`: `plainto_tsquery('simple', q)` trên document `setweight(to_tsvector('simple', coalesce(name,'')),'A') || setweight(to_tsvector('simple', coalesce(description,'')),'D')`, điểm `ts_rank`. Document tính trong câu truy vấn (không thêm cột — plan mục 3.2).
- `src/search/fuzzy.js`: `similarity(name, q)` và `name % q`, ngưỡng `0.3` đặt bằng `set_config('pg_trgm.similarity_threshold', '0.3', true)` (= `SET LOCAL`) trong cùng transaction với câu tìm.
- Mỗi chế độ là **một câu SQL** trả `total` + id/điểm của trang (`LIMIT/OFFSET` sau `ORDER BY score DESC, id ASC`) → cùng ảnh chụp dữ liệu, một vòng mạng. Prisma nạp tag, đầu bếp theo danh sách id rồi giữ đúng thứ tự điểm; mỗi món có thêm `score` (làm tròn 3 chữ số).
- `list-query.js`: `mode` nhận thêm `fulltext`, `fuzzy`; hai chế độ này bắt buộc `q` (trống → `VALIDATION_FAILED fields.q`), bỏ qua `sort` và tiêu chí của advanced.
- `prisma/sql/search-examples.sql` (mới): 4 chế độ + câu total/trang trên bảng `dishes`, kèm dòng "Kỳ vọng" tính từ seed; BEGIN/ROLLBACK.
- `scripts/run-sql.js` (mới): chạy nguyên văn một file `.sql` bằng `pg` và in kết quả từng câu (`prisma db execute` chỉ báo chạy được, không in kết quả).
- `check-api.sh` phần D thêm 18 kiểm tra fulltext/fuzzy; `collect` gom thêm `score` và chữ của tên + mô tả.

**Quyết định và lý do:**
- **Tên trọng số A, mô tả D** (như file mẫu của giảng viên): món có từ khoá trong tên xếp trước. Nhiều món vẫn cùng điểm (vd. "cá kho tộ": 11 món, 5 món đầu cùng 1.000) → thứ tự phụ `id` là bắt buộc để chia trang ổn định.
- **`set_config(..., true)` thay vì `SET LOCAL` chuỗi cố định:** tương đương, nhưng gọi được qua `$queryRaw` có tham số.
- **Không kết hợp fulltext/fuzzy với tag/giá/trạng thái** (plan mục 6.4 — không bắt buộc).

**Lỗi dữ liệu phát hiện và sửa (seed):**
1. *Tên món lặp chữ:* fuzzy "Gỏi cuống tôm thịt" trả kèm "Gỏi tôm tôm thịt". Bộ sinh ghép phần chính "tôm" với kiểu "tôm thịt" (2 tên: Gỏi/Nộm). Thêm quy tắc bỏ tên có hai chữ liền nhau giống nhau.
2. Thay đổi trên làm lệch chuỗi ngẫu nhiên → bước phủ nguyên liệu báo **"Chân giò" không món nào dùng** (chỉ đến từ từ khoá "giò heo", lần bốc mới chọn "Giò heo"). Bộ sinh dừng trước khi ghi DB. Sửa bước phủ: ngoài kho theo loại, nhận cả món có tên khớp từ khoá dẫn tới nguyên liệu đó.
- Seed mới: 1.200 món, 60 đầu bếp, 250 nguyên liệu; 2.106 món–tag, 5.357 món–nguyên liệu; 4 món giá 0, 180 món tạm hết; 0 món sai chuyên môn; 5 nguyên liệu không dùng; 0 tên lặp chữ; hash `798423e712f0ffdc` (seed 2 lần giống nhau). Món nước 224, Lẩu 61 — các kỳ vọng của `check-api.sh` không đổi.

**Lỗi trong kiểm tra (không phải lỗi app):** thử hàm `literal_pattern` bằng `$queryRaw` của JavaScript cho kết quả sai (`Trà_` khớp 23 món): trong template literal, `'\'` bị hiểu thành nháy được escape nên câu SQL gửi đi khác câu trong file. Chạy nguyên văn file bằng `scripts/run-sql.js` thì đúng.

**Đã kiểm tra:**
- `check-api.sh`: **210/210 đạt** (A 75, B 19, C 34, D 43, E 39).
- Fulltext: q trống → lỗi; "nước dùng xương" → mọi món chứa đủ 3 từ ở tên hoặc mô tả, xếp theo điểm rồi id qua mọi trang, không trùng id; đảo thứ tự từ → cùng total; `sort=gia-tang&tag=abc` bị bỏ qua; "pho" → 0 (không bỏ dấu); "phở" → món có "phở" trong tên đứng đầu.
- Fuzzy (số đo thực tế): "Bò lúc lắt" → "Bò lúc lắc" 0.667 đứng đầu; "Gỏi cuống tôm thịt" → "Gỏi cuốn tôm thịt" 0.842; "Phở bò tá" → "Phở bò tái" 0.75; "Hủ tíu Nam Vang" → "Hủ tiếu Nam Vang" 0.65; "pho bo tai" → 0 món; "unrelatedxyz" → 0. Mọi điểm ≥ 0.3, total khớp số món gom qua các trang.
- `node scripts/run-sql.js prisma/sql/search-examples.sql`: **14/14 kết quả khớp dòng "Kỳ vọng"** (vd. `Trà_` → 700; Lẩu + Miền Nam + 200–300k + còn phục vụ → 135, 352, 675, 1107, 1169; tên chứa "lẩu" 60 dòng nhưng tag Lẩu 61 vì "Combo 100% bò"; fuzzy ngưỡng 0.6 chỉ còn #9; total/trang = 60, {37,44,55}, {77,130,135}).
- Thời gian một trang: fulltext ~0,41s, fuzzy ~0,56s.

## Bước 9 — SPA: bảng admin món có phân trang
**Đã làm:**
- `components/Pagination.jsx` (mới): Trước · dải số rút gọn (`pageWindow`: trang đầu, trang cuối, trang hiện tại ±1, chỗ lược là "…") · Sau. Mỗi nút là **link tới URL có `?page=N`** (không phải nút gọi API) → copy link, tab mới, Back/Forward đều đúng. Trang hiện tại `aria-current="page"`; ≤ 600px chỉ còn Trước · "Trang 4/100" · Sau.
- `AdminDishListPage`: gọi `GET /api/dishes?searchIn=name,tag&sort=moi-nhat&page=&pageSize=20`; `q`, `page` trên URL; dòng "Món 21–40 trong 1200 món"; trang vượt phạm vi → "Trang N không có món nào" + link về trang cuối; `VALIDATION_FAILED` (vd. `?page=0`) → `InvalidQuery` (liệt kê lỗi + "Về trang 1", không có "Thử lại" vì không phải lỗi máy chủ); đổi trang → cuộn đầu bảng vào màn hình.
- `hooks/useBackTo.js` (mới): bảng admin truyền URL đang xem qua `state` của link Sửa / Xoá / Thêm; form và trang xoá quay về đúng URL đó (giữ `page`, `q`). `withFlash` thay `msg`/`id` cũ trong URL. Thêm mới vẫn về trang 1 (món mới nhất ở đầu, được tô).
- `components/StatusView.jsx`: thêm `InvalidQuery`.
- CSS: phân trang (nút ≥ 44px), cột Tên / Tag / Đầu bếp được xuống dòng ở > 820px.

**Quyết định và lý do:**
- **Gửi `page` nguyên văn cho API**, SPA không tự sửa: API là nơi kiểm tra cuối (như validate kết hợp của block6); URL sửa tay sai thì người dùng thấy rõ lỗi gì.
- **Trang vượt phạm vi là thành công, không tự nhảy về trang cuối**: đúng hợp đồng API; có link để người dùng tự chọn.
- **Sửa xong quay về trang đang làm việc** (plan mục 6.5): admin sửa món ở trang 3 không phải lật lại từ đầu.

**Lỗi hiển thị phát hiện và sửa:** ở 1280px cột "Tình trạng" bị cắt — cột Tag ("Tráng miệng · Miền Bắc") dài hơn cột Loại cũ nên bảng rộng 1107px trong khung 1078px. Cho cột Tag, Đầu bếp, Tên xuống dòng → 1280px: 1078/1078, 1024px: 982/982. Ở 821–900px bảng vẫn rộng hơn khung khoảng 85px và cuộn ngang trong khung (như block6; trang không cuộn ngang); dưới 820px bảng chuyển thành thẻ.

**Đã kiểm tra** (Chrome headless, **17/17 đạt**):
- `/admin/dishes`: 20 dòng 1200 → 1181; "Món 1–20 trong 1200 món"; phân trang 1 2 … 60; request chỉ có `sort=moi-nhat&pageSize=20`.
- Bấm trang 2 → `?page=2`, dòng 1180 → 1161, nút 2 có `aria-current`; Back → trang 1.
- `?page=60` → id 20 → 1, nút Sau bị khoá; `?page=61` → thông báo + link `?page=60`; `?page=0` → "Số trang phải là số nguyên dương.", không có "Thử lại".
- Tìm "lẩu" → 61 kết quả (tên + tag), 4 trang; trang 2 giữ `q`; mở thẳng `?q=lẩu&page=2` → đúng trang, ô tìm có sẵn từ khoá; tìm từ khoá mới ở trang 2 → về trang 1.
- Sửa món #1155 ở trang 3 → về `?page=3&msg=dish-updated`, dòng được tô; thêm món → trang 1, #1201 đứng đầu và được tô; xoá #1201 → về danh sách, có thông báo.
- 375px: dải số ẩn, "Trang 2/60", không cuộn ngang. Không lỗi console. `vite build` thành công. Seed lại sau khi test.

**Trạng thái:** thực đơn `/dishes` vẫn đọc `data` là mảng và gửi tham số cũ → làm ở bước 10.

## Bước 10 — SPA: thực đơn với khung tìm 4 chế độ và số trang
**Đã làm:**
- `listQuery.js` (mới, thay `menuOptions.js` đã xoá): đọc điều kiện từ URL trang (`mode, q, tag, minPrice, maxPrice, available, sort, view, page`); `toApiParams` chỉ gửi tham số thuộc chế độ (basic: q + sort; advanced: thêm tag, giá, trạng thái; fulltext/fuzzy: chỉ q) + `pageSize=12`; `toPageParams` dựng URL trang gọn (bỏ giá trị mặc định); giá trị lạ trên URL giữ nguyên để API báo lỗi.
- `components/SearchPanel.jsx` (mới): chip tag (lối tắt `mode=advanced&tag=<id>`), ô Kiểu tìm + dòng giải thích chế độ, ô từ khoá + Tìm, nhóm tiêu chí nâng cao (Tag, Giá từ, Giá đến, Trạng thái: Mọi / Còn phục vụ / Tạm hết), Sắp xếp (khoá "Theo độ phù hợp" ở toàn văn / gần đúng). Lỗi `VALIDATION_FAILED` của API hiện cạnh đúng ô.
- `DishListPage` viết lại: gọi đúng một trang (`pageSize=12`), dòng kết quả theo `total`, danh sách phẳng (bỏ nhóm theo loại — plan mục 10.8), "Món 13–24 trong 61 món", `Pagination`, trang vượt phạm vi, `InvalidQuery`, đổi trang thì cuộn tới đầu danh sách. Toàn văn / gần đúng mà URL thiếu từ khoá → không gọi API.
- `DishRow`: hiện điểm phù hợp (`score`) ở toàn văn / gần đúng; bỏ `hideTagId` (không còn nhóm). Chip tag ở trang chi tiết và nút "Xem thêm …" trỏ tới `/dishes?mode=advanced&tag=<id>` (tag là tiêu chí của Nâng cao).

**Quyết định và lý do:**
- **Ô chữ và ô Kiểu tìm áp dụng khi Tìm; ô chọn và chip áp dụng ngay**, mang theo chữ đang có trong form (như thực đơn block6 bước 15). Đổi kiểu tìm phải bấm Tìm vì đổi sang toàn văn / gần đúng cần từ khoá.
- **Mọi lần áp dụng điều kiện mới đều về trang 1, giữ cách hiển thị**; chuyển trang giữ nguyên điều kiện (plan mục 6.3).
- **Không gửi tham số không thuộc chế độ**: URL API trên Network dễ đọc khi demo; API vẫn bỏ qua nếu có.

**Đã kiểm tra** (Chrome headless, **22/22 đạt**):
- Mặc định 12 món id 1–12, "1200 món", phân trang 1 2 … 100; mọi request có `pageSize=12`.
- Gõ từ khoá chưa Tìm → URL không đổi; Tìm → `?q=phở`, "54 món khớp điều kiện cho “phở”"; trang 2 giữ `q`; Back → trang 1.
- Đổi sắp xếp ở trang 2 → `?q=phở&sort=gia-tang`, bỏ `page`, giá tăng dần.
- Chip Lẩu → `?mode=advanced&tag=9`, 61 món, chip có `aria-current` ("Combo 100% bò" có trong kết quả dù tên không có chữ "lẩu"); Trạng thái "Tạm hết" áp dụng ngay → mọi món tạm hết; Giá từ 0 đến 0 + Tìm → 4 món.
- Toàn văn + từ khoá trống → "Nhập từ khoá để tìm.", không gọi API, URL không đổi; "nước dùng xương" → có điểm phù hợp, ô sắp xếp khoá. Gần đúng "Bò lúc lắt" → "Bò lúc lắc" đầu tiên; "pho bo tai" → 0 món + gợi ý gõ có dấu.
- `?mode=advanced&minPrice=abc&available=yes` → lỗi cạnh 2 ô + "Điều kiện tìm không hợp lệ"; "Xoá bộ lọc" → `/dishes`. Mở thẳng `?mode=advanced&tag=9&page=2` → "Món 13–24 trong 61 món", ô Tag chọn Lẩu; vào chi tiết rồi "← Thực đơn" → về đúng URL đó. `?page=101` → link về trang 100.
- 375px không cuộn ngang; không lỗi console; `vite build` thành công.

**Lỗi trong kịch bản kiểm tra (không phải lỗi app):** (1) chờ "URL đã đổi" rồi đọc danh sách ngay → đọc nhầm danh sách cũ vì React chưa render lại (6 mục báo sai); đổi sang chờ nội dung mong đợi. (2) Ghi cứng "53 món" theo seed cũ — seed sau bước 8 có 54 món chứa "phở"; đổi sang lấy `total` từ API.

## Bước 11–13 — Tải thêm, Cuộn vô hạn, không trộn kết quả
**Đã làm:**
- `hooks/useAppendList.js` (mới): danh sách nối thêm dùng chung cho cả hai kiểu. `loadNext()` thoát khi đang tải / đã hết; cờ "đang tải" là ref đặt đồng bộ trước khi gửi; chỉ nối khi response còn thuộc bộ điều kiện hiện tại (bộ đếm "thế hệ" tăng mỗi lần reset, request cũ bị huỷ bằng AbortController); lỗi → giữ `nextPage` và danh sách; `end` tính từ metadata của response vừa nhận (`page * pageSize >= total` hoặc items rỗng). Đổi bộ điều kiện → reset, tải trang 1.
- `components/LoadMore.jsx` (nút Tải thêm / Đang tải thêm… / Thử lại, "Đã hiện 24/1200 món", "Đã hiện hết N món"), `components/InfiniteSentinel.jsx` (IntersectionObserver trên một phần tử sau danh sách, `rootMargin: 200px`; lỗi hoặc hết → ngắt; sau mỗi lần nối, nếu sentinel vẫn trong vùng nhìn thì tải tiếp tuần tự; rời trang → disconnect), `components/ViewSwitch.jsx` (Số trang / Tải thêm / Cuộn vô hạn, mỗi nút là link giữ điều kiện, bỏ `page`).
- `DishListPage` tách thành `PagedMenu` (số trang) và `AppendMenu` (tải thêm / cuộn, chung `useAppendList`); phần đầu trang, dòng kết quả, trạng thái rỗng, lưới món dùng chung. Chế độ cuộn vẫn có nút "Tải thêm" dự phòng.

**Quyết định và lý do:**
- **URL của Tải thêm / Cuộn không ghi `page`; mở lại link thì tải lại từ đầu với cùng điều kiện** (plan mục 10.11).
- **Một hàm `loadNext()` cho cả nút và sentinel**: chỉ một chỗ giữ quy tắc chặn gửi trùng, bỏ response cũ, giữ danh sách khi lỗi.

**Lỗi phát hiện và sửa (bước 13):** khi đổi điều kiện (bấm chip) trong lúc đang ở Tải thêm, URL đã đổi nhưng danh sách của điều kiện CŨ vẫn hiện thêm một khoảng (đo được hơn 500ms) cho tới khi effect reset chạy. Không có món nào bị nối nhầm, nhưng vi phạm nguyên tắc "kết quả của URL cũ không được hiện cho URL mới" mà `useLoad` của block6 đảm bảo. Sửa: state của `useAppendList` ghi kèm `key`; `key` lệch → trả trạng thái đang tải ngay trong lần render đầu tiên.

**Đã điều tra, không phải lỗi app:** ở chế độ dev, lần render sau khi bấm chip có lúc trễ 1–2,5s. Profile cho thấy phần lớn thời gian nằm ở phần ghi hiệu năng chỉ có ở React 19 bản dev (`logComponentRender`, `addObjectDiffToProperties`). Trên bản production (`vite build` + `vite preview`), đo lặp 3 lần thời gian từ lúc bấm chip tới lúc component cha render: Tải thêm 954 / 230 / 39ms, Số trang 26 / 10 / 4ms, Cuộn 19 / 17 / 18ms. Độ trễ lớn chỉ xuất hiện ở lần điều hướng đầu tiên sau khi tải trang trong Chrome headless rồi giảm nhanh → dao động lúc khởi động của môi trường đo, không phải lỗi có hệ thống của danh sách nối thêm.

**Đã kiểm tra** (Chrome headless trên bản production, **16/16 đạt**):
- Tải thêm: 12 món + "Đã hiện 12/1200 món"; bấm → 24 món id 1–24, URL không đổi; bấm 3 lần liên tiếp trong một lượt → chỉ 1 request `page=3`, 36 món không trùng.
- Chặn request trang 4 (`Network.setBlockedURLs`) → thông báo lỗi, giữ 36 món, nút "Thử lại"; bỏ chặn, Thử lại → đúng trang 4 (48 món, id 1–48).
- Lọc Lẩu, bấm tới hết → "Đã hiện hết 61 món", 61 id đúng thứ tự API; hết thì không còn nút, không gửi trang 7.
- Mạng chậm 2,5s (`Network.emulateNetworkConditions`), bấm Tải thêm rồi đổi sang chip Đồ uống ngay → chỉ có 12 món Đồ uống, trang 2 của danh sách cũ không bị nối. Mở lại link Tải thêm → tải lại từ đầu, giữ điều kiện.
- Cuộn vô hạn (Lẩu): tự nối tới "Đã hiện hết 61 món", đúng 61 id; mỗi trang chỉ gửi một lần. Màn hình cao 4000px → tự tải tiếp cho tới khi sentinel ra khỏi vùng nhìn. Có nút Tải thêm dự phòng. Vào trang chi tiết rồi cuộn → không còn request danh sách (observer đã ngắt).
- **Cuộn hết 1.200 món: đủ id 1–1200, không trùng, không mất (71s).**
- Chạy lại trên bản production: bước 9 **17/17**, bước 10 **22/22**. Seed lại sau khi test.
