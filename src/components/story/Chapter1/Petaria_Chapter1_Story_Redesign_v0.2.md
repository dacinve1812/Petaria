# PETARIA — CHAPTER 1: NHỮNG HẠT GIỐNG THẤT LẠC
**Story & Gameplay Redesign v0.2 — Bản đề xuất cần duyệt**

## 0. Nguyên tắc thiết kế
- Giữ Core Lore: Petaria là vương quốc sống, thiên nhiên và Pet cùng con người; Thiên Mạch và đường cổ chỉ được gợi mở, không tiết lộ sớm.
- **Chỉ 4 node/location cố định trên Region Map:** Làng Nhân Ái → Vườn Bách Thảo → Hội Anh Hùng → Thành Thái Dương.
- Có **3 combat checkpoints tạm thời** giữa các địa danh và **1 regional boss** ở phần cuối. Checkpoint chỉ hiển thị khi cần, sau khi thắng trở thành trạng thái hoàn thành; cũng có thể hiển thị trong quest panel thay vì ghim trên artwork.
- Trận chiến ngẫu nhiên, săn Pet, farming EXP, lặp boss nếu phù hợp đều nằm trong hệ thống bãi săn, đấu trường hoặc mission, **không phải thêm 30 chấm stage** trên bản đồ.
- Khoảng 35–60 phút nội dung tuyến chính (ước lượng để playtest, chưa xác nhận), hoàn thành theo nhịp độ từng người.
- Sau khi mở một location, người chơi quay lại được bất cứ lúc nào; Daily Gift của Mira, săn ở Vườn Bách Thảo và nhiệm vụ Hội Anh Hùng vẫn tiếp tục hoạt động.

## 1. Bản đồ và UX
Bốn POI dùng location ID hiện hữu của game. Vị trí hotspot phải theo **hai bộ tọa độ normalized khác nhau cho desktop và mobile** vì artwork bố cục không giống nhau. Không vẽ thêm chi tiết lên ảnh nền.

Trạng thái từng POI: `LOCKED_HINT` → `AVAILABLE` → `VISITED` → `STORY_COMPLETE` (một số dịch vụ có thể xem trước tùy luật gameplay). Trạng thái sự kiện tạm: `HIDDEN` → `ACTIVE` → `WON`.

Hiển thị liên tục tối đa 4 POI chính và 1 encounter badge đang active. Mỗi POI là một hub với card gồm: NPC, “Tiếp tục câu chuyện”, hoạt động, quest phụ, bãi săn và nút quay lại. Không chạy lại lời thoại intro mỗi lần click. Quest Tracker luôn có nút “Dẫn đường”.

Bản đồ hiện có từng gán Vườn Bách Thảo ở khu lâu đài trên cao bên phải, Thành Thái Dương ở cụm thị trấn phía trên trái; nhà kính mái vòm giữa ảnh cũng gợi cảm giác Vườn Bách Thảo. Khi gắn hotspot, nên xác nhận lại sự tương thích giữa **tên/location và landmark thị giác**, nhưng không tùy tiện đổi location ID đang chạy.

## 2. Lá thư khởi đầu: `ITEM_CH1_SEALED_LETTER`
**Người gửi:** Sở Canh Nông Kinh Đô. **Người nhận:** Bà Mira — Làng Nhân Ái. **Đơn vị vận chuyển:** Bưu Điện Hoàng Gia, Rowan phụ trách. Bức thư được niêm phong; Rowan chỉ biết địa chỉ, yêu cầu chuyển phát và tình trạng tuyến đường chậm trễ, không biết toàn bộ nội dung.

> **VƯƠNG QUỐC PETARIA — SỞ CANH NÔNG KINH ĐÔ**  
> **Kính gửi bà Mira, Làng Nhân Ái,**  
> Trong ba kỳ thu hoạch gần đây, lượng hạt giống được vận chuyển từ Cánh Đồng Vạn Hoa về Kinh Đô đã giảm đáng kể. Những bông hoa vẫn nở rực rỡ như mọi năm, nhưng nhiều hạt giống không còn khả năng nảy mầm.  
> Chúng tôi cũng nhận được báo cáo về việc các đàn Pet mang phấn hoa rời khỏi tuyến di cư quen thuộc.  
> Vì bà đã nhiều năm chăm sóc Pet và hỗ trợ cư dân trong vùng, kính mong bà giúp xác minh tình trạng của các đàn Pet tại Làng Nhân Ái, đồng thời phối hợp với các nhà nghiên cứu tại Vườn Bách Thảo để tìm nguyên nhân.  
> Chúng tôi hy vọng đây chỉ là biến động tạm thời trước mùa gieo hạt mới.  
> **Trân trọng, Sở Canh Nông Kinh Đô.**

