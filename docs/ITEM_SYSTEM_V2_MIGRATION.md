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
| `10000` – `10999` | **Booster / evolve:** tiến hóa, tăng stat vĩnh viễn, HP/MP/EXP/level, … (chi tiết dải con bên dưới) |
| `11000` – `11999` | Consumable + `category=medicine` (hồi HP/MP tạm thời) |
| `12000` – `12999` | Thức ăn / đời sống: **`type = food`** + `category = food`; đồ chơi **`consumable` + `toy`** (xem mục 3.2) |
| `13000` – `13999` | `type=equipment` — vũ khí, khiên, và các món “dược chiến đấu” gán `equipment` + `stat_boost` (ví dụ Minh dược) |
| `15000` – `16999` | Nhóm mở rộng: event / special / quest (dữ liệu mẫu CSV hiện chưa dùng dải này) |

Trong DB, `item_code` có unique index (`idx_items_item_code`). Nên đặt **duy nhất** theo dải bạn chọn.

### 3.1) Chi tiết theo bộ item mẫu (`public/images/equipments/items (1).csv`)

File CSV đầy đủ trong repo (~153 dòng item, không kể header) minh hoạ cách gán `type` / `category` / `subtype` theo `item_code`. Dùng làm tham chiếu khi seed hoặc review admin.

| Dải `item_code` | Ví dụ | `type` | `category` | `subtype` (đặc trưng) |
|------------------|--------|--------|--------------|----------------------|
| `10001` – `10015` | Thần dược tiến hóa Alpha… | `evolve` | `transform` | `evolution_*`, `evolution_return` |
| `10101` – `10110` | Dây chuyền đá… | `booster` | `stat_boost` | `def_boost` |
| `10201` – `10210` | Nhẫn tam bảo… | `booster` | `stat_boost` | `str_boost` |
| `10301` – `10310` | Giày siêu tốc… | `booster` | `stat_boost` | `spd_boost` |
| `10401` – `10410` | Sách giáo khoa… | `booster` | `stat_boost` | `int_boost` |
| `10501` – `10502` | Thuốc kích thích LX… | `booster` | `stat_boost` | `lvl_boost` |
| `10601` – `10603` | Sâm tửu… | `booster` | `stat_boost` | `hp_boost` |
| `10701` – `10704` | Thần dược Exp No.1… | `booster` | `stat_boost` | `exp_boost` |
| `11001` – `11004` | Hồng dược… | `consumable` | `medicine` | `hp_recovery` |
| `11101` – `11103` | Lục năng dược… | `consumable` | `medicine` | `mp_recovery` |
| `12001` – `12010` | Bánh mì… | `food` | `food` | `hunger_recovery` (legacy có thể còn `consumable` + `food`) |
| `12101` – `12110` | Sao vàng… | `consumable` | `toy` | `happiness_up` |
| `13001` – `13126` | Bạch ngân kiếm… | `equipment` | `equipment` | `weapon_permanent`, `weapon_critical` |
| `13201` – `13210` | Song kiếm… | `equipment` | `equipment` | `weapon_basic` |
| `13501` – `13509` | Khiên gỗ… | `equipment` | `equipment` | `shield_basic` |
| `13901` – `13912` | Minh dược, Ảo dược… | `equipment` | `stat_boost` | `accuracy_up`, `accuracy_down` (dùng trong trận, `consume_policy=on_battle_only`) |

**Lưu ý:** Trong `10xxx`, nhánh `100xx` là **evolve**; từ `101xx` trở đi trong file mẫu là **booster** theo nhóm trăm (101 = def, 102 = str, …). Có thể tiếp tục mở số `108xx`, `109xx` cho booster khác nếu cần.

### 3.2) Type `food`, API inventory và menu “dùng cho pet” (túi đồ)

**Tách thức ăn:** nên đặt `items.type = food` (thường kèm `category = food`, ví dụ `subtype = hunger_recovery`). Dữ liệu cũ có thể vẫn là `consumable` + `category = food`; backend vẫn xử lý như thức ăn khi dùng cho pet. Script SQL tùy chọn để chuẩn hóa: `db/migrations/20260426_item_type_food_separate.sql`.

**Đồ chơi:** thường là `consumable` + `category = toy`; có thể thêm `type = toy` tùy catalog.

**`GET /api/users/:userId/inventory`** expose thêm từ bảng `items` (để frontend phân menu theo HP/MP, v.v.):

