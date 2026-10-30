import { useId, useState } from "react";
import { plain } from "../format.js";

const MAX_SUGGESTIONS = 8;

// Chọn bản ghi bằng ô gõ có gợi ý (combobox) + chip "đã chọn" — dùng cho nguyên liệu (chọn nhiều) và đầu bếp
// (chọn một) trong form món (plan mục 16; trước là lưới 250 ô tick và lưới 60 radio, form cao ~7.000px).
// Chỉ lọc danh sách đã tải khi mở form, không gọi API. So khớp bỏ dấu, không phân biệt hoa thường ("tom" → "Tôm sú").
// - Gõ → tối đa 8 gợi ý chưa chọn theo đúng thứ tự `items` (đầu bếp đúng chuyên môn đã được xếp lên đầu);
//   showOnEmpty: bấm vào ô trống cũng hiện gợi ý (đầu bếp — 60 người, gợi ý đầu là người đúng chuyên môn).
// - Gợi ý đầu tiên được tô sẵn: gõ rồi Enter là chọn ngay; ↑/↓ di chuyển, Enter chọn, Esc đóng, bấm chuột cũng chọn được; Enter trong ô này KHÔNG gửi form món.
// - Ô trống + Backspace → bỏ chip cuối.
// - single: chỉ một lựa chọn — chọn người khác là THAY (onAdd nhận id mới, form tự thay giá trị cũ).
// - Không có tên trùng khớp → mục cuối "+ Thêm {noun} mới “…”" gọi onAddNew(tên) (form mở khung thêm nhanh).
// - items: [{ id, name, ... }] · selected: mảng id · meta(item): chữ phụ cạnh tên (đơn vị, chuyên môn).
export default function ComboPicker({ noun, items, selected, onAdd, onRemove, onAddNew, meta = () => null, placeholder, single = false, showOnEmpty = false }) {
  const listId = useId();
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = query.trim();
  const byId = new Map(items.map((i) => [i.id, i]));

  const candidates = items.filter((i) => !selected.includes(i.id));
  const matches = (q ? candidates.filter((i) => plain(i.name).includes(plain(q))) : showOnEmpty ? candidates : []).slice(0, MAX_SUGGESTIONS);
  // Đã có đúng tên này (kể cả bản ghi đã chọn) → không mời "thêm mới" (API cũng chặn trùng tên).
  const exact = q && items.some((i) => plain(i.name) === plain(q));
  const options = [...matches.map((i) => ({ type: "pick", item: i })), ...(q && !exact && onAddNew ? [{ type: "new" }] : [])];
  const expanded = open && options.length > 0;
  const current = Math.min(active, Math.max(options.length - 1, 0));

  function choose(option) {
    if (!option) return;
    if (option.type === "pick") {
      onAdd(option.item.id);
      setQuery("");
      setActive(0);
      if (single) setOpen(false);
    } else {
      onAddNew(q);
      setQuery(""); // tên đã chuyển sang khung thêm nhanh → ô gõ trống, gõ tiếp không bị nối vào chữ cũ
      setOpen(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault(); // không gửi form món
      if (expanded) choose(options[current]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(current + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      onRemove(selected[selected.length - 1]);
    }
  }

  return (
    <div className="picker">
      {selected.length > 0 && (
        <ul className="chip-list" aria-label={`${Noun} đã chọn`}>
          {selected.map((id) => {
            const item = byId.get(id);
            const extra = item && meta(item);
            return (
              <li key={id} className="chip">
                <span>{item ? item.name : `#${id}`}</span>
                {extra && <small className="chip-meta">{extra}</small>}
                <button type="button" className="chip-remove" aria-label={`Bỏ ${item?.name ?? id}`} onClick={() => onRemove(id)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="combo">
        <input
          type="text"
          role="combobox"
          aria-label={single && selected.length ? `Đổi ${noun}` : `Tìm và chọn ${noun}`}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? `${listId}-${current}` : undefined}
          autoComplete="off"
          placeholder={single && selected.length ? `Gõ để đổi ${noun}` : placeholder}
          value={query}
          onChange={(e) => (setQuery(e.target.value), setOpen(true), setActive(0))}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {expanded && (
          <ul className="combo-list" id={listId} role="listbox" aria-label={`Gợi ý ${noun}`}>
            {options.map((o, i) => (
              <li
                key={o.type === "pick" ? o.item.id : "new"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                className={`combo-option${i === current ? " active" : ""}${o.type === "new" ? " new" : ""}`}
                // mousedown + preventDefault: chọn trước khi ô mất focus (blur sẽ đóng danh sách).
                onMouseDown={(e) => (e.preventDefault(), choose(o))}
                onMouseEnter={() => setActive(i)}
              >
                {o.type === "pick" ? (
                  <>
                    {o.item.name}
                    {meta(o.item) && <small>{meta(o.item)}</small>}
                  </>
                ) : (
                  <>
                    + Thêm {noun} mới “{q}”
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
