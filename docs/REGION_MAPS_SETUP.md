# Region Maps — Hướng dẫn cấu hình (Admin & Dev)

Tài liệu này giải thích **toàn bộ luồng bản đồ thế giới → vùng (region) → điểm đến (spot)**: người chơi đi đâu khi click, admin chỉnh gì trên UI, và developer thêm/sửa geometry như thế nào.

Liên quan:
- Map săn (lưới Phaser): [`HUNTING_MAP_ADMIN_WORKFLOW.md`](./HUNTING_MAP_ADMIN_WORKFLOW.md)
- World Map zone polygons (ảnh overlay): mục trong [`DOCUMENTATION.md`](./DOCUMENTATION.md) + script `npm run gen:worldmap-points`

---

## 1. Nhìn nhanh — 3 tầng bản đồ

```text
[World Map]  /world-map
     │  click vùng (vd. 3-2 Biển Địa Đàng)
     ▼
[Region Map]  /region/3-2
     │  click spot (vd. Làng Phú Gia)
     ▼
  ┌──┴──────────────────────────────────────┐
  │ path = "/"          → Confirm săn       │
  │   /hunting-world/confirm?regionId=…     │
  │   &spotId=…&spotName=…&mapId=…          │
  │                                         │
  │ path ≠ "/"          → Đi thẳng URL      │
  │   vd. /game-center/beggar-king          │
  └─────────────────────────────────────────┘
```

| Tầng | URL ví dụ | Người chơi thấy gì | Config chính |
|------|-----------|--------------------|--------------|
| World Map | `/world-map` | Bản đồ lớn, các vùng 1-1, 3-2… | Ảnh `public/worldmap/` + `worldmap-zone-points.json` |
| Region | `/region/3-2` | Ảnh vùng + nút/vùng click (spot) | `region-maps` (JSON defaults + DB override) |
| Spot đích | confirm săn **hoặc** trang feature | Map săn / Vua ăn mày / quest… | Spot: `path` + `huntingMapId` |

**Ví dụ Làng Phú Gia**

- Region: `3-2` (Biển Địa Đàng)
- Spot id: `1`, tên: `Làng Phú Gia`
- Nếu `path = "/"` →  
  `/hunting-world/confirm?regionId=3-2&spotId=1&spotName=Làng+Phú+Gia&mapId=lang_phu_gia`
- Nếu `path = "/game-center/beggar-king"` → vào thẳng Vua ăn mày / Richies

---

## 2. Dành cho non-dev / Admin (không cần sửa code)

### 2.1 Việc thường làm nhất: đổi chỗ spot dẫn tới

1. Đăng nhập tài khoản **admin**
2. Vào **Admin → Quản lý Site → Quản lý Region maps**  
   (hoặc mở `/admin/region-maps`)
3. Chọn **Region** (vd. `3-2 — Biển Địa Đàng`)
4. Với từng spot, chỉnh:
   - **Tên spot** — chữ hiện trên map / confirm
   - **Path (đi đâu)** — chọn preset hoặc gõ tay
   - **Hunting map ID** — map săn gắn với spot (khi path = `/`)
5. Bấm **Lưu cấu hình**

Sau khi lưu, người chơi tải lại trang region là thấy hành vi mới (API `GET /api/region-maps/config`).

### 2.2 Path nghĩa là gì?

| Path | Khi click spot sẽ… | Cần Hunting map ID? |
|------|--------------------|---------------------|
| `/` | Mở trang **Confirm săn** (chọn vào map săn) | **Có** — dùng làm `mapId` |
| `/game-center/beggar-king` | Vào **Vua ăn mày / Làng Phú Gia** | Không (bỏ qua khi navigate) |
| `/game-center` | Hub Trung tâm giải trí | Không |
| `/tasks/spirit-fusion` | Trang task fusion | Không |
| `/tasks/item-hunt`, `/tasks/monster-hunt` | Task tương ứng | Không |
| Path tùy chỉnh khác | `navigate` thẳng URL đó | Thường không |

Preset có sẵn trên admin; vẫn có thể gõ path bất kỳ (phải là route tồn tại trong app).

### 2.3 Hunting map ID là gì?

