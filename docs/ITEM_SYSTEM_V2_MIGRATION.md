# Item System V2 Migration

Tài liệu mô tả migrate hệ thống item: taxonomy (`type` / `category` / `subtype`), `item_code`, durability, effect target, CSV admin và script tiện ích.

---

## 1) Migrate schema

Từ thư mục `petaria`:

```bash
node scripts/migrate_item_system_v2.js
```

Tuỳ chọn xóa toàn bộ dữ liệu item liên quan trước khi migrate:

```bash
node scripts/migrate_item_system_v2.js --wipe-items
```

**Script migrate còn làm:**

- Thêm / backfill cột `items`: `item_code`, `category`, `subtype`, `magic_value`, `stackable`, `max_stack`, `consume_policy`, `pet_scope`, `price_currency`, …
- Thêm / chuẩn hóa `equipment_data`: `durability_mode`, `random_break_chance`, `slot_type`, `equipment_type` (kể cả `booster`)
- Đổi `durability_mode` cũ `random` → `unknown`; với `unknown`: `durability_max = NULL`, `random_break_chance` mặc định `3` nếu thiếu
- Chuẩn hóa `item_effects` (alias target/type, `magic_value`)
- Chuẩn hóa **phân loại** `type` / `category` (xem mục 5)
- Nếu cột `items.rarity` đang là **ENUM** cũ: script đổi sang **`VARCHAR(32)`** để tránh lỗi *Data truncated for column 'rarity'* khi import CSV hoặc lưu từ admin.
- **Giá trị rarity chuẩn (4 mức):** `common`, `rare`, `epic`, `legendary` (UI có thể gọi là “Legend”). Không dùng `mythic` trong game item; dữ liệu cũ `mythic` / `legend` / … được migrate và API chuẩn hóa về `legendary`; `uncommon` → `rare`.

---

## 2) Seed item mẫu

```bash
node scripts/seed_item_examples_v2.js
```

Script upsert theo `item_code` (không phụ thuộc `items.id`). Các item mẫu gồm:

- Thần dược tiến hóa Alpha  
- Dây chuyền đá, Nhẫn tam bảo, Giày siêu tốc, Sách giáo khoa Petaria  
- Sâm tửu, Nước tăng lực ngũ sắc, Thần dược Exp No.1  
- Bạch ngân kiếm, Cung Mãng xà, Khiên gỗ  
- Hồng dược, Lục năng dược, Minh dược, Ảo dược, Sao vàng, Bánh mì  

---

## 2.1) Reset `items.id` về dãy 1..N (tuỳ chọn)

Khi muốn `items.id` liên tục từ `1` và `AUTO_INCREMENT` khớp sau khi đã có dữ liệu:

```bash
node scripts/reset_item_ids_v2.js
```

Script sẽ:

- Gán lại `items.id` thành `1 .. N` (theo thứ tự id cũ tăng dần)
- Cập nhật mọi bảng có FK trỏ tới `items.id` (tự phát hiện qua `information_schema`)
- Đặt `AUTO_INCREMENT` của `items` = `N + 1`

**Lưu ý:** `item_code` không đổi; chỉ id kỹ thuật đổi. URL/query param cũ dùng `item_id` số cần đổi theo bảng map mới nếu có bookmark.

---

## 3) `item_code` vs `items.id`

| Khái niệm | Vai trò |
|-----------|---------|
| `items.id` | Khóa chính kỹ thuật, auto-increment, mọi FK nội bộ (`inventory.item_id`, `item_effects.item_id`, `equipment_data.item_id`, …) |
| `item_code` | Mã nghiệp vụ ổn định: seed, CSV, design doc, phân nhóm nội dung |

### Quy ước `item_code` khuyến nghị

| Dải | Ý nghĩa gợi ý |
|------|----------------|
| `10000` – `10999` | Evolve / booster / tiến hóa (tăng chỉ số vĩnh viễn, exp, …) |
| `11000` – `11999` | Consumable + `category=medicine` (hồi HP/MP tạm thời) |
| `12000` – `12999` | Consumable + `category` `food` / `toy` |
| `13000` – `13999` | `type=equipment` (vũ khí, khiên, trang bị hỗ trợ stat, …) |
| `15000` – `16999` | Mở rộng (quest, event, misc) |

Trong DB, `item_code` có unique index (`idx_items_item_code`). Nên đặt **duy nhất** theo dải bạn chọn.

---

## 4) Schema chính

### Bảng `items`

Cột / nhóm quan trọng:

- `type`, `category`, `subtype` — taxonomy (xem mục 5)
- `item_code`, `rarity`, `image_url`, `buy_price`, `sell_price`, `price_currency` (`peta` | `petagold`)
- `magic_value`, `stackable`, `max_stack`, `consume_policy`, `pet_scope`

### Bảng `equipment_data`

- `equipment_type`: `weapon` | `shield` | `crit_weapon` | `booster`
- `slot_type`: `weapon` | `shield` | `stat_boost`
- `durability_mode`: `fixed` | `unknown` | `unbreakable`
  - `unknown`: không dùng `durability_max`; mỗi lần hao mòn roll theo `random_break_chance` (%). UI hiển thị **Ngẫu nhiên** (không hiện %)
  - `unbreakable`: `durability_max` chuẩn hóa `999999`; UI **Vĩnh viễn**, không trừ độ bền
