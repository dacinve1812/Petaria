# Global CSS — Modal chi tiết vật phẩm (`inventory-item-modal-*`)

Tài liệu mô tả **bộ class dùng chung** để hiển thị popup chi tiết item (túi đồ, trang bị trên pet, shop, …).  
Toàn bộ style nằm trong **`src/styles/global.css`** (cùng với responsive trong các `@media`).

Component React tham chiếu: **`src/components/items/ItemDetailModal.js`**.

**UI chung toàn game** (nút `?`, modal spirit, **`GameDialogModal`**, …): xem **[GLOBAL_GAME_UI.md](./GLOBAL_GAME_UI.md)**.

---

## `GameDialogModal` — item / inventory

Dùng cho **bán vật phẩm**, **chọn pet** (equip / use), **placeholder** tính năng chưa làm — luôn **trên** overlay modal chi tiết item (`inventory-item-modal-overlay`), không thay thế card `inventory-item-modal`.

| File | Vai trò |
|------|---------|
| `src/components/ui/GameDialogModal.js` | Component |
| `src/components/ui/GameDialogModal.css` | Style dialog + mobile + hook item |
| `src/components/ui/GameModalButton.js` | Nút pill Cancel / Confirm |

### Chuẩn props (luồng item)

1. **Nhãn nút:** luôn **`Cancel`** và **`Confirm`** (default của component; có thể không truyền `cancelLabel` / `confirmLabel`).
2. **Loading / không hợp lệ:** chỉ **`confirmDisabled`**, **không** đổi text nút (tránh `"Đang xử lý..."` trên Confirm).
3. **Modifier chung:** `className="game-dialog-modal--global-item"` trên `GameDialogModal` → hook trong `GameDialogModal.css` (`.game-dialog-modal.game-dialog-modal--global-item`).
4. **Body có quantity / form:** `contentClassName="item-detail-game-dialog-body"` → rules trong `GameDialogModal.css` (intro, `.highlight`, căn `quantity-selector`, `purchase-summary`).

### Tái dùng class quantity từ global modal item

Trong body `GameDialogModal` (VD dialog bán), có thể dùng lại **cùng class** đã định nghĩa trong `global.css`:

- `quantity-selector`, `quantity-controls`, `quantity-btn` (`.minus` / `.plus`), `quantity-input`
- `purchase-summary`, `total-price`

→ Giao diện đồng bộ với shop / form số lượng trong footer `inventory-item-modal`.

### Chỗ gọi trong codebase

| Màn hình | Mô tả |
|----------|--------|
| **`ItemDetailModal.js`** | `mode === 'sell'`: title bán, body quantity + tổng peta, **Confirm** gọi API bán. `mode === 'placeholder'`: `mode="alert"`, một nút **Confirm**, nội dung “sẽ cập nhật sau”. |
| **`PetSelectionModal.js`** | Shell `GameDialogModal` + nội dung chọn pet / số lượng; **Cancel** / **Confirm**. |

### Dropdown “Chọn hành động”

Footer modal item vẫn dùng **`inventory-item-modal-dropdown`** + **`dropdown-trigger`**; chọn option **không** ẩn nút — mở `GameDialogModal` (bán / placeholder) hoặc `PetSelectionModal` (equip / use / …).

### Overflow

Trên card modal item dùng **`inventory-item-modal--allow-dropdown-overflow`** khi cần menu dropdown không bị `overflow: hidden` cắt (xem rule trong `global.css`).

---

## Nguyên tắc layout (BEM theo prefix)

| Khối | Class gốc | Vai trò |
|------|-----------|---------|
| Overlay | `inventory-item-modal-overlay` | Phủ màn hình, căn giữa modal, đóng khi click nền |
| Khung | `inventory-item-modal` | Hộp nội dung chính |
| Header | `inventory-item-modal-header` | Ảnh + thông tin tóm tắt (flex) |
| Body | `inventory-item-modal-body` | Mô tả, effect, chỉ số |
| Footer | `inventory-item-modal-footer` | Nút hành động (Equip / Remove / shop / dropdown) |

---

## Danh sách class (theo nhóm)

### Overlay & container
- **`inventory-item-modal-overlay`** — `position: fixed`, full viewport, flex center, nền mờ.
- **`inventory-item-modal`** — Card modal (max-width, bo góc, shadow).

### Header
- **`inventory-item-modal-header`** — Hàng trên: ảnh + info.
- **`inventory-item-modal-close`** — Nút × đóng.
- **`inventory-item-modal-image`** — Ảnh item (equipment path `/images/equipments/...`).
- **`inventory-item-modal-header-info`** — Cột text bên phải ảnh.
- **`inventory-item-modal-name`** — `<h3>` chỉ hiển thị tên vật phẩm.
- **`inventory-item-modal-rarity`** — Dòng độ hiếm (giá trị có thể tô màu riêng).
- **`inventory-item-modal-quantity`** — Khối số lượng (layout flex).
- **`inventory-item-modal-quantity-value`** — Một dòng thông tin (Loại, độ bền, sở hữu, …).

