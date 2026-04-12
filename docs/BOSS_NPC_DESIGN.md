# Boss / NPC – Kiến trúc tách biệt

Boss và NPC không nằm trong bảng `pets`, tránh nhầm lẫn (đấu giá, thả pet) và tối ưu truy vấn.

## 1. Cấu trúc database

### A. `skills`
Kỹ năng dùng chung; Boss **không đánh thường, không tốn MP** – mọi hành động từ skill.

| Cột | Mô tả |
|-----|--------|
| id | PK |
| name | Tên chiêu thức |
| description | Mô tả (text) |
| type | ENUM: `'attack'` (thay Sword) hoặc `'defend'` (thay Shield) |
| power_min, power_max | Sàn/trần ma thuật ảo (dùng trong công thức 1 + R/10) |
| accuracy | Tỷ lệ trúng 0–100 |
| mana_cost | Mặc định 0 cho Boss |
| power_multiplier, effect_type, created_at | Khác (giữ tương thích) |

### B. `boss_templates`
Bản thiết kế Boss (không có owner, thuộc hệ thống). **Stat Boss cố định**: do admin nhập hoặc tạo từ DB, không tính bằng công thức, không có IV, Boss không lên level.

| Cột | Mô tả |
|-----|--------|
| id | PK |
| name | Tên hiển thị |
| image_url | Đường dẫn ảnh (vd: `mewtwo.png`) |
| level | Level hiển thị (chỉ để hiển thị, Boss không lên level) |
| base_hp, base_mp, base_str, base_def, base_intelligence, base_spd | **Chỉ số cố định** dùng trực tiếp trong battle (admin nhập / tạo từ DB) |
| accuracy | Độ chính xác 0–100% |
| location_id | Khu vực xuất hiện (1 = Arena, NULL = hiển thị mọi nơi) |
| drop_table | JSON mảng bảng rơi đồ (xem **Hệ thống Loot** bên dưới). |
| respawn_minutes | Thời gian hồi sinh (phút), nullable |
| action_pattern | JSON mảng ID skill theo thứ tự lượt, VD `[1, 1, 2]`. **Để trống hoặc `[]`** → Boss chọn **random** 1 trong các skill mỗi lượt. |
| created_at | Timestamp |

### C. `boss_skills`
Gán skill cho Boss (n–n).

| Cột | Mô tả |
|-----|--------|
| id | PK |
| boss_template_id | FK → boss_templates |
| skill_id | FK → skills |
| sort_order | Thứ tự hiển thị / ưu tiên |

## 2. Migration

```bash
cd petaria
node scripts/create_boss_and_skills_tables.js
node scripts/migrate_skills_and_boss_action_pattern.js   # thêm type, power_min, power_max, accuracy vào skills; action_pattern vào boss_templates
```

Sau khi chạy, thêm dữ liệu Boss và Skill qua admin hoặc SQL. Arena sẽ hiển thị Boss có `location_id = 1` hoặc `location_id IS NULL`.

### CSV Upload (Admin)

Trang **Quản lý NPC/Boss** (`/admin/npc-boss-management`) cho phép tải xuống CSV và upload CSV để cập nhật từng bảng. Cột bắt buộc theo cấu trúc DB:

- **skills**: Bắt buộc: `name`. Có thể có: `id` (để update), `description`, `power_multiplier`, `effect_type`, `mana_cost`.
- **boss_templates**: Bắt buộc: `name`, `image_url`. Có thể có: `id`, `level`, `base_hp`, `base_mp`, `base_str`, `base_def`, `base_intelligence`, `base_spd`, `accuracy`, `location_id`, `drop_table` (chuỗi JSON), `respawn_minutes`.
- **boss_skills**: Bắt buộc: `boss_template_id`, `skill_id`. Có thể có: `id` (để update), `sort_order`.

**Logic upload:** Chỉ **UPDATE** khi dòng CSV có cột `id` **và** id đó **đã tồn tại** trong bảng. Dòng có `id` trống, hoặc `id` không có trong DB → **INSERT** (thêm mới). Ví dụ: file có 1 dòng id=1 (đã có trong DB) và 16 dòng id trống (hoặc id=1 copy từ Excel nhưng chỉ row đầu tồn tại) → 1 cập nhật + 16 thêm mới.

## 3. API

- **GET /api/arena/enemies**  
  Trả về danh sách Boss (id, name, level, image, isBoss: true) từ `boss_templates` với `location_id = 1 OR location_id IS NULL`.

- **GET /api/bosses/:id**  
  Trả về chi tiết Boss: final_stats = chỉ số cố định từ DB (base_hp, base_mp, ... dùng trực tiếp), current_hp = HP đầy đủ, skills, accuracy, drop_table, respawn_minutes. Format tương thích battle (giống pet: final_stats, current_hp).

## 4. Logic vận hành

- Boss **không có** owner_id; không lưu Boss dưới dạng bản ghi pet.
- **Stat Boss**: cố định, do admin nhập hoặc tạo từ DB. Không tính bằng công thức, **không có IV**, **Boss không lên level**. Cột `level` chỉ để hiển thị.
- Trong trận đấu (Arena): dùng object Boss trong RAM (final_stats, current_hp). Mỗi trận có bản sao HP riêng, tránh hai user đánh chung một instance.
- **Chiến đấu Arena (Pet vs Boss)**: luồng lượt, công thức sát thương Pet/Boss, và API mô phỏng lượt được mô tả trong **DOCUMENTATION.md** → mục **Battle System → Arena Battle: Pet vs Boss**.

## 5. Hệ thống Loot (drop_table)

Cột `drop_table` trong `boss_templates` lưu **JSON** (hoặc LongText) với cấu trúc:

```json
[
  { "item_id": 101, "name": "Kiếm Gỗ", "rate": 45.5, "min_qty": 1, "max_qty": 1 },
  { "item_id": 205, "name": "Đá Cường Hóa", "rate": 15.0, "min_qty": 1, "max_qty": 3 },
  { "item_id": 0, "name": "Vàng (Peta)", "rate": 100, "min_qty": 50, "max_qty": 200 }
]
```

| Trường | Ý nghĩa |
|--------|---------|
| **item_id** | ID vật phẩm trong bảng `items`. **Quy ước `0`** = tiền Peta (cộng vào `users.peta`). |
| **name** | Tên hiển thị (log / UI). |
| **rate** | Tỷ lệ rơi (%) từ 0.01 đến 100. Mỗi entry roll độc lập. |
| **min_qty** / **max_qty** | Số lượng nhận được (random trong khoảng [min_qty, max_qty]). |

**Logic:** Khi thắng Boss, backend gọi `calculateLoot(drop_table)` → với mỗi entry roll `Math.random() * 100`; nếu `roll <= rate` thì cộng lượng random trong [min_qty, max_qty]. **item_id = 0** → `UPDATE users SET peta = peta + quantity`; item khác → thêm vào `inventory` (stack hoặc từng dòng nếu là equipment). API: **POST /api/arena/claim-loot** (body: `{ bossId, petId }`, header: `Authorization: Bearer <token>`). Frontend gọi khi trận kết thúc thắng Boss và ghi log phần thưởng.