| Trường trong JSON | Nguồn |
|-------------------|--------|
| `item_category` | `items.category` |
| `item_subtype` | `items.subtype` |

#### Menu “Chọn hành động”: chỉ thêm dòng “dùng cho pet” khi khớp taxonomy

Trong túi đồ (**`ItemDetailModal`**), dropdown **“Chọn hành động”** được ghép như sau:

1. **Luôn có** (đối với item không phải trang bị đang mặc): các mục không gắn nhãn pet — ví dụ **Bán ve chai**, **Đặt vào cửa hàng**, **Mang vào phòng triển lãm**, **Tặng cho bạn bè**.
2. **Chỉ thêm từng dòng “dùng cho thú cưng”** khi `type` / `category` / `subtype` của catalog khớp **một** trong các rule bên dưới (`getPetUseActionsForItem`). Không khớp rule nào → **không** có thêm dòng Cho ăn / Chữa trị / Booster / … (tránh chọn nhầm hành động so với loại item).
3. **Trang bị chưa mặc**: nhánh riêng — có **Trang bị cho thú cưng** + các mục bán/triển lãm/… như trên; không qua bảng taxonomy pet-use.

Điều kiện so khớp dùng các field **trên dòng inventory đã join catalog**: ưu tiên `item_category` / `item_subtype` từ API, fallback `category` / `subtype` nếu có.

**`PetSelectionModal`** nhận đúng `action` đã chọn (`feed`, `heal`, …) để tiêu đề/mô tả khớp với dòng menu (không còn chung chung “Sử dụng”). Fetch danh sách pet chỉ khi cần: có ít nhất một dòng pet-use **hoặc** trang bị chưa equip.

**Menu “Chọn hành động”** — hàm `getPetUseActionsForItem` trong `src/components/items/ItemDetailModal.js`:

| Nhãn UI | Điều kiện `items` |
|---------|-------------------|
| Cho thú cưng ăn | `type = food` **hoặc** (`type = consumable` và `category = food`) |
| Chữa trị cho thú cưng | (`type = consumable` hoặc `medicine`) + `category = medicine` + `subtype = hp_recovery` |
| Hồi phục năng lượng cho thú cưng | (`consumable` hoặc `medicine`) + `medicine` + `subtype = mp_recovery` |
| Gia tăng chỉ số cho thú cưng | `type = booster` + `category = stat_boost` |
| Chơi đùa với thú cưng | (`consumable` + `category = toy`) **hoặc** `type = toy` |
| Thay đổi hình dạng cho thú cưng | `type = evolve` |

**Ví dụ:** `booster` + `stat_boost` chỉ thêm một dòng **Gia tăng chỉ số cho thú cưng** — không kèm Cho ăn / Thuốc / Đồ chơi. Thuốc `medicine` mà **không** có `subtype` là `hp_recovery` hoặc `mp_recovery` thì không hiện Chữa trị / Hồi năng lượng cho đến khi chỉnh catalog.

Các mục **Bán ve chai**, đặt shop, triển lãm, tặng vẫn luôn có (trừ khi UI riêng cho trang bị đang mặc). Tab **Thức ăn** trong `Inventory.js` hiển thị `type = food` hoặc legacy `consumable` + `item_category = food`.

Component UI **`TaxonomyFilterModal`** (`src/components/filters/`) dùng được lại ở màn khác; trang admin **Edit Items** có nút **Bộ lọc** cạnh ô search để lọc đồng thời theo `type` / `category` / `subtype` (multi-select, AND giữa các nhóm). Hướng dẫn props, `filterByTaxonomySelection` và mẫu tích hợp: **`docs/TAXONOMY_FILTER_MODAL.md`**.

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

### 4.1) Đồng bộ `item_effects` + `equipment_data` theo `items.magic_value`

Sau khi bảng `items` đã chuẩn (CSV / admin), chạy:

```bash
node scripts/sync_item_effects_equipment_magic_v2.js
```

Lệnh này cũng được **gọi tự động cuối** `node scripts/migrate_item_system_v2.js` (không cần `--wipe-items`).

**`equipment_data` (trang bị `type=equipment` + `category=equipment`):**

