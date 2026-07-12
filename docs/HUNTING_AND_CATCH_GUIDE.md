# Đi săn & Bắt pet — Tài liệu đầy đủ

Tài liệu mô tả **toàn bộ logic đi săn trên map** và **bắt thú cưng hoang dã** theo cách đang chạy trong game.

Gồm **hai phần**:

1. **Phần A — Cho đội phát triển / vận hành** — quy tắc chi tiết, số liệu mặc định, chỗ chỉnh cấu hình.
2. **Phần B — Hướng dẫn người mới** — cách chơi, mẹo, những gì nhìn thấy trên màn hình.

> Tài liệu liên quan: quản lý map săn (`HUNTING_MAP_ADMIN_WORKFLOW.md`), encounter cũ (`ENCOUNTER_SYSTEM_DOCS.md` — một phần đã lỗi thời so với map săn hiện tại).

---

# Phần A — Cho đội phát triển / vận hành

## A1. Bức tranh tổng thể

Người chơi vào **Thế giới săn bắt** → chọn map → đi trên lưới ô → khi đứng trên **ô gặp gỡ**, có xác suất gặp một trong ba thứ:

| Loại gặp | Người chơi làm gì |
|----------|-------------------|
| **Pet hoang** | Chỉ **Bắt** hoặc **Bỏ chạy** (chiến đấu với pet hoang tạm ẩn, làm sau). |
| **Vật phẩm** | Xác nhận nhận vào túi (bắt buộc nhận, không bỏ qua bằng nút đóng). |
| **Boss** | Chiến đấu (chọn pet → vào trận giống Đấu trường) hoặc bỏ chạy. |

Mỗi map có thể giới hạn **số bước**. Hết bước thì không đi tiếp và phải về danh sách map.

---

## A2. Vào map và di chuyển

### Vào map

1. Từ trang Thế giới săn bắt, chọn map (có thể hiện phí vé / loại tiền).
2. Xác nhận rồi vào màn chơi map.
3. Map có điểm xuất phát, ảnh nền, lưới ô (đi được / tường / ô gặp gỡ), khoảng level encounter, bảng gặp gỡ (pet / item / boss + trọng số).

**Lưu ý vận hành:** UI có thể hiện phí vào map và kiểm tra đủ tiền ở bước xác nhận; việc **trừ tiền thật khi vào map** cần đối chiếu lại với server (có thể chưa trừ phía backend).

### Di chuyển

- Đi **ô theo ô** (bàn phím hoặc nút điều hướng trên màn hình).
- Không đi xuyên tường.
- Khi đang mở hộp thoại gặp gỡ / bắt pet / trận đấu, nhân vật **không đi tiếp**.
- Mỗi lần **đến một ô mới** (nếu map có giới hạn bước): trừ **1 bước**.
- Map không giới hạn bước: hiện ∞.

### Session trên máy người chơi

- Vị trí ô và số bước còn lại được nhớ tạm trên máy (để quay lại map đang săn).
- Nếu mở nhiều tab: ưu tiên lấy **số bước còn lại nhỏ nhất** để tránh “nhân đôi” bước.
- Đang có map săn dang dở: UI có thể gợi ý **tiếp tục map cũ** thay vì vào map mới.
- Bấm **Kết thúc đi săn** hoặc rời trang (trừ khi vào trận boss): hỏi xác nhận → xóa session săn.
- **Hết bước**: khóa di chuyển → thông báo hết lượt → về danh sách map, xóa session.

### Camera / màn chơi

- Vùng chơi chiếm gần hết chiều cao màn hình; camera tự zoom để map lấp đầy khung nhìn.
- Khi mới vào map, trang có thể cuộn mượt xuống để thấy hết vùng canvas.

---

## A3. Khi nào gặp gỡ?

Điều kiện **đồng thời**:

1. Nhân vật đứng trên **ô gặp gỡ** (ô được đánh dấu encounter trên map).
2. Không đang trong thời gian chờ sau lần gặp trước (**cooldown**, mặc định zone hiện tại khoảng **3 giây**).
3. Mỗi bước trên ô đó: tung “xúc xắc” theo **tỉ lệ gặp cơ bản của zone** (zone Forest mặc định khoảng **5% mỗi bước** trên ô encounter). Các zone khác có thể khác (ví dụ ~10–12%).