- Là **id map săn** trong hệ thống map săn (Admin → **Quản lý Map săn**).
- Ví dụ: `lang_phu_gia`, `thanh_hoang_kim`, `vinh_san_ho`.
- Chỉ quan trọng khi **Path = `/`**: trang confirm dùng id này để tìm map, phí vào, v.v.
- Nếu Path đã trỏ thẳng feature (beggar-king…), field này **không điều khiển navigate**, nhưng vẫn nên giữ cho đồng bộ / sau này dùng lại.

### 2.4 Checklist nhanh — gắn Làng Phú Gia → Vua ăn mày

1. `/admin/region-maps` → Region `3-2`
2. Spot **Làng Phú Gia** (id `1`)
3. Path = `/game-center/beggar-king`
4. (Tuỳ chọn) Hunting map ID vẫn để `lang_phu_gia`
5. **Lưu** → mở `/region/3-2` → click Làng Phú Gia → phải vào beggar-king

### 2.5 Việc Admin **không** làm trên trang Region maps (hiện tại)

| Việc | Làm ở đâu |
|------|-----------|
| Vẽ / sửa **ô click** (tọa độ hình chữ nhật) | Dev / Map tool → cập nhật JSON defaults (xem mục 3) |
| Thêm **region mới** trên World Map | Dev: ảnh overlay + `gen:worldmap-points` + thêm region trong JSON |
| Tạo **map săn** (lưới đi, encounter) | `/admin/hunting-maps` — xem `HUNTING_MAP_ADMIN_WORKFLOW.md` |
| Script thoại Richies / Peta lì xì | `/admin/game-center` tab **Vua ăn mày** |

---

## 3. Dành cho Developer

### 3.1 Nguồn dữ liệu (defaults + DB)

| Lớp | File / chỗ | Vai trò |
|-----|------------|---------|
| Defaults | `src/config/region-maps.json` | Geometry + path mặc định trong repo |
| Merge | `backend/regionMapsConfigDefaults.js` | `getDefaultRegionMapsConfig` + `mergeRegionMapsConfig` |
| DB | bảng `site_region_maps_config` (id=1, cột `config` JSON) | Override sau khi admin lưu |
| Public API | `GET /api/region-maps/config` | Client đọc config đã merge |
| Admin API | `PUT /api/admin/region-maps/config` | Admin lưu (cần JWT admin) |
| Client hook | `src/hooks/useRegionMapsConfig.js` | Fetch API, fallback JSON nếu lỗi |

**Merge:** theo `region.id` rồi `spot.id`. Admin đổi `path` / `huntingMapId` / tên; coords/`x`/`y` giữ từ defaults nếu admin không gửi geometry mới.

### 3.2 Schema một region (rút gọn)

```json
{
  "id": "3-2",
  "name": "Biển Địa Đàng",
  "description": "…",
  "imageSrc": "/hunting/maps/zone-5.png",
  "mapName": "region-3-2",
  "previewHeight": 1399,
  "originalHeight": 1024,
  "naturalSize": { "width": 1536, "height": 1024 },
  "originalCoordinates": [
    {
      "id": 1,
      "coords": [975, 737, 1076, 769],
      "path": "/",
      "name": "Làng Phú Gia",
      "huntingMapId": "lang_phu_gia"
    }
  ],
  "mapButtons": [
    {
      "id": 1,
      "x": 1023,
      "y": 753,
      "path": "/",
      "label": "Làng Phú Gia",
      "huntingMapId": "lang_phu_gia"
    }
  ]
}
```

| Trường | Ý nghĩa |
|--------|---------|
| `originalCoordinates[].coords` | `[x1,y1,x2,y2]` trên ảnh **natural** — vùng `<area>` click |
| `mapButtons[]` | Nút overlay (tọa độ tâm `x`,`y`) — cùng `id` với area |
| `path` | Route đích hoặc `/` = confirm săn |
| `huntingMapId` | Id map săn (slug) |

**Quan trọng:** khi sửa path/tên bằng tay trong JSON, sửa **cả** `originalCoordinates` và `mapButtons` cùng `id`. Trang Admin đã sync hai list giúp bạn.

### 3.3 Code đọc config

