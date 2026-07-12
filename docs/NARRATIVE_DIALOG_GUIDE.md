# Narrative Dialog — Hướng dẫn dùng hội thoại NPC (kiểu Vua ăn mày)

Tài liệu này giải thích **hệ thống dialog / kể chuyện** dùng trên trang **Vua ăn mày** (`/game-center/beggar-king`): chữ chạy, nhân vật, nút `>` / `>>|`, và cách **admin** chỉnh script cũng như **dev** (hoặc prompt AI) gắn dialog tương tự lên feature khác.

**Reference UI:** visual-novel — nhân vật sát đáy, gradient dialog tối, nameplate vàng, chữ trắng chạy, actions phía dưới.

---

## 1. Đây là gì?

| Thành phần | File | Vai trò |
|------------|------|---------|
| `NarrativeScene` | `src/components/ui/NarrativeScene.js` + `.css` | Scene NPC + dialog + typewriter + skip |
| `TypewriterText` | `src/components/ui/TypewriterText.js` | Chữ hiện dần (không caret) |
| Ví dụ dùng | `src/components/entertainment/BeggarKingGame.js` | Claim Peta + 3 bộ script (intro / cooldown / reward) |
| Config admin | Game center → tab **Vua ăn mày** | `beggarKing.narrative` trong JSON config |

**Không nhầm với** `GameDialogModal` — modal confirm/alert kiểu game (mua item, cảnh báo). Narrative là **cốt truyện / NPC nói chuyện** trên page.

---

## 2. Dành cho Admin — chỉnh dialog Vua ăn mày (không cần code)

### 2.1 Vào đâu

1. Đăng nhập admin  
2. **Admin → Quản lý Game center** (`/admin/game-center`)  
3. Tab **Vua ăn mày**  
4. Cuộn xuống mục **Hội thoại (Narrative)**  
5. Sửa → **Lưu cấu hình**

### 2.2 Các ô admin chỉnh được

| Ô | Ý nghĩa |
|---|--------|
| Tiêu đề scene | Chữ nhỏ trên scene (vd. `Làng Phú Gia`) |
| Tên nhân vật | Nameplate (vd. `Richies`) |
| Nhãn nút nhận | Nút sau khi hết intro (vd. `Xin lì xì`) |
| Tốc độ chữ (ms/ký tự) | Càng lớn càng chậm (khoảng 20–40 thường ổn) |
| Ảnh nhân vật | Path hoặc upload portrait |
| Dùng ảnh nền | Bật/tắt nền; tắt = trong suốt (tách nền nhân vật sau) |
| Ảnh nền | Upload/path khi bật nền |
| Script giới thiệu | Mỗi **dòng** = một câu thoại |
| Script cooldown | Khi đang chờ (chưa xin được) |
| Câu nhận lì xì | 1 câu sau khi nhận — dùng `{amount}` |

### 2.3 Token trong script (thay số lúc chạy)

Gõ trong câu thoại, hệ thống thay khi hiện:

| Token | Nghĩa |
|-------|--------|
| `{minPeta}` / `{maxPeta}` | Khoảng Peta lì xì |
| `{cooldownHours}` | Số giờ chờ |
| `{remaining}` | Thời gian còn lại (cooldown) |
| `{amount}` | Peta vừa nhận (reward) |
| `{playerName}` | Tên người chơi |

**Ví dụ:**  
`Mỗi lần khoảng {minPeta}–{maxPeta} Peta — mỗi {cooldownHours} giờ một lần.`

### 2.4 Cách chơi dialog trên page

- Click **vùng dialog** hoặc nút **`>`** → hiện hết câu / sang câu tiếp  
- Nút **`>>|`** → skip hết script (hiện actions)  
- Slot actions **luôn chiếm chỗ** (ẩn nội dung đến khi hết thoại) để không xê dịch nền/dialog

---

## 3. Dành cho Dev — gắn NarrativeScene vào trang mới

### 3.1 Import tối thiểu

```jsx
import NarrativeScene, { applyNarrativeVars } from '../ui/NarrativeScene';
import '../ui/NarrativeScene.css'; // đã import sẵn trong NarrativeScene.js

function MyFeaturePage() {
  const lines = [
    'Chào ngươi! Ta là NPC…',
    'Nhiệm vụ hôm nay: lấy {reward} Peta.',
  ];
  const vars = { reward: '1.000' };

  return (
    <NarrativeScene
      title="Tên khu"
      speaker="Tên NPC"
      portraitSrc="/images/character/richies.jpg"
      useBackground={false}          // hoặc true + backgroundSrc
      backgroundSrc=""
      lines={lines}
      vars={vars}
      typingMsPerChar={26}
      scriptKey="intro"              // đổi khi đổi bộ script
      showActions="end"              // 'end' | 'always' | 'never'
      actions={
        <>
          <button type="button" className="ec-btn">Làm gì đó</button>
          <button type="button" className="ec-btn ec-btn--ghost">Trở lại sau</button>
        </>
      }
    />
  );
}
```

### 3.2 Props quan trọng

| Prop | Mặc định | Ghi chú |
|------|----------|---------|
| `speaker` | `''` | Nameplate |
| `portraitSrc` | `''` | Ảnh nhân vật (fallback knight) |
| `useBackground` | `true` | `false` = không nền |
| `backgroundSrc` | `''` | URL ảnh nền khi bật |
| `lines` | `[]` | `string[]` hoặc `{ text, speaker?, portraitSrc? }[]` |
| `vars` | `{}` | Thay `{token}` trong text |
| `scriptKey` | `'default'` | Đổi → reset về câu 0 |
| `showActions` | `'end'` | `end`: giữ chỗ actions, reveal khi hết thoại |
| `actions` | `null` | ReactNode dưới scene |
| `align` | `'left'` | `'left'` \| `'right'` \| `'center'` |
| `onScriptComplete` | — | Callback hết script |
| `onSkip` | — | Khi bấm `>>\|` |

