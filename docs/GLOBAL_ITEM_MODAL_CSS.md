# Global CSS — Modal chi tiết vật phẩm (`inventory-item-modal-*`)

Tài liệu mô tả **bộ class dùng chung** để hiển thị popup chi tiết item (túi đồ, trang bị trên pet, shop, …).  
Toàn bộ style nằm trong **`src/styles/global.css`** (cùng với responsive trong các `@media`).

Component React tham chiếu: **`src/components/items/ItemDetailModal.js`**.

**UI chung toàn game** (nút `?`, modal spirit, …): xem **[GLOBAL_GAME_UI.md](./GLOBAL_GAME_UI.md)**.

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
  - **`inventory-item-modal-action-btn.unequip`** — Kiểu nút Remove / tháo đồ.
  - **`inventory-item-modal-action-btn.buy-btn`** — Mua / xác nhận (shop hoặc tái dùng).
  - **`inventory-item-modal-action-btn.dropdown-trigger`** — Mở menu hành động.
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

*Cập nhật: thống nhất PetProfile với modal inventory + bổ sung API equipment trả `description`, `type`, `rarity`.*