- Mỗi dòng gắn đúng `item_id` hiện tại; upsert theo `subtype` → `equipment_type` / `slot_type` / độ bền (ví dụ `weapon_permanent` → `unbreakable`).
- `magic_value` = `items.magic_value`; **`power_min` / `power_max`** = bậc sát thương theo ma thuật: `magic * 10` … `magic * 10 + 9` (ví dụ magic 4 → 40–49).

**`equipment_data` (Minh dược / Ảo dược: `equipment` + `category=stat_boost`):**

- Hàng `booster` + `slot_type=stat_boost`, `power_min`/`power_max` = 0; chỉ đồng bộ `magic_value` từ item (logic % nằm ở `item_effects`).

**`item_effects`:**

- Xóa orphan; xóa effect thừa trên vũ khí/khiên thuần (chỉ còn chỉnh qua bảng equipment); xóa thêm `item_effects` gắn item **không** thuộc nhóm có effect (`consumable`, `booster`, `evolve`, legacy `food`/`toy`/`medicine`, `quest`, `repair_kit`, hoặc `equipment`+`stat_boost`) — ví dụ `misc` cũ có effect sẽ bị gỡ.
- Với `consumable`, `booster`, hoặc `equipment`+`stat_boost`: đặt `effect_type = percent`, `value_min` = `value_max` = **`magic_tier * 10`** (magic 2 → 20 nghĩa là 20% max HP/MP hoặc 20% thang đói 10; booster vĩnh viễn: cộng **tier** = `value/10` điểm vào `_added`).
- **Không** ghi đè: `evolve`, `effect_target` `exp` / `status`, `effect_type` `status_cure`.

Chi tiết công thức runtime: backend `resolveEffectPercentOfMax` / `resolveTierPointsFromPercentEffect` trong `server.js`.

**Booster thiếu `item_effects`:** script insert **một** dòng mặc định theo `subtype` (`def_boost`→`def`, `str_boost`→`str`, … `hp_boost`/`mp_boost`→percent; `exp_boost`/`lvl_boost`→`exp` flat theo tier) chỉ khi item booster **chưa có** bản ghi effect nào (không ghi đè tay).

---

## 5) Quy ước `type` / `category` / `subtype`

Script `migrate_item_system_v2.js` (hàm normalize) và seed đã căn theo rule sau:

| Nội dung | `type` | `category` |
|---------|--------|--------------|
| Tăng HP/MP/EXP vĩnh viễn (effect permanent) | `booster` | `stat_boost` |
| Hồi HP/MP tạm (consumable medicine) | `consumable` | `medicine` |
| Đồ ăn | `food` | `food` (legacy: `consumable` + `food`) |
| Đồ chơi (tiêu hao) | `consumable` | `toy` |
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

API lưu **`effect_target` đã chuẩn hoá** (ví dụ `happiness` / `tam_trang` → `mood`). Nên dùng **`mood`** trong CSV và schema; script `sync_item_effects_equipment_magic_v2.js` + migration `db/migrations/20260426_item_effects_effect_target_mood_aliases.sql` gộp alias cũ trong DB.

---

## 7) Admin UI liên quan

- **Edit Items:** bảng có **bốn cột đầu** (`id`, `item_code`, ảnh, `name`) **cố định** khi scroll ngang; không hiển thị cột `stackable`, `consume_policy`, `pet_scope` trên bảng (vẫn có trong form, CSV download/upload và API). Thanh công cụ: ô **Search** và nút **Bộ lọc** (modal `TaxonomyFilterModal` — lọc multi-select theo `type`, `category`, `subtype`). Form + CSV: đủ `item_code`, `type` / `category` / `subtype`, `rarity` (4 mức chuẩn), `magic_value`, `stackable` / `max_stack`, `consume_policy`, `pet_scope`, `price_currency`, giá. Liên kết: `equipment` → Edit Equipment Stats; `evolve` không link; còn lại → Edit Item Effects.
- **Edit Item Effects:** `magic_value`; một target **`mood`** cho tâm trạng / đồ chơi (không còn option `happiness` trùng lặp). Hàng có alias cũ trong DB hiển thị như `mood`.
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

# 4) Chỉ đồng bộ lại item_effects + equipment_data theo items (nếu đã chạy migrate cũ)
node scripts/sync_item_effects_equipment_magic_v2.js
```

Nếu cần làm sạch hoàn toàn item rồi migrate lại:

```bash
node scripts/migrate_item_system_v2.js --wipe-items
node scripts/seed_item_examples_v2.js
```
