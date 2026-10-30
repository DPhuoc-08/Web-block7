#!/usr/bin/env bash
# Bộ request nghiệm thu API (chạy lại được). Cần: curl, jq; API đang chạy.
#   ./scripts/check-api.sh            → chạy tất cả
#   ./scripts/check-api.sh A          → chỉ phần A (đúng bảng REST của đề)
#   ./scripts/check-api.sh B          → chỉ phần B (mở rộng do giữ quan hệ / block5)
#   ./scripts/check-api.sh C          → chỉ phần C (phân trang GET /api/dishes — block7)
#   ./scripts/check-api.sh D          → chỉ phần D (search basic / advanced — block7)
#   ./scripts/check-api.sh E          → chỉ phần E (tag của món và chuyên môn đầu bếp — block7)
#   ./scripts/check-api.sh F          → chỉ phần F (phân trang admin đầu bếp, nguyên liệu — plan mục 12)
#   ./scripts/check-api.sh G          → chỉ phần G (tìm theo nguyên liệu, đầu bếp ?by= — plan mục 14)
#   ./scripts/check-api.sh H          → chỉ phần H (tìm gần đúng admin đầu bếp, nguyên liệu — plan 14.f)
# Phần C, D, F, G, H đối chiếu với dữ liệu seed (1.200 món, 60 đầu bếp, 250 nguyên liệu) → chạy `npx prisma db seed` trước.
# Kiểm tra 500 (mất kết nối DB): chạy thêm một API với DATABASE_URL sai ở cổng khác rồi đặt
#   API_BROKEN=http://localhost:3001 ./scripts/check-api.sh A
# Script tự tạo rồi tự xoá món/đầu bếp/nguyên liệu test. Tag test KHÔNG xoá được (API không có xoá tag)
# → chạy `npx prisma db seed` sau khi test để đưa database block7 về dữ liệu seed.