### 3.3 Nhiều bộ script (như beggar-king)

Giữ `phase` (`intro` | `cooldown` | `reward`) → chọn `lines` khác nhau → đổi `scriptKey` theo phase để typewriter reset.

Config nên nằm trong object `narrative` (JSON admin / defaults), ví dụ:

```js
narrative: {
  title: '…',
  speaker: '…',
  portraitSrc: '/images/character/….jpg',
  useBackground: false,
  backgroundSrc: '',
  typingMsPerChar: 26,
  lines: ['…', '…'],
  cooldownLines: ['…'],
  rewardLine: 'Nhận {amount}!',
  claimLabel: 'Nhận quà',
}
```

Wire admin: thêm field trên tab Game center (hoặc admin page feature) → lưu cùng config API hiện có.

### 3.4 Ảnh nhân vật

- Đặt file dưới `public/images/character/` (vd. `richies.jpg`)  
- Hoặc upload qua Game center → URL `/images/entertainment/uploads/…`  
- Portrait **nên PNG/JPG tách nền** nếu `useBackground: false`

### 3.5 Nút back theo nguồn (region / game-center)

Trên beggar-king: truyền `location.state` khi navigate từ region/hub; đọc trong page để hiện:

- Từ region → `Trở lại {tên region}`  
- Từ hub → `Trở lại Trung tâm giải trí`  
- Không có state → `Trở lại sau` (`history.back`)

Ẩn `ec-back` trên layout nếu page tự có nút back trong `actions` (xem `EntertainmentCenterPage` + beggar-king).

### 3.6 File liên quan

```text
src/components/ui/NarrativeScene.js
src/components/ui/NarrativeScene.css
src/components/ui/TypewriterText.js
src/components/entertainment/BeggarKingGame.js          # ví dụ đầy đủ
backend/gameCenterConfigDefaults.js                    # beggarKing.narrative
src/components/admin/AdminGameCenterManagement.js      # UI sửa script
```

---

## 4. Prompt mẫu — nhờ AI / Cursor thêm dialog giống Vua ăn mày

Copy và điền chỗ `[…]`:

```text
Thêm Narrative Dialog (NarrativeScene) cho trang [TÊN FEATURE / ROUTE],
giống pattern /game-center/beggar-king (Richies).

Yêu cầu UI:
- Dùng component có sẵn: src/components/ui/NarrativeScene (+ TypewriterText)
- Style visual-novel hiện tại (gradient dialog, nameplate, >, >>|, chữ trắng chạy, không caret)
- Nhân vật [TÊN NPC], portrait [path hoặc upload admin]
- useBackground false trừ khi có ảnh nền
- Actions giữ chỗ từ đầu (showActions="end"), không xê dịch stage khi hiện nút
- Nút back thông minh (từ region / game-center / history) nếu trang nằm trong game-center hoặc mở từ region

Nội dung / script:
- Intro: [2–4 câu lore]
- (Tuỳ chọn) Cooldown / trạng thái khác: […]
- (Tuỳ chọn) Reward: câu có token {amount} hoặc tương đương
- Token cần hỗ trợ: […]

Admin:
- Cho phép sửa speaker, portrait, nền, lines (mỗi dòng 1 câu) trong [Admin Game center tab X / admin page Y]
- Lưu qua config JSON hiện có (merge defaults + DB), không hard-code script trong JSX nếu có thể

Logic game giữ nguyên: [mô tả claim / API / cooldown…]
Chỉ bọc UI bằng NarrativeScene; tham khảo BeggarKingGame.js.
```

### Checklist trước khi gửi prompt

- [ ] Route / tên page đã có chưa?  
- [ ] NPC tên gì, có sẵn ảnh chưa?  
- [ ] Script intro (và cooldown/reward nếu có)  
- [ ] Nút actions sau dialog làm gì?  
- [ ] Admin sửa script ở đâu (tab game center vs admin riêng)?  
- [ ] Có cần gắn từ Region map (`path`) không? → xem `REGION_MAPS_SETUP.md`

---

## 5. So sánh nhanh với modal thường

| | NarrativeScene | GameDialogModal |
|--|----------------|-----------------|
| Mục đích | Cốt truyện / NPC nói | Confirm, alert, form ngắn |
| Chữ chạy | Có | Không |
| Nhân vật lớn | Có | Không |
| Admin script dài | Có (lines[]) | Thường hard-code / 1 câu |
| Dùng khi | Quest, làng, NPC, intro feature | Mua, xác nhận, lỗi |

Chi tiết modal: [`GLOBAL_GAME_UI.md`](./GLOBAL_GAME_UI.md).

---

## 6. Troubleshooting

| Hiện tượng | Cách xử lý |
|------------|------------|
| Đổi script admin không thấy | Đã **Lưu cấu hình**? Hard refresh? Backend đang chạy? |
| Token `{minPeta}` hiện nguyên chữ | Page chưa truyền `vars` hoặc key sai |
| Layout nhảy khi hiện nút | Đảm bảo `showActions="end"` + `actions` luôn render (pending ẩn bằng CSS) |
| Ảnh NPC có khung trắng | Tách nền hoặc bật nền scene cho khớp |
| Skip / next không chạy | Click vùng dialog hoặc `>` / `>>\|`; kiểm tra `lines` không rỗng |

---

**Cập nhật:** July 2026 — theo implementation Vua ăn mày / Làng Phú Gia (Richies).