### Body — section & mô tả
- **`inventory-item-modal-body`** — Vùng cuộn nội dung giữa header/footer.
- **`inventory-item-modal-section`** — Khối logic (effects, mô tả, …).
- **`inventory-item-modal-description`** — Đoạn mô tả item.
- **`inventory-item-modal-no-info`** — Placeholder khi không có dữ liệu.

### Body — chỉ số & effect
- **`inventory-item-modal-primary-stats`** — Cột chỉ số chính (VD equipment).
- **`inventory-item-modal-stat`** — Một dòng stat.
- **`inventory-item-modal-stat-icon`** — Icon (nếu dùng).
- **`inventory-item-modal-stat-value`** — Giá trị nhấn mạnh trong câu.
- **`inventory-item-modal-secondary-stats`** / **`inventory-item-modal-secondary-stat`** — Stats phụ (nếu mở rộng).
- **`inventory-item-modal-secondary-stat-label`** / **`inventory-item-modal-secondary-stat-value`**
- **`inventory-item-modal-set-effect`** / **`inventory-item-modal-set-name`** / **`inventory-item-modal-set-bonus`** — Set bonus (nếu dùng).
- **`inventory-item-modal-effects`** — Danh sách effect.
- **`inventory-item-modal-effect`** — Một effect.
- **`inventory-item-modal-effect-icon`**
- **`inventory-item-modal-effect-content`**
- **`inventory-item-modal-effect-description`**
- **`inventory-item-modal-effect-usage`**
- **`inventory-item-modal-effect-permanent`**

### Footer & hành động
- **`inventory-item-modal-footer`**
- **`inventory-item-modal-action-container`**
- **`inventory-item-modal-action-btn`** — Nút chính; modifier:
  - **`inventory-item-modal-action-btn.buy-btn`** — Mua / xác nhận (shop hoặc tái dùng).
  - **`inventory-item-modal-action-btn.dropdown-trigger`** — (legacy) có thể còn ở chỗ khác.
- **Remove / gỡ trang bị:** **`GameModalButton`** `variant="confirm"` + class **`inventory-item-modal-remove-game-btn`** — `ItemDetailModal` (equipment đang mặc), footer **`SpiritDetailModal`** tại `MyHome` / `PetProfile`.
- **Chọn hành động:** **`GameModalButton`** `variant="primary"` `showIcon={false}` + class dropdown trigger.
- **`inventory-item-modal-dropdown`**
- **`inventory-item-modal-dropdown-menu`**
- **`inventory-item-modal-dropdown-item`**

### Shop (cùng file global, dùng trong footer modal)
- **`shop-purchase-container`**
- **`quantity-selector`**
- **`quantity-controls`**
- **`quantity-btn`** (`.minus` / `.plus`)
- **`quantity-input`**
- **`purchase-summary`**
- **`total-price`** (nếu hiển thị tổng)

---

## Biến màu (theme)

Trong **`src/styles/variables.css`** (hoặc tương đương):

- `--color-modal-header`, `--color-modal-header-text` — nền / chữ vùng header modal item.

---

## Cách tái sử dụng trong trang mới

1. **Item (túi đồ / pet profile):** dùng `ItemDetailModal` + class `inventory-item-modal-*`. Không dùng lại class cũ `detail-modal` / `detail-modal-overlay` (đã gỡ khỏi CSS).
2. **Linh thú (PetProfile / MyHome):** `SpiritDetailModal` — cùng overlay/header/footer với item modal (`--color-modal-header`); body nền `--color-bg`; Pet Effect: `spirit-detail-pet-effect-*`.
3. Truyền **object item** cùng “shape” với inventory khi có thể: `id` (inventory row), `item_id`, `name` hoặc `item_name`, `type`, `is_equipped`, `durability_left`, `max_durability`, `image_url`, `rarity`, `description`, …
4. **Remove** trang bị: `POST /api/inventory/:inventoryId/unequip` — `ItemDetailModal` đã gắn sẵn khi `type === 'equipment'` và `is_equipped`.

### Ví dụ đã thống nhất trong codebase

| Màn hình | Cách dùng |
|----------|-----------|
| **Inventory** | `ItemDetailModal` + `inventory-item-modal-*` |
| **PetProfile** (click đồ đang mặc) | Cùng `ItemDetailModal`; map dữ liệu từ `GET /api/pets/:petId/equipment` sang shape inventory |
| **Shop** | `ItemDetailModal` với `mode="shop"` |

---

## Ghi chú bảo trì

- Khi thêm field UI mới (VD set đồ), ưu tiên thêm class con dưới prefix `inventory-item-modal-` để tránh trùng với modal khác (`spirit-detail-modal`, `mail-detail-modal`, …).
- Responsive: tìm trong `global.css` các rule lồng trong `@media` có selector `.inventory-item-modal…` để chỉnh mobile.

---

*Cập nhật: mục `GameDialogModal` (item/inventory), liên kết GLOBAL_GAME_UI.md; dropdown + bán qua dialog.*