Khi trúng:

1. Flash màn hình ngắn.
2. Chọn **một** kết quả từ bảng gặp gỡ của map (theo trọng số `rate`).
3. Level pet / boss = số ngẫu nhiên trong khoảng **level min–max** của map.
4. Mở hộp thoại tương ứng.

Nếu map **không có bảng gặp gỡ**: dùng danh sách pet mẫu cũ theo zone (fallback).

Sau mỗi lần gặp: bật cooldown → trong vài giây tiếp theo **không gặp lại**, dù vẫn đứng / đi trên ô encounter.

---

## A4. Ba loại gặp — hành vi chi tiết

### Pet hoang

- Hiện tên, ảnh, level.
- **Bắt** → mở màn bắt (xem A5).
- **Bỏ chạy** → hỏi xác nhận → đóng, tiếp tục đi map.
- Nút **Chiến đấu** với pet hoang: **đã ẩn** trên UI (tính năng để sau).


### Vật phẩm

- Tiêu đề kiểu chúc mừng tìm được vật phẩm + số lượng.
- Chỉ **Xác nhận** → gửi nhận vào túi đồ.
- Không cho đóng bằng ✕ để bỏ qua (phải nhận).
- Nếu có gắn map: vật phẩm phải thuộc pool của map đó mới nhận được (chống nhận sai).

### Boss

- **Chiến đấu** → chọn pet đủ điều kiện (đói / HP giống luật Đấu trường) → tạo trận.
- Boss từ săn dùng **level encounter trên map** và **tính chỉ số theo công thức level** (khác boss Arena thường dùng chỉ số gốc template).
- Sau trận: nút về nên dẫn về **đi săn / map** chứ không phải Đấu trường.
- Rời map săn để vào trận boss: **không** hỏi “kết thúc đi săn” (tránh mất session / orphan trận).

---

## A5. Hệ thống bắt pet (trọng tâm)

### Mở phiên bắt

Khi bấm **Bắt**, server tạo **phiên bắt tạm** gắn với người chơi:

- Nhớ: loài pet, level, độ hiếm pet, số lần đã cho ăn, bonus thức ăn đã cộng, số lần ném lưới hụt.
- Phiên hết hạn khoảng **15 phút** nếu bỏ đó.
- Mỗi người một phiên bắt tại một thời điểm (phiên mới thay phiên cũ theo logic server).

### Lưới

Ba loại lưới chuẩn (mã vật phẩm cố định), tỉ lệ gốc **mặc định**:

| Lưới | Tỉ lệ gốc |
|------|-----------|
| Lưới thường | 30% |
| Lưới Điện | 40% |
| Lưới Đặc Biệt | 50% |

- Màn bắt luôn hiện **3 ô lưới**; hết số lượng thì xám / không chọn được.
- Mỗi lần **Ném lưới** (dù thành công hay hụt): **trừ 1 lưới** khỏi túi.
- Có thể nhận diện lưới theo mã item; nếu thiếu mã thì fallback theo tên / subtype “lưới bắt”.

### Thức ăn (Cho ăn)

- Chỉ dùng item loại thức ăn (food / consumable category food).
- Mỗi lần cho ăn: **trừ 1** món → cộng **bonus %** vào tỉ lệ bắt (cộng dồn trong phiên).
- Bonus theo **độ hiếm của món ăn** (mặc định):

| Độ hiếm thức ăn | Cộng thêm mỗi lần |
|-----------------|-------------------|
| Thường (common) | +0,5% |
| Uncommon / Rare | +1% |
| Epic / Legendary | +2% |

- Màn hình hiện rõ **Bonus thức ăn: +X%**.
- Cho ăn thành công: câu thoại ngẫu nhiên (có thể chứa tên pet).

### Độ khó theo độ hiếm **pet** (penalty)

Trước khi cộng bonus thức ăn, tỉ lệ lưới bị **trừ** theo rarity pet (mặc định):

