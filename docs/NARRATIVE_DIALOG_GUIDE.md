# Feature NPC intro (Mystery Box pattern)

Các trang game-center dùng **`FeatureNpcIntro`** — nội dung trên trang, không NarrativeHost overlay.

## Schema `narrative` (admin + defaults)

| Field | Mục đích |
|-------|----------|
| `speaker` | Nameplate + title modal (trống → `…`) |
| `portraitSrc` | Ảnh nút trên trang; trống → ẩn ảnh, giữ dialog |
| `lorePortraitSrc` | Ảnh trong modal lore; trống = dùng `portraitSrc` |
| `greeting` | 1 câu trên trang; trống → placeholder |
| `lines[]` | Lore modal |

## Games đã áp dụng

mystery-box, beggar-king, daily-free, lucky-booth, guess-number, slot-machine, **lucky-wheel**, **scratch-lottery**

Lucky wheel / scratch: narrative mặc định trống — layout sẵn, thêm NPC trong Admin.

## Admin

`AdminFeatureNpcEditor` trong từng tab feature (gồm Vòng quay + Vé cào).
