# Hệ thống Booster thú cưng (stat + EXP)

Tài liệu mô tả cách item **`type = booster`**, **`category = stat_boost`** (và nhánh EXP) tác động **vĩnh viễn** lên pet: lưu **`booster_stats`**, đồng bộ **`final_stats`** và cột chỉ số, không ghi đè bằng `*_added`.

**Code chính**

- `backend/utils/petIntrinsicStats.js` — làm tròn, công thức % stat, `refreshPetIntrinsicStats`
- `backend/server.js` — `handleBoosterItem`, `resolveExpBoostPercentOfCurrent`, `POST /api/pets/:petId/use-item`
- Schema: server gọi `ensureBoosterStatsColumn` khi khởi động (`pets.booster_stats` JSON, nullable)

---

## 1. `booster_stats` (JSON trên bảng `pets`)

Lưu **phần thập phân** theo từng khóa: `hp`, `mp`, `str`, `def`, `intelligence`, `spd`.

- **Không** dùng `str_added` / `def_added` / … để lưu booster (cột `*_added` dành cho bonus kiểu khác, ví dụ consumable hoặc thiết kế cũ).
- Giá trị trong JSON được **làm tròn 2 chữ số thập phân** khi ghi (`roundBoosterStatValue`) để giảm drift float.

---

## 2. Booster chỉ số — `effect_type = percent`, ma thuật `M` ⇒ `M%`

`resolveEffectMagicValue` lấy `item_effects.magic_value`, không thì `items.magic_value`, mặc định `1`.

Mỗi lần dùng (và lặp theo `quantity` trong một request), với **một** chỉ số:

$$\text{booster}_{mới} = \text{booster}_{cũ} + \bigl(\text{real\_stat} + \text{booster}_{cũ}\bigr) \times \frac{M}{100}$$

- `real_stat`: chỉ từ **công thức IV + `pet_species` + level hiện tại** (`calculateFinalStats`), không gồm `*_added`.

Sau đó gán `booster[statKey] = roundBoosterStatValue(...)`.

---

## 3. Booster chỉ số — `effect_type = flat`

Cộng trực tiếp vào phần thập phân trong JSON (vẫn làm tròn 2 số sau khi cộng).

---

## 4. Đồng bộ chỉ số: `refreshPetIntrinsicStats`

Sau khi đổi `booster_stats`, khi **lên cấp**, hoặc sau **một số** luồng dùng item, server gọi `refreshPetIntrinsicStats` để:

1. Tính lại `real` theo level hiện tại.
2. Với mỗi stat:  
   `merged = real + round(booster_frac) + *_added` — dùng cho **`final_stats`** và **HP/MP max** (máu).
3. Cột **`str`, `def`, `spd`, `intelligence`**: chỉ **`real + round(booster_frac)`** (core, không gồm `*_added`) để UI có thể hiển thị dạng `core + added`.

Booster **không mất** khi lên cấp: `real` tăng theo công thức, `round(booster)` vẫn cộng vào chỉ số mới.

---

## 5. Booster EXP

| `effect_type` | Cách tính EXP cộng vào `current_exp` |
|---------------|-------------------------------------|
| **`percent`** | `floor(current_exp × magic × quantity / 100)` — ma thuật **M** = **M%** tổng EXP **tại thời điểm dùng**. |
| **`flat`**    | `value_min × quantity × magic` (qua `resolveEffectAmount` + `scaleByMagic`), như các booster EXP cố định. |

Với bản ghi admin **`percent`**, cột **`value_min`** (vd. 10, 20…) có thể chỉ để **tier / hiển thị**; **phần trăm thực** do **`magic_value`** quyết định (vd. magic 1 ⇒ 1%, magic 2 ⇒ 2%).

**EXP / đẳng cấp (`subtype` `exp_boost`, `lvl_boost`, hoặc `effect_target = exp`)**: không có giới hạn level trên server; chỉ bị chặn bởi giới hạn lần dùng theo item (`pet_item_usage`) hoặc hết đồ trong túi.

---

## 6. Giới hạn cân bằng booster (server — `petIntrinsicStats`)

Áp dụng khi **`POST /api/pets/:petId/use-item`** xử lý item **`type = booster`**. Logic kiểm tra nằm trong `assertBoosterLimitsAfterChange` sau khi mô phỏng chỉ số **merged** (công thức giống `refreshPetIntrinsicStats`: `real + round(booster) + *_added`).