| Độ hiếm pet | Trừ khỏi tỉ lệ lưới |
|-------------|---------------------|
| Common | 0 |
| Uncommon | 5 |
| Rare | 10 |
| Epic | 20 |
| Legendary | 30 |

### Cách tính tỉ lệ bắt (ý niệm)

```
Tỉ lệ = (tỉ lệ lưới − penalty theo rarity pet) + tổng bonus thức ăn
Rồi giới hạn trong khoảng 0% … trần tối đa (mặc định trần = 95%)
```

Server tung số ngẫu nhiên 0–100; nếu nhỏ hơn tỉ lệ → **bắt được**.

**Người chơi không thấy số % chính xác.** Chỉ thấy mức độ định tính:

| Tỉ lệ thực (ẩn) | Nhãn hiện |
|-----------------|-----------|
| dưới 10% | Cực thấp |
| dưới 25% | Thấp |
| dưới 50% | Trung bình |
| dưới 70% | Khá cao |
| dưới 90% | Cao |
| từ 90% trở lên | Rất cao |

### Ném lưới hụt

- Mất lưới, pet **không** chạy mất ngay.
- Hiện câu thoại thất bại ngẫu nhiên (có thể thay `{petName}` bằng tên pet).
- Tăng **số lần hụt** trong phiên → lần **cho ăn sau** dễ bị chạy hơn (xem dưới).
- Vẫn ở màn bắt; bonus thức ăn **giữ nguyên**.

### Pet chạy mất (chỉ khi Cho ăn)

Mỗi lần bấm **Cho ăn**, trước/khi xử lý ăn, server tính rủi ro chạy:

```
Rủi ro chạy = mốc theo số lần đã cho ăn
            + (số lần ném hụt × hệ số mỗi lần hụt)
Rồi không vượt quá trần chạy (mặc định trần = 50%)
```

**Mốc theo số lần đã cho ăn** (mặc định):

| Số lần đã cho ăn (trước lần này) | Rủi ro cơ bản |
|----------------------------------|---------------|
| 0 – 9 | 5% |
| 10 – 19 | 10% |
| từ 20 trở lên | 20% |

- Mỗi lần ném lưới **hụt**: cộng thêm **5%** vào rủi ro chạy khi cho ăn lần sau (`fleePerFailedCatch`, mặc định 5).
- **Ném hụt không làm pet chạy ngay** — chỉ tăng nguy hiểm khi tiếp tục cho ăn.
- Nếu chạy: đã trừ thức ăn lần đó; phiên bắt kết thúc; thông báo thất bại → đóng encounter.

### Kết quả cuối cùng (thông báo)

| Kết quả | Tiêu đề | Nội dung (ý) | Màu tiêu đề |
|---------|---------|--------------|-------------|
| Bắt được | Bắt thành công | Chúc mừng bạn đã bắt thành công {tên} level {level} ! | Xanh |
| Chạy mất | Bắt thất bại | {Tên} đã chạy mất ! | Đỏ |

Pet bắt được: tạo pet mới cho người chơi (IV + chỉ số theo level), cập nhật thành tích bắt nếu có, xóa phiên bắt.

### Hủy / đóng màn bắt

- Hủy phiên bắt trên server, quay lại hộp thoại gặp pet (có thể Bắt lại hoặc bỏ chạy).
- Không tạo pet, không mất thêm lưới nếu chưa ném.

---

## A6. Ví dụ số (theo mặc định)

**Ví dụ 1 — Pet rare, lưới thường, chưa ăn**

- Lưới 30 − penalty 10 = 20 → nhãn khoảng **Thấp**.
- Cho 4 món common (+0,5 × 4 = +2) → ~22% → vẫn **Thấp**.

**Ví dụ 2 — Cho ăn và rủi ro chạy**

- Lần cho ăn đầu, chưa hụt lưới: ~5% chạy.
- Hụt lưới 2 lần rồi cho ăn: ~5 + 2×5 = **15%** chạy (vẫn dưới trần 50%).

**Ví dụ 3 — Lưới đặc biệt + pet common + ăn nhiều**

- 50 − 0 + nhiều bonus thức ăn → có thể lên gần trần **95%** → nhãn **Rất cao**, nhưng không bao giờ vượt trần cấu hình.

---

