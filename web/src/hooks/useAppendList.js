import { useCallback, useEffect, useRef, useState } from "react";

const EMPTY = { key: undefined, items: [], total: null, end: false, pending: false, error: null };

// Danh sách NỐI THÊM từng trang — dùng chung cho "Tải thêm" và "Cuộn vô hạn" (plan mục 6.2).
// - loadPage(page, signal) → Promise<{ items, total, page, pageSize }> (một trang của GET /api/dishes).
// - key: bộ điều kiện (từ khoá, lọc, sắp xếp). Đổi key → huỷ request cũ, xoá danh sách, tải lại từ trang 1.
//
// Quy tắc (hợp đồng block7 trong CLAUDE.md):
// - loadNext() thoát ngay khi đang tải hoặc đã hết. Cờ "đang tải" là REF đặt đồng bộ TRƯỚC khi gửi: bấm nhanh hai lần
//   hay IntersectionObserver gọi liên tiếp trước lần render kế tiếp vẫn chỉ gửi một request cho một trang.
// - Chỉ nối items + tăng nextPage khi response hợp lệ VÀ còn thuộc bộ điều kiện hiện tại (so "thế hệ" của lần reset).
// - Lỗi → giữ nguyên nextPage và danh sách đã có, hiện lỗi; gọi lại loadNext() sẽ tải đúng trang chưa nhận.
// - end tính từ metadata của response vừa nhận: page * pageSize >= total, hoặc items rỗng (phòng dữ liệu thay đổi).
export function useAppendList(loadPage, key) {
  const [state, setState] = useState(EMPTY);
  const pending = useRef(false);
  const nextPage = useRef(1);
  const end = useRef(false);
  const generation = useRef(0); // tăng mỗi lần reset; response mang thế hệ cũ bị bỏ
  const controller = useRef(null);
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  const loadNext = useCallback(async () => {
    if (pending.current || end.current) return;
    pending.current = true;
    const gen = generation.current;
    const page = nextPage.current;
    const ctrl = new AbortController();
    controller.current = ctrl;
    setState((s) => ({ ...s, pending: true, error: null }));
    try {
      const data = await loadPageRef.current(page, ctrl.signal);
      if (gen !== generation.current) return; // điều kiện đã đổi trong lúc chờ → response cũ, không nối
      nextPage.current = page + 1;
      end.current = data.page * data.pageSize >= data.total || data.items.length === 0;
      setState((s) => ({ ...s, items: [...s.items, ...data.items], total: data.total, end: end.current, pending: false, error: null }));
    } catch (error) {
      if (ctrl.signal.aborted || gen !== generation.current) return;
      setState((s) => ({ ...s, pending: false, error })); // giữ danh sách; nextPage không đổi → "Thử lại" tải đúng trang này
    } finally {
      if (gen === generation.current) pending.current = false;
    }
  }, []);

  // Đổi bộ điều kiện → reset và tải trang 1. Cleanup huỷ request đang chạy (cả khi rời trang).
  // React StrictMode (dev) chạy effect hai lần: lần đầu bị huỷ ở cleanup, lần sau tải thật → không nối trùng.
  useEffect(() => {
    generation.current += 1;
    pending.current = false;
    nextPage.current = 1;
    end.current = false;
    setState({ ...EMPTY, key });
    loadNext();
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [key, loadNext]);

  // Kết quả của bộ điều kiện cũ không bao giờ được hiện cho bộ điều kiện mới: render đầu tiên sau khi URL đổi
  // (trước khi effect reset kịp chạy) đã thấy "đang tải" thay vì danh sách cũ — như useLoad của block6.
  const current = state.key === key ? state : { ...EMPTY, pending: true };
  return { ...current, loadNext };
}