### 6.1. Đẳng cấp trong công thức

**Đẳng cấp** = **`pets.level`** (số nguyên ≥ 1).

### 6.2. Trần tuyệt đối theo khoảng level

Giá trị **merged** sau lần dùng booster **không được vượt** các trần sau (mỗi ô là **hệ số × level**):

| Khoảng level (L) | STR / DEF / INT / SPD (mỗi chỉ số) | HP (sinh mệnh) | MP (năng lượng) |
|------------------|-------------------------------------|----------------|-----------------|
| **1 – 750**      | ≤ **10 × L**                        | ≤ **50 × L**   | ≤ **20 × L**    |
| **751 – 1000**   | ≤ **15 × L**                        | ≤ **75 × L**   | ≤ **30 × L**    |
| **> 1000**       | ≤ **20 × L**                        | ≤ **100 × L**  | ≤ **40 × L**    |

- Booster **HP**: chỉ kiểm tra trần **HP** (theo bảng).
- Booster **MP**: chỉ kiểm tra trần **MP** (theo bảng).
- Booster **STR / DEF / INT / SPD**: kiểm tra trần **cả bốn** chỉ số combat (mỗi chỉ số so với cột STR/DEF/INT/SPD) **và** quy tắc trung bình (mục 6.3).

### 6.3. Trần tương đối — “20% so với trung bình” (bốn chỉ số combat)

Chỉ áp cho nhóm **Tấn công / Phòng thủ / Trí tuệ / Tốc độ** (`str`, `def`, `intelligence`, `spd`), sau khi đã cộng booster + `*_added`:

- Gọi \(\bar{s} = \dfrac{s_{str} + s_{def} + s_{int} + s_{spd}}{4}\).
- Mỗi chỉ số trong bốn chỉ số phải thỏa: **giá trị ≤ 1,2 × \(\bar{s}\)** (tức không vượt quá **20%** so với trung bình bốn chỉ số).

**HP / MP** không tham gia công thức trung bình này.

### 6.4. Dữ liệu cũ và lần dùng tiếp

- **Không chỉnh ngược** chỉ số đã có trên pet (không “kéo” pet đã vượt ngưỡng về dưới trần).
- Nếu trạng thái hiện tại hoặc lần dùng tiếp **vi phạm** trần tuyệt đối hoặc quy tắc trung bình → server **từ chối** lần dùng đó (HTTP **400**, message tiếng Việt).

### 6.5. Mã lỗi gợi ý (API)

| Mã (body / `error.code`) | Ý nghĩa |
|--------------------------|---------|
| `BOOSTER_MEAN_LIMIT`     | Vi phạm quy tắc trung bình bốn chỉ số combat. |
| `BOOSTER_ABS_CAP_CORE`   | Vi phạm trần STR/DEF/INT/SPD theo bảng 6.2. |
| `BOOSTER_ABS_CAP_HP`     | Vi phạm trần HP theo bảng 6.2. |
| `BOOSTER_ABS_CAP_MP`     | Vi phạm trần MP theo bảng 6.2. |

---

## 7. Giới hạn `pet_item_usage` (tuỳ item)

- Chỉ áp khi `item_effects.max_usage` là **số nguyên dương**.
- `NULL` / không hợp lệ ⇒ **không giới hạn** số lần trên pet (giới hạn thực tế là **số lượng trong túi**).
- So sánh: `used_count + quantity > max_usage` thì lỗi `Usage limit reached`.

---

## 8. API và luồng

- **`POST /api/pets/:petId/use-item`** — booster xử lý trong `handleBoosterItem`; sau booster gọi `refreshPetIntrinsicStats` (stat không đụng EXP-only nếu không đổi chỉ số base).
- Response khi có EXP: `exp_gained`, `level_up`, `new_stats` lấy từ `handleExpGainWithLevelUp` khi dùng booster EXP.

---

## 9. Giao diện (`PetProfile`)

STR / DEF / INT / SPD hiển thị dạng **`core + *_added`** khi `*_added > 0`; phần bonus linh thú / trang bị tính % trên **tổng intrinsic** (core + added).

---

## 10. Tham chiếu

- Công thức stat gốc: mục **Pet Stats Formula** trong `DOCUMENTATION.md`
- Taxonomy item booster: `ITEM_SYSTEM_V2_MIGRATION.md` (dải `item_code`, subtype `*_boost`, …)