## A7. Chỗ chỉnh cấu hình (vận hành)

### Tỉ lệ bắt / chạy / câu thoại

- Trang admin: **Hunting catch rates** (`/admin/hunting-catch-rates`).
- Lưu một bộ cấu hình JSON trên DB (`hunting_catch_config`).
- Có nút reset về mặc định trong code.

Chỉnh được:

- Tỉ lệ từng loại lưới  
- Bonus thức ăn theo rarity  
- Penalty bắt theo rarity pet  
- Bảng rủi ro chạy theo số lần cho ăn  
- % cộng thêm mỗi lần ném hụt  
- Trần rủi ro chạy  
- Trần tỉ lệ bắt  
- Danh sách câu khi hụt lưới / khi cho ăn thành công  

Logic mặc định nằm ở `backend/utils/huntingCatch.js`.

### Map, bước, pool gặp gỡ

- Admin hunting maps: phí, bước tối đa, level min–max, lưới ô, ảnh, bảng encounter (pet / item / boss + rate + số lượng item).
- Chi tiết schema map: `HUNTING_MAP_ADMIN_WORKFLOW.md`.

### File / màn hình chính (tham chiếu nhanh)

| Việc | Chỗ |
|------|-----|
| Di chuyển + trừ bước + camera | Màn HuntingMap + MainScene |
| Roll gặp gỡ | EncounterManager |
| Modal gặp / bắt / alert | EncounterModal, CatchWildPetModal, EncounterModalContainer |
| Tính tỉ lệ / phiên bắt | huntingCatch (backend) + API hunting catch |
| Boss từ săn → trận | Arena match start + ArenaBattlePage (nguồn hunting) |

---

## A8. Việc chưa làm / cần lưu ý khi mở rộng

- Chiến đấu với **pet hoang**: nút đã ẩn trên UI; làm sau.
- Trừ **vé vào map** phía server: đối chiếu lại trước khi coi là đã thu phí.
- Cân bằng: tăng tỉ lệ lưới / giảm penalty / tăng bonus ăn sẽ làm bắt dễ hơn rõ; tăng flee theo số lần ăn / theo hụt sẽ phạt kiểu “spam ăn”.
- Người chơi **không** được thấy % chính xác — giữ nguyên nếu muốn tránh min-max cứng; chỉ admin thấy số trong trang cấu hình.

---

# Phần B — Hướng dẫn người mới

## B1. Đi săn là gì?

**Đi săn** là vào một bản đồ nhỏ, điều khiển nhân vật đi quanh, và **ngẫu nhiên gặp**:

- thú cưng hoang để **bắt về nuôi**,
- **vật phẩm** nhặt được,
- hoặc **Boss** để chiến đấu.

Bạn không cần biết số liệu phức tạp — chỉ cần biết: đi trên vùng “có thể gặp”, mang theo **lưới** và **thức ăn**, và quyết định khi nào ném lưới / khi nào cho ăn.

---

## B2. Các bước chơi từ đầu

1. Vào **Thế giới săn bắt**.
2. Chọn map (xem tên, phí nếu có, số bước nếu map giới hạn).
3. Xác nhận vào map.
4. Dùng phím hoặc nút mũi tên để đi. Mỗi ô đi có thể trừ 1 bước (nếu map có giới hạn).
5. Đi vào vùng cỏ / vùng gặp gỡ (ô đặc biệt trên map) và đi thêm vài bước — đôi khi sẽ **gặp** gì đó (có hiệu ứng flash).
6. Đọc hộp thoại và chọn hành động.
7. Khi muốn dừng: bấm **Kết thúc đi săn** (sẽ hỏi xác nhận). Hết bước cũng phải về.

**Mẹo:** Sau mỗi lần gặp, có vài giây “nghỉ” — đi tiếp ngay chưa chắc gặp liền.

---

## B3. Gặp pet hoang — bắt như thế nào?

### Màn hình bắt cho bạn thấy gì?

- Ảnh / tên / level pet.
- **Tỷ lệ thành công** dạng chữ: Cực thấp → Thấp → Trung bình → Khá cao → Cao → Rất cao (**không** hiện số %).
- **Bonus thức ăn** dạng +X% (cái này hiện số vì là phần bạn đã “đầu tư” bằng đồ ăn).
- Ba loại lưới (thường / điện / đặc biệt) và số lượng bạn đang có.
- Danh sách thức ăn trong túi.

