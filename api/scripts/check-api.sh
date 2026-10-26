#!/usr/bin/env bash
# Bộ request nghiệm thu API (chạy lại được). Cần: curl, jq; API đang chạy.
#   ./scripts/check-api.sh            → chạy tất cả
#   ./scripts/check-api.sh A          → chỉ phần A (đúng bảng REST của đề)
#   ./scripts/check-api.sh B          → chỉ phần B (mở rộng do giữ quan hệ / block5)
# Kiểm tra 500 (mất kết nối DB): chạy thêm một API với DATABASE_URL sai ở cổng khác rồi đặt
#   API_BROKEN=http://localhost:3001 ./scripts/check-api.sh A
# Script tự tạo rồi tự xoá bản ghi test; vẫn nên `npx prisma db seed` sau khi test (DB dùng chung với block5).

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
  expect "Chi tiết /1 → bản ghi kèm chef + ingredients" 200 '.ok and .data.id == 1 and (.data.chef.name | type == "string") and (.data.ingredients | length > 0)'
  for bad in 999999 abc 2.5 0 -1 99999999999; do
    req GET "/api/dishes/$bad"
    expect_code "Chi tiết /$bad → NOT_FOUND" NOT_FOUND
  done

  req POST /api/dishes '{"name":"  Món test API  ","price":45000,"category":"Món nước","chefId":1,"ingredientIds":[1,2,2],"id":999999,"createdAt":"2000-01-01T00:00:00Z"}'
  expect "Thêm hợp lệ → bản ghi vừa tạo, tên đã trim, nguyên liệu bỏ trùng, available mặc định true" 200 '.ok and .data.name == "Món test API" and .data.id != 999999 and (.data.ingredients | length == 2) and .data.available == true'
  local new_id
  new_id=$(jq '.data.id' <<<"$BODY")
  expect "Trường lạ (id, createdAt) bị bỏ qua" 200 '.data.createdAt != "2000-01-01T00:00:00.000Z"'

  req POST /api/dishes '{"name":"","price":-5,"category":"Món nước","chefId":1,"ingredientIds":[1]}'
  expect_code "Thêm: tên rỗng, giá âm → VALIDATION_FAILED kèm fields.name, fields.price" VALIDATION_FAILED '(.error.fields | has("name") and has("price"))'
  req POST /api/dishes '{"name":"X","price":"50000","category":"Món nước","chefId":1,"ingredientIds":[1]}'
  expect_code 'Thêm: price là chuỗi "50000" → VALIDATION_FAILED (JSON giữ kiểu)' VALIDATION_FAILED '(.error.fields | keys == ["price"])'
  req POST /api/dishes '{"name":"X","price":1.5,"category":"Món nước","chefId":1,"ingredientIds":[1]}'
  expect_code "Thêm: price 1.5 → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | keys == ["price"])'
  req POST /api/dishes '{}'
  expect_code "Thêm: body {} → VALIDATION_FAILED đủ 5 trường bắt buộc" VALIDATION_FAILED '(.error.fields | keys | sort) == (["category","chefId","ingredientIds","name","price"] | sort)'
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

  simple_resource /api/chefs "Đầu bếp" specialty
  simple_resource /api/ingredients "Nguyên liệu" unit
}