**Lý do để người chơi giao thư:** Theo Rowan đây là chuyến giao thư đơn giản trên tuyến an toàn cho người mới. Những người đưa thư khác gần đây thường đến chậm hoặc quay lại cột mốc cũ; chưa có cơ sở coi đó là chuyện siêu nhiên. Người chơi được trả công theo quest, không bị ép phải giải cứu cả vùng ngay lúc nhận thư.

## 3. Story acts và sự kiện

### PART I — Làng Nhân Ái: “Bức thư và bông hoa không hạt”
**Chủ đề:** Chăm sóc; trách nhiệm đối với sinh vật yếu hơn.  
**NPC:** Mira, một em nhỏ trong làng (tên làm việc: Nhi), Pet thụ phấn của em (biệt danh: Bông).  
**Mục tiêu:** Giao thư; nhìn thấy dấu hiệu thực tế; cứu Pet thất lạc; khởi hành tới Vườn Bách Thảo.

**Cảnh A — Gặp Mira (mở location):**
- Mira: “Cháu đi từ Kinh Đô đến tận đây sao? Đường Hoa vẫn dễ đi chứ?”
- Player: “Cháu có thư từ Bưu Điện Hoàng Gia gửi cho bà.”
- Mira mở phong bì, đọc; vẻ mặt trầm xuống.
- Mira: “Hoa vẫn nở, nhưng hạt lại không chịu thức dậy… Ta cứ tưởng chỉ ruộng nhà mình gặp chuyện.”
- Player: “Vậy chuyện này đang xảy ra khắp nơi ạ?”
- Mira: “Có lẽ thế. Nhưng điều làm ta lo nhất là những Pet mang phấn hoa đã không trở về.”
- Mira: “Nếu cháu chưa vội lên đường, giúp ta tìm một người bạn nhỏ được không?”

**Cảnh B — Em nhỏ tìm Pet:**
- Nhi: “Bông lúc nào cũng về trước khi trời tối. Hôm nay em chờ mãi…”
- Mira: “Nó thường bay gần Cầu Hoa. Nhưng mấy hôm nay đàn Pet ở đó không cho ai đến gần.”

**Encounter 1 — Cầu Hoa:** `CH1_ENCOUNTER_BRIDGE`.
- Trận mini-boss với **Thủ Lĩnh Đàn Hoa** (vai trò boss; pet_id lấy từ dữ liệu thật về sau).
- Không được mô tả là thú dữ vô cớ: nó đang che chở những Pet yếu và mắc bẫy.
- Sau trận, người chơi phát hiện Bông bị mắc trong chiếc lồng bỏ lại gần bờ cỏ. Con đầu đàn không phải kẻ bắt cóc.
- Giải cứu Pet; thu nhặt **mảnh khóa lồng thợ săn** làm manh mối.

**Cảnh C — Quay về Mira:**
- Nhi: “Bông! Cuối cùng cậu cũng về rồi!”
- Mira: “Cảm ơn cháu. Có kẻ đặt bẫy ngay trên đường di cư… Không thể chỉ là thay đổi mùa vụ.”
- Mira: “Hãy mang mẫu hoa và chiếc khóa này tới Vườn Bách Thảo. Ở đó có người biết cách đọc những dấu hiệu của thiên nhiên.”

**Reward mốc I:** mở tính năng **Quà Nhân Ái hằng ngày** (theo logic server đang có), một lần nhận quest reward nhỏ; Story key `CH1_EVIDENCE_TRAP_LOCK` và `CH1_SAMPLE_EMPTY_SEEDS`. Daily Gift không được gắn điều kiện phải đánh boss nếu bản game hiện tại vốn cho dân làng nhận quà độc lập.

### PART II — Vườn Bách Thảo: “Mùa hoa không hạt”
**Chủ đề:** Học hỏi, khám phá và thu phục Pet có trách nhiệm.  
**NPC:** Lyra (nhà nghiên cứu/giám quản vườn, tên làm việc).  
**Mục tiêu:** Phân tích mẫu, tìm dấu di cư, sử dụng hệ thống săn/thu phục nếu đã có sẵn, mở đường đến Hội Anh Hùng.