### Nên làm gì?

1. **Cho ăn** vài lần nếu tỉ lệ còn thấp — pet dễ bắt hơn, nhưng càng cho nhiều / càng ném hụt nhiều thì lần cho ăn sau càng dễ **chạy mất**.
2. Chọn **lưới tốt hơn** nếu có (Đặc Biệt > Điện > Thường).
3. Khi thấy mức độ ổn (ví dụ Khá cao trở lên), **Ném lưới**.
4. Hụt thì đừng panic: bạn vẫn còn ở màn bắt, có thể cho ăn thêm hoặc đổi lưới — nhưng nhớ mỗi lần hụt làm lần cho ăn sau nguy hiểm hơn một chút.
5. Nếu pet **chạy mất**: phiên bắt kết thúc, bạn mất cơ hội lần đó (đã tốn thức ăn lần cuối nếu đang cho ăn).

### Kết quả

- **Bắt thành công** (tiêu đề xanh): pet vào bộ sưu tập của bạn.
- **Bắt thất bại** (tiêu đề đỏ): pet chạy mất.

Bạn có thể **hủy** màn bắt để quay lại hộp thoại gặp pet (bắt lại hoặc bỏ chạy) — hủy không mất lưới nếu chưa ném.

---

## B4. Gặp vật phẩm

- Hiện tên và số lượng.
- Bấm **Xác nhận** để nhận vào túi.
- Không bỏ qua — phải nhận rồi mới tiếp tục đi.

---

## B5. Gặp Boss

- Có thể **bỏ chạy** hoặc **chiến đấu**.
- Chiến đấu: chọn một pet còn chiến đấu được → vào trận.
- Sau trận, quay lại hướng đi săn (không nhầm với Đấu trường thường).
- Boss trên map săn có level theo map — có thể mạnh/yếu khác boss ở Đấu trường.

---

## B6. Mẹo nhanh cho người mới

| Tình huống | Gợi ý |
|------------|--------|
| Mới chơi, ít lưới | Ưu tiên pet thường / mức độ hiếm thấp; đừng spam ăn quá nhiều. |
| Thấy “Cực thấp” / “Thấp” | Cho ăn vài lần hoặc dùng lưới tốt hơn trước khi ném. |
| Đã hụt lưới nhiều lần | Cân nhắc ném luôn thay vì cho ăn thêm (cho ăn lúc này dễ chạy hơn). |
| Map có giới hạn bước | Đừng đi vòng vô ích ngoài vùng gặp; giữ bước cho lúc cần. |
| Hết lưới / hết thức ăn | Về chuẩn bị túi rồi vào lại (session bước có thể còn nếu chưa kết thúc săn). |
| Muốn farm item | Đi vùng encounter, nhận item rồi đi tiếp; không cần lưới. |

### Những điều dễ hiểu nhầm

- **Hụt lưới ≠ pet chạy mất.** Hụt chỉ mất lưới và làm lần cho ăn sau rủi ro hơn.
- **Cho ăn không đảm bảo bắt được** — chỉ tăng cơ hội; vẫn có thể chạy khi đang cho ăn.
- **Không có bắt 100%** — luôn có trần tối đa (thường dưới 100%).
- **Không có nút chiến đấu** khi gặp pet hoang — chỉ bắt hoặc bỏ chạy. Gặp Boss mới vào trận thật.

---

## B7. Checklist trước khi vào map

- [ ] Đăng nhập  
- [ ] Có ít nhất vài **lưới** trong túi  
- [ ] Có **thức ăn** nếu muốn tăng tỉ lệ  
- [ ] Pet chiến đấu còn khỏe (nếu định đánh Boss)  
- [ ] Biết map có giới hạn bước hay không  

---

*Cập nhật theo logic hiện tại của hệ thống săn / bắt. Khi admin đổi cấu hình tỉ lệ trên trang Hunting catch rates, số % mặc định trong Phần A có thể khác — lấy số trên admin làm chuẩn vận hành.*
