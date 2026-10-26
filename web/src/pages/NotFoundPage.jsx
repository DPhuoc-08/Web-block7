import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { NotFoundMessage } from "../components/StatusView.jsx";

// URL không khớp route nào của SPA (vd. /abc). Server vẫn trả index.html với status 200 (fallback),
// nên chính SPA phải tự hiện trang "không tìm thấy".
export default function NotFoundPage() {
  useDocumentTitle("Không tìm thấy");
  return <NotFoundMessage />;
}
