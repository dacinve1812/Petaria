# Quản lý Map săn — Requirements & Quy trình

Tài liệu này mô tả **dữ liệu map**, **cách thêm/sửa map**, và **trang Admin UI** (`/admin/hunting-maps`). Game Phaser đọc map qua `getHuntingMap(mapId)` trong `src/game/map/mapRegistry.js`.

---

## 1. Hai nguồn map

| Nguồn | Map ID | Chỉnh ở đâu |
|--------|--------|----------------|
| **Built-in** | `forest` | Code: `src/game/map/forest/` (`collisions.js`, `battleZones.js`, `mapData.js`) |
| **Custom** | `map_normal`, `map_event`, … (chữ thường, số, `_`) | **UI Admin** → lưu `localStorage` (key `petaria_hunting_maps_v1`) |

- Custom map **không** được đặt id `forest` (reserved).
- `getHuntingMap(id)` ưu tiên bản ghi trong `localStorage` nếu đủ trường; không có thì dùng built-in hoặc fallback `forest`.

---

## 2. Schema dữ liệu map (runtime / JSON lưu)

Một map hợp lệ gồm:

| Trường | Kiểu | Mô tả |
|--------|------|--------|
| `id` | string | Định danh duy nhất (vd `map_grass`) |
| `name` | string | Tên hiển thị |
| `entryFee` | number | Vé vào (logic nghiệp vụ sau này) |
| `currency` | `"peta"` \| `"petagold"` | Loại tiền hiển thị |
| `maxSteps` | number | Giới hạn bước trong màn săn: mỗi **ô mới** trừ 1; **≤0 hoặc bỏ trống** khi import → không giới hạn (`∞`). Map `forest` built-in: không giới hạn. |
| `thumb` | string (optional) | URL thumbnail trên trang chọn map |
| `width` | number | Số **ô** ngang |
| `height` | number | Số **ô** dọc |
| `tileSize` | number | Thường **16** (khớp `huntingConfig.TILE_SIZE`) |
| `start` | `{ x, y }` | Ô xuất phát (tọa độ ô, gốc trên-trái) |
| `assets.background` | string | URL ảnh nền (file trong `public/…`) |
| `assets.foreground` | string (optional) | Ảnh PNG trong suốt phủ lên nhân vật (như map `forest`). **Trống hoặc trùng URL nền** → game **không** vẽ lớp foreground (tránh che sprite). |
| `tiles` | `number[]` | Độ dài = `width * height`, **row-major**: index `i = y * width + x` |

Giá trị `tiles[i]` (xem `src/game/map/tiles.js`):

- `0` — **WALK** (đi được, không ưu tiên encounter)
- `1` — **WALL** (chặn)
- `2` — **ENCOUNTER** (đi được + roll gặp pet)

**Quy ước ảnh:** kích thước pixel nền (và foreground) nên là:

`pixelWidth = width * tileSize`, `pixelHeight = height * tileSize`

(vd `50×40` ô, `tileSize 16` → `800×640` px).

---

## 3. Layout lưới vẽ tay (Admin)

Trong UI, lưới được mã hóa bằng ký tự (xem `src/game/map/layoutCodec.js`):

| Ký tự | Ý nghĩa |
|--------|---------|
| `.` | Đường đi (WALK) |
| `#` | Tường (WALL) |
| `*` | Vùng gặp pet (ENCOUNTER) |
| `S` | Điểm xuất phát (đúng **một** ô trên toàn map) |

Nút **Sync → Layout JSON** chuyển lưới → `tiles` + `start` + nhập vào khối JSON.

---

## 4. Quy trình trên UI (khuyến nghị)

### Thêm map hoàn toàn mới

1. Đăng nhập **Admin** (`user.isAdmin`).
2. Vào **Admin → Quản lý Map săn** (`/admin/hunting-maps`).
3. Cột trái: nhập **map_id** (vd `map_ruong`) và **Tên map** → **+ Tạo map**.
4. Chỉnh **metadata**: vé, loại tiền, max steps, `tileSize` (thường 16).
5. Đặt file ảnh vào `public/hunting/maps/` (hoặc URL tĩnh khác) → điền **Ảnh nền** (`/hunting/maps/tenfile.png`). Tuỳ chọn **foreground**.
6. Đặt **width / height** khớp lưới bạn muốn → **Áp kích thước lưới** (cắt/pad hàng `.`).
7. Chọn công cụ **Đường / Tường / Gặp pet / Start** và **bấm từng ô** trên lưới phủ nền.
8. Bấm **Sync → Layout JSON** (kiểm tra có đúng **một** `S`).
9. Bấm **Lưu map** (ghi `localStorage` + phát sự kiện để Thế giới săn cập nhật).
10. Vào **Thế giới săn** → chọn card map → chơi thử (`/hunting-world/map/<id>`).

### Sửa map đã có (custom)

1. Trong bảng **Danh sách map**, bấm **Sửa** trên dòng map (không phải built-in `forest`).
2. Sửa form / lưới / JSON → **Sync → Layout JSON** (nếu đổi lưới) → **Lưu map**.

### Map built-in `forest`

- Trong Admin chỉ **xem / nhận hướng dẫn**; không ghi đè bằng UI.
- Sửa collision / encounter: chỉnh `src/game/map/forest/collisions.js`, `battleZones.js`, hoặc `mapData.js`.

### Sao chép map

1. Mở map custom cần copy.
2. Nhập **map_id mới** → **Duplicate**.
3. Chỉnh tên / ảnh / lưới → **Lưu map**.

### Backup / đổi máy

- **Export tất cả map (JSON)** tải file.
- **Import JSON** trên máy khác (ghi đè toàn bộ key custom trong trình duyệt — nên export trước khi import).

---

## 5. Requirements kỹ thuật (khi không dùng UI)

Nếu muốn thêm map **bằng code** (CI / repo):

1. Thêm ảnh vào `public/hunting/maps/`.
2. Tạo object map đủ trường như mục 2 (đặc biệt `tiles` đúng độ dài).
3. Hoặc đăng ký trong `src/game/map/mapRegistry.js` (import giống `FOREST_MAP`), **hoặc** đưa JSON vào pipeline build và hydrate `localStorage` lần đầu (tuỳ bạn).

---

## 6. Hạn chế hiện tại & hướng mở rộng

- **Lưu trữ**: Admin đang dùng **localStorage** (theo trình duyệt). Production đa thiết bị cần **API + DB** (đồng bộ `huntingMapsStorage` với backend).
- **Vé / max steps**: đã lưu trong bản ghi; **chưa** khóa gameplay trong Phaser — cần bước tích hợp sau.
- **Encounter zone**: cần vẽ ô `*`; không có thì không roll encounter trên ô đó.

---

## 7. File liên quan

| File | Vai trò |
|------|---------|
| `src/utils/huntingMapsStorage.js` | Đọc/ghi `localStorage` |
| `src/game/map/mapRegistry.js` | `getHuntingMap(id)` |
| `src/game/map/layoutCodec.js` | `. # * S` ↔ `tiles` |
| `src/game/map/huntingMapCatalog.js` | Danh sách cho UI chọn map |
| `src/components/admin/AdminHuntingMapManagement.js` | Trang quản lý |
| `src/components/HuntingWorldPage.js` | Grid link theo catalog |
| `src/game/scenes/PreloadScene.js` | Load ảnh theo `map.assets` |
| `src/game/scenes/MainScene.js` | Di chuyển lưới + encounter |

---

*Tài liệu này đi kèm UI Admin “Quản lý Map săn” như mock: danh sách + editor lưới + JSON + export/import.*
