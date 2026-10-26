#!/usr/bin/env bash
# Bộ request nghiệm thu API (chạy lại được). Cần: curl, jq; API đang chạy.
#   ./scripts/check-api.sh            → chạy tất cả
#   ./scripts/check-api.sh A          → chỉ phần A (đúng bảng REST của đề)
#   ./scripts/check-api.sh B          → chỉ phần B (mở rộng do giữ quan hệ / block5)
#   ./scripts/check-api.sh E          → chỉ phần E (tag của món và chuyên môn đầu bếp — block7)
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
  expect "Danh sách → 200, ok, data là mảng" 200 '.ok == true and (.data | type == "array") and (.data | length > 0)'
  local total
  total=$(jq '.data | length' <<<"$BODY")
  req GET "/api/dishes?q=PH%E1%BB%9E"
  expect "?q=PHỞ → tìm theo tên, không phân biệt hoa thường" 200 '.ok and (.data | length >= 1) and all(.data[]; .name | ascii_downcase | test("phở"; "i"))'
  req GET "/api/dishes?q=khongcomonnay"
  expect "?q= không khớp → ok, data = []" 200 '.ok == true and .data == []'
  req GET "/api/dishes?q=a&q=b"
  expect "?q=a&q=b (mảng) → bỏ qua, trả đủ $total món" 200 ".ok and (.data | length == $total)"

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
  expect "Danh sách → 200, ok, mảng, mỗi phần tử có dishCount" 200 '.ok and (.data | type == "array") and (.data | length > 0) and all(.data[]; .dishCount | type == "number")'
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
  req GET /api/dishes
  local total
  total=$(jq '.data | length' <<<"$BODY")

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

  echo "== B. Món ăn: bộ lọc thực đơn, tìm kiếm admin (searchIn)"
  req GET "/api/dishes?tag=2"
  expect "?tag=2 (Món nước) → chỉ món có tag Món nước" 200 '.ok and (.data | length > 0) and all(.data[]; any(.tags[]; .id == 2))'
  req GET "/api/dishes?tag=9"
  expect "?tag=9 (Lẩu, chưa có món) → []" 200 '.ok and .data == []'
  req GET "/api/dishes?tag=abc"
  expect "?tag=abc (sai định dạng) → bỏ qua, trả đủ" 200 "(.data | length == $total)"
  req GET "/api/dishes?price=duoi-40k"
  expect "?price=duoi-40k → giá < 40000" 200 '(.data | length > 0) and all(.data[]; .price < 40000)'
  req GET "/api/dishes?price=40k-60k&sort=gia-tang"
  expect "?price=40k-60k&sort=gia-tang → 40000–60000, giá tăng dần" 200 '(.data | length > 0) and all(.data[]; .price >= 40000 and .price <= 60000) and ([.data[].price] == ([.data[].price] | sort))'
  req GET "/api/dishes?sort=gia-giam"
  expect "?sort=gia-giam → giá giảm dần" 200 '[.data[].price] == ([.data[].price] | sort | reverse)'
  req GET "/api/dishes?available=1"
  expect "?available=1 → chỉ món còn phục vụ" 200 '(.data | length > 0) and all(.data[]; .available == true)'
  req GET "/api/dishes?price=abc&sort=xyz&available=yes"
  expect "Tham số lọc sai → bỏ qua, trả đủ, thứ tự id" 200 "(.data | length == $total) and ([.data[].id] == ([.data[].id] | sort))"
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc"
  expect '?q=món nước (mặc định chỉ tìm tên) → []' 200 '.data == []'
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc&searchIn=name,tag"
  expect '?q=món nước&searchIn=name,tag → tìm cả tên tag' 200 '(.data | length > 0) and all(.data[]; any(.tags[]; .name == "Món nước"))'
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc&searchIn=description,xyz"
  expect 'searchIn lạ → bỏ qua, chỉ tìm tên → []' 200 '.data == []'

  echo "== B. Tìm kiếm admin: đầu bếp (tên, chuyên môn), nguyên liệu (tên, đơn vị)"
  req GET "/api/chefs?q=TR%C3%81NG%20MI%E1%BB%86NG"
  expect '/api/chefs?q=TRÁNG MIỆNG → khớp tên chuyên môn (tag)' 200 '(.data | length >= 1) and all(.data[]; any(.tags[]; .name == "Tráng miệng"))'
  req GET "/api/chefs?q=mai"
  expect '/api/chefs?q=mai → khớp tên' 200 '(.data | length >= 1) and all(.data[]; .name | test("mai"; "i"))'
  req GET "/api/ingredients?q=l%C3%ADt"
  expect '/api/ingredients?q=lít → khớp đơn vị' 200 '(.data | length >= 1) and all(.data[]; .unit == "lít")'
  req GET /api/ingredients
  local ing_total
  ing_total=$(jq '.data | length' <<<"$BODY")
  req GET "/api/ingredients?q=a&q=b"
  expect "/api/ingredients?q=a&q=b (mảng) → bỏ qua, trả đủ $ing_total" 200 "(.data | length == $ing_total)"

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

part_e() {
  local stamp
  stamp=$(date +%s)

  echo "== E. Tag: /api/tags (chỉ đọc danh sách + thêm, không sửa/xoá)"
  req GET /api/tags
  expect "Danh sách → mảng tag, mỗi tag có dishCount, chefCount" 200 '.ok and (.data | length >= 16) and all(.data[]; (.dishCount | type == "number") and (.chefCount | type == "number"))'
  expect "  …có tag chưa món nào dùng (Lẩu: dishCount 0)" 200 'any(.data[]; .name == "Lẩu" and .dishCount == 0)'
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
  req GET "/api/dishes?tag=16"
  expect "  …lọc ?tag=16 thấy món vừa sửa" 200 "any(.data[]; .id == $dish)"
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
  req GET "/api/chefs?q=m%C3%B3n%20chay"
  expect "/api/chefs?q=món chay → thấy đầu bếp vừa đổi chuyên môn" 200 "any(.data[]; .id == $chef)"
  req DELETE "/api/chefs/$chef"
  expect "Xoá đầu bếp 0 món → ok (chuyên môn tự xoá theo Cascade)" 200 '.ok == true'
}

case $PART in
  A) part_a ;;
  B) part_b ;;
  E) part_e ;;
  *) part_a; part_b; part_e ;;
esac

echo
echo "Tổng: $pass đạt, $fail chưa đạt"
[ "$fail" -eq 0 ]