**Cảnh A — Lyra xem mẫu:**
- Lyra: “Đẹp thật đấy… Nhưng cháu nhìn xem, phần nhụy gần như không có dấu phấn.”
- Player: “Vậy hoa vẫn nở, nhưng không tạo ra hạt giống?”
- Lyra: “Đúng. Những loài Pet mang phấn đã không ghé qua đây như mọi năm.”
- Player: “Ở Cầu Hoa, cháu thấy lồng bẫy.”
- Lyra: “Đây không còn là chuyện thiếu nắng hay mưa nữa rồi.”

**Tương tác trong vườn:**
- Khảo sát hai khu cây (không ép random drop để qua truyện).
- Giới thiệu điểm săn Pet, sưu tầm/thu phục theo hệ thống thực tế; không tạo Capture Mechanic mới.
- Phát hiện mùi hương nhân tạo lạ và vài chiếc cọc đánh dấu hướng đàn Pet, không khớp tuyến di cư trên sổ tay nghiên cứu.

**Encounter 2 — Lối Vườn Cổ:** `CH1_ENCOUNTER_GARDEN`.
- Mini-boss **Pet Canh Vườn** đã bị mồi nhử kích động/đánh lạc hướng; trận chiến nhằm mở lối tiếp cận vườn ươm, không phải giết sinh vật bảo hộ.
- Sau chiến đấu, Lyra tìm được một đoạn thẻ hàng gắn trên dụng cụ bẫy với dấu hiệu liên quan một chuyến vận chuyển thương mại.

**Cảnh B — Đưa vụ việc đến Hội Anh Hùng:**
- Lyra: “Muốn điều tra bẫy trái phép và đoàn vận chuyển, chúng ta cần Hội Anh Hùng giúp đỡ.”
- Lyra: “Ta sẽ viết báo cáo. Cháu đã tận mắt thấy những gì xảy ra, cháu có thể làm chứng.”

**Reward mốc II:** mở điểm săn/quest sinh thái Vườn Bách Thảo; 1 lần quest reward vật phẩm hỗ trợ chăm sóc/thu phục theo economy config; story key `CH1_BOTANICAL_REPORT`.

### PART III — Hội Anh Hùng: “Lời hứa bảo vệ”
**Chủ đề:** Trưởng thành từ chăm sóc Pet sang bảo vệ cộng đồng.  
**NPC:** Người phụ trách nhiệm vụ Hội Anh Hùng (tên làm việc: Đội trưởng Cedric).  
**Mục tiêu:** Nộp báo cáo, nhận quyền tham gia một nhiệm vụ chính thức, điều tra lô hàng.

**Cảnh A — Hội Anh Hùng:**
- Cedric: “Người mới? Ta tưởng cậu đến đăng ký nhiệm vụ săn quái.”
- Player: “Cháu mang báo cáo từ Vườn Bách Thảo. Có người đang bẫy Pet trên đường di cư.”
- Cedric: “Việc đó không thể xem nhẹ. Một đàn Pet mất đi, cả mùa màng có thể chịu ảnh hưởng.”
- Cedric: “Ta sẽ cho người kiểm tra đường thương mại. Cậu muốn cùng đi chứ?”

**Tính năng:** mở hoặc giới thiệu Guild Quest/NPC Quest tại Hội Anh Hùng; không bắt buộc tham gia player guild để đi main story. Nếu có Adventurer rank, chỉ trao danh hiệu tập sự đúng hệ thống có thật.

**Encounter 3 — Đường Thương Mại:** `CH1_ENCOUNTER_TRADE_ROUTE`.
- Trận mini-boss với **Pet Hộ Tống** của nhóm săn trái phép, qua engine PvE hiện tại nếu chưa hỗ trợ Trainer battle.
- Đoàn thu gom tháo chạy; sau chiến đấu thu được phiếu hàng cho thấy có kho nhận hàng tại Thành Thái Dương. Chưa kết luận toàn bộ thương nhân hoặc lãnh chúa phạm tội.

**Cảnh B — Nhận nhiệm vụ đến Thành Thái Dương:**
- Cedric: “Phiếu này ghi tên một kho hàng ở Thành Thái Dương. Ta cần người đi cùng để xác minh.”
- Cedric: “Cậu đã khởi đầu bằng việc mang thư. Giờ hãy giúp chúng ta đưa những Pet đó về nhà.”

**Reward mốc III:** mở hệ thống nhiệm vụ Hội Anh Hùng (nếu chưa có), EXP/Peta theo cân bằng, story key `CH1_SHIPMENT_RECEIPT`, có thể nhận biểu tượng “Phiêu lưu tập sự” chỉ nếu hệ thống title/rank tồn tại.