# Phần A cho đầu bếp / nguyên liệu (cùng khuôn): 5 dòng bảng REST, xoá bằng bản ghi vừa tạo (không bị chặn).
simple_resource() {
  local path=$1 label=$2 extra=$3
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
  req POST "$path" "{\"name\":\" $label test $stamp \",\"$extra\":\"Thử\",\"id\":999999}"
  expect "Thêm hợp lệ → bản ghi vừa tạo, tên đã trim, bỏ trường lạ id" 200 ".ok and .data.name == \"$label test $stamp\" and .data.$extra == \"Thử\" and .data.id != 999999"
  local id
  id=$(jq '.data.id' <<<"$BODY")
  req POST "$path" '{"name":""}'
  expect_code "Thêm: tên rỗng → VALIDATION_FAILED fields.name" VALIDATION_FAILED '(.error.fields | has("name"))'
  req POST "$path" '{}'
  expect_code "Thêm: body {} → VALIDATION_FAILED fields.name" VALIDATION_FAILED '(.error.fields | keys) == ["name"]'
  req POST "$path" '{"name":123}'
  expect_code "Thêm: tên là số → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | has("name"))'
  req POST "$path" '{"name":'
  expect_tech "Thêm: JSON hỏng → 400" 400

  req PATCH "$path/$id" "{\"$extra\":\"\"}"
  expect "Sửa: chỉ gửi $extra rỗng → lưu null, tên giữ nguyên" 200 ".ok and .data.$extra == null and .data.name == \"$label test $stamp\""
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
  req POST /api/dishes '{"name":"X","price":1000,"category":"Lẩu","chefId":9999,"ingredientIds":[9999],"available":"yes"}'
  expect_code "Thêm: loại ngoài danh sách, chefId/ingredientId không tồn tại, available sai kiểu → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | has("category") and has("available"))'
  req POST /api/dishes '{"name":"X","price":1000,"category":"Món nước","chefId":9999,"ingredientIds":[9999]}'
  expect_code "Thêm: chefId, ingredientIds không tồn tại → VALIDATION_FAILED đúng 2 trường" VALIDATION_FAILED '(.error.fields | keys | sort) == ["chefId","ingredientIds"]'
  req POST /api/dishes '{"name":"X","price":1000,"category":"Món nước","chefId":"1","ingredientIds":["1"]}'
  expect_code 'Thêm: chefId "1", ingredientIds ["1"] (chuỗi) → VALIDATION_FAILED' VALIDATION_FAILED '(.error.fields | keys | sort) == ["chefId","ingredientIds"]'
  req POST /api/dishes '{"name":"X","price":1000,"category":"Món nước","chefId":1,"ingredientIds":[]}'
  expect_code "Thêm: ingredientIds rỗng → VALIDATION_FAILED" VALIDATION_FAILED '(.error.fields | keys) == ["ingredientIds"]'

  req POST /api/dishes '{"name":"Món test quan hệ","price":30000,"category":"Khai vị","chefId":1,"ingredientIds":[1,2]}'
  local id
  id=$(jq '.data.id' <<<"$BODY")
  req PATCH "/api/dishes/$id" '{"chefId":2,"ingredientIds":[3]}'
  expect "Sửa: đổi đầu bếp, thay toàn bộ nguyên liệu" 200 '.ok and .data.chef.id == 2 and ([.data.ingredients[].id] == [3])'
  req PATCH "/api/dishes/$id" '{"ingredientIds":[3,9999]}'
  expect_code "Sửa: nguyên liệu không tồn tại → VALIDATION_FAILED, liên kết cũ giữ nguyên" VALIDATION_FAILED
  req GET "/api/dishes/$id"
  expect "  …liên kết vẫn là [3]" 200 '[.data.ingredients[].id] == [3]'
  req DELETE "/api/dishes/$id" >/dev/null

  req GET /api/categories
  expect "GET /api/categories → all (7 loại cố định) + used (loại đang có món)" 200 '.ok and (.data.all | length == 7) and (.data.used | type == "array")'

  echo "== B. Món ăn: bộ lọc thực đơn, tìm kiếm admin (searchIn)"
  req GET "/api/dishes?category=M%C3%B3n%20n%C6%B0%E1%BB%9Bc"
  expect "?category=Món nước → chỉ món nước" 200 '.ok and (.data | length > 0) and all(.data[]; .category == "Món nước")'
  req GET "/api/dishes?category=L%E1%BA%A9u"
  expect "?category=Lẩu (không có món) → bỏ qua, trả đủ" 200 "(.data | length == $total)"
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
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc&searchIn=name,category"
  expect '?q=món nước&searchIn=name,category → tìm cả loại' 200 '(.data | length > 0) and all(.data[]; .category == "Món nước")'
  req GET "/api/dishes?q=m%C3%B3n%20n%C6%B0%E1%BB%9Bc&searchIn=description,xyz"
  expect 'searchIn lạ → bỏ qua, chỉ tìm tên → []' 200 '.data == []'

  echo "== B. Tìm kiếm admin: đầu bếp (tên, chuyên môn), nguyên liệu (tên, đơn vị)"
  req GET "/api/chefs?q=TR%C3%81NG%20MI%E1%BB%86NG"
  expect '/api/chefs?q=TRÁNG MIỆNG → khớp chuyên môn' 200 '(.data | length == 1) and .data[0].specialty == "Tráng miệng"'
  req GET "/api/chefs?q=mai"
  expect '/api/chefs?q=mai → khớp tên' 200 '(.data | length >= 1) and all(.data[]; .name | test("mai"; "i"))'
  req GET "/api/ingredients?q=l%C3%ADt"
  expect '/api/ingredients?q=lít → khớp đơn vị' 200 '(.data | length >= 1) and all(.data[]; .unit == "lít")'
  req GET "/api/ingredients?q=a&q=b"
  expect '/api/ingredients?q=a&q=b (mảng) → bỏ qua, trả đủ' 200 '(.data | length == 30)'

  echo "== B. Món ăn: ảnh minh hoạ (imageUrl, imageCredit)"
  local base='"name":"Món ảnh","price":1000,"category":"Khai vị","chefId":1,"ingredientIds":[1]'
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
  req POST /api/chefs '{"name":"nguyễn văn an"}'
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

  req POST /api/chefs "{\"name\":\"Bếp nguồn $stamp\"}"
  local from
  from=$(jq '.data.id' <<<"$BODY")
  req POST /api/chefs "{\"name\":\"Bếp nhận $stamp\"}"
  local to
  to=$(jq '.data.id' <<<"$BODY")
  req POST /api/dishes "{\"name\":\"Món chuyển $stamp\",\"price\":10000,\"category\":\"Khai vị\",\"chefId\":$from,\"ingredientIds\":[1]}"
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
  req POST /api/dishes "{\"name\":\"Món dùng tạm $stamp\",\"price\":10000,\"category\":\"Khai vị\",\"chefId\":1,\"ingredientIds\":[$ing]}"
  dish=$(jq '.data.id' <<<"$BODY")
  req DELETE "/api/ingredients/$ing"
  expect_code "Xoá nguyên liệu vừa được món dùng → IN_USE" IN_USE "([.error.dishes[].id] == [$dish])"
  req DELETE "/api/dishes/$dish" >/dev/null
  req DELETE "/api/ingredients/$ing"
  expect "Xoá món dùng nó rồi xoá lại → ok" 200 '.ok == true and .data == null'
}

case $PART in
  A) part_a ;;
  B) part_b ;;
  *) part_a; part_b ;;
esac

echo
echo "Tổng: $pass đạt, $fail chưa đạt"
[ "$fail" -eq 0 ]