| Trang | File | Dùng gì |
|-------|------|---------|
| World Map | `WorldMapPage.js` | Tên region + link `/region/:id` từ config |
| Region | `RegionMapPage.js` | Ảnh + areas + buttons; `handleNavigate(path, meta)` |
| Confirm săn | `HuntConfirmPage.js` | Resolve spot + `mapId` từ query / `huntingMapId` |
| Admin UI | `AdminRegionMapsManagement.js` | `/admin/region-maps` |

Logic navigate (`RegionMapPage`):

1. Nếu `path` khác `/` và không phải `/hunting-world/map/:id` → `navigate(path)` thẳng  
2. Ngược lại → `/hunting-world/confirm?regionId&spotId&spotName&mapId`

### 3.4 Thêm / sửa vùng click (geometry) — quy trình đề xuất

1. Chuẩn bị ảnh region trong `public/` (vd. `/hunting/maps/zone-5.png`)
2. Mở `/map-tool` — vẽ vùng, gán path / label (Export JSON)
3. Gắn kết quả vào `src/config/region-maps.json` (region tương ứng):  
   `originalCoordinates` + `mapButtons` + `naturalSize` / heights khớp ảnh
4. Commit JSON — đây là **defaults** mới
5. Path/huntingMapId hàng ngày: để **Admin Region maps** chỉnh trên DB (không cần deploy lại mỗi lần đổi path)

> Map tool hiện thiên về homepage castle preset; với region, thường Export rồi paste/merge vào `region-maps.json` (hoặc chỉnh JSON trực tiếp nếu đã quen coords).

### 3.5 Thêm region mới trên World Map (dev)

1. Thêm overlay PNG: `public/worldmap/<row>-<col>.png` (vd. `2-3.png`)
2. Chạy:
   ```bash
   npm run gen:worldmap-points
   ```
   → cập nhật `src/config/worldmap-zone-points.json`
3. Thêm object region mới vào `src/config/region-maps.json` (`id` trùng `row-col`)
4. (Tuỳ chọn) Admin sau đó chỉ cần gán path/huntingMapId cho từng spot

### 3.6 Admin page chrome

Trang config mới dùng:

- `AdminConfigPage.css` — nền trắng, `admin-header`, `header-text`, `back-admin-btn`
- Không dùng link chữ `← Admin` trần

### 3.7 API tóm tắt

```http
GET /api/region-maps/config
→ JSON merged (defaults ⊕ DB)

PUT /api/admin/region-maps/config
Authorization: Bearer <admin_jwt>
Content-Type: application/json
Body: full config document (server merge + upsert id=1)
→ { success: true, config: … }
```

Bảng tạo lúc server start: `ensureSiteRegionMapsTable()` trong `backend/server.js`.

---

## 4. Troubleshooting

| Hiện tượng | Kiểm tra |
|------------|----------|
| Click spot vẫn vào confirm dù đã đổi path | Đã **Lưu** trên admin chưa? Hard refresh? Backend đã restart sau khi thêm API? |
| Confirm báo không có map | `huntingMapId` có tồn tại trong **Quản lý Map săn** / DB `hunting_maps`? |
| Region trống / không tìm thấy | `id` region trên URL khớp JSON không? (vd. `3-2`) |
| Admin lưu lỗi | Token admin, bảng `site_region_maps_config`, log server |
| World Map không hiện vùng mới | Đã thêm PNG + chạy `gen:worldmap-points` chưa? |
| Đổi JSON local mà production không đổi | Production đang dùng DB override — sửa qua Admin hoặc cập nhật defaults rồi merge |

---

## 5. File index (dev)

```text
src/config/region-maps.json              # defaults spots/regions
src/config/worldmap-zone-points.json     # world map hit polygons
src/hooks/useRegionMapsConfig.js         # fetch + fallback
src/components/WorldMapPage.js
src/components/RegionMapPage.js
src/components/HuntConfirmPage.js
src/components/admin/AdminRegionMapsManagement.js
src/components/admin/AdminConfigPage.css
backend/regionMapsConfigDefaults.js
backend/server.js                        # GET/PUT + ensure table
public/worldmap/                         # world overlays
```

---

**Cập nhật:** July 2026 — bổ sung Admin Region maps (path / huntingMapId), API merge DB, guide admin + dev.
