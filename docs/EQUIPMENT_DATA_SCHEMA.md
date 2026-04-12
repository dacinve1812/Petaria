# Bảng equipment_data – Schema và migration

## Cấu trúc bảng (sau migration)

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | INT AUTO_INCREMENT PRIMARY KEY | |
| `item_id` | INT NOT NULL, UNIQUE | FK tới `items.id` |
| `equipment_type` | ENUM('weapon','shield','crit_weapon') | Loại trang bị, mặc định `weapon` |
| `power_min` | INT NULL | Sát thương tối thiểu (tùy chọn) |
| `power_max` | INT NULL | Sát thương tối đa (tùy chọn) |
| `durability_max` | INT NULL | Độ bền tối đa; dùng khi mua item để set `inventory.durability_left` |
| `magic_value` | INT NULL | Ma thuật 1–10; dùng trong công thức Dmg_out (Rand_Magic) |
| `crit_rate` | DECIMAL(5,2) NULL | Tỷ lệ chí mạng (tùy chọn) |
| `block_rate` | DECIMAL(5,2) NULL | Tỷ lệ chặn (tùy chọn) |
| `element` | VARCHAR(50) NULL | Hệ (tùy chọn) |
| `effect_id` | INT NULL | FK hiệu ứng (tùy chọn) |

## Mapping từ schema cũ

- `power` (cũ) → `magic_value` (clamp 1–10) và `power_min` / `power_max` (cùng giá trị khi migrate)
- `durability` (cũ) → `durability_max`

## Chạy migration

Từ thư mục `petaria`:

```bash
node scripts/migrate_equipment_data_schema.js
```

- Nếu bảng chưa tồn tại: script tạo bảng mới với đủ cột.
- Nếu bảng có `power`/`durability`: thêm cột mới, backfill, xóa `power` và `durability`.

## API Admin

- **GET** `/api/admin/equipment-stats` – trả về toàn bộ bảng (cột mới).
- **POST** `/api/admin/equipment-stats` – body: `item_id`, `equipment_type`, `power_min`, `power_max`, `durability_max`, `magic_value`, `crit_rate`, `block_rate`, `element`, `effect_id`.
- **PUT** `/api/admin/equipment-stats/:id` – cập nhật theo id, cùng các trường trên.

## Frontend / Battle

- API `/api/pets/:petId/equipment` trả về `power` (= `magic_value`) và `max_durability` (= `durability_max`) để battle và UI không đổi.
- `equipment_type` có trong response khi cần phân biệt khiên/vũ khí sau này.
