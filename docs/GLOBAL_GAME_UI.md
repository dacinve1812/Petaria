# Global Game UI — CSS & modal dùng chung

Tài liệu tổng hợp **class global** có thể tái sử dụng trên nhiều màn (modal, panel, form).  
Style nằm trong **`src/styles/global.css`**; biến màu trong **`src/styles/variables.css`**.

Liên quan: **[GLOBAL_ITEM_MODAL_CSS.md](./GLOBAL_ITEM_MODAL_CSS.md)** — modal vật phẩm (`inventory-item-modal-*`).

---

## 1. Nút trợ giúp `?` — popover khi click

**Component (khuyến nghị):** `src/components/ui/ModalHelpIconButton.js`  
- **Click** nút `?` → mở box (`modal-help-icon-popover`) qua **`createPortal` → `document.body`** + **`position: fixed`** (căn theo nút, mặc định phía trên; thiếu chỗ thì lật xuống dưới).  
- **Ngang:** tâm popover được **kẹp trong viewport** (`clampPopoverCenterX`); **`width < 768px`** dùng margin 14px để box không bị cắt khi nút nằm sát phải.  
- **Không** cần `overflow: visible` trên `.inventory-item-modal` → **giữ `border-radius`**.  
- **Click ra ngoài** / **Escape** → đóng.

**CSS (`global.css`):**

| Class | Vai trò |
|--------|---------|
| **`modal-help-icon-btn-wrap`** | Bọc nút + popover; `position: relative`. |
| **`modal-help-icon-btn-wrap.modal-help-icon-btn--section-end`** | Căn **phải + giữa dọc** trong cha có `position: relative`. |
| **`modal-help-icon-btn`** | Nút tròn 22×22px, `cursor: pointer`. |
| **`modal-help-icon-popover`** | Box phía trên nút (`bottom: calc(100% + 8px)`). |

### Ví dụ JSX (Popover)

```jsx
import ModalHelpIconButton from './ui/ModalHelpIconButton';

<div className="my-section-bar" style={{ position: 'relative' }}>
  <span>Tiêu đề section</span>
  <ModalHelpIconButton
    sectionEnd
    ariaLabel="Giải thích section"
    infoText="Nội dung hiển thị trong box phía trên nút ?."
  />
</div>
```

Props: `sectionEnd`, `infoText` (string), `infoContent` (node, thay cho text), `ariaLabel`, `className`.

### Chỉ style nút (không popover)

Có thể dùng thuần `<button className="modal-help-icon-btn">` nếu không cần hành vi popover.

### Ghi chú a11y

- Truyền **`ariaLabel`** cho `ModalHelpIconButton`.
- Nút có `aria-expanded`; popover `role="dialog"`.
- **`:focus-visible`** trên nút dùng `--color-primary`.

---

## 2. Modal linh thú (Spirit) — tái dùng layout item modal

**Component:** `src/components/spirit/SpiritDetailModal.js`

**Ý tưởng:** Cùng **overlay / header / footer** với modal vật phẩm (`inventory-item-modal-overlay`, `inventory-item-modal`, `inventory-item-modal-header`, `inventory-item-modal-body`, `inventory-item-modal-footer`), palette `--color-modal-header` / `--color-bg`.

### Class theo nhóm (prefix `spirit-detail-`)

| Nhóm | Class | Mô tả ngắn |
|------|--------|------------|
| Khung | `spirit-detail-modal` + `spirit-detail-modal--dark` | Modifier trên `inventory-item-modal` (max-width, …). |
| Header | `spirit-detail-modal__header`, `spirit-detail-modal__spirit-img`, `spirit-detail-modal__rarity` | Ảnh spirit, tên, độ hiếm, mô tả header. |
| Mô tả header | `spirit-detail-modal-header-description` (+ `--empty`) | Đoạn mô tả dưới độ hiếm. |
| Pet đang mặc | `spirit-detail-equipped-line` | “Đang trang bị cho: …” (MyHome). |
| Section bar | `spirit-detail-section-bar`, `spirit-detail-section-bar-title`, `spirit-detail-section-bar-deco` | Thanh pill “Pet Effect” + hình thoi trang trí. |
| Trợ giúp | **`ModalHelpIconButton`** + class global `modal-help-icon-btn-*` | Nút `?` + popover Pet Effect. |
| Effect rows | `spirit-detail-pet-effect-rows`, `spirit-detail-pet-effect-row`, `--empty-slot`, `--stripe-a` / `--stripe-b` | Grid 4 hàng cố định; chỉ hàng có stat có viền; xen kẽ nền. |
| Footer form | `spirit-detail-modal-footer-actions`, `spirit-detail-modal-footer-label`, `spirit-detail-modal-footer-select` | Equip spirit (MyHome). |

### Biến chiều cao Pet Effect (chỉnh trong `global.css`)

Trên `.spirit-detail-pet-effect-rows`:

- **`--spirit-pet-effect-row-h`** — cao mỗi hàng (desktop).
- **`--spirit-pet-effect-gap`** — khe giữa các hàng.

Trong `@media (max-width: 768px)` cùng file: override hai biến + thu nhỏ icon/chữ.

---

## 3. Hướng mở rộng (toàn game)

- **Ưu tiên** thêm primitive global (prefix ngắn, không gắn tên màn) thay vì copy style theo từng feature.
- Modal mới nên **bám** `inventory-item-modal-*` nếu UX tương tự (đóng overlay, header xám, footer nút).
- Giữ doc cập nhật khi thêm class dùng lại (`modal-*`, `ui-*`, …).

---

*Cập nhật: `ModalHelpIconButton` + popover (click mở, click ngoài / Escape đóng); doc Spirit modal + UI chung.*
