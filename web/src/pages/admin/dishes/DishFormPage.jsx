import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getDish, createDish, updateDish } from "../../../api/dishes.js";
import { listChefs } from "../../../api/chefs.js";
import { listIngredients, createIngredient } from "../../../api/ingredients.js";
import { listTags } from "../../../api/tags.js";
import { isBusiness } from "../../../api/client.js";
import { useLoad } from "../../../hooks/useLoad.js";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle.js";
import { useFocusFirstError } from "../../../hooks/useFocusFirstError.js";
import { Loading, LoadError, NotFoundMessage } from "../../../components/StatusView.jsx";
import { FieldError, FormAlert, generalMessage } from "../../../components/FormBits.jsx";
import DishImage from "../../../components/DishImage.jsx";
import QuickAdd from "../../../components/QuickAdd.jsx";
import TagPicker from "../../../components/TagPicker.jsx";
import LeaveConfirm from "../../../components/LeaveConfirm.jsx";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges.js";
import { useBackTo, withFlash } from "../../../hooks/useBackTo.js";
import { plain, tagNames } from "../../../format.js";

const INGREDIENT_FIELDS = [
  { key: "name", label: "Tên nguyên liệu", requiredMessage: "Tên nguyên liệu không được để trống." },
  { key: "unit", label: "Đơn vị", placeholder: "Ví dụ: kg, bó" },
];
const createIngredientFrom = (v) => createIngredient({ name: v.name, unit: v.unit.trim() === "" ? null : v.unit });

// Form thêm (/admin/dishes/new) và sửa (/admin/dishes/:id/edit) món.
// Trang tự tải những gì form cần: danh sách tag, đầu bếp, nguyên liệu; khi sửa thì tải thêm món theo id trên URL
// (không lấy giá trị từ trang danh sách).
export default function DishFormPage() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  useDocumentTitle(isEdit ? "Sửa món" : "Thêm món");

  const { status, data, reload } = useLoad(
    (signal) =>
      Promise.all([
        listTags({ signal }),
        listChefs({}, { signal }),
        listIngredients({}, { signal }),
        isEdit ? getDish(id, { signal }) : null,
      ]),
    [id],
  );

  if (status === "loading") return <Loading />;
  if (status === "error") return <LoadError onRetry={reload} />;
  if (status === "notFound") {
    return <NotFoundMessage title="Không tìm thấy món" text="Món cần sửa không tồn tại hoặc đã bị xoá." backTo="/admin/dishes" backLabel="Về danh sách món" />;
  }

  const [tags, chefs, ingredients, dish] = data;
  // key: đổi id thì dựng lại form với giá trị ban đầu mới.
  return <DishForm key={id ?? "new"} id={id} dish={dish} tags={tags} chefs={chefs} ingredients={ingredients} />;
}

// Giá trị form giữ dạng mà ô nhập dùng (giá là chuỗi của ô number, đầu bếp là chuỗi của radio).
function initialValues(dish) {
  if (!dish) {
    return { name: "", price: "", tagIds: [], description: "", imageUrl: "", imageCredit: "", available: true, chefId: "", ingredientIds: [] };
  }
  return {
    name: dish.name,
    price: String(dish.price),
    tagIds: dish.tags.map((t) => t.id),
    description: dish.description ?? "",
    imageUrl: dish.imageUrl ?? "",
    imageCredit: dish.imageCredit ?? "",
    available: dish.available,
    chefId: String(dish.chef.id),
    ingredientIds: dish.ingredients.map((i) => i.id),
  };
}

// Validate kết hợp — SPA chỉ chặn ô BẮT BUỘC bị bỏ trống (để người dùng sửa nhanh, không cần gửi request).
// Định dạng / giá trị (giá âm, giá lẻ, trùng, id không tồn tại...) để API kiểm tra và trả VALIDATION_FAILED.
function checkRequired(v) {
  const errors = {};
  if (!v.name.trim()) errors.name = "Tên món không được để trống.";
  if (v.price.trim() === "") errors.price = "Giá không được để trống.";
  if (v.tagIds.length === 0) errors.tagIds = "Vui lòng chọn ít nhất một tag.";
  if (!v.chefId) errors.chefId = "Vui lòng chọn đầu bếp phụ trách.";
  if (v.ingredientIds.length === 0) errors.ingredientIds = "Vui lòng chọn ít nhất một nguyên liệu.";
  return errors;
}

