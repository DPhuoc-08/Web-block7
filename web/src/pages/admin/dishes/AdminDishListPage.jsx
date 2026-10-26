import { Link, useSearchParams } from "react-router";
import AdminSearch from "../../../components/AdminSearch.jsx";
import { listDishes } from "../../../api/dishes.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { Loading, LoadError } from "../../../components/StatusView.jsx";
import AdminNav from "../../../components/AdminNav.jsx";
import { useJustSaved } from "../../../hooks/useJustSaved.js";
import { formatPrice } from "../../../format.js";
import DishImage from "../../../components/DishImage.jsx";

// Danh sách quản trị món (/admin/dishes). Tự tải mỗi lần mở → sau khi thêm/sửa/xoá quay lại luôn thấy dữ liệu mới.
export default function AdminDishListPage() {
  useDocumentTitle("Quản trị món ăn");
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  // Admin tìm cả tên và loại (như admin block5); trang người dùng chỉ tìm theo tên.
  const { status, data: dishes, reload } = useLoad((signal) => listDishes({ q, searchIn: q ? "name,category" : "" }, { signal }), [q]);
  const { savedId, savedRowRef } = useJustSaved();

  return (
    <>
      <AdminNav current="dishes" />
      <div className="toolbar">
        <h1>Món ăn</h1>
        <Link className="btn btn-primary" to="/admin/dishes/new">
          + Thêm món
        </Link>
      </div>

      <AdminSearch label="Tìm món" placeholder="Tìm theo tên hoặc loại món" count={status === "ok" ? dishes.length : null} />

      {status === "loading" && <Loading />}
      {status === "error" && <LoadError onRetry={reload} />}
      {status === "ok" && dishes.length === 0 && <div className="panel empty">{q ? "Không có món nào khớp từ khoá." : "Chưa có món nào."}</div>}
      {status === "ok" && dishes.length > 0 && (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Ảnh</th>
                <th>Tên</th>
                <th>Giá</th>
                <th>Loại</th>
                <th>Đầu bếp</th>
                <th>Tình trạng</th>
                <th>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d) => (
                <tr key={d.id} className={d.id === savedId ? "just-saved" : undefined} ref={d.id === savedId ? savedRowRef : undefined}>
                  {/* data-label: nhãn cột hiện trên điện thoại khi bảng chuyển thành thẻ (xem style.css). */}
                  <td className="num" data-label="Mã">
                    {d.id}
                  </td>
                  <td className="thumb" data-label="Ảnh">
                    <DishImage className="table-thumb" src={d.imageUrl} loading="lazy" emptyText="—" />
                  </td>
                  {/* Tên món mở form sửa: admin ở lại khu Quản trị (trước đây dẫn ra trang người dùng). */}
                  <td className="title" data-label="Tên">
                    <Link to={`/admin/dishes/${d.id}/edit`}>{d.name}</Link>
                  </td>
                  <td data-label="Giá">{formatPrice(d.price)}</td>
                  <td data-label="Loại">{d.category ?? "—"}</td>
                  <td data-label="Đầu bếp">{d.chef.name}</td>
                  <td data-label="Tình trạng">
                    <span className={`badge ${d.available ? "on" : "off"}`}>{d.available ? "Đang phục vụ" : "Tạm hết"}</span>
                  </td>
                  {/* Hai link chỉ mở trang (form sửa, trang xác nhận xoá); không link nào tự ghi dữ liệu. */}
                  <td className="actions">
                    <Link className="btn btn-sm" to={`/admin/dishes/${d.id}/edit`}>
                      Sửa
                    </Link>
                    <Link className="btn btn-sm danger-text" to={`/admin/dishes/${d.id}/delete`}>
                      Xoá
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
