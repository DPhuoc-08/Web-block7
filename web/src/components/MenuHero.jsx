import { Link } from "react-router";
import DishImage from "./DishImage.jsx";

// Đầu trang thực đơn (plan mục 13, phương án B của bản phác Figma). Khung tìm (children) luôn nằm trong đầu trang.
// - full: trang 1 chưa có điều kiện → giới thiệu + ảnh ghép.
// - còn lại (đang tìm / lọc / sắp xếp, hoặc page ≥ 2) → thu gọn: tiêu đề nhỏ + khung tìm, kết quả lên gần đầu màn hình.
// Ảnh ghép lấy 3 món CÓ ẢNH đầu tiên trong chính danh sách vừa tải (13.d): không thêm request, không ghi cứng link ảnh.
// Mỗi ảnh là link tới trang chi tiết, nơi có dòng ghi công ảnh (giấy phép CC).
export default function MenuHero({ full, dishes, loading, children }) {
  if (!full) {
    return (
      <section className="menu-hero compact" aria-labelledby="menu-title">
        <h1 id="menu-title">Thực đơn</h1>
        {children}
      </section>
    );
  }
  return (
    <section className="menu-hero" aria-labelledby="menu-title">
      <div className="hero-text">
        {/* Trang khách không hiện số đếm (plan 13.4). Lời giới thiệu chỉ nhắc món có thật trong thực đơn (seed). */}
        <p className="hero-eyebrow">Thực đơn</p>
        <h1 id="menu-title">
          Ăn một bữa,
          <br />
          đi trọn ba miền
        </h1>
        <p className="hero-lead">Bún chả Hà Nội khói than hoa, mì Quảng vàng ươm bánh tráng nướng, cá kho tộ đậm đà miền Tây — mỗi món là một vùng đất trên bàn ăn của bạn.</p>
        {children}
      </div>
      <HeroPhotos dishes={dishes} loading={loading} />
    </section>
  );
}

function HeroPhotos({ dishes, loading }) {
  if (loading) {
    return (
      <div className="hero-photos" aria-hidden="true">
        <span className="sk" />
        <span className="sk" />
        <span className="sk" />
      </div>
    );
  }
  const photos = dishes.filter((d) => d.imageUrl).slice(0, 3);
  if (photos.length < 3) return null;
  return (
    <div className="hero-photos">
      {photos.map((d) => (
        <Link key={d.id} to={`/dishes/${d.id}`} className="hero-photo">
          {/* Link ảnh chết → hình minh hoạ như thẻ món, không hiện ảnh vỡ. */}
          <DishImage className="hero-img" src={d.imageUrl} alt={d.name} tags={d.tags} />
        </Link>
      ))}
    </div>
  );
}