// JSON giữ kiểu: SPA chuyển giá trị ô nhập sang đúng kiểu API cần (số, boolean, null) trước khi gửi.
const orNull = (s) => (s.trim() === "" ? null : s);
function toBody(v) {
  return {
    name: v.name,
    price: Number(v.price),
    tagIds: v.tagIds,
    description: orNull(v.description),
    imageUrl: orNull(v.imageUrl),
    imageCredit: orNull(v.imageCredit),
    available: v.available,
    chefId: Number(v.chefId),
    ingredientIds: v.ingredientIds,
  };
}

// Đầu bếp phù hợp (có ít nhất một chuyên môn trùng tag đang chọn của món) đưa lên đầu, giữ thứ tự id trong từng nhóm.
// Chỉ là gợi ý: API không bắt buộc đầu bếp đúng chuyên môn (nhóm chốt).
function sortChefs(chefs, tagIds) {
  const fits = (c) => c.tags.some((t) => tagIds.includes(t.id));
  return [...chefs.filter(fits).map((c) => ({ ...c, fits: true })), ...chefs.filter((c) => !fits(c))];
}

const sortedIds = (ids) => [...ids].sort((a, b) => a - b);

function DishForm({ id, dish, tags, chefs, ingredients }) {
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  // Danh sách admin đã mở (giữ ?page=, ?q=) — Huỷ, "← Danh sách món" và lưu xong đều quay về đây.
  const listUrl = useBackTo("/admin/dishes");
  const [initial] = useState(() => initialValues(dish));
  const [values, setValues] = useState(initial);
  // Đã sửa gì chưa: so với giá trị lúc mở form (thứ tự tick nguyên liệu, tag không tính là thay đổi).
  const snapshot = (v) => JSON.stringify({ ...v, ingredientIds: sortedIds(v.ingredientIds), tagIds: sortedIds(v.tagIds) });
  const { blocker, allowLeave } = useUnsavedChanges(snapshot(values) !== snapshot(initial));
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Cờ chặn gửi trùng: ref đổi ngay lập tức, kể cả khi hai lần bấm xảy ra trước lần render kế tiếp
  // (state `submitting` chỉ dùng để hiển thị nút bị khoá).
  const busy = useRef(false);
  const { panelRef, showFirstError } = useFocusFirstError();
  // Ô tìm nguyên liệu chỉ lọc danh sách đã tải khi mở form (không gọi API). Ô đã tick mà bị ẩn vẫn nằm trong
  // values.ingredientIds → vẫn được gửi khi lưu.
  const [ingredientQuery, setIngredientQuery] = useState("");
  // Danh sách nguyên liệu của form: bắt đầu từ dữ liệu đã tải, thêm bản ghi mới khi admin thêm nhanh ngay trong form
  // (state cục bộ của trang, không phải kho dùng chung — trang khác vẫn tự tải từ API).
  const [ingredientList, setIngredientList] = useState(ingredients);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [addedIngredient, setAddedIngredient] = useState(null);
  const shownIngredients = ingredientQuery.trim()
    ? ingredientList.filter((i) => plain(i.name).includes(plain(ingredientQuery.trim())))
    : ingredientList;

  function set(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
    // Sửa ô nào thì bỏ lỗi của ô đó.
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  // Tick / bỏ tick một id trong mảng (nguyên liệu, tag).
  function toggle(field, itemId) {
    set(field, values[field].includes(itemId) ? values[field].filter((x) => x !== itemId) : [...values[field], itemId]);
  }

  // Tag vừa tạo trong TagPicker: tick sẵn. Cập nhật dạng hàm vì trong lúc chờ API admin có thể đã tick ô khác.
  function onTagCreated(tag) {
    setValues((v) => ({ ...v, tagIds: [...v.tagIds, tag.id] }));
    setErrors(({ tagIds: _removed, ...rest }) => rest);
  }

  const chefChoices = sortChefs(chefs, values.tagIds);

  // Nguyên liệu vừa tạo (POST /api/ingredients đã trả về id): thêm vào danh sách và tick sẵn.
  // Cập nhật dạng hàm: trong lúc chờ API, admin có thể đã tick/bỏ tick ô khác — không được ghi đè.
  function onIngredientCreated(created) {
    setIngredientList((list) => [...list, created]);
    setValues((v) => ({ ...v, ingredientIds: [...v.ingredientIds, created.id] }));
    setErrors(({ ingredientIds: _removed, ...rest }) => rest);
    setAddingIngredient(false);
    setIngredientQuery(""); // xoá chữ tìm để thấy nguyên liệu mới (đã tick) trong danh sách
    setAddedIngredient(created.name);
  }

  async function onSubmit(event) {
    // Chặn form HTML tự gửi và tải lại trang (SPA sẽ mất state); SPA tự gửi request tới API.
    event.preventDefault();
    if (busy.current) return;
    setGeneralError(null);

    const missing = checkRequired(values);
    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      showFirstError();
      return;
    }

    // Khoá nút trong lúc chờ: không còn cơ chế nào khác chặn bấm hai lần (→ API nhận hai request, tạo hai món).
    busy.current = true;
    setSubmitting(true);
    try {
      const saved = isEdit ? await updateDish(id, toBody(values)) : await createDish(toBody(values));
      // Ghi thành công → điều hướng phía client về danh sách admin (như đầu bếp, nguyên liệu: admin không rơi
      // ra trang người dùng); danh sách tự tải lại từ API. Không tải lại document. ?msg= → dòng thông báo (bảng FLASH),
      // &id= → danh sách tô dòng vừa lưu.
      allowLeave(); // đã lưu → không hỏi "rời trang khi chưa lưu"
      // Thêm mới → trang 1 của danh sách (món mới nhất lên đầu); sửa → đúng trang đang làm việc.
      navigate(withFlash(isEdit ? listUrl : "/admin/dishes", { msg: isEdit ? "dish-updated" : "dish-created", id: saved.id }));
    } catch (err) {
      if (isBusiness(err, "VALIDATION_FAILED")) {
        // Lỗi theo trường từ API: hiện cạnh từng ô theo khoá của fields; giá trị đã nhập vẫn giữ trong state.
        setErrors(err.fields);
      } else if (isBusiness(err, "NOT_FOUND")) {
        setGeneralError("Món này không còn tồn tại (có thể vừa bị xoá ở nơi khác).");
      } else {
        // Lỗi kỹ thuật / mạng: thông báo chung, không đổi trạng thái form.
        setGeneralError(generalMessage(err));
      }
      showFirstError();
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link className="back" to={listUrl}>
        ← Danh sách món
      </Link>

      <div className="panel form-panel" ref={panelRef}>
        <h1>{isEdit ? "Sửa món" : "Thêm món"}</h1>
        {isEdit && <p className="muted no-margin">Món #{id}</p>}
        <FormAlert fieldErrors={errors} generalError={generalError} />

        {/* noValidate + không đặt required/min: kiểm tra do SPA (ô trống) và API (định dạng) làm, hiện lỗi cùng kiểu. */}
        <form className="form" onSubmit={onSubmit} noValidate>
          <label className={`field${errors.name ? " invalid" : ""}`}>
            <span>Tên món</span>
            <input name="name" value={values.name} onChange={(e) => set("name", e.target.value)} />
            <FieldError message={errors.name} />
          </label>

          <label className={`field${errors.price ? " invalid" : ""}`}>
            <span>Giá (đồng)</span>
            <input name="price" type="number" value={values.price} onChange={(e) => set("price", e.target.value)} placeholder="50000" />
            <FieldError message={errors.price} />
          </label>

          {/* Tag của món (loại món, đặc điểm, vùng miền): tick nhiều → tagIds (API lưu vào dish_tags). */}
          <TagPicker
            legend="Tag"
            tags={tags}
            selected={values.tagIds}
            error={errors.tagIds}
            onToggle={(tagId) => toggle("tagIds", tagId)}
            onCreated={onTagCreated}
          />

          <label className={`field${errors.description ? " invalid" : ""}`}>
            <span>Mô tả</span>
            <textarea name="description" rows="3" value={values.description} onChange={(e) => set("description", e.target.value)} />
            <FieldError message={errors.description} />
          </label>

          {/* Đầu bếp phụ trách: chọn đúng 1 (radio). Gửi id dạng số; API kiểm tra id có thật.
              Đầu bếp có chuyên môn trùng tag đã chọn được đưa lên đầu, kèm nhãn "Đúng chuyên môn". */}
          <fieldset className={`choice-group${errors.chefId ? " invalid" : ""}`}>
            <legend>Đầu bếp phụ trách</legend>
            {errors.chefId && <p className="error">{errors.chefId}</p>}
            {values.tagIds.length === 0 && chefs.length > 0 && <p className="muted choice-summary">Chọn tag của món để thấy đầu bếp đúng chuyên môn ở đầu danh sách.</p>}
            {chefs.length === 0 && (
              <p className="muted">
                Chưa có đầu bếp nào. <Link to="/admin/chefs/new">Thêm đầu bếp</Link> trước khi tạo món.
              </p>
            )}
            <div className="choice-grid">
              {chefChoices.map((c) => (
                <label key={c.id} className="choice">
                  <input type="radio" name="chefId" value={c.id} checked={values.chefId === String(c.id)} onChange={() => set("chefId", String(c.id))} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{tagNames(c.tags)}</small>
                    {c.fits && <small className="fit-label">Đúng chuyên môn</small>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Nguyên liệu: tick nhiều ô → mảng id (API lưu vào bảng dish_ingredients). */}
          <fieldset className={`choice-group${errors.ingredientIds ? " invalid" : ""}`}>
            <legend>
              Nguyên liệu <small className="muted">(chọn ít nhất 1)</small>
            </legend>
            {errors.ingredientIds && <p className="error">{errors.ingredientIds}</p>}
            {ingredientList.length === 0 && (
              <p className="muted">
                Chưa có nguyên liệu nào. <Link to="/admin/ingredients/new">Thêm nguyên liệu</Link> trước khi tạo món.
              </p>
            )}
            <div className="choice-tools">
              {/* Enter trong ô tìm không được gửi form món (ô này nằm trong <form> của món). */}
              {ingredientList.length > 0 && (
                <input
                  type="search"
                  aria-label="Tìm nguyên liệu"
                  placeholder="Tìm nguyên liệu, ví dụ: tôm, hành"
                  value={ingredientQuery}
                  onChange={(e) => setIngredientQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  data-skip-error-focus
                />
              )}
              {/* Nguyên liệu chưa có trong DB → thêm ngay tại đây, không rời form món. */}
              <button
                type="button"
                className="btn"
                onClick={() => (setAddingIngredient(true), setAddedIngredient(null))}
                disabled={addingIngredient}
                aria-expanded={addingIngredient}
              >
                + Thêm nguyên liệu
              </button>
            </div>
            {addingIngredient && (
              // Tên lấy sẵn từ ô tìm (thường admin vừa tìm không thấy).
              <QuickAdd
                title="Thêm nguyên liệu mới"
                fields={INGREDIENT_FIELDS}
                initialValues={{ name: ingredientQuery.trim() }}
                create={createIngredientFrom}
                onCreated={onIngredientCreated}
                onCancel={() => setAddingIngredient(false)}
              />
            )}
            {addedIngredient && (
              <p className="choice-added" role="status">
                Đã thêm và chọn nguyên liệu “{addedIngredient}”.
              </p>
            )}
            {ingredientList.length > 0 && (
              <p className="muted choice-summary" role="status">
                Đã chọn {values.ingredientIds.length} nguyên liệu
                {ingredientQuery.trim() && ` · đang hiện ${shownIngredients.length}/${ingredientList.length}`}
              </p>
            )}
            {ingredientQuery.trim() && shownIngredients.length === 0 && <p className="muted">Không có nguyên liệu nào khớp “{ingredientQuery.trim()}”.</p>}
            <div className="choice-grid compact">
              {shownIngredients.map((i) => (
                <label key={i.id} className="choice">
                  <input type="checkbox" name="ingredientIds" value={i.id} checked={values.ingredientIds.includes(i.id)} onChange={() => toggle("ingredientIds", i.id)} />
                  <span>
                    {i.name}
                    {i.unit && <small> {i.unit}</small>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Định dạng link (chỉ http/https) do API kiểm tra → lỗi hiện ở đây nếu sai. */}
          <label className={`field${errors.imageUrl ? " invalid" : ""}`}>
            <span>Link ảnh minh hoạ</span>
            <input name="imageUrl" value={values.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://upload.wikimedia.org/..." />
            <span className="hint">Dán link trực tiếp tới file ảnh (nên dùng ảnh có giấy phép mở, vd. Wikimedia Commons).</span>
            <FieldError message={errors.imageUrl} />
          </label>
          {/^https?:\/\//i.test(values.imageUrl.trim()) && !errors.imageUrl && (
            <DishImage className="image-preview" src={values.imageUrl.trim()} alt="Ảnh xem trước của món" emptyText="Không tải được ảnh từ link này" />
          )}

          <label className={`field${errors.imageCredit ? " invalid" : ""}`}>
            <span>Ghi công ảnh</span>
            <input name="imageCredit" value={values.imageCredit} onChange={(e) => set("imageCredit", e.target.value)} placeholder="Tác giả · Giấy phép · Nguồn" />
            <FieldError message={errors.imageCredit} />
          </label>

          <label className="field inline">
            <input name="available" type="checkbox" checked={values.available} onChange={(e) => set("available", e.target.checked)} />
            <span>Đang phục vụ</span>
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : isEdit ? "Lưu" : "Thêm"}
            </button>
            <Link className="btn" to={listUrl}>
              Huỷ
            </Link>
          </div>
        </form>
      </div>
      <LeaveConfirm blocker={blocker} />
    </>
  );
}