### PART IV — Thành Thái Dương: “Giá của một mùa hoa”
**Chủ đề:** Lợi ích thương mại, trách nhiệm xã hội, sức mạnh không đồng nghĩa với quyền sở hữu sự sống.  
**NPC:** Người quản thành hoặc viên chức phụ trách kho (vai trò, không gắn cứng lãnh chúa); thương nhân thu gom Pet (tên làm việc: Orven); Cedric có thể xuất hiện hỗ trợ.

**Cảnh A — Thành phố phồn hoa:**
- Người dân: “Thành Thái Dương năm nay vẫn đầy lúa, nhưng các ruộng ngoài thành đã bắt đầu thiếu hạt giống.”
- Cedric: “Lạ thật. Một số kho tư nhân lại đang nhập Pet mang phấn hoa với số lượng rất lớn.”
- Người quản thành: “Nếu có bẫy trái phép, hãy mang bằng chứng. Ta không thể kết tội mọi thương nhân chỉ vì một phiếu hàng.”

**Điều tra:** sổ hàng và lồng bẫy; một thương nhân thu gom Pet để chiếm nguồn thụ phấn cho ruộng đất của mình và nâng giá hạt giống ở những nơi khác. Xung đột kinh tế cụ thể, không phải âm mưu hủy diệt thế giới.

**Cảnh B — Đối đầu thương nhân:**
- Orven: “Ta chỉ đưa những Pet ấy đến nơi có thể chăm sóc chúng tốt hơn. Lợi nhuận không phải tội lỗi.”
- Player: “Chúng bị nhốt trong lồng. Còn những cánh đồng khác thì không thể kết hạt.”
- Orven: “Một mùa vụ thành công đáng giá hơn vài lời than phiền.”
- Cedric: “Nếu đó là giao thương tự nguyện thì không ai ngăn. Nhưng cậu đã đặt bẫy và khiến cả vùng phải trả giá.”

**Regional Boss — Kho Lương Ánh Dương:** `CH1_BOSS_SUN_CITY`.
- Boss role: **Thú Hộ Vệ Thương Đoàn** của Orven (pet_id xác định từ dữ liệu hiện có), có thể là một trận nhiều wave nếu combat engine hỗ trợ.
- Không bắt hoặc sở hữu boss bắt buộc qua main quest; Pet được thu hồi, bảo vệ sau khi nhóm săn bị bắt.

**Kết thúc:** nhóm Pet được đưa về hành lang di cư, người dân bắt đầu phục hồi vườn hoa và chia sẻ hạt giống. Không để cánh đồng hồi sinh kỳ diệu ngay lập tức. Hoàng Gia và Hội Anh Hùng điều tra thương nhân; vương quốc vẫn là vùng đất sống.

**Manh mối hậu truyện:** sổ hàng có hình một dấu đường mòn cổ và dòng chữ “đường hoa cũ” ở một vị trí không xuất hiện trên bản đồ hiện tại. Cedric chưa nhận ra dấu hiệu, nhưng có nhắc rằng thành Vinh Quang lưu giữ nhiều hồ sơ cổ hơn.

**Cảnh kết:**
- Mira: “Làng ta đã bắt đầu gieo hạt lại rồi. Còn những Pet nhỏ, chúng đã trở về đúng mùa.”
- Lyra: “Có điều… dấu vẽ trong sổ hàng này không giống bất kỳ tuyến đường nào ta từng thấy.”
- Cedric: “Nếu muốn tìm hiểu những con đường xưa, hãy thử đến Thành Vinh Quang. Đó là tòa thành cổ nhất Petaria.”
- Người kể chuyện: “Chuyến giao thư đầu tiên đã kết thúc. Nhưng ở một nơi xa hơn, một con đường khác đang chờ được tìm thấy.”

**Reward mốc IV:** title/achievement “Người Giữ Mùa Hoa” nếu có hệ thống phù hợp; one-time chest qua reward config; mở tuyến story Thung Lũng Hạnh Phúc / Thành Vinh Quang. Thành Thái Dương tiếp tục là trung tâm kinh tế và có thể thu thuế theo luật hiện hành.