- `random_break_chance`, `power_min` / `power_max`, `magic_value`, …

### Bảng `item_effects`

- `magic_value` (ưu tiên hiển thị / tính toán theo effect)
- Alias chuẩn hóa: `atk`→`str`, `int`→`intelligence`, `energy`→`mp`, `status_heal`→`status_cure`

---

## 5) Quy ước `type` / `category` / `subtype`

Script `migrate_item_system_v2.js` (hàm normalize) và seed đã căn theo rule sau:

| Nội dung | `type` | `category` |
|---------|--------|--------------|
| Tăng HP/MP/EXP vĩnh viễn (effect permanent) | `booster` | `stat_boost` |
| Hồi HP/MP tạm (consumable medicine) | `consumable` | `medicine` |
| Đồ ăn / đồ chơi | `consumable` | `food` hoặc `toy` |
| Trang bị đánh / thủ / hỗ trợ stat (equip) | `equipment` | `equipment` hoặc `stat_boost` (ví dụ Minh dược / Ảo dược: `stat_boost`) |
| Tiến hóa | `evolve` | `transform` (ví dụ) |

`subtype` mô tả chi tiết (`hp_recovery`, `weapon_critical`, `accuracy_up`, …).

---

## 6) CSV admin (download / upload)

### `GET /api/admin/items/csv`

- **Cột xuất:** `item_code`, `name`, `description`, `type`, `category`, `subtype`, `rarity`, `image_url`, `buy_price`, `sell_price`, `price_currency`, `magic_value`, `stackable`, `max_stack`, `consume_policy`, `pet_scope`  
- Không xuất cột `id` (tham chiếu nội dung bằng `item_code`).

**Upload `POST /api/admin/items/csv`**

- Có thể dùng `id` để update theo khóa cũ, hoặc chỉ `item_code`: nếu `item_code` đã tồn tại thì **update** đúng dòng đó.
- Cột bắt buộc tối thiểu: `name`, `type`, `rarity`, `image_url`.
- Các cột tùy chọn khi upload: `magic_value`, `stackable` (`0`/`1`), `max_stack`, `consume_policy`, `pet_scope`. Trên server, `rarity` được chuẩn hóa về một trong bốn giá trị trên (alias ví dụ `legend` → `legendary`, `mythic` → `legendary`, `uncommon` → `rare`; giá trị lạ → `common`).

### `GET /api/admin/equipment-stats/csv`

- Cột: `id` (PK bảng `equipment_data`), **`item_code`**, `equipment_type`, `slot_type`, `power_min`, `power_max`, `durability_max`, `durability_mode`, `random_break_chance`, `magic_value`, …  
- Tham chiếu item bằng **`item_code`** (không còn `item_id` trên file tải về).

**Upload:** bắt buộc có **`item_code`** hoặc **`item_id`** (một trong hai); backend resolve sang `items.id`.

### `GET /api/admin/item-effects/csv`

- Cột: `id`, **`item_code`**, `effect_target`, `effect_type`, `value_min`, `value_max`, `is_permanent`, `duration_turns`, `magic_value`.

**Upload:** cần `effect_target`, `effect_type` và **`item_code`** hoặc **`item_id`**.

---

## 7) Admin UI liên quan

- **Edit Items:** bảng có **bốn cột đầu** (`id`, `item_code`, ảnh, `name`) **cố định** khi scroll ngang; không hiển thị cột `stackable`, `consume_policy`, `pet_scope` trên bảng (vẫn có trong form, CSV download/upload và API). Form + CSV: đủ `item_code`, `type` / `category` / `subtype`, `rarity` (4 mức chuẩn), `magic_value`, `stackable` / `max_stack`, `consume_policy`, `pet_scope`, `price_currency`, giá. Liên kết: `equipment` → Edit Equipment Stats; `evolve` không link; còn lại → Edit Item Effects.
- **Edit Item Effects:** `magic_value`, target chuẩn (`str`, `intelligence`, `mp`, …).
- **Edit Equipment Stats:** filter `All` / `non-booster` / `booster`; `durability_mode` + `random_break_chance` khi `unknown`.

---

## 8) Bảo mật API admin

Các route CRUD + CSV cho `items`, `equipment_data`, `item_effects` dùng middleware admin phù hợp (items role), không dùng nhầm quyền NPC-only.

---

## 9) Tóm tắt lệnh thường dùng

```bash
# 1) Migrate schema + normalize
node scripts/migrate_item_system_v2.js

# 2) (Tuỳ chọn) seed mẫu
node scripts/seed_item_examples_v2.js

# 3) (Tuỳ chọn) reindex items.id 1..N
node scripts/reset_item_ids_v2.js
```

Nếu cần làm sạch hoàn toàn item rồi migrate lại:

```bash
node scripts/migrate_item_system_v2.js --wipe-items
node scripts/seed_item_examples_v2.js
```
