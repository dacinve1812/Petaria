# Item Hunt (Kỳ Trân Các) — Reward Design Note

Nội dung này **không hiển thị trên UI**. Tỉ lệ chỉ dùng server-side khi nhận nhiệm vụ (`POST /api/tasks/item-hunt/accept`). Sau khi nhận, phần thưởng item đã được chốt vào `reward_item_json` và hiện cố định cho người chơi.

## Quy tắc chung

- **Yêu cầu & phần thưởng** có thể gồm **equipment** (và hầu hết type khác), trừ: `quest`, `key`, `currency`, `ticket`.
- Khi nhận nhiệm vụ: roll rarity theo bảng dưới → chọn **1 item thật** trong pool (theo rarity + `MAX_BUY_PRICE` theo tier) → lưu `reward_item_json`.
- Khi nộp: trao đúng item đã lưu + Peta (`reward_peta`), không roll lại.
- Peta = `%` tổng `buy_price` của yêu cầu, clamp theo tier (`petaMin` / `petaMax`).

### Giới hạn giá item trong pool theo tier

| Tier | `MAX_BUY_PRICE` |
|------|-----------------|
| easy | 8,000 |
| medium | 40,000 |
| hard | 200,000 |
| special | 500,000 |

---

## Composition yêu cầu (request)

### Easy

- Luôn: `3c` → 3× common

### Medium (weight %)

| Key | Rarities | Weight |
|-----|----------|--------|
| `3c1r` | common×3, rare×1 | 60 |
| `2c2r` | common×2, rare×2 | 30 |
| `1c1r2e` | common, rare, epic×2 | 10 |

### Hard (weight %)

| Key | Rarities | Weight |
|-----|----------|--------|
| `5r` | rare×5 | 40 |
| `4r1e` | rare×4, epic×1 | 25 |
| `3r2e` | rare×3, epic×2 | 20 |
| `2r3e` | rare×2, epic×3 | 10 |
| `5e` | epic×5 | 5 |

### Special (weight %)

| Key | Rarities | Weight |
|-----|----------|--------|
| `3r2e` | rare×3, epic×2 | 35 |
| `2r3e` | rare×2, epic×3 | 30 |
| `4e1l` | epic×4, legendary×1 | 25 |
| `3e2l` | epic×3, legendary×2 | 10 |

---

## Weight phần thưởng item (roll lúc accept)

Weight là **phần trăm relative** trong `pickWeighted` (không bắt buộc tổng = 100, nhưng các bảng dưới thiết kế theo %).

### Easy

| Rarity | Weight |
|--------|--------|
| common | 65 |
| rare | 35 |

### Medium — theo `composition_key`

**`3c1r`**

| Rarity | Weight |
|--------|--------|
| common | 25 |
| rare | 70 |
| epic | 5 |

**`2c2r`**

| Rarity | Weight |
|--------|--------|
| common | 10 |
| rare | 55 |
| epic | 35 |

**`1c1r2e` (và fallback khác)**

| Rarity | Weight |
|--------|--------|
| rare | 35 |
| epic | 50 |
| legendary | 15 |

### Hard — theo `composition_key`

**`5r` / `4r1e`**

| Rarity | Weight |
|--------|--------|
| rare | 40 |
| epic | 45 |
| legendary | 15 |

**`3r2e` / `2r3e`**

| Rarity | Weight |
|--------|--------|
| rare | 20 |
| epic | 60 |
| legendary | 20 |

**`5e` (và fallback khác)**

| Rarity | Weight |
|--------|--------|
| epic | 55 |
| legendary | 45 |

### Special

| Rarity | Weight |
|--------|--------|
| epic | 45 |
| legendary | 55 |

---

## Peta theo tier

| Tier | Ratio | Min | Max | Duration | Daily limit | Req count |
|------|-------|-----|-----|----------|-------------|-------------|
| easy | 0.5 | 50 | 5,000 | 60 phút | 5 | 3 |
| medium | 0.6 | 100 | 15,000 | 30 phút | 3 | 4 |
| hard | 0.7 | 200 | 50,000 | 15 phút | 2 | 5 |
| special | 0.75 | 500 | 100,000 | 20 phút | 3 | 5 |

---

## Source code

Logic nằm trong `backend/routes/itemHunt.js`:

- `rollMediumComposition` / `rollHardComposition` / `rollSpecialComposition`
- `rewardWeightsFor(tier, compositionKey)`
- `pickRewardItem` → ghi `reward_item_json` lúc accept
- UI chỉ đọc `reward_item` từ `enrichQuestForClient`