## 4. Danh mục checkpoint và phần thưởng
| Mốc | Loại | Điều kiện | Phần thưởng / Mở khóa (đề xuất) |
|---|---|---|---|
| Làng Nhân Ái | Fixed POI | Đến vùng & giao thư cho Mira | `CH1_LETTER_DELIVERED`; Daily Gift được giới thiệu, không cấp hai lần |
| Cầu Hoa | Mini-boss tạm | Gặp Mira & điều tra Pet mất tích | Một lần EXP/Peta qua config; giải cứu Bông; mở Vườn Bách Thảo |
| Vườn Bách Thảo | Fixed POI | Hoàn thành Cầu Hoa | Hunting/thu phục tại vườn và khảo sát mẫu |
| Lối Vườn Cổ | Mini-boss tạm | Hoàn thành khảo sát | Reward vật phẩm qua config; `CH1_BOTANICAL_REPORT`; mở Hội Anh Hùng |
| Hội Anh Hùng | Fixed POI | Có báo cáo của Lyra | Guild/NPC Quests, ghi nhận tư cách cộng tác |
| Đường Thương Mại | Mini-boss tạm | Nhận nhiệm vụ điều tra | EXP/Peta theo config, phiếu hàng; mở Thành Thái Dương |
| Thành Thái Dương | Fixed POI | Có phiếu hàng | Tham quan thành, tiếp cận kho và điều tra |
| Kho Lương Ánh Dương | Regional boss trong POI | Thu thập đủ bằng chứng | Rương thưởng một lần, Chapter 1 complete, unlock story Thung Lũng Hạnh Phúc |

Reward phải sử dụng item IDs/EXP/Peta có thật từ backend; các phần thưởng cốt truyện (thư, báo cáo, phiếu hàng) có thể là `story flags`, không bắt buộc tạo vật phẩm vật lý trong inventory. Tất cả reward một lần cần idempotency server-side. Daily Gift của Mira là vòng lặp độc lập theo reset thực tế.

## 5. Quy tắc mở khóa / sự kiện server
- `CH1_LETTER_DELIVERED`: kiểm tra quest CH0 của Rowan và xác nhận giao thư cho Mira.
- `CH1_BRIDGE_CLEARED`: battle server xác nhận thắng checkpoint 1.
- `CH1_GARDEN_SURVEY_DONE`: xác nhận hai tương tác khảo sát hoặc tương đương, không dựa random drops.
- `CH1_GARDEN_CLEARED`: battle server xác nhận thắng checkpoint 2.
- `CH1_GUILD_REPORT_SUBMITTED`: đã nộp báo cáo Lyra, có quest Hội Anh Hùng.
- `CH1_ROUTE_CLEARED`: battle server xác nhận thắng checkpoint 3.
- `CH1_CITY_EVIDENCE_VERIFIED`: đủ bằng chứng điều tra trong Thành Thái Dương.
- `CH1_FINAL_BOSS_WON`: xác nhận thắng boss vùng.
- `CH1_COMPLETED`: các điều kiện cốt truyện đã đạt, thưởng một lần, kích hoạt hook Chapter 2.

Khóa tiến trình **main story**, không vô cớ khóa các tính năng kinh tế/hunting của các POI nếu gameplay cũ cho phép truy cập tự do. Sau khi hoàn thành, replay dialogue không phát reward/trigger lại. Boss retry không reset hub progress; ngắt kết nối phải resume từ backend.

## 6. Nhịp kể chuyện và ước lượng
- 4 hub: mỗi nơi 2–4 scene, 30–90 giây/scene, linh hoạt skip/replay.
- 3 mini-boss làm “cao trào nhỏ”; 1 boss vùng là cao trào cuối.
- Không bắt buộc clear hàng loạt trận thường trước khi đọc tiếp cốt truyện. Hunting là loop phát triển Pet độc lập, có thể tích hợp một trận giới thiệu khi cần.
- Giao diện màn hình chiến đấu dùng những asset, boss ID và hệ thống level đã có; không ấn định sức mạnh bằng tài liệu kể chuyện.

## 7. Các quyết định còn cần đối chiếu codebase
1. Tên và IDs hiện tại của bốn location.
2. Thư CH0 có đang là inventory item hay quest flag.
3. Có Trainer Battle hay chỉ PvE boss Pet; thay đổi cách dàn dựng Encounter 3/Final Boss cho phù hợp.
4. Daily Gift Mira và Hunting Garden đã tồn tại hay cần mở UI.
5. Bộ artwork desktop/mobile có các hotspot nào, ai đang gán cho tòa nhà/vườn kính nào.
6. Tên/tính cách NPC mới Lyra, Cedric, Nhi, Orven là **working names**, không tự động chốt canon.

**Tình trạng:** Chờ duyệt. Không thay đổi Chapter 0 đã chạy và không sửa Core Lore đã duyệt.
