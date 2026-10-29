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

## Bước 14 — Nghiệm thu giai đoạn I (mốc "đạt tiêu chí block7")
Chạy trên dữ liệu seed đầy đủ (1.200 món), API :3000, SPA bản production (`vite build` + `vite preview` :5173).

| Bảng nghiệm thu (plan mục 8) | Kết quả | Bằng chứng |
| :--- | :--- | :--- |
| Chọn trang, Tải thêm, cuộn tiếp: ba kiểu UI hoạt động, không mất / lặp món | **Đạt** | Số trang: id 1–12, 13–24, trang cuối 1189–1200 (bước 10); admin 1200 → 1181, trang 60 → id 1 (bước 9). Tải thêm: 12 → 24 → 36 → 48 đúng id, bấm 3 lần chỉ 1 request (bước 11). Cuộn hết **1.200 món đủ id 1–1200, không trùng** (bước 12). API: gom 12 trang × 100 đủ 1.200 id không trùng (`check-api.sh C`) |
| Đổi filter hoặc sort: đúng điều kiện, thứ tự, phạm vi | **Đạt** | Sort qua mọi trang: giá không giảm, cùng giá thì id tăng (C); Lẩu 61 món có id > 12 (ngoài trang đầu); `available=false`, `minPrice=0&maxPrice=0` (4 món), Hải sản + giá + trạng thái: mọi món thoả, total = số món gom qua các trang (D); đổi sort trên UI về trang 1, giá tăng dần (bước 10) |
| Chuyển trang sau khi search: giữ điều kiện, không trộn | **Đạt** | `?q=phở&page=2`, `?q=lẩu&page=2` giữ từ khoá (bước 9, 10); đổi điều kiện khi request cũ còn chậm 2,5s → chỉ có kết quả mới (bước 13) |
| Xoá điều kiện, Reload, mở lại link | **Đạt** | "Xoá bộ lọc" → `/dishes`; mở thẳng 8 URL sâu (chi tiết, fuzzy + scroll, admin trang 3, form sửa, xoá đầu bếp, xoá nguyên liệu, route lạ, id không có) đều đúng trang; Tải thêm mở lại link → tải lại từ đầu, giữ điều kiện |
| Search 4 chế độ: đúng quy tắc so khớp | **Đạt** | `check-api.sh D` 43/43 (escape `% _ \`, basic = advanced khi chỉ có q, fulltext đủ từ không liền nhau, fuzzy ngưỡng 0.3, không dấu → 0); `scripts/run-sql.js prisma/sql/search-examples.sql`: 14/14 kết quả khớp "Kỳ vọng" |
| Tag: món / đầu bếp nhiều tag, thêm tag trong form | **Đạt** | `check-api.sh E` 39/39; thêm đầu bếp với tag mới tạo ngay trong form (bước 14), form món (bước 4) |
| Chức năng cũ không hồi quy | **Đạt** | `check-api.sh A B` 94/94; 500 khi mất DB (75/75 với `API_BROKEN`); xoá đầu bếp còn món + chuyển món, nguyên liệu đang dùng bị chặn xoá, thêm nhanh nguyên liệu (trùng tên báo lỗi), sửa/xoá quay về đúng trang, lỗi chung khi API bị chặn (bước 14) |

**Kịch bản bước 14** (hồi quy luồng block6 trên dữ liệu đầy đủ, **19/19 đạt**): mở thẳng 8 URL sâu; thêm đầu bếp kèm tag mới tạo trong form rồi xoá; tạo đầu bếp có món, trang xoá liệt kê món + ô chọn người nhận, chuyển sang đầu bếp #2 rồi xoá; "Thịt bò" đang dùng → không có nút Xoá; "Nấm hương" 0 món; form món 60 đầu bếp / 250 nguyên liệu, tick Lẩu → đầu bếp chuyên Lẩu lên đầu; thêm nhanh "tỏi" → lỗi trùng; chặn API → "Không tải được dữ liệu" ở cả Số trang và Tải thêm; không lỗi JavaScript.

**Kịch bản các bước trước, chạy lại trên bản production:** bước 9 17/17, bước 10 22/22, bước 11–13 16/16. Hai kịch bản của bước 4 viết cho seed nhỏ (20 món, 7 đầu bếp) không còn chạy được vì dữ liệu đổi; các luồng đó đã được kịch bản bước 14 phủ lại trên dữ liệu đầy đủ.

**Checklist mã nguồn:** không có `$queryRawUnsafe`; không chèn HTML thô (`innerHTML`, `dangerouslySetInnerHTML`); biến `VITE_` duy nhất là `VITE_API_URL` (công khai); không `Math.random` trong seed/app; không `rejectUnauthorized: false`; `DATABASE_URL` không có `sslmode` → `pg` dùng CA, xác minh chứng chỉ (`rejectUnauthorized` mặc định true); không `Boolean(...)` trên query; trang không gọi `fetch` trực tiếp (chỉ qua `api/client.js`); không `.env` nào bị git theo dõi; không `console.log` sót trong app.

**API:** `check-api.sh` **210/210**; `API_BROKEN` **75/75**. Seed lại sau khi test (hash dữ liệu không đổi).

**Còn lại (giai đoạn II):** responsive + truy cập cho phần mới và hiệu ứng cơ bản (bước 15), bằng chứng nộp (16), README + tài liệu trình bày (17), index tùy chọn (18). Ghi chú cho bước 15: bảng admin món ở 821–900px rộng hơn khung ~85px (cuộn trong khung).

## Bước 15 — Responsive, truy cập cho phần mới, hiệu ứng cơ bản (plan mục 7.4)
**Đo trước khi sửa** (Chrome headless, 375 / 820 / 1280px, 6 trang: thực đơn số trang + lọc, Tải thêm, chi tiết, form món, form đầu bếp, admin món): không trang nào cuộn ngang; vùng chạm dưới 44px ở 375px: chip lọc tag (40px), chip tag ở trang chi tiết (32px), link tên món trên thẻ admin (26px), link "Xoá bộ lọc" (24px); bảng admin món rộng 943px trong khung 779–858px ở 821–1023px (không chỉ 821–900px như ghi ở bước 14).

**Đã làm:**
- **Hiệu ứng (chỉ các mục trong bảng 7.4):**
  - Transition màu / nền / viền / bóng 150ms cho link, nút, chip, ô số trang, công tắc hiển thị, ô nhập, ô chọn, dòng bảng.
  - Thẻ món nổi 2px + bóng khi rê chuột, chỉ trên thiết bị có chuột (`@media (hover: hover)`), nên màn hình cảm ứng không bị kẹt trạng thái nổi.
  - `SkeletonList` (`StatusView.jsx`) thay chữ "Đang tải…" ở thực đơn (cả 3 kiểu) và admin món. Thanh xám có một dải sáng mờ lướt qua bằng `transform` trên `::after`; đây là gradient nhẹ duy nhất của trang.
  - Món vừa nối (Tải thêm / Cuộn) hiện dần: mờ → rõ, trượt lên 8px, 250ms. `DishGrid` nhận `appearFrom={PAGE_SIZE}`, nên trang đầu không có hiệu ứng.
  - Biểu tượng xoay trong nút "Đang tải thêm…" (dùng chung cho cuối danh sách cuộn vô hạn).
  - Chuyển trang thì cuộn mượt về đầu danh sách.
  - `prefers-reduced-motion: reduce` tắt mọi animation và transition chuyển động, chỉ giữ đổi màu; chuyển trang nhảy thẳng.
- **Truy cập:**
  - `hooks/useListTop.js` (mới, dùng cho thực đơn số trang và admin món): chuyển trang thì đưa focus tới đầu danh sách. Thực đơn có mốc `tabIndex=-1` đọc "Danh sách món, trang N"; admin là tiêu đề "Món ăn". Như vậy người dùng bàn phím / trình đọc màn hình không bị bỏ lại ở nút phân trang đã biến mất. Hook thay hai đoạn `scrollIntoView` lặp lại ở hai trang.
  - Tóm tắt trang admin ("Món 21–40 trong 1200 món") có `role=status`. Dòng số kết quả thực đơn đã có `aria-live` từ bước 10.
- **Responsive / vùng chạm:**
  - Chip lọc tag, chip tag ở chi tiết, link "Xoá bộ lọc" cao 44px ở ≤ 600px.
  - Link tên món trên thẻ admin cao 44px ở ≤ 820px.
  - Bảng admin món 821–1023px: đệm ô 8px, cột Tên / Tag / Đầu bếp được hẹp hơn.

**Quyết định và lý do:**
- **Khung xương thực đơn 12 dòng = một trang.** Bản đầu dùng 6 dòng: khi chuyển trang, khung xương ngắn làm trang thấp đi, trình duyệt chỉ cuộn tới được cuối trang ngắn, đầu danh sách dừng giữa màn hình (đo: top = 377px thay vì 16px). Đó cũng là lý do của khung xương: giữ chỗ đúng kích thước kết quả.
- **Cuộn mượt bằng tham số `behavior` trong JS**, không dùng `scroll-behavior: smooth` cho cả trang: CSS sẽ làm mọi lần cuộn (kể cả cuộn khi đổi route) đều mượt, ngoài phạm vi mục 7.4.
- **Hiệu ứng hiện dần không giữ trạng thái cuối** (không `animation-fill-mode`): nếu giữ, `transform` của animation đè lên `transform` khi rê chuột, nên món đã nối sẽ không nổi được nữa.
- **Thẻ admin vẫn giữ ngưỡng 820px**, chỉ thu đệm và độ rộng cột cho khoảng 821–1023px. Đẩy ngưỡng thẻ lên 1023px sẽ đổi luôn bảng đầu bếp / nguyên liệu, vốn đang vừa khung.

**Phương án đã bỏ:** mở rộng vùng chạm của chip tag bằng `::after` âm lề (giữ chip nhỏ 32px). Các chip xếp nhiều hàng, cách nhau 6px, nên vùng chạm của hai hàng sẽ chồng lên nhau. Chọn cách tăng chiều cao thật trên điện thoại.

**Đo lại sau khi sửa:** 6 trang × 3 độ rộng không cuộn ngang; ở 375px không còn phần tử tương tác (ngoài checkbox/radio nằm trong nhãn 44px) thấp hơn 44px; bảng admin vừa khung: 779/779 (821px), 818/818 (860px), 858/858 (900px), 982/982 (1024px).

**Đã kiểm tra** (Chrome headless trên bản production, kịch bản bước 15, **24/24 đạt**):
- Mạng chậm 1,5s → thực đơn và admin món hiện khung xương `role=status` (có chữ ẩn "Đang tải…"), không còn dòng `.loading`; dải sáng chạy animation `shimmer`; dữ liệu về → khung xương biến mất.
- Rê chuột (sự kiện chuột thật qua `Input.dispatchMouseEvent`) → thẻ món `translateY(-2px)` + bóng; chip, ô số trang có transition màu 150ms.
- Tải thêm: trang đầu 0 món có class `appear`; nối trang 2 → đúng món 13–24 có `appear`; ≤ 12 animation `appear` đang chạy; xong hiệu ứng, rê chuột món đã nối vẫn nổi. Mạng chậm → nút khoá, có biểu tượng xoay (animation `spin`).
- Bấm trang 2 → focus ở mốc "Danh sách món, trang 2", `scrollIntoView` được gọi đúng một lần với `behavior: smooth`, mốc dừng cách đỉnh màn hình 16px (`scroll-margin`). Admin bấm trang 2 → focus tiêu đề "Món ăn", tóm tắt trang có `role=status`.
- Bật giảm chuyển động (`Emulation.setEmulatedMedia`): khung xương đứng yên, biểu tượng không xoay (chữ "Đang tải thêm…" vẫn còn), món nối thêm không có animation (`document.getAnimations()` rỗng), rê chuột không nổi nhưng vẫn đổi màu, chuyển trang gọi `behavior: auto`.
- Ảnh 1280 / 820 / 375px (thực đơn, Tải thêm, chi tiết, form món, admin món) không cuộn ngang; không lỗi console. Ở 375px với cảm ứng giả lập (`hover: none`), thẻ món thẳng lề 16px như phần còn lại của trang.

**Lỗi trong kịch bản kiểm tra (không phải lỗi app):**
- (1) Rê chuột lên món nằm ngoài màn hình nên không có `:hover`; sửa: cuộn món vào giữa màn hình trước.
- (2) Kiểm tra cuộn mượt bằng cách lấy mẫu `scrollY` mỗi khung hình không dùng được. Chrome headless (không GPU) chặn luồng chính 300–700ms khi render; đo bằng PerformanceObserver `longtask` thấy hiện tượng này **cả trên bản build trước bước 15** (`fe61558`), nên không do thay đổi này. Vì vậy không lấy được mẫu nào giữa lúc cuộn. Đổi sang ghi lại tham số app truyền cho `scrollIntoView` + đo vị trí cuối. Riêng việc Chrome có cuộn mượt khi nhận `smooth` thì đo độc lập: 805 → 0 qua khoảng 30 khung hình.
- (3) Ở trang 1 / 60 của admin, dải số là 1 2 … 60, nên không có nút "Trang 3"; đổi sang trang 2.

**Hồi quy:** `check-api.sh` **210/210**; kịch bản bước 9 **17/17**, bước 10 **22/22** (chờ thêm `.skeleton-list` biến mất thay vì chỉ `.loading`), bước 11–13 **16/16** (cuộn hết 1.200 món đủ id 1–1200, không trùng, 50s), bước 14 **19/19**. Seed lại sau khi test (`npx prisma db seed`, in host Singapore trước khi xoá), hash dữ liệu `798423e712f0ffdc` không đổi.

## Bước 16 — Bằng chứng nộp (`evidence/`)
**Đã làm:**
- **`LOG_SQL=1`** (plan mục 5, chưa làm ở giai đoạn I): `src/db.js` bật `log: [{ emit: "event", level: "query" }]` của Prisma. Mỗi câu SQL thật được in kèm tham số và thời gian chạy, ví dụ `[SQL 36ms] … LIMIT $1 OFFSET $2` / `params: ["12","12"]`. Mặc định tắt; `.env.example` có dòng hướng dẫn (để comment).
- File SQL chạy lại được, có dòng "Kỳ vọng" như `search-examples.sql`:
  - `api/prisma/sql/count-rows.sql`: số dòng 7 bảng, số món tạm hết / giá 0, số món theo tag;
  - `api/prisma/sql/wildcard-escape.sql`: chạy đúng dạng câu Prisma sinh ra (`ILIKE ('%' || $1 || '%')`) trước và sau khi escape.
- **`evidence/`:**
  - `README.md`: đối chiếu từng yêu cầu của đề, bảng 4 chế độ (URL trang ↔ request API ↔ SQL), lỗi đã phát hiện, cách chạy lại, checklist phần nhóm tự chụp trên trình duyệt thật.
  - `network/network-log.md`: 12 thao tác demo, mỗi request có status, kiểu, dung lượng, số items / total / page / pageSize.
  - `network/response-thuc-don-trang-2.json`: JSON đầy đủ của trang 2.
  - `sql-log/*.txt`: SQL thật của từng thao tác.
  - `sql-results/*.txt`: kết quả 3 file SQL.
  - `screens/*.png`: 12 ảnh, mỗi ảnh cuộn tới phần cần chứng minh.

**Cách thu:**
- Chrome headless điều khiển qua DevTools Protocol mở từng URL trang trên bản production, làm thao tác (bấm trang 2, Tải thêm 2 lần, cuộn 2 lần), ghi mọi request tới API và lấy body bằng `Network.getResponseBody`.
- Sau đó gửi lại **đúng các URL API đó** tới một API phụ (cổng 3001, `LOG_SQL=1`) và cắt log theo từng request. Nhờ vậy URL trang ↔ request ↔ SQL là cùng một chuỗi, không phải ví dụ viết tay.

**Kết quả đáng chú ý:**
- 29/29 request tới API là `Fetch`, `application/json`, status 200 (kể cả `VALIDATION_FAILED`, đúng envelope).
- Mỗi lần chuyển trang / tải thêm / cuộn tới cuối chỉ có một `GET /api/dishes` nhận 12 món, body ≈ 5,8 KB. Tải cả 1.200 món (12 request × 100 món) ≈ 480 KB.
- Mỗi request danh sách gồm: `COUNT(*)` cùng điều kiện → `total`; `ORDER BY … id ASC LIMIT/OFFSET`; ba câu nạp đầu bếp và tag theo id của trang.
- Fuzzy: `set_config('pg_trgm.similarity_threshold', '0.3', true)` → CTE `matched` → `COMMIT`.
- Tham số sai → không có câu SQL nào.
- Không file nào trong `evidence/` chứa host, user, mật khẩu hay chuỗi kết nối (đã `grep "postgres\.\|pooler\|password"`).

**Quyết định:**
- **Ảnh tab Network của DevTools và ảnh Table Editor của Supabase để nhóm tự chụp** (checklist trong `evidence/README.md`, plan mục 8 đã ghi). Chrome headless không chụp được giao diện DevTools, và mình không vào dashboard Supabase. Phần thay thế tự động là bản ghi Network qua giao thức DevTools + `count-rows.sql`.
- **Script thu bằng chứng không đưa vào repo**, giống các kịch bản trình duyệt của bước trước: chúng phụ thuộc bộ điều khiển Chrome viết tạm. Phần chạy lại được nằm ở 3 file `.sql` + `LOG_SQL=1` (README mục "Cách chạy lại").

**Phát hiện khi làm:**
- **Lỗi giao diện của bước 15** (thấy khi xem ảnh bằng chứng, kịch bản bước 15 không bắt được vì chỉ đo số liệu):
  - *Hiện tượng:* ở máy có chuột, đường kẻ dưới mỗi món cong lên ở hai đầu.
  - *Nguyên nhân:* `border-radius` của thẻ món được đặt sẵn ở trạng thái thường, nên bo luôn cả `border-bottom`.
  - *Cách sửa:* chỉ bo góc khi rê chuột, lúc đó đường kẻ đã trong suốt.
  - *Sau khi sửa:* ảnh `so-trang-2.png`, `tai-them.png` có đường kẻ thẳng; kịch bản bước 15 đạt 24/24.
- **Số "Trà_ → 24 món" trong BUILD_LOG bước 7** đo trên seed lúc đó. Bước 8 bỏ các tên lặp chữ trong bộ sinh, nên seed hiện tại cho 23. `wildcard-escape.sql` ghi kỳ vọng 23 kèm lý do; mục bước 7 giữ nguyên vì đúng tại thời điểm đo.
- **Cảnh báo `DeprecationWarning: Calling client.query() when the client is already executing a query`** trong log API:
  - Có từ trước bước 16 (tiến trình API đầu phiên đã in).
  - Truy bằng `--trace-deprecation` khi chạy `check-api.sh`: nguồn là `PgTransaction.performIO` trong `@prisma/adapter-pg`. Bộ chạy truy vấn của Prisma 7.10 gửi hai câu cùng lúc trên một kết nối trong transaction; `pg` 8 tự xếp hàng nên kết quả đúng.
  - Các request chỉ đọc (danh sách, fuzzy, fulltext, tag, đầu bếp) không gây cảnh báo.
  - Không sửa: phiên bản ghim theo block6, không phải code của nhóm. Ghi lại để biết khi nâng `pg` lên 9.

**Đã kiểm tra:**
- `check-api.sh` **210/210** sau khi đổi `db.js` (LOG_SQL tắt, API không in thêm gì).
- 3 file SQL chạy lại đúng các dòng "Kỳ vọng" (count-rows 3 kết quả, search-examples 14, wildcard-escape 7).
- Kịch bản bước 15 sau khi sửa CSS: lần đầu **22/24**. Hai mục phụ thuộc thời gian: khung xương biến mất giữa lúc chờ thấy và lúc đo style; rê chuột. Chạy riêng mục rê chuột thì đạt (`:hover`, `translateY(-2px)`, bo 10px). Chạy lại toàn bộ hai lần: **24/24, 24/24**.
- Seed lại sau khi test, hash `798423e712f0ffdc`.

## Bước 17 — README, `hotrotrinhbay.html`, `kichban.html`
**Đã làm:**
- **`README.md`:** chạy ứng dụng, dựng database lần đầu (`db push` → `setup-search.sql` → `db seed`), biến môi trường (thêm `LOG_SQL`), kiểm tra (`check-api.sh` A–E kèm số kiểm tra từng phần, 3 file SQL), 7 bảng, hợp đồng `GET /api/dishes` (tham số, metadata, SQL của từng chế độ), `/api/tags`, `tagIds`, các trang và URL của thực đơn, cấu trúc.
- **`hotrotrinhbay.html`** (khung và bộ màu tài liệu của block6):
  - mục tiêu + câu hỏi xuyên suốt, tiêu chí nghiệm thu và kết quả;
  - ba quyết định phân trang, kèm lý do bằng lượng dữ liệu (≈ 6 KB/trang so với ≈ 480 KB cho cả 1.200 món);
  - lọc / sắp xếp đặt ở đâu, áp dụng cho tập nào (ví dụ trang 2 + giá tăng);
  - bốn chế độ search và cấu hình PostgreSQL;
  - Network + SQL thật; lỗi wildcard;
  - công nghệ và "cố ý không dùng".
- **`kichban.html`:**
  - 7 bảng và số bản ghi; các món cố ý có để kiểm tra (giá 0, ký tự đặc biệt);
  - hợp đồng `GET /api/dishes` và các trường hợp biên;
  - 8 luồng URL trang ↔ request API ↔ SQL, SQL lấy từ `evidence/sql-log/`;
  - kịch bản demo 23 bước theo bảng nghiệm thu, 4 chế độ search, tag và chức năng cũ;
  - lỗi chính + 8 lỗi khác đã sửa.
- Thành viên lấy theo tài liệu block6 (cùng nhóm).

**Đối chiếu với code thật (mọi con số trong tài liệu lấy từ API / SQL trên seed chuẩn):**
- Thông báo sau khi sửa món ghi theo đúng chữ của app: "Đã lưu thay đổi của món." (bản nháp viết "Đã lưu").
- Dòng SQL trích trong `hotrotrinhbay.html` lấy nguyên văn từ `evidence/sql-log/so-trang-2.txt`.
- Kịch bản bước 17 (Chrome headless, **13/13 đạt**) kiểm các câu "Thấy được" chưa có trong kịch bản trước:
  - `?page=101` → "Trang 101 không có món nào." + "Về trang cuối (100)";
  - toàn văn "cá kho tộ" trên giao diện;
  - gợi ý gõ có dấu khi gần đúng ra 0 món;
  - lỗi "giá đến < giá từ" cạnh ô;
  - admin tìm "lẩu" → 61;
  - 375px phân trang "Trang 2/100";
  - hai trang tài liệu không cuộn ngang ở 1280 / 375px, mọi link mục lục trỏ đúng id.

**Lỗi phát hiện khi viết kịch bản: thứ tự toàn văn / gần đúng khi điểm bằng nhau.**
- *Tái hiện:* toàn văn "cá kho tộ": 10 món cùng hiện "phù hợp 1.000" nhưng thứ tự id là 8, 109, 201, 80, 380… Hai nơi lệch nhau:
  - `search-examples.sql` (xếp theo điểm đã làm tròn) ghi kỳ vọng 8, 80, 109, 201, 342;
  - API thật lại xếp khác.
- *Nguyên nhân:* `ts_rank` (và `similarity`) là float4. Mười món chỉ khác nhau ở sai số: `ts_rank(...)::text` in ra đều là `1`, nhưng `= 1` là false. API xếp theo phần lẻ vô nghĩa đó rồi mới tới id. SPA làm tròn 3 chữ số khi hiển thị, nên người dùng thấy "cùng điểm mà id lộn xộn". `check-api.sh` đã có kiểm tra "cùng điểm thì id tăng" nhưng chưa có từ khoá nào sinh ra điểm bằng nhau.
- *Quyết định (người dùng chốt):* điểm làm tròn 3 chữ số, cùng điểm thì id tăng dần. Phương án bỏ: giữ điểm gốc và sửa file SQL mẫu, vì giao diện vẫn trông sai.
- *Cách sửa:* `search/fulltext.js`, `search/fuzzy.js` tính `round(…::numeric, 3) AS score` ngay trong CTE `matched`. Cùng một giá trị vừa dùng để `ORDER BY score DESC, id ASC`, vừa trả cho SPA.
- *Bằng chứng:*
  - Thêm kiểm tra "cá kho tộ" vào `check-api.sh` D. Chạy **trước khi sửa: CHƯA ĐẠT** (43/44); sau khi sửa: **44/44**.
  - Gần đúng "bò lúc lắt" giữ nguyên thứ tự (9, 957, 610, 255, 625, 216).
  - Toàn văn "nước dùng xương" vẫn 62 món, đầu tiên "Hủ tiếu xương khô".
  - Thu lại toàn bộ `evidence/` (network, sql-log có `round(`, ảnh, `search-examples.txt`).
- *Chạy lại phần D lần đầu sau khi sửa:* 11 mục basic báo chưa đạt, vì API (`node --watch`) đang khởi động lại giữa lúc script chạy. Chạy lại: 44/44.

**Đã kiểm tra:**
- `check-api.sh` **211/211** (thêm 1 kiểm tra ở D). README, `hotrotrinhbay.html` cập nhật số mới.
- Kịch bản trình duyệt bước 10 **22/22** (có toàn văn / gần đúng).
- Seed lại, hash `798423e712f0ffdc`.

## Bước 19 — API: phân trang `/api/chefs`, `/api/ingredients` (plan mục 12)
**Bối cảnh (29/10/2026):** nhóm thấy bảng admin món xếp 1200 → 1 nên nhìn như bị ngược (mục 10.9 cũ chọn `id DESC`). Admin đầu bếp và nguyên liệu thì tải toàn bộ (60 / 250 dòng) mỗi lần mở trang. Nhóm chốt:
- cả 3 bảng admin xếp `id ASC`;
- thêm mới xong thì về trang 1 + thông báo;
- hai API luôn trả `{ items, total, page, pageSize }`, nơi cần đủ danh sách gọi `?all=true`;
- `all` sai → `VALIDATION_FAILED`;
- giữ `sort=moi-nhat` trong API;
- sửa lỗi wildcard ở ô tìm admin.

Phương án bỏ:
- sau khi thêm thì chuyển tới trang cuối;
- chỉ phân trang khi có `page` (response đổi dạng theo tham số).

**Đã làm:**
- `validators/list-query.js`:
  - tách `parsePaging` (đọc `page`, `pageSize`, dùng chung cho 3 route; thực đơn mặc định 12, admin 20, tối đa 100);
  - thêm `parseAdminListQuery` (`q` đọc như block6, mảng thì bỏ qua; `all` chỉ nhận `"true"`);
  - chuyển `searchWhere` từ `common.js` về cạnh `escapeLike`, nay escape từ khoá; thêm `containsIn`.
- `db.js` → `findPage(delegate, { where, include }, query)`:
  - `count` + `findMany` (`orderBy id ASC`, `skip/take`) trong một transaction `RepeatableRead` như `/api/dishes`;
  - `all` bỏ `skip/take` và trả `page: 1, pageSize: total`.
- `routes/chefs.js`, `routes/ingredients.js`: `GET /` dùng hai hàm trên. Lọc theo `q` vẫn là tên/chuyên môn, tên/đơn vị như cũ.
- SPA (sửa hết nơi đang dùng, để không commit code lỗi):
  - `listAllChefs`, `listAllIngredients` (`?all=true` → `items`) cho form món và trang xoá đầu bếp;
  - hai bảng admin tạm gọi `all: true` để giữ hành vi cũ, số trang làm ở bước 20.
- `check-api.sh`: ca cũ đọc `.data.items` / `.data.total`; thêm **phần F** (40 kiểm tra) và hàm `collect_ids`.

**Lỗi đã phát hiện:** *ô tìm admin đầu bếp / nguyên liệu hiểu `%`, `_` là wildcard* (cùng loại lỗi bước 7, nhưng nằm ở `searchWhere` của block6 nên bước 7 chưa sửa tới).
- *Tái hiện* (trước khi sửa, API đang chạy):
  - `GET /api/chefs?q=%` và `?q=_` → **60 đầu bếp**;
  - `GET /api/ingredients?q=%` và `?q=_` → **250 nguyên liệu**;
  - `?q=\` → 0.
- *Nguyên nhân:* `searchWhere` đưa `q` thẳng vào `contains` (Prisma không escape, xem bước 7). Đầu bếp còn một điều kiện riêng (tên chuyên môn) cũng không escape.
- *Cách sửa:* mọi điều kiện tìm admin đi qua `searchWhere`, hàm này gọi `escapeLike` một lần.
- *Bằng chứng sau khi sửa:*
  - `q=%`, `q=_`, `q=\` → `total: 0` cho cả hai API;
  - SQL đếm tên/đơn vị chứa `%`, `_`, `\` → 0 (vậy 0 là đúng);
  - nằm trong `check-api.sh F`.

**Đã kiểm tra:**
- Database trước khi chạy test và seed: host `aws-0-ap-southeast-1.pooler.supabase.com`, ref `ovirbpyprylgaqgvgzil` (block7).
- Request thật:
  - `/api/chefs` → 20 dòng, id 1–20, total 60;
  - `page=3` → id 41–60; `page=4` → `items: []`, total 60, page 4;
  - `/api/ingredients?page=13` → id 241–250;
  - `all=true&page=99` → 250 dòng, page 1, pageSize 250;
  - `page=0`, `pageSize=101`, `all=1`, `all` lặp → `VALIDATION_FAILED` đúng trường.
- `total` khớp SQL: `/api/chefs?q=mai` → 6 (SQL tên ILIKE hoặc tên chuyên môn ILIKE: 6); `/api/ingredients?q=lít` → 6 (SQL: 6).
- `check-api.sh`: **251/251 đạt** (211 cũ + 40 phần F). Phần F gom mọi trang (7 dòng/trang): đúng `[1..60]` và `[1..250]`, tăng dần, không lặp/mất.
- Chrome headless (Vite :5173, **7/7 đạt**):
  - form thêm món có 60 đầu bếp, đủ ô tick nguyên liệu + tag;
  - form sửa món 1 có đầu bếp chọn sẵn;
  - trang xoá đầu bếp 1 có đủ người nhận;
  - hai bảng admin vẫn 60 / 250 dòng;
  - không lỗi console; request là `/api/chefs?all=true`, `/api/ingredients?all=true`.
- `vite build` thành công. Seed lại sau khi test.

**Trạng thái:** hai bảng admin đầu bếp, nguyên liệu chưa có số trang; admin món vẫn `moi-nhat` → bước 20.

## Bước 20 — SPA: 3 bảng admin xếp id tăng dần, đầu bếp và nguyên liệu có số trang (plan mục 12)
**Đã làm:**
- `AdminDishListPage`: bỏ `sort: "moi-nhat"` → API xếp `id ASC` (mặc định); sửa comment.
- `AdminChefListPage`, `AdminIngredientListPage`: viết lại theo khuôn `AdminDishListPage`:
  - `q`, `page` trên URL, 20 dòng/trang, gửi `page` nguyên văn cho API;
  - `Pagination`, dòng "Đầu bếp 21–40 trong 60 đầu bếp", số kết quả tìm = `total`;
  - trang vượt phạm vi → "Trang N không có … nào" + "Về trang cuối";
  - URL sai → `InvalidQuery`; khung xương khi tải; chuyển trang thì cuộn/focus về tiêu đề (`useListTop`).
- Form + trang xoá đầu bếp, nguyên liệu: dùng `useBackTo` / `withFlash` như món. Link Sửa/Xoá/Thêm của bảng gửi `backTo` = URL đang xem.
  - Sửa / xoá / Huỷ → về đúng URL danh sách (giữ `page`, `q`).
  - Thêm → `/admin/<…>?msg=…-created&id=…` (trang 1 + thông báo, theo chốt).

**Quyết định:** thêm mới không tô dòng, vì bản ghi mới ở trang cuối, không nằm trên trang 1. Không thêm link "xem bản ghi vừa thêm" (ngoài plan).

**Đã kiểm tra** (Chrome headless, Vite :5173, **47/47 đạt**):
- `/admin/dishes` → id 1–20, "Món 1–20 trong 1200 món", request `/api/dishes?pageSize=20` (không còn `moi-nhat`); `?page=60` → 1181–1200.
- Đầu bếp / nguyên liệu (mỗi trang):
  - 20 dòng id 1–20, request `?pageSize=20` (không `all=true`);
  - "Sau" → `?page=2` id 21–40; trang cuối → 41–60 / 241–250;
  - Back → trang 2, Forward → trang cuối;
  - `?page=4` / `?page=14` → "Về trang cuối (3)" / "(13)"; `?page=0` → "Số trang phải là số nguyên dương.".
- Tìm:
  - `/admin/chefs?q=mai` → "Tìm thấy 6 kết quả", 6 dòng;
  - `/admin/ingredients?q=%` → không có kết quả (trước bước 19: 250);
  - `?q=a&page=2` → "Nguyên liệu 21–40 trong 76", link "Trước" giữ `q`.
- Sửa không đổi dữ liệu, rồi Lưu:
  - nguyên liệu #45 ở trang 3, đầu bếp #25 ở trang 2, món #41 ở trang 3 → URL giữ `page`, dòng được tô, đúng thông báo.
- Thêm đầu bếp / nguyên liệu từ trang 2 → về trang 1 (id 1–20), "Đã thêm …", không dòng nào tô.
  - Bản ghi mới nằm cuối trang 4 / 13.
  - Xoá nó ở đó → về đúng `?page=4` / `?page=13` + "Đã xoá …" (trang 4 của đầu bếp nay trống → hiện "Về trang cuối").
- Form thêm món vẫn đủ 60 đầu bếp. Không cuộn ngang ở 1280 / 820 / 375px. Không lỗi console.
- `vite build` thành công. Seed lại sau khi test.
- Lần chạy đầu 2 mục chưa đạt do script sai, không phải lỗi app:
  - chọn "thịt" (chỉ 6 kết quả) cho ca trang 2;
  - `a.matches()` nhận chữ không phải selector.
  Đổi sang `q=a` (76 kết quả) và sửa hàm.

## Bước 21 — Nghiệm thu lại, cập nhật tài liệu và bằng chứng (plan mục 12)
**Đã làm:**
- `README.md`:
  - `check-api.sh` 251 kiểm tra (thêm dòng phần F);
  - mục mới "`GET /api/chefs`, `GET /api/ingredients` — phân trang" (metadata, `q`, `page`/`pageSize`, `all=true`);
  - bảng trang SPA: admin món id tăng dần (không còn `sort=moi-nhat`), admin đầu bếp / nguyên liệu `?q=&page=`;
  - quy tắc quay về sau khi lưu; `moi-nhat` ghi chú "giữ trong API, admin không dùng".
- `hotrotrinhbay.html`:
  - phạm vi: ba bảng quản trị có số trang;
  - kết quả 251/251;
  - bảng "lọc và sắp xếp": admin món id tăng dần + dòng admin đầu bếp / nguyên liệu;
  - lỗi wildcard ở admin trong danh sách lỗi khác.
- `kichban.html`:
  - ghi chú `moi-nhat`;
  - demo bước 18: admin món id 1 ở đầu, đầu bếp / nguyên liệu 20 dòng/trang, thêm đầu bếp → về trang 1 + thông báo;
  - bảng lỗi thêm dòng bước 19.
- `evidence/` thu lại phần admin trên seed chuẩn (API `LOG_SQL=1`, SPA `vite` dev):
  - `sql-log/admin.txt`: `ORDER BY id ASC LIMIT/OFFSET`, id 501 … 848, total 61;
  - `sql-log/admin-dau-bep.txt` (mới): id 21–40, total 60;
  - `screens/admin.png`, `screens/admin-dau-bep.png` (mới);
  - `network-log.md` mục admin món + mục admin đầu bếp; `evidence/README.md` ghi ngày thu lại;
  - không file nào chứa host / user / mật khẩu (`grep "postgres\.\|pooler\|password"` → 0).

**Đã kiểm tra:**
- `check-api.sh` trên code cuối: **251/251 đạt**. Seed lại sau đó.
- Kịch bản bước 20: **47/47** (chạy trước khi viết tài liệu, code SPA không đổi từ đó).
- Thực đơn không hồi quy:
  - `/dishes?page=2` → id 13–24;
  - Tải thêm → 24 món, request `page=2`;
  - không lỗi console.
- Hai trang tài liệu ở 1280px không cuộn ngang, mọi link mục lục trỏ đúng id. `vite build` thành công.
- Chưa chạy lại các kịch bản trình duyệt bước 10–14 (gom id qua 3 kiểu UI). Script của các bước đó không nằm trong repo, và bước 19–20 không sửa thực đơn hay `/api/dishes`; `check-api.sh` C, D vẫn đạt.

**Phát hiện, chưa sửa (ngoài phạm vi, chờ nhóm quyết):** ở 375px, `hotrotrinhbay.html` rộng 594px và `kichban.html` rộng 881px → cuộn ngang.
- Đo bằng hai cách (giả lập thiết bị và iframe 375px qua HTTP) đều ra cùng con số. Bản HEAD trước bước 21 cũng vậy → lỗi có từ bước 17, không phải do lần sửa này.
- Bước 17 ghi "không cuộn ngang ở 375px" là **sai**.
- Phần tràn: các khối `pre`/`code` dài (biểu thức full-text, sơ đồ quan hệ bảng, URL request mẫu).

## Bước 22 — Hình minh hoạ theo loại món cho món chưa có ảnh (plan mục 13)
**Bối cảnh (29/10/2026):** nhóm thấy giao diện "khô, cứng, thô" và chốt làm lại thực đơn theo bản phác Figma (https://www.figma.com/design/Hg0hZEkHTngeGGCh9yY2CK), plan mục 13, đủ 9 điểm 13.a–13.i. Đếm qua API: **956/1.200 món chưa có ảnh** → hiện ô màu phẳng ghi tên loại món, là nguyên nhân lớn nhất khiến trang trông thô.
- Lúc góp ý ban đầu mình nói "chỉ khoảng 65 món có ảnh" là **sai**, vì chỉ lấy mẫu 3 trang.
- Đếm lại đủ 12 trang × 100 món: 244 món có ảnh.

**Đã làm:**
- `components/DishArt.jsx` (mới):
  - 11 hình nét mảnh theo loại món, vẽ lại từ bản Figma bằng phần tử SVG của JSX (không chèn HTML thô);
  - chọn theo tag loại món đầu tiên của món; tag chưa có hình → hình đĩa chung (13.a);
  - nền / nét theo 4 nhóm màu đã chốt;
  - hình để `aria-hidden`; nhãn loại món là chữ (tuỳ chọn).
- `DishImage`: không có ảnh hoặc ảnh lỗi + có `tags` → `DishArt`; không truyền `tags` (form xem trước ảnh) → khung chữ như cũ.
  - Dùng ở thực đơn (`DishRow`, tạm thời tới bước 23), trang chi tiết (có nhãn) và ảnh nhỏ bảng admin (trước đây "—").
- `style.css`:
  - biến `--art-<nhóm>-bg/ink` trong `:root`; khung `.dish-art`; cỡ hình theo nơi dùng (52 / 28 / 128px);
  - xoá 2 luật của ô chữ cũ không còn dùng (`.dish-thumb.no-photo`, `.table-thumb.no-photo`).

**Quyết định:** cỡ hình đặt bằng px theo từng nơi dùng, không dùng % trong khung lưới (`place-content: center` + chiều rộng % dễ ra kích thước vòng / bằng 0).

**Lỗi trong lúc làm:** trang chi tiết ra nền xám thay vì nền nhóm.
- Nguyên nhân: luật cũ `.detail-photo img, .detail-photo .no-photo` (thêm `.dish-art` vào cùng luật) có `background: var(--surface-2)`, độ ưu tiên 2 class > `.dish-art`.
- Sửa: tách luật riêng cho `.detail-photo .dish-art` (chỉ khung 4:3 + bo góc).
- Kiểm tra lại: nền `rgb(237, 240, 225)` = `#edf0e1`.

**Đã kiểm tra** (Chrome headless, Vite :5173, API :3000, **9/9 đạt**):
- Thực đơn: món 7 (không ảnh) → khung minh hoạ nhóm `com`, 120px; món 1 vẫn là `<img>`.
- Chi tiết món 7: nhãn "Món cơm", nền `#edf0e1`, nét `#4d5b26`, hình 128px, tỉ lệ 4:3, không có dòng ghi công ảnh.
- Admin: ảnh nhỏ món 7 → minh hoạ 56×42, hình 28px.
- Chặn `*wikimedia.org*` để giả lập ảnh lỗi → món 1 hiện minh hoạ "Món nước".
- Form thêm món: link ảnh hỏng → ô xem trước vẫn ghi "Không tải được ảnh từ link này".
- Không lỗi console (trừ lỗi tải ảnh bị chặn có chủ ý). `vite build` thành công.
- Lần chạy đầu script dừng ở ca form: ô xem trước chỉ hiện khi đã nhập link http (script sai, không phải lỗi app) → script nhập link hỏng trước.

## Bước 23 — Thẻ món dạng lưới (plan mục 13, 13.h, 13.i)
**Đã làm:**
- `components/DishCard.jsx` thay `DishRow.jsx` (đã xoá). Một component cho mọi cỡ màn hình:
  - khung ảnh 3:2 (ảnh thật hoặc minh hoạ có nhãn loại món);
  - tên + giá cùng dòng; mô tả 2 dòng;
  - tag đầu (loại món) là chip, các tag còn lại ghi bằng chữ (`Miền Nam · Món chay`);
  - điểm phù hợp giữ nguyên cho toàn văn / gần đúng.
- Tạm hết: lớp trắng 55% phủ ảnh + nhãn "Tạm hết" góc trên, giá màu nhạt. Bỏ kiểu cũ (ảnh xám + giá gạch ngang + badge đỏ).
- `format.js` → `formatMenuPrice`: giá 0 → "Miễn phí" (màu nhấn) ở thẻ món và trang chi tiết. Admin vẫn `formatPrice` → "0đ" (13.h).
- `style.css`:
  - `.menu-cards` 3 cột (≥ 1024px), 2 cột (601–1023px);
  - ≤ 600px: dòng món ảnh 96px — `.card-title { display: contents }` + `order` để xếp tên → mô tả → giá + chip cùng hàng; ẩn tag phụ dạng chữ;
  - bỏ đường kẻ giữa món, khoảng cách 44px / 24px;
  - hiệu ứng nổi khi rê chuột chuyển sang khung ảnh; hiệu ứng hiện dần dùng cho `.dish-card.appear`;
  - khung xương thực đơn đổi thành dạng thẻ (vẫn 12 ô = một trang, giữ lý do của bước 15);
  - xoá CSS không còn dùng (`dish-row`, `dish-thumb`, `menu-columns`, `menu-grid`).

**Phương án đã bỏ:** hai component riêng cho máy tính và điện thoại → trùng logic, lệch nhau khi sửa.

**Lưu ý khi kiểm tra:** lần chạy đầu báo 1 lỗi console `[vite] Failed to reload /src/components/DishRow.jsx`.
- Nguyên nhân: thông báo HMR của server Vite dev, do file bị xoá trong lúc server vẫn giữ module cũ — không phải lỗi app.
- Chạy lại khi không có file nào đổi giữa chừng: không còn lỗi.
- Không kiểm bằng `vite preview` được: API chỉ cho CORS từ `localhost:5173`, mà cổng này đang là Vite dev của người dùng.

**Đã kiểm tra** (Chrome headless, **13/13 đạt**):
- Số trang: 12 thẻ id 1–12, 3 cột; thẻ 1 ảnh 344×229, "Phở bò tái" / "55.000đ" / chip "Món nước" / "Miền Bắc"; không còn đường kẻ.
- Trang 2: thẻ tạm hết có nhãn, lớp `rgba(255,255,255,.55)`, giá `#5f5b55`, không gạch ngang.
- Trang 25: Trà đá (#300) "Miễn phí" + minh hoạ "Đồ uống" nhóm `uong`; trang chi tiết #300 "Miễn phí".
- Tải thêm: 24 thẻ id 1–24, chỉ 12 thẻ mới có class `appear`.
- Cuộn vô hạn: cuộn 3 lần → 48 thẻ id 1–48 liên tục.
- 820px: 2 cột; 375px: 1 cột, ảnh 96px, tên → mô tả → giá + chip cùng hàng. Không cuộn ngang ở cả hai.
- Không lỗi console. `vite build` thành công.

## Bước 24 — Đầu trang, ô tìm gọn, thanh danh mục, thanh công cụ (plan mục 13, 13.b–13.g)
**Đã làm:**
- `components/MenuHero.jsx` (mới):
  - đầy đủ chỉ ở trang 1 khi chưa có điều kiện: dòng "THỰC ĐƠN · {total} MÓN" lấy `total` của response (13.e), tiêu đề, giới thiệu, khung tìm, ảnh ghép;
  - còn lại thu gọn: h1 "Thực đơn" + khung tìm;
  - ảnh ghép = 3 món có ảnh đầu tiên trong danh sách vừa tải (13.d), mỗi ảnh là link tới chi tiết; ảnh lỗi → minh hoạ (`DishImage`); đang tải → khung xương.
- `components/SearchPanel.jsx`:
  - ô tìm gọn (biểu tượng + ô chữ + Tìm); hàng dưới: ô chế độ, nút "Bộ lọc nâng cao"/"Ẩn bộ lọc" (`aria-expanded`, bật/tắt chế độ Nâng cao trong form — 13.f), gợi ý của chế độ;
  - bỏ hàng chip (→ `CategoryBar`) và ô sắp xếp (→ thanh công cụ);
  - cách áp dụng điều kiện, lỗi cạnh ô giữ như cũ.
- `components/CategoryBar.jsx` (mới):
  - "Tất cả" + 5 loại món nhiều món nhất (13.b, cùng số món thì id nhỏ trước); nút "N tag khác" / "Thu gọn" mở phần còn lại (loại món khác, rồi tag khác theo số món);
  - tag đang lọc nằm ở phần ẩn → mở sẵn, ẩn nút thu gọn;
  - số món = `dishCount` (13.c); link giữ các điều kiện **đã áp dụng** trên URL.
- `DishListPage`: `MenuToolbar` thay `ResultLine` — trái: "1.200 món khớp điều kiện cho “…” · Trang x/y" + Xoá bộ lọc; phải: công tắc cách hiển thị + ô sắp xếp.
  - Ô sắp xếp áp dụng ngay trên điều kiện của URL, về trang 1; toàn văn/gần đúng khoá ô (13.g).
  - Lỗi `fields.sort` hiện dưới thanh công cụ.
- `DishArt` thêm `hasArt(name)` (tách tag loại món).
- `style.css`:
  - nền đầu trang trải hết bề ngang bằng `box-shadow` + `clip-path` (không dùng `100vw`, tránh tràn ngang do thanh cuộn);
  - ≤ 1023px ẩn ảnh ghép; ≤ 600px danh mục cuộn ngang một hàng chạm mép, công cụ xếp dọc;
  - xoá CSS không còn dùng (`page-head`, `filters`, `filter-row`, `chips`, `chip`, `search-main`, `search-sort`, `search-box`).

**Khác bản phác (ghi lại để nhóm biết):**
- Ô chọn chế độ đặt ở hàng dưới ô tìm cho cả máy tính (bản phác máy tính đặt trong ô tìm, bản điện thoại đặt ở hàng dưới). Lý do: một bố cục cho mọi cỡ màn hình, ô chữ rộng hơn.
- Gợi ý ô tìm rút gọn "Tìm món, ví dụ: phở, bún" (bản dài bị cắt ở 375px).
- Danh mục và ô sắp xếp dùng điều kiện **đã áp dụng** (URL). Trước đây chip và ô sắp xếp lấy cả chữ đang gõ dở trong form — đã chốt ở 13.g.

**Đã kiểm tra** (Chrome headless, **33/33 đạt**):
- Đầu trang đầy đủ:
  - "Thực đơn · 1.200 món", ảnh ghép là món 1, 2, 3;
  - danh mục: Tất cả + Món nước, Món cơm, Món xào, Món chiên, Món nướng; "11 tag khác" mở ra đủ 16 tag, "Thu gọn".
- Bấm "Lẩu" (phần ẩn) → `?mode=advanced&tag=9`, 61 món, đầu trang thu gọn, phần ẩn mở sẵn, form ở chế độ Nâng cao với tag 9.
- Tìm, sắp xếp, chuyển trang:
  - gõ "phở" + Tìm → `?q=phở`, "54 món khớp điều kiện cho “phở” · Trang 1/5";
  - sắp xếp giá tăng → `?q=phở&sort=gia-tang`;
  - Sau → `page=2` giữ q + sort; Back / Forward khôi phục đúng ô tìm và ô sắp xếp.
- Danh mục và Xoá bộ lọc:
  - đang tìm "bún" bấm Món nước → `?mode=advanced&q=bún&tag=2`;
  - Xoá bộ lọc → `/dishes`, đầu trang đầy đủ trở lại; `?page=2` không điều kiện → thu gọn.
- Bộ lọc nâng cao bật/tắt không đổi URL.
- Toàn văn:
  - ô trống → "Nhập từ khoá để tìm.";
  - "cá kho tộ" → ô sắp xếp khoá, "xếp theo độ phù hợp", có điểm.
- Lỗi URL:
  - `?mode=advanced&minPrice=abc` → lỗi cạnh ô giá;
  - `?sort=xyz` → lỗi dưới ô sắp xếp.
- Tải thêm từ `?q=lẩu` → `?q=lẩu&view=more`, 60 món, không có "Trang x/y".
- Ảnh ghép bị chặn → 3 hình minh hoạ.
- 1280 / 820 / 375px không cuộn ngang; ≤ 1023px ẩn ảnh ghép; 375px danh mục cuộn ngang. Không lỗi console.

**Hai mục chưa đạt ở lần chạy đầu — đều do kỳ vọng của script sai:**
- "Chỉ 1 request /api/dishes": thấy 2 request giống hệt.
  - Đo lại trên commit trước bước 24 (`git stash`, rồi `stash pop`) cũng là 2 → do React StrictMode ở bản dev chạy effect 2 lần (request đầu bị huỷ), ảnh ghép không gọi thêm.
  - Sửa kiểm tra: đếm URL khác nhau = 1.
- "lẩu" ở thực đơn = 60 chứ không phải 61: 61 là số của admin (tìm cả tên tag, có "Combo 100% bò"); chế độ Cơ bản chỉ tìm theo tên.

## Bước 25 — Nghiệm thu lại sau khi làm lại giao diện thực đơn; tài liệu, ảnh bằng chứng (plan mục 13)
**Đã kiểm tra:**
- **Ba kiểu UI không mất / lặp món** (bảng nghiệm thu dòng 1), điều kiện `?mode=advanced&tag=12&sort=gia-tang` (Hải sản, giá tăng — nhiều món cùng giá nên kiểm cả thứ tự phụ theo id).
  - Kỳ vọng lấy thẳng từ API (100 món/trang): 386 món.
  - Số trang (bấm Sau tới hết), Tải thêm (mỗi lượt bấm 3 lần liền), Cuộn vô hạn: đều **386/386 id, không trùng, đúng thứ tự API**. Không lỗi console.
- Kịch bản bước 22 (9/9), 23 (13/13), 24 (33/33) đạt trên code cuối.
- Kịch bản admin bước 20 chạy lại: **47/47** (ảnh nhỏ bảng admin món nay là minh hoạ). Seed lại sau đó.
- `check-api.sh` không chạy lại: API không đổi kể từ lần 251/251 ở bước 21 (bước 22–25 chỉ sửa `web/`).
- `vite build` thành công. Hai trang tài liệu ở 1280px không cuộn ngang, link mục lục đúng.

**Lỗi của script (không phải lỗi app):** lần chạy đầu, Số trang chỉ gom được 24 id (trùng 12).
- Script chờ "URL đổi + có thẻ món + không có khung xương", điều kiện này đúng ngay lúc URL vừa đổi mà React chưa vẽ lại, nên đọc lại thẻ của trang cũ; lượt sau gặp khung xương (chưa có phân trang) nên dừng sớm.
- Sửa: chờ tới khi thẻ đầu đổi id → 386/386.

**Tài liệu:**
- `README.md`: dòng `/dishes` mô tả giao diện mới; cách áp dụng điều kiện (danh mục, sắp xếp dùng điều kiện đã áp dụng).
- `hotrotrinhbay.html`: "chip tag" → "thanh danh mục"; dòng CSS thuần ghi thực đơn làm lại theo bản phác Figma, 11 hình minh hoạ SVG tự vẽ.
- `kichban.html`:
  - kịch bản demo theo giao diện mới: đầu trang + "1.200 món · Trang 1/100", hình minh hoạ, "11 tag khác" → Lẩu / Đồ uống, ô Sắp xếp ở thanh công cụ, "Miễn phí", "Bộ lọc nâng cao", nhãn Tạm hết trên ảnh, responsive;
  - bảng lỗi thêm lỗi nền xám ở bước 22.
- `evidence/screens/`: chụp lại 11 ảnh thực đơn (1280×900, cùng URL trong `network-log.md`).
  - Kết quả khớp bằng chứng cũ: phở 54, `100%` 1, nâng cao 14 (trang 2/2), toàn văn 62, gần đúng 6, `?page=101` trang trống, `?minPrice=abc` lỗi cạnh ô.
  - Network / SQL không đổi (API không đổi).
- `evidence/README.md` ghi ngày chụp lại.

**Vẫn còn (đã báo ở bước 21, chờ nhóm quyết):** `hotrotrinhbay.html` / `kichban.html` tràn ngang ở 375px (594 / 882px), không đổi so với trước bước 25.