API=${API:-http://localhost:3000}
ORIGIN=${ORIGIN:-http://localhost:5173}
PART=${1:-all}
pass=0
fail=0

# req METHOD PATH [JSON] [CONTENT_TYPE] → đặt STATUS, BODY
req() {
  local method=$1 path=$2 data=$3 ctype=${4:-application/json}
  local args=(-s -w $'\n%{http_code}' -X "$method" "$API$path")
  if [ -n "$data" ]; then args+=(-H "Content-Type: $ctype" --data-raw "$data"); fi
  local resp
  resp=$(curl "${args[@]}")
  STATUS=${resp##*$'\n'}
  BODY=${resp%$'\n'*}
}

# expect "mô tả" STATUS 'biểu thức jq trả true'
expect() {
  local desc=$1 status=$2 expr=$3
  if [ "$STATUS" = "$status" ] && jq -e "$expr" >/dev/null 2>&1 <<<"$BODY"; then
    echo "  ĐẠT       $desc"
    pass=$((pass + 1))
  else
    echo "  CHƯA ĐẠT  $desc"
    echo "            status=$STATUS body=${BODY:0:300}"
    fail=$((fail + 1))
  fi
}

# Lỗi nghiệp vụ: 200 + ok:false + đúng code
expect_code() { expect "$1" 200 ".ok == false and .error.code == \"$2\"${3:+ and $3}"; }
# Lỗi kỹ thuật: đúng status, body KHÔNG có trường ok
expect_tech() { expect "$1" "$2" 'has("ok") | not'; }

# header_of METHOD PATH ORIGIN [extra curl args...] → in toàn bộ header response
header_of() {
  local method=$1 path=$2 origin=$3
  shift 3
  curl -s -o /dev/null -D - -X "$method" "$API$path" -H "Origin: $origin" "$@" | tr -d '\r'
}

check_header() {
  local desc=$1 headers=$2 pattern=$3 negate=$4
  if { [ -z "$negate" ] && grep -qiE "$pattern" <<<"$headers"; } || { [ -n "$negate" ] && ! grep -qiE "$pattern" <<<"$headers"; }; then
    echo "  ĐẠT       $desc"
    pass=$((pass + 1))
  else
    echo "  CHƯA ĐẠT  $desc"
    echo "$headers" | sed 's/^/            /'
    fail=$((fail + 1))
  fi
}

part_a() {
  echo "== A. Kỹ thuật: route, body, CORS"
  req GET /api/bok
  expect_tech "GET /api/bok (sai URL) → 404, không theo response shape" 404
  req POST /api/bok '{"name":'
  expect_tech "POST /api/bok kèm JSON hỏng → vẫn 404 (route kiểm tra trước body)" 404
  req POST /api/dishes '{"name":'
  expect_tech "POST /api/dishes JSON hỏng → 400" 400
  req POST /api/dishes 'name=Pho&price=1' 'application/x-www-form-urlencoded'
  expect_tech "POST /api/dishes thiếu Content-Type JSON → 400" 400

  local h
  h=$(header_of GET /api/dishes "$ORIGIN")
  check_header "GET kèm Origin của SPA → Access-Control-Allow-Origin: $ORIGIN" "$h" "^access-control-allow-origin: $ORIGIN\$"
  check_header "Access-Control-Allow-Origin không phải *" "$h" '^access-control-allow-origin: \*' not
  h=$(header_of OPTIONS /api/dishes/1 "$ORIGIN" -H "Access-Control-Request-Method: PATCH" -H "Access-Control-Request-Headers: content-type")
  check_header "Preflight PATCH → 204" "$h" '^HTTP/[0-9.]+ 204'
  check_header "Preflight có Allow-Origin của SPA" "$h" "^access-control-allow-origin: $ORIGIN\$"
  check_header "Preflight có Allow-Methods gồm PATCH, DELETE" "$h" '^access-control-allow-methods: .*PATCH.*DELETE'
  check_header "Preflight có Allow-Headers: Content-Type" "$h" '^access-control-allow-headers: .*content-type'
  h=$(header_of GET /api/dishes "http://evil.com")
  check_header "Origin lạ (http://evil.com) → không có Access-Control-Allow-Origin" "$h" '^access-control-allow-origin' not

  if [ -n "$API_BROKEN" ]; then
    local tmp
    tmp=$(mktemp)
    STATUS=$(curl -s -o "$tmp" -w '%{http_code}' "$API_BROKEN/api/dishes")
    BODY=$(cat "$tmp")
    rm -f "$tmp"
    expect_tech "GET /api/dishes khi mất kết nối DB → 500, không theo response shape" 500
  else
    echo "  (bỏ qua)  500 khi mất kết nối DB — đặt API_BROKEN để kiểm tra"
  fi

  echo "== A. Món ăn /api/dishes"
  req GET /api/dishes
  expect "Danh sách → 200, ok, data = { items, total, page, pageSize } (trang 1, 12 món)" 200 '.ok == true and (.data.items | type == "array") and (.data.items | length == 12) and .data.page == 1 and .data.pageSize == 12 and .data.total > 12'
  local total
  total=$(jq '.data.total' <<<"$BODY")
  req GET "/api/dishes?q=PH%E1%BB%9E"
  expect "?q=PHỞ → tìm theo tên, không phân biệt hoa thường" 200 '.ok and (.data.items | length >= 1) and all(.data.items[]; .name | test("phở"; "i"))'
  req GET "/api/dishes?q=khongcomonnay"
  expect "?q= không khớp → ok, items = [], total = 0 (không phải NOT_FOUND)" 200 '.ok == true and .data.items == [] and .data.total == 0'
  req GET "/api/dishes?q=a&q=b"
  expect_code "?q=a&q=b (mảng) → VALIDATION_FAILED fields.q (block7: tham số sai không bị bỏ qua)" VALIDATION_FAILED '(.error.fields | keys) == ["q"]'

  req GET /api/dishes/1
  expect "Chi tiết /1 → bản ghi kèm chef (có tags) + tags + ingredients" 200 '.ok and .data.id == 1 and (.data.chef.name | type == "string") and (.data.chef.tags | length > 0) and (.data.tags | length > 0) and (.data.ingredients | length > 0)'
  for bad in 999999 abc 2.5 0 -1 99999999999; do
    req GET "/api/dishes/$bad"
    expect_code "Chi tiết /$bad → NOT_FOUND" NOT_FOUND
  done

  req POST /api/dishes '{"name":"  Món test API  ","price":45000,"tagIds":[2],"chefId":1,"ingredientIds":[1,2,2],"id":999999,"createdAt":"2000-01-01T00:00:00Z"}'
  expect "Thêm hợp lệ → bản ghi vừa tạo, tên đã trim, nguyên liệu bỏ trùng, available mặc định true" 200 '.ok and .data.name == "Món test API" and .data.id != 999999 and (.data.ingredients | length == 2) and .data.available == true'
  local new_id
  new_id=$(jq '.data.id' <<<"$BODY")
  expect "Trường lạ (id, createdAt) bị bỏ qua" 200 '.data.createdAt != "2000-01-01T00:00:00.000Z"'

  req POST /api/dishes '{"name":"","price":-5,"tagIds":[2],"chefId":1,"ingredientIds":[1]}'
  expect_code "Thêm: tên rỗng, giá âm → VALIDATION_FAILED kèm fields.name, fields.price" VALIDATION_FAILED '(.error.fields | has("name") and has("price"))'
  req POST /api/dishes '{"name":"X","price":"50000","tagIds":[2],"chefId":1,"ingredientIds":[1]}'
  expect_code 'Thêm: price là chuỗi "50000" → VALIDATION_FAILED (JSON giữ kiểu)' VALIDATION_FAILED '(.error.fields | keys == ["price"])'
  req POST /api/dishes '{"name":"X","price":1.5,"tagIds":[2],"chefId":1,"ingredientIds":[1]}'
  expect_code "Thêm: price 1.5 → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | keys == ["price"])'
  req POST /api/dishes '{}'
  expect_code "Thêm: body {} → VALIDATION_FAILED đủ 5 trường bắt buộc" VALIDATION_FAILED '(.error.fields | keys | sort) == (["chefId","ingredientIds","name","price","tagIds"] | sort)'
  req POST /api/dishes '[1,2]'
  expect_code "Thêm: body là mảng → VALIDATION_FAILED" VALIDATION_FAILED

  if [ -n "$new_id" ] && [ "$new_id" != "null" ]; then
    req PATCH "/api/dishes/$new_id" '{"price":50000}'
    expect "Sửa: chỉ gửi price → price đổi, tên giữ nguyên" 200 '.ok and .data.price == 50000 and .data.name == "Món test API"'
    req PATCH "/api/dishes/$new_id" '{"price":-1}'
    expect_code "Sửa: price âm → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | has("price"))'
    req PATCH "/api/dishes/$new_id" '{"name":"   "}'
    expect_code "Sửa: tên toàn khoảng trắng → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | has("name"))'
    req DELETE "/api/dishes/$new_id"
    expect "Xoá → ok, data = null" 200 '.ok == true and .data == null'
    req DELETE "/api/dishes/$new_id"
    expect_code "Xoá lần 2 → NOT_FOUND" NOT_FOUND
    req GET "/api/dishes/$new_id"
    expect_code "Chi tiết món vừa xoá → NOT_FOUND" NOT_FOUND
  fi
  req PATCH /api/dishes/999999 '{"price":1}'
  expect_code "Sửa id không có → NOT_FOUND" NOT_FOUND
  req PATCH /api/dishes/abc '{"price":1}'
  expect_code "Sửa id sai kiểu → NOT_FOUND" NOT_FOUND
  req DELETE /api/dishes/999999
  expect_code "Xoá id không có → NOT_FOUND" NOT_FOUND
  req DELETE /api/dishes/abc
  expect_code "Xoá id sai kiểu → NOT_FOUND" NOT_FOUND

  # Đầu bếp bắt buộc ≥ 1 chuyên môn (tagIds), không có trường chữ phụ; nguyên liệu có `unit`.
  simple_resource /api/chefs "Đầu bếp" "" '"tagIds":[1],' '["name","tagIds"]'
  simple_resource /api/ingredients "Nguyên liệu" unit "" '["name"]'
}

# Phần A cho đầu bếp / nguyên liệu (cùng khuôn): 5 dòng bảng REST, xoá bằng bản ghi vừa tạo (không bị chặn).
#   simple_resource PATH NHÃN TRƯỜNG_CHỮ_PHỤ ĐOẠN_JSON_BẮT_BUỘC KHOÁ_LỖI_KHI_BODY_RỖNG
simple_resource() {
  local path=$1 label=$2 extra=$3 required=$4 empty_keys=$5
  echo "== A. $label $path"
  req GET "$path"
  expect "Danh sách → 200, ok, data.items là mảng, mỗi phần tử có dishCount" 200 '.ok and (.data.items | type == "array") and (.data.items | length > 0) and all(.data.items[]; .dishCount | type == "number")'
  req GET "$path/1"
  expect "Chi tiết /1 → bản ghi kèm dishes" 200 '.ok and .data.id == 1 and (.data.dishes | type == "array")'
  for bad in 999999 abc 2.5; do
    req GET "$path/$bad"
    expect_code "Chi tiết /$bad → NOT_FOUND" NOT_FOUND
  done

  local stamp
  stamp=$(date +%s)
  local opt=""
  [ -n "$extra" ] && opt=",\"$extra\":\"Thử\""
  req POST "$path" "{$required\"name\":\" $label test $stamp \"$opt,\"id\":999999}"
  expect "Thêm hợp lệ → bản ghi vừa tạo, tên đã trim, bỏ trường lạ id" 200 ".ok and .data.name == \"$label test $stamp\" ${extra:+and .data.$extra == \"Thử\"} and .data.id != 999999"
  local id
  id=$(jq '.data.id' <<<"$BODY")
  req POST "$path" '{"name":""}'
  expect_code "Thêm: tên rỗng → VALIDATION_FAILED fields.name" VALIDATION_FAILED '(.error.fields | has("name"))'
  req POST "$path" '{}'
  expect_code "Thêm: body {} → VALIDATION_FAILED fields $empty_keys" VALIDATION_FAILED "(.error.fields | keys) == $empty_keys"
  req POST "$path" '{"name":123}'
  expect_code "Thêm: tên là số → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | has("name"))'
  req POST "$path" '{"name":'
  expect_tech "Thêm: JSON hỏng → 400" 400

  if [ -n "$extra" ]; then
    req PATCH "$path/$id" "{\"$extra\":\"\"}"
    expect "Sửa: chỉ gửi $extra rỗng → lưu null, tên giữ nguyên" 200 ".ok and .data.$extra == null and .data.name == \"$label test $stamp\""
  fi
  req PATCH "$path/$id" '{"name":"   "}'
  expect_code "Sửa: tên toàn khoảng trắng → VALIDATION_FAILED" VALIDATION_FAILED
  req PATCH "$path/999999" '{"name":"X"}'
  expect_code "Sửa id không có → NOT_FOUND" NOT_FOUND
  req PATCH "$path/abc" '{"name":"X"}'
  expect_code "Sửa id sai kiểu → NOT_FOUND" NOT_FOUND

  req DELETE "$path/$id"
  expect "Xoá (bản ghi không có món nào dùng) → ok, data = null" 200 '.ok == true and .data == null'
  req DELETE "$path/$id"
  expect_code "Xoá lần 2 → NOT_FOUND" NOT_FOUND
  req GET "$path/$id"
  expect_code "Chi tiết bản ghi vừa xoá → NOT_FOUND" NOT_FOUND
  req DELETE "$path/abc"
  expect_code "Xoá id sai kiểu → NOT_FOUND" NOT_FOUND
}

part_b() {
  echo "== B. Món ăn: quan hệ đầu bếp / nguyên liệu, loại món"
  req POST /api/dishes '{"name":"X","price":1000,"tagIds":"Lẩu","chefId":9999,"ingredientIds":[9999],"available":"yes"}'
  expect_code "Thêm: tagIds không phải mảng id, available sai kiểu → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | has("tagIds") and has("available"))'
  req POST /api/dishes '{"name":"X","price":1000,"tagIds":[2],"chefId":9999,"ingredientIds":[9999]}'
  expect_code "Thêm: chefId, ingredientIds không tồn tại → VALIDATION_FAILED đúng 2 trường" VALIDATION_FAILED '(.error.fields | keys | sort) == ["chefId","ingredientIds"]'
  req POST /api/dishes '{"name":"X","price":1000,"tagIds":[2],"chefId":"1","ingredientIds":["1"]}'
  expect_code 'Thêm: chefId "1", ingredientIds ["1"] (chuỗi) → VALIDATION_FAILED' VALIDATION_FAILED '(.error.fields | keys | sort) == ["chefId","ingredientIds"]'
  req POST /api/dishes '{"name":"X","price":1000,"tagIds":[2],"chefId":1,"ingredientIds":[]}'
  expect_code "Thêm: ingredientIds rỗng → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | keys) == ["ingredientIds"]'

  req POST /api/dishes '{"name":"Món test quan hệ","price":30000,"tagIds":[1],"chefId":1,"ingredientIds":[1,2]}'
  local id
  id=$(jq '.data.id' <<<"$BODY")
  req PATCH "/api/dishes/$id" '{"chefId":2,"ingredientIds":[3]}'
  expect "Sửa: đổi đầu bếp, thay toàn bộ nguyên liệu" 200 '.ok and .data.chef.id == 2 and ([.data.ingredients[].id] == [3])'
  req PATCH "/api/dishes/$id" '{"ingredientIds":[3,9999]}'
  expect_code "Sửa: nguyên liệu không tồn tại → VALIDATION_FAILED, liên kết cũ giữ nguyên" VALIDATION_FAILED
  req GET "/api/dishes/$id"
  expect "  …liên kết vẫn là [3]" 200 '[.data.ingredients[].id] == [3]'
  req DELETE "/api/dishes/$id" >/dev/null

  echo "== B. Tìm kiếm admin: đầu bếp (tên, chuyên môn), nguyên liệu (tên, đơn vị)"
  req GET "/api/chefs?q=TR%C3%81NG%20MI%E1%BB%86NG"
  expect '/api/chefs?q=TRÁNG MIỆNG → khớp tên chuyên môn (tag)' 200 '(.data.items | length >= 1) and all(.data.items[]; any(.tags[]; .name == "Tráng miệng"))'
  req GET "/api/chefs?q=mai"
  expect '/api/chefs?q=mai → khớp tên' 200 '(.data.items | length >= 1) and all(.data.items[]; .name | test("mai"; "i"))'
  req GET "/api/ingredients?q=l%C3%ADt"
  expect '/api/ingredients?q=lít → khớp đơn vị' 200 '(.data.items | length >= 1) and all(.data.items[]; .unit == "lít")'
  req GET /api/ingredients
  local ing_total
  ing_total=$(jq '.data.total' <<<"$BODY")
  req GET "/api/ingredients?q=a&q=b"
  expect "/api/ingredients?q=a&q=b (mảng) → bỏ qua, total đủ $ing_total" 200 "(.data.total == $ing_total)"

  echo "== B. Món ăn: ảnh minh hoạ (imageUrl, imageCredit)"
  local base='"name":"Món ảnh","price":1000,"tagIds":[1],"chefId":1,"ingredientIds":[1]'
  for bad in 'javascript:alert(1)' 'data:image/png;base64,AAAA' 'abc' 'ftp://x.com/a.jpg'; do
    req POST /api/dishes "{$base,\"imageUrl\":\"$bad\"}"
    expect_code "Thêm: imageUrl \"$bad\" → VALIDATION_FAILED fields.imageUrl" VALIDATION_FAILED '(.error.fields | keys) == ["imageUrl"]'
  done
  req POST /api/dishes "{$base,\"imageCredit\":\"$(printf 'x%.0s' {1..201})\"}"
  expect_code "Thêm: imageCredit 201 ký tự → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | keys) == ["imageCredit"]'
  req POST /api/dishes "{$base,\"imageUrl\":\"https://example.com/a.jpg\",\"imageCredit\":\" Tác giả · CC BY \"}"
  expect "Thêm: link https hợp lệ + ghi công (trim) → lưu" 200 '.ok and .data.imageUrl == "https://example.com/a.jpg" and .data.imageCredit == "Tác giả · CC BY"'
  local img
  img=$(jq '.data.id' <<<"$BODY")
  req PATCH "/api/dishes/$img" '{"imageUrl":"","imageCredit":null}'
  expect "Sửa: imageUrl rỗng, imageCredit null → lưu null (bỏ ảnh)" 200 '.ok and .data.imageUrl == null and .data.imageCredit == null'
  req DELETE "/api/dishes/$img" >/dev/null

  local stamp
  stamp=$(date +%s)

  echo "== B. Đầu bếp: trùng tên, xoá khi còn món, chuyển món"
  req POST /api/chefs '{"name":"nguyễn văn an","tagIds":[1]}'
  expect_code 'Thêm: "nguyễn văn an" trùng "Nguyễn Văn An" (không phân biệt hoa thường) → VALIDATION_FAILED fields.name' VALIDATION_FAILED '(.error.fields | keys) == ["name"]'
  req PATCH /api/chefs/2 '{"name":"NGUYỄN VĂN AN"}'
  expect_code "Sửa đầu bếp 2 thành tên của đầu bếp 1 → VALIDATION_FAILED" VALIDATION_FAILED
  req PATCH /api/chefs/1 '{"name":"Nguyễn Văn An"}'
  expect "Sửa: lưu lại đúng tên cũ của chính mình → ok" 200 '.ok == true'
  req DELETE /api/chefs/1
  expect_code "Xoá đầu bếp còn món, không có transferTo → IN_USE kèm dishes" IN_USE '(.error.dishes | length > 0)'
  for bad in 1 abc 999999; do
    req DELETE "/api/chefs/1?transferTo=$bad"
    expect_code "Xoá với transferTo=$bad → VALIDATION_FAILED fields.transferTo" VALIDATION_FAILED '(.error.fields | has("transferTo"))'
  done
  req GET /api/chefs/1
  expect "  …đầu bếp 1 vẫn còn" 200 '.ok == true'

  req POST /api/chefs "{\"name\":\"Bếp nguồn $stamp\",\"tagIds\":[1]}"
  local from
  from=$(jq '.data.id' <<<"$BODY")
  req POST /api/chefs "{\"name\":\"Bếp nhận $stamp\",\"tagIds\":[1]}"
  local to
  to=$(jq '.data.id' <<<"$BODY")
  req POST /api/dishes "{\"name\":\"Món chuyển $stamp\",\"price\":10000,\"tagIds\":[1],\"chefId\":$from,\"ingredientIds\":[1]}"
  local dish
  dish=$(jq '.data.id' <<<"$BODY")
  req DELETE "/api/chefs/$from?transferTo=$to"
  expect "Xoá đầu bếp kèm transferTo hợp lệ → ok, data = null" 200 '.ok == true and .data == null'
  req GET "/api/dishes/$dish"
  expect "  …món đã chuyển sang đầu bếp nhận" 200 ".data.chef.id == $to"
  req GET "/api/chefs/$from"
  expect_code "  …đầu bếp nguồn đã bị xoá" NOT_FOUND
  req DELETE "/api/dishes/$dish" >/dev/null
  req DELETE "/api/chefs/$to" >/dev/null

  echo "== B. Nguyên liệu: trùng tên, xoá khi đang được dùng"
  req POST /api/ingredients '{"name":"tỏi"}'
  expect_code 'Thêm: "tỏi" trùng "Tỏi" → VALIDATION_FAILED fields.name' VALIDATION_FAILED '(.error.fields | keys) == ["name"]'
  req DELETE /api/ingredients/1
  expect_code "Xoá nguyên liệu đang dùng (Thịt bò) → IN_USE kèm dishes" IN_USE '(.error.dishes | length > 0)'
  req GET /api/ingredients/1
  expect "  …nguyên liệu 1 vẫn còn" 200 '.ok == true and .data.dishCount > 0'

  req POST /api/ingredients "{\"name\":\"Nguyên liệu tạm $stamp\"}"
  local ing
  ing=$(jq '.data.id' <<<"$BODY")
  req POST /api/dishes "{\"name\":\"Món dùng tạm $stamp\",\"price\":10000,\"tagIds\":[1],\"chefId\":1,\"ingredientIds\":[$ing]}"
  dish=$(jq '.data.id' <<<"$BODY")
  req DELETE "/api/ingredients/$ing"
  expect_code "Xoá nguyên liệu vừa được món dùng → IN_USE" IN_USE "([.error.dishes[].id] == [$dish])"
  req DELETE "/api/dishes/$dish" >/dev/null
  req DELETE "/api/ingredients/$ing"
  expect "Xoá món dùng nó rồi xoá lại → ok" 200 '.ok == true and .data == null'
}

# Gom id của MỌI trang cho một bộ điều kiện (pageSize 100) → in mảng JSON. Dùng để chứng minh không mất / lặp món.
collect() {
  local query=$1 page=1 all="[]" items
  while :; do
    req GET "/api/dishes?${query}&pageSize=100&page=$page"
    items=$(jq -c '[.data.items[] | {id, price, available, score, text: ((.name + " " + (.description // "")) | ascii_downcase)}]' <<<"$BODY")
    [ "$items" = "[]" ] && break
    all=$(jq -c --argjson a "$all" --argjson b "$items" -n '$a + $b')
    page=$((page + 1))
  done
  echo "$all"
}

part_c() {
  echo "== C. Phân trang GET /api/dishes (seed 1.200 món)"
  req GET /api/dishes
  expect "Mặc định: page 1, pageSize 12, total 1200, id 1–12 (thứ tự id tăng)" 200 '.data.page == 1 and .data.pageSize == 12 and .data.total == 1200 and ([.data.items[].id] == [range(1;13)])'
  req GET "/api/dishes?page=2"
  expect "page=2 → id 13–24 (OFFSET 12)" 200 '[.data.items[].id] == [range(13;25)]'
  req GET "/api/dishes?page=100"
  expect "page=100 (trang cuối) → id 1189–1200" 200 '[.data.items[].id] == [range(1189;1201)]'
  req GET "/api/dishes?page=101"
  expect "page=101 (vượt phạm vi) → ok, items [], total 1200, page giữ 101" 200 '.ok and .data.items == [] and .data.total == 1200 and .data.page == 101'
  req GET "/api/dishes?page=2147483647"
  expect "page rất lớn → ok, items []" 200 '.ok and .data.items == []'
  req GET "/api/dishes?page=&pageSize=%20"
  expect "page, pageSize trắng → mặc định 1, 12" 200 '.data.page == 1 and .data.pageSize == 12'
  req GET "/api/dishes?pageSize=100"
  expect "pageSize=100 (tối đa) → 100 món" 200 '(.data.items | length) == 100'
  for bad in 0 -1 abc 2.5 01 1e2 2147483648; do
    req GET "/api/dishes?page=$bad"
    expect_code "page=$bad → VALIDATION_FAILED fields.page" VALIDATION_FAILED '(.error.fields | keys) == ["page"]'
  done
  for bad in 0 101 abc 2.5; do
    req GET "/api/dishes?pageSize=$bad"
    expect_code "pageSize=$bad → VALIDATION_FAILED fields.pageSize" VALIDATION_FAILED '(.error.fields | keys) == ["pageSize"]'
  done
  req GET "/api/dishes?page=1&page=2"
  expect_code "page lặp (?page=1&page=2) → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | keys) == ["page"]'
  req GET "/api/dishes?sort=xyz&mode=abc"
  expect_code "sort=xyz, mode=abc → VALIDATION_FAILED cả hai trường" VALIDATION_FAILED '(.error.fields | keys | sort) == ["mode","sort"]'

  local all
  all=$(collect "mode=basic")
  BODY=$all; STATUS=200
  expect "Gom 12 trang × 100 món: đủ 1.200 id, không trùng" 200 '(length == 1200) and ([.[].id] | unique | length == 1200)'
  all=$(collect "sort=gia-tang")
  BODY=$all; STATUS=200
  expect "sort=gia-tang qua mọi trang: giá không giảm, cùng giá thì id tăng (thứ tự xác định)" 200 '(length == 1200) and ([range(1; length) as $i | (.[$i-1].price < .[$i].price) or (.[$i-1].price == .[$i].price and .[$i-1].id < .[$i].id)] | all)'
  req GET "/api/dishes?sort=moi-nhat"
  expect "sort=moi-nhat → id 1200 đứng đầu" 200 '.data.items[0].id == 1200'
  req GET "/api/dishes?sort=gia-giam&pageSize=1"
  expect "sort=gia-giam → món đắt nhất trước (Combo 100% bò hoặc lẩu)" 200 '.data.items[0].price >= 300000'
}

part_d() {
  echo "== D. Search basic / advanced / fulltext / fuzzy"
  local v expect_id
  for pair in "%25:560" "_:700" "Tr%C3%A0_:700" "%5C:960" "100%25:560"; do
    v=${pair%%:*}; expect_id=${pair##*:}
    req GET "/api/dishes?q=$v"
    expect "q=$(printf '%b' "${v//%/\\x}") → chỉ món #$expect_id (ký tự đặc biệt là dữ liệu, không phải wildcard)" 200 ".data.total == 1 and .data.items[0].id == $expect_id"
  done
  req GET "/api/dishes?q=%20%20%20"
  expect "q toàn khoảng trắng → không có tiêu chí, total 1200" 200 '.data.total == 1200'

  req GET "/api/dishes?mode=basic&q=ph%E1%BB%9F&pageSize=100"
  local basic
  basic=$(jq -c '{total: .data.total, ids: [.data.items[].id]}' <<<"$BODY")
  req GET "/api/dishes?mode=advanced&q=ph%E1%BB%9F&pageSize=100"
  expect "basic và advanced chỉ có cùng q=phở → cùng total, cùng danh sách id" 200 "({total: .data.total, ids: [.data.items[].id]}) == $basic"
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc"
  expect '?q=món nước (basic, mặc định chỉ tìm tên) → total 0' 200 '.data.total == 0'
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc&searchIn=name,tag&pageSize=100"
  expect '?q=món nước&searchIn=name,tag (admin) → các món có tag Món nước' 200 '.data.total == 224 and all(.data.items[]; any(.tags[]; .name == "Món nước"))'
  req GET "/api/dishes?mode=basic&available=abc&tag=xyz"
  expect "mode=basic kèm tham số của advanced (sai) → bỏ qua, không lỗi" 200 '.ok and .data.total == 1200'

  local all
  req GET "/api/dishes?mode=advanced&tag=9"
  expect "advanced tag=9 (Lẩu) → 61 món, có món nằm ngoài trang đầu của danh sách mặc định (id > 12)" 200 '.data.total == 61 and any(.data.items[]; .id > 12)'
  all=$(collect "mode=advanced&available=false")
  BODY=$all; STATUS=200
  expect "advanced available=false → mọi món tạm hết (false là tiêu chí, không bị bỏ)" 200 '(length > 0) and all(.[]; .available == false)'
  req GET "/api/dishes?mode=advanced&minPrice=0&maxPrice=0"
  expect "advanced minPrice=0&maxPrice=0 → 4 món giá 0 (0 là tiêu chí)" 200 '.data.total == 4 and all(.data.items[]; .price == 0)'
  all=$(collect "mode=advanced&tag=12&minPrice=50000&maxPrice=100000&available=true")
  BODY=$all; STATUS=200
  expect "advanced Hải sản + giá 50.000–100.000 + còn phục vụ → mọi món thoả cả 3 (AND)" 200 '(length > 0) and all(.[]; .price >= 50000 and .price <= 100000 and .available == true)'
  req GET "/api/dishes?mode=advanced&tag=12&minPrice=50000&maxPrice=100000&available=true"
  expect "  …total khớp số món gom được qua các trang" 200 ".data.total == $(jq length <<<"$all")"
  req GET "/api/dishes?mode=advanced&tag=&minPrice=&maxPrice=%20&available="
  expect "advanced các ô trắng → không có tiêu chí, total 1200" 200 '.data.total == 1200'

  for pair in "minPrice=-1:minPrice" "minPrice=1.5:minPrice" "minPrice=abc:minPrice" "maxPrice=1e3:maxPrice" "minPrice=50000&maxPrice=10000:maxPrice" "available=1:available" "available=yes:available" "tag=abc:tag" "tag=999999:tag"; do
    req GET "/api/dishes?mode=advanced&${pair%%:*}"
    expect_code "advanced ${pair%%:*} → VALIDATION_FAILED fields.${pair##*:}" VALIDATION_FAILED "(.error.fields | keys) == [\"${pair##*:}\"]"
  done

  echo "== D. Full-text (simple, tên + mô tả) và fuzzy (pg_trgm, ngưỡng 0.3)"
  # Thứ tự theo điểm: điểm giảm dần, cùng điểm thì id tăng dần (thứ tự xác định khi chia trang).
  local by_score='[range(1; length) as $i | (.[$i-1].score > .[$i].score) or (.[$i-1].score == .[$i].score and .[$i-1].id < .[$i].id)] | all'
  for m in fulltext fuzzy; do
    req GET "/api/dishes?mode=$m"
    expect_code "mode=$m không có q → VALIDATION_FAILED fields.q" VALIDATION_FAILED '(.error.fields | keys) == ["q"]'
    req GET "/api/dishes?mode=$m&q=%20%20"
    expect_code "mode=$m q toàn khoảng trắng → VALIDATION_FAILED fields.q (không âm thầm lấy tất cả)" VALIDATION_FAILED '(.error.fields | keys) == ["q"]'
    req GET "/api/dishes?mode=$m&q=khongcomonnay"
    expect "mode=$m không khớp → ok, items [], total 0" 200 '.ok and .data.items == [] and .data.total == 0'
  done
  all=$(collect "mode=fulltext&q=n%C6%B0%E1%BB%9Bc%20d%C3%B9ng%20x%C6%B0%C6%A1ng")
  BODY=$all; STATUS=200
  expect "fulltext \"nước dùng xương\": mọi món chứa đủ 3 từ (không cần liền nhau) trong tên + mô tả" 200 '(length > 0) and all(.[]; (.text | test("nước")) and (.text | test("dùng")) and (.text | test("xương")))'
  expect "  …qua mọi trang: xếp theo điểm giảm dần rồi id, không trùng id" 200 "($by_score) and ([.[].id] | unique | length) == length"
  local ft_total
  ft_total=$(jq length <<<"$all")
  req GET "/api/dishes?mode=fulltext&q=x%C6%B0%C6%A1ng%20d%C3%B9ng%20n%C6%B0%E1%BB%9Bc"
  expect "fulltext đảo thứ tự từ (\"xương dùng nước\") → cùng total $ft_total" 200 ".data.total == $ft_total"
  req GET "/api/dishes?mode=fulltext&q=n%C6%B0%E1%BB%9Bc%20d%C3%B9ng%20x%C6%B0%C6%A1ng&sort=gia-tang&tag=abc"
  expect "fulltext bỏ qua sort và tiêu chí advanced (vẫn xếp theo điểm, không lỗi tag)" 200 ".ok and .data.total == $ft_total and (.data.items | [.[] | {id, score}] | $by_score)"
  req GET "/api/dishes?mode=fulltext&q=pho"
  expect "fulltext \"pho\" (không dấu) → 0 món: cấu hình simple không bỏ dấu" 200 '.data.total == 0'
  # ts_rank là float4: 10 món "cá kho tộ" chỉ khác nhau ở sai số (in ra đều là 1) → điểm làm tròn 3 chữ số trong SQL,
  # cùng điểm hiển thị thì xếp theo id (bước 17).
  req GET "/api/dishes?mode=fulltext&q=c%C3%A1%20kho%20t%E1%BB%99"
  expect "fulltext \"cá kho tộ\": 10 món cùng điểm 1.000 → xếp theo id tăng dần (8, 80, 109, 201, 342…)" 200 ".data.total == 11 and (.data.items | [.[] | {id, score}] | $by_score) and ([.data.items[:5][].id] == [8,80,109,201,342])"
  req GET "/api/dishes?mode=fulltext&q=ph%E1%BB%9F&pageSize=1"
  expect "fulltext \"phở\" → món có \"phở\" trong tên xếp đầu" 200 '.data.total > 0 and (.data.items[0].name | test("phở"; "i"))'
  req GET "/api/dishes?mode=fulltext&q=x&page=0"
  expect_code "fulltext page=0 → VALIDATION_FAILED fields.page" VALIDATION_FAILED '(.error.fields | keys) == ["page"]'

  req GET "/api/dishes?mode=fuzzy&q=B%C3%B2%20l%C3%BAc%20l%E1%BA%AFt"
  expect "fuzzy \"Bò lúc lắt\" (gõ sai) → \"Bò lúc lắc\" đứng đầu, mọi điểm ≥ 0.3" 200 '.data.items[0].name == "Bò lúc lắc" and all(.data.items[]; .score >= 0.3)'
  req GET "/api/dishes?mode=fuzzy&q=G%E1%BB%8Fi%20cu%E1%BB%91ng%20t%C3%B4m%20th%E1%BB%8Bt"
  expect "fuzzy \"Gỏi cuống tôm thịt\" → \"Gỏi cuốn tôm thịt\" đứng đầu" 200 '.data.items[0].name == "Gỏi cuốn tôm thịt"'
  req GET "/api/dishes?mode=fuzzy&q=pho%20bo%20tai"
  expect "fuzzy \"pho bo tai\" (không dấu) → 0 món (dưới ngưỡng 0.3)" 200 '.data.total == 0'
  all=$(collect "mode=fuzzy&q=C%C6%A1m%20t%E1%BA%A5m%20su%E1%BB%9Dn%20n%C6%B0%E1%BB%9Bng")
  BODY=$all; STATUS=200
  expect "fuzzy \"Cơm tấm suờn nướng\" qua mọi trang: điểm ≥ 0.3, xếp theo điểm rồi id, không trùng" 200 "(length > 0) and all(.[]; .score >= 0.3) and ($by_score) and ([.[].id] | unique | length) == length"
  req GET "/api/dishes?mode=fuzzy&q=C%C6%A1m%20t%E1%BA%A5m%20su%E1%BB%9Dn%20n%C6%B0%E1%BB%9Bng"
  expect "  …total khớp số món gom được" 200 ".data.total == $(jq length <<<"$all")"
}

part_e() {
  local stamp
  stamp=$(date +%s)

  echo "== E. Tag: /api/tags (chỉ đọc danh sách + thêm, không sửa/xoá)"
  req GET /api/tags
  expect "Danh sách → mảng tag, mỗi tag có dishCount, chefCount" 200 '.ok and (.data | length >= 16) and all(.data[]; (.dishCount | type == "number") and (.chefCount | type == "number"))'
  expect "  …tag Lẩu có món và có đầu bếp chuyên môn (seed đầy đủ)" 200 'any(.data[]; .name == "Lẩu" and .dishCount > 0 and .chefCount > 0)'
  req POST /api/tags "{\"name\":\"  Tag test $stamp  \",\"id\":999999}"
  expect "Thêm tag hợp lệ → tên đã trim, bỏ trường lạ id, dishCount 0" 200 ".ok and .data.name == \"Tag test $stamp\" and .data.id != 999999 and .data.dishCount == 0 and .data.chefCount == 0"
  req POST /api/tags '{"name":"  MÓN NƯỚC "}'
  expect_code 'Thêm "MÓN NƯỚC" trùng "Món nước" (không phân biệt hoa thường) → VALIDATION_FAILED fields.name' VALIDATION_FAILED '(.error.fields | keys) == ["name"]'
  for bad in '{"name":""}' '{"name":"   "}' '{}' '{"name":5}'; do
    req POST /api/tags "$bad"
    expect_code "Thêm tag $bad → VALIDATION_FAILED fields.name" VALIDATION_FAILED '(.error.fields | keys) == ["name"]'
  done
  req POST /api/tags '{"name":'
  expect_tech "Thêm tag JSON hỏng → 400" 400
  req PATCH /api/tags/1 '{"name":"X"}'
  expect_tech "PATCH /api/tags/1 (không có sửa tag) → 404" 404
  req DELETE /api/tags/1
  expect_tech "DELETE /api/tags/1 (không có xoá tag) → 404" 404

  echo "== E. Món: tagIds"
  local base='"price":10000,"chefId":1,"ingredientIds":[1]'
  for bad in '[]' 'null' '"2"' '["2"]' '[2.5]' '[0]'; do
    req POST /api/dishes "{\"name\":\"Món tag\",$base,\"tagIds\":$bad}"
    expect_code "Thêm món tagIds=$bad → VALIDATION_FAILED fields.tagIds" VALIDATION_FAILED '(.error.fields | keys) == ["tagIds"]'
  done
  req POST /api/dishes "{\"name\":\"Món tag\",$base,\"tagIds\":[2,9999]}"
  expect_code "Thêm món có tag không tồn tại → VALIDATION_FAILED fields.tagIds" VALIDATION_FAILED '(.error.fields | keys) == ["tagIds"]'
  req POST /api/dishes "{\"name\":\"Món tag $stamp\",$base,\"tagIds\":[14,2,2]}"
  expect "Thêm món tagIds=[14,2,2] → 2 tag, bỏ trùng, sắp theo id" 200 '.ok and ([.data.tags[].id] == [2,14])'
  local dish
  dish=$(jq '.data.id' <<<"$BODY")
  req PATCH "/api/dishes/$dish" '{"tagIds":[16]}'
  expect "Sửa món tagIds=[16] → thay toàn bộ tag" 200 '.ok and ([.data.tags[].id] == [16])'
  req PATCH "/api/dishes/$dish" '{"tagIds":[]}'
  expect_code "Sửa món tagIds=[] → VALIDATION_FAILED (món phải có ≥ 1 tag)" VALIDATION_FAILED '(.error.fields | keys) == ["tagIds"]'
  req PATCH "/api/dishes/$dish" '{"price":12000}'
  expect "Sửa món không gửi tagIds → tag giữ nguyên" 200 '.ok and .data.price == 12000 and ([.data.tags[].id] == [16])'
  req GET "/api/dishes?mode=advanced&tag=16&sort=moi-nhat"
  expect "  …lọc advanced tag=16, mới nhất trước → món vừa sửa ở đầu" 200 ".data.items[0].id == $dish"
  req DELETE "/api/dishes/$dish"
  expect "Xoá món → ok (liên kết tag tự xoá theo Cascade)" 200 '.ok == true'
  req GET /api/tags
  expect "  …tag vẫn còn sau khi xoá món" 200 'any(.data[]; .id == 16)'

  echo "== E. Đầu bếp: chuyên môn (tagIds, bắt buộc ≥ 1)"
  req POST /api/chefs "{\"name\":\"Bếp tag $stamp\"}"
  expect_code "Thêm đầu bếp thiếu tagIds → VALIDATION_FAILED fields.tagIds" VALIDATION_FAILED '(.error.fields | keys) == ["tagIds"]'
  req POST /api/chefs "{\"name\":\"Bếp tag $stamp\",\"tagIds\":[]}"
  expect_code "Thêm đầu bếp tagIds=[] → VALIDATION_FAILED fields.tagIds" VALIDATION_FAILED '(.error.fields | keys) == ["tagIds"]'
  req POST /api/chefs "{\"name\":\"Bếp tag $stamp\",\"tagIds\":[9999]}"
  expect_code "Thêm đầu bếp có tag không tồn tại → VALIDATION_FAILED fields.tagIds" VALIDATION_FAILED '(.error.fields | keys) == ["tagIds"]'
  req POST /api/chefs "{\"name\":\"Bếp tag $stamp\",\"tagIds\":[12,7,12]}"
  expect "Thêm đầu bếp tagIds=[12,7,12] → 2 chuyên môn, dishCount 0" 200 '.ok and ([.data.tags[].id] == [7,12]) and .data.dishCount == 0'
  local chef
  chef=$(jq '.data.id' <<<"$BODY")
  req PATCH "/api/chefs/$chef" '{"tagIds":[]}'
  expect_code "Sửa đầu bếp tagIds=[] → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | keys) == ["tagIds"]'
  req PATCH "/api/chefs/$chef" '{"tagIds":[13]}'
  expect "Sửa đầu bếp tagIds=[13] → thay toàn bộ chuyên môn" 200 '.ok and ([.data.tags[].id] == [13])'
  req PATCH "/api/chefs/$chef" "{\"name\":\"Bếp tag đổi $stamp\"}"
  expect "Sửa tên, không gửi tagIds → chuyên môn giữ nguyên" 200 '.ok and ([.data.tags[].id] == [13])'
  req GET "/api/chefs/$chef"
  expect "Chi tiết đầu bếp → có tags, dishes" 200 '.ok and ([.data.tags[].id] == [13]) and .data.dishes == []'
  req GET "/api/chefs?q=m%C3%B3n%20chay&all=true"
  expect "/api/chefs?q=món chay → thấy đầu bếp vừa đổi chuyên môn" 200 "any(.data.items[]; .id == $chef)"
  req DELETE "/api/chefs/$chef"
  expect "Xoá đầu bếp 0 món → ok (chuyên môn tự xoá theo Cascade)" 200 '.ok == true'
}

# Gom id của mọi trang (pageSize nhỏ để đi qua nhiều trang) → kiểm tra không lặp, không mất.
collect_ids() {
  local path=$1 page=1 all="[]" ids
  while :; do
    req GET "$path?pageSize=7&page=$page"
    ids=$(jq -c '[.data.items[].id]' <<<"$BODY")
    [ "$ids" = "[]" ] && break
    all=$(jq -c --argjson a "$all" --argjson b "$ids" -n '$a + $b')
    page=$((page + 1))
  done
  echo "$all"
}

part_f() {
  local pair path total last
  for pair in "/api/chefs:60" "/api/ingredients:250"; do
    path=${pair%%:*} total=${pair##*:} last=$(((total + 19) / 20))
    echo "== F. Phân trang admin GET $path (seed $total dòng)"
    req GET "$path"
    expect "Mặc định: page 1, pageSize 20, total $total, id 1–20 (id tăng dần)" 200 ".ok and .data.page == 1 and .data.pageSize == 20 and .data.total == $total and ([.data.items[].id] == [range(1;21)])"
    req GET "$path?page=2"
    expect "page=2 → id 21–40 (OFFSET 20)" 200 '[.data.items[].id] == [range(21;41)]'
    req GET "$path?page=$last"
    expect "page=$last (trang cuối) → món cuối là id $total" 200 ".data.items[-1].id == $total"
    req GET "$path?page=$((last + 1))"
    expect "page=$((last + 1)) (vượt phạm vi) → ok, items [], total $total, page giữ $((last + 1))" 200 ".ok and .data.items == [] and .data.total == $total and .data.page == $((last + 1))"
    req GET "$path?all=true&page=5&pageSize=1"
    expect "all=true → đủ $total dòng, bỏ qua page/pageSize, page 1, pageSize = total" 200 ".ok and (.data.items | length) == $total and .data.page == 1 and .data.pageSize == $total"
    for bad in 0 -1 abc 2.5; do
      req GET "$path?page=$bad"
      expect_code "page=$bad → VALIDATION_FAILED fields.page" VALIDATION_FAILED '(.error.fields | keys) == ["page"]'
    done
    for bad in 0 101 abc; do
      req GET "$path?pageSize=$bad"
      expect_code "pageSize=$bad → VALIDATION_FAILED fields.pageSize" VALIDATION_FAILED '(.error.fields | keys) == ["pageSize"]'
    done
    for bad in 1 false TRUE; do
      req GET "$path?all=$bad"
      expect_code "all=$bad → VALIDATION_FAILED fields.all" VALIDATION_FAILED '(.error.fields | keys) == ["all"]'
    done
    BODY=$(collect_ids "$path"); STATUS=200
    expect "Gom mọi trang (7 dòng/trang): đủ $total id, tăng dần, không trùng" 200 ". == [range(1; $((total + 1)))]"
    # Ký tự đặc biệt là chữ thường: không tên/đơn vị nào chứa % _ \ (đã đếm bằng SQL) → 0 kết quả, không phải tất cả.
    for q in %25 _ %5C; do
      req GET "$path?q=$q"
      expect "q=$q (literal) → ok, total 0" 200 '.ok and .data.total == 0 and .data.items == []'
    done
  done
  # total đếm cùng điều kiện q, không đếm cả bảng (số kỳ vọng đếm bằng SQL trên seed).
  req GET "/api/chefs?q=mai&pageSize=4&page=2"
  expect "/api/chefs?q=mai&pageSize=4&page=2 → total 6 (khớp SQL), trang 2 còn 2 dòng" 200 '.data.total == 6 and (.data.items | length) == 2 and all(.data.items[]; .name | test("mai"; "i"))'
  req GET "/api/ingredients?q=l%C3%ADt"
  expect "/api/ingredients?q=lít → total 6 (khớp SQL)" 200 '.data.total == 6'
}

part_g() {
  echo "== G. Tìm theo nguyên liệu, đầu bếp (?by=, plan mục 14) — số kỳ vọng đếm bằng SQL trên seed"
  local all by_score basic
  by_score='[range(1; length) as $i | (.[$i-1].score > .[$i].score) or (.[$i-1].score == .[$i].score and .[$i-1].id < .[$i].id)] | all'
  req GET "/api/dishes?q=t%C3%B4m&by=ingredient&pageSize=100"
  basic=$(jq -c '{total: .data.total, ids: [.data.items[].id]}' <<<"$BODY")
  expect "basic by=ingredient q=tôm → 149 món (có ít nhất một nguyên liệu chứa \"tôm\", kể cả Mắm tôm)" 200 '.data.total == 149'
  req GET "/api/dishes?mode=advanced&q=t%C3%B4m&by=ingredient&pageSize=100"
  expect "advanced chỉ có cùng q, by → cùng total, cùng danh sách id với basic" 200 "({total: .data.total, ids: [.data.items[].id]}) == $basic"
  all=$(collect "q=t%C3%B4m&by=ingredient")
  BODY=$all; STATUS=200
  expect "  …gom mọi trang: đủ 149 id, tăng dần, không trùng (món nhiều nguyên liệu khớp vẫn chỉ một lần)" 200 '([.[].id] | length) == 149 and ([.[].id] == ([.[].id] | unique))'
  req GET "/api/dishes?mode=advanced&q=t%C3%B4m&by=ingredient&tag=12&maxPrice=60000"
  expect "advanced by=ingredient q=tôm + Hải sản + giá ≤ 60.000 → 28 món (AND)" 200 '.data.total == 28'
  req GET "/api/dishes?q=mai&by=chef&pageSize=100"
  expect "by=chef q=mai → 122 món, mọi món do đầu bếp tên chứa \"mai\" phụ trách" 200 '.data.total == 122 and all(.data.items[]; .chef.name | test("mai"; "i"))'
  req GET "/api/dishes?q=B%C3%B9i%20Thanh%20T%C3%A2m&by=chef"
  expect "by=chef \"Bùi Thanh Tâm\" (không phụ trách món nào) → ok, items [], total 0" 200 '.ok and .data.items == [] and .data.total == 0'
  for v in %25 _ %5C; do
    for b in ingredient chef; do
      req GET "/api/dishes?q=$v&by=$b"
      expect "by=$b q=$v (literal) → total 0, không phải mọi món" 200 '.ok and .data.total == 0'
    done
  done
  req GET "/api/dishes?q=ph%E1%BB%9F&by=name"
  expect "by=name tường minh → giống mặc định (tên món)" 200 ".data.total == $(curl -s "$API/api/dishes?q=ph%E1%BB%9F" | jq .data.total)"
  for bad in "by=abc" "by=Ingredient" "by=name&by=chef"; do
    req GET "/api/dishes?q=x&$bad"
    expect_code "$bad → VALIDATION_FAILED fields.by" VALIDATION_FAILED '(.error.fields | keys) == ["by"]'
  done
  req GET "/api/dishes?mode=fulltext&q=t%C3%B4m&by=abc"
  expect "fulltext bỏ qua by (document luôn là tên + mô tả món), không lỗi" 200 ".ok and .data.total == $(curl -s "$API/api/dishes?mode=fulltext&q=t%C3%B4m" | jq .data.total)"
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc&by=chef&searchIn=name,tag"
  expect "searchIn của admin chỉ áp dụng khi by=name (by=chef q=món nước → 0)" 200 '.data.total == 0'

  all=$(collect "mode=fuzzy&q=T%C3%B4m%20x%C3%BA&by=ingredient")
  BODY=$all; STATUS=200
  expect "fuzzy by=ingredient \"Tôm xú\" (gõ sai) qua mọi trang: 136 món, điểm ≥ 0.3, theo điểm rồi id, không trùng" 200 "length == 136 and all(.[]; .score >= 0.3) and ($by_score) and ([.[].id] | unique | length) == length"
  req GET "/api/dishes?mode=fuzzy&q=T%C3%B4m%20x%C3%BA&by=ingredient"
  expect "  …total 136 khớp số món gom được, điểm đầu 0.4 (Tôm sú / Tôm thẻ)" 200 '.data.total == 136 and .data.items[0].score == 0.4'
  req GET "/api/dishes?mode=fuzzy&q=Tr%E1%BA%A7n%20Th%E1%BB%8B%20B%C3%ADt&by=chef&pageSize=100"
  expect "fuzzy by=chef \"Trần Thị Bít\" → 21 món của Trần Thị Bích, cùng điểm 0.667, id tăng dần" 200 '.data.total == 21 and all(.data.items[]; .chef.name == "Trần Thị Bích" and .score == 0.667) and ([.data.items[].id] == ([.data.items[].id] | sort))'
  req GET "/api/dishes?mode=fuzzy&q=%20&by=chef"
  expect_code "fuzzy by=chef q trắng → VALIDATION_FAILED fields.q" VALIDATION_FAILED '(.error.fields | keys) == ["q"]'
}

part_h() {
  echo "== H. Tìm gần đúng admin GET /api/chefs, /api/ingredients ?mode=fuzzy (plan 14.f) — số kỳ vọng đo bằng SQL trên seed"
  local by_score='[range(1; length) as $i | (.[$i-1].score > .[$i].score) or (.[$i-1].score == .[$i].score and .[$i-1].id < .[$i].id)] | all'
  req GET "/api/chefs?mode=fuzzy&q=Nguy%E1%BB%85n%20V%C4%83n%20Ann"
  expect "chefs fuzzy \"Nguyễn Văn Ann\" (gõ sai) → 1 người: Nguyễn Văn An, điểm 0.813, kèm chuyên môn + số món" 200 '.data.total == 1 and .data.items[0].name == "Nguyễn Văn An" and .data.items[0].score == 0.813 and (.data.items[0].tags | length) > 0 and .data.items[0].dishCount == 21'
  req GET "/api/chefs?mode=fuzzy&q=Anh%20Lan"
  expect "chefs fuzzy \"Anh Lan\" → 2 người (Lý Anh Lan 0.8, Vũ Anh Lan 0.727), điểm giảm dần" 200 '.data.total == 2 and ([.data.items[].id] == [9, 46])'
  req GET "/api/ingredients?mode=fuzzy&q=T%C3%B4m%20x%C3%BA"
  expect "ingredients fuzzy \"Tôm xú\" → 5 nguyên liệu; Tôm sú, Tôm thẻ cùng 0.4 → id 7 trước 57" 200 ".data.total == 5 and ([.data.items[].id] == [7, 57, 80, 145, 58]) and (.data.items | [.[] | {id, score}] | $by_score) and all(.data.items[]; .score >= 0.3)"
  req GET "/api/ingredients?mode=fuzzy&q=T%C3%B4m%20x%C3%BA&pageSize=2&page=2"
  expect "  …pageSize=2&page=2 → id 80, 145 (LIMIT/OFFSET sau khi xếp điểm), total vẫn 5" 200 '.data.total == 5 and ([.data.items[].id] == [80, 145]) and .data.page == 2'
  req GET "/api/ingredients?mode=fuzzy&q=T%C3%B4m%20x%C3%BA&pageSize=2&page=4"
  expect "  …page=4 (vượt phạm vi) → ok, items [], total 5, page giữ 4" 200 '.ok and .data.items == [] and .data.total == 5 and .data.page == 4'
  req GET "/api/ingredients?mode=fuzzy&q=N%C6%B0%E1%BB%9Bc%20m%E1%BA%AFn"
  expect "ingredients fuzzy \"Nước mắn\" → Nước mắm đứng đầu" 200 '.data.items[0].name == "Nước mắm"'
  req GET "/api/chefs?mode=fuzzy&q=khongconguoinay"
  expect "fuzzy không khớp → ok, items [], total 0" 200 '.ok and .data.items == [] and .data.total == 0'
  local path
  for path in /api/chefs /api/ingredients; do
    req GET "$path?mode=fuzzy"
    expect_code "$path mode=fuzzy không có q → VALIDATION_FAILED fields.q" VALIDATION_FAILED '(.error.fields | keys) == ["q"]'
    req GET "$path?mode=fuzzy&q=%20%20"
    expect_code "$path mode=fuzzy q trắng → VALIDATION_FAILED fields.q (không âm thầm lấy tất cả)" VALIDATION_FAILED '(.error.fields | keys) == ["q"]'
    req GET "$path?mode=fuzzy&q=a&q=b"
    expect_code "$path mode=fuzzy q lặp → VALIDATION_FAILED fields.q" VALIDATION_FAILED '(.error.fields | keys) == ["q"]'
    req GET "$path?mode=fuzzy&q=x&all=true"
    expect_code "$path mode=fuzzy + all=true → VALIDATION_FAILED fields.all" VALIDATION_FAILED '(.error.fields | keys) == ["all"]'
    for bad in abc fulltext advanced; do
      req GET "$path?mode=$bad&q=x"
      expect_code "$path mode=$bad → VALIDATION_FAILED fields.mode" VALIDATION_FAILED '(.error.fields | keys) == ["mode"]'
    done
    req GET "$path?mode=fuzzy&q=x&page=0"
    expect_code "$path mode=fuzzy page=0 → VALIDATION_FAILED fields.page" VALIDATION_FAILED '(.error.fields | keys) == ["page"]'
    req GET "$path?mode=basic"
    expect "$path mode=basic tường minh → như mặc định (id 1–20, không có score)" 200 '([.data.items[].id] == [range(1;21)]) and all(.data.items[]; has("score") | not)'
  done
}

case $PART in
  A) part_a ;;
  B) part_b ;;
  C) part_c ;;
  D) part_d ;;
  E) part_e ;;
  F) part_f ;;
  G) part_g ;;
  H) part_h ;;
  *) part_a; part_b; part_c; part_d; part_e; part_f; part_g; part_h ;;
esac

echo
echo "Tổng: $pass đạt, $fail chưa đạt"
[ "$fail" -eq 0 ]
