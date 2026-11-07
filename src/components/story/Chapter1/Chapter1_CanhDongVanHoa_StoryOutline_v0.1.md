# PETARIA — CHAPTER 1: CÁNH ĐỒNG VẠN HOA

**Giai đoạn:** Outline để duyệt · v0.1 · Chưa phải Content Pack dùng trực tiếp cho game  
**Thuộc World Story Bible:** Arc I — Hành Trình Khai Phá  
**Chủ đề chương:** Sự sống được duy trì không chỉ nhờ ánh sáng, mà còn nhờ những sinh linh nhỏ bé âm thầm kết nối mọi thứ.  
**Chapter 0 handoff:** người chơi nhận thư niêm phong từ Rowan, đến Cánh Đồng Vạn Hoa tìm bà Mira tại Làng Nhân Ái.  
**Kết thúc:** mở tuyến Thung Lũng Hạnh Phúc / Thành Vinh Quang (không đặt Thành Vinh Quang ở Cánh Đồng Vạn Hoa).

## 1. Một câu tóm tắt

Người chơi đến giao thư và giúp Làng Nhân Ái tìm những Pet mang phấn hoa biến mất. Một nhóm người thu gom Pet quý hiếm đang lợi dụng các tuyến di chuyển bất thường, trong khi cả Cánh Đồng Vạn Hoa bắt đầu đối mặt với nguy cơ mất mùa. Từ việc giúp một ngôi làng nhỏ, người chơi được Hội Anh Hùng chú ý và tìm ra dấu vết của một con đường cổ không còn tồn tại trên bản đồ.

## 2. Ba tầng xung đột

- **Cảm xúc (local):** Mira đang chăm sóc những Pet nhỏ trở về trong tình trạng kiệt sức. Trẻ em và người dân chờ những gói hạt giống đã thất lạc.
- **Gameplay (regional):** các loài Pet giúp thụ phấn bị dồn về một vài thung lũng; những khu vườn và cánh đồng bắt đầu thiếu hạt giống mới. Nhóm thu gom Pet lấy chúng đi bán, khiến khủng hoảng trầm trọng hơn.
- **Core mystery (long-term):** cột mốc cổ chỉ vào một con đường mà bản đồ hiện đại không còn vẽ. Hội Tầm Lộ chưa được công khai nêu tên trong Chapter 1; chỉ có ký hiệu và dấu vết mơ hồ.

## 3. Vai trò bốn địa danh gốc

### Làng Nhân Ái — Neo cảm xúc
- Bà Mira nhận thư của Rowan.
- Daily Gift là quà do cư dân tự nguyện góp để tiếp sức những người nuôi Pet; mở vĩnh viễn sau lần gặp đầu, không phụ thuộc việc nhận lại thư mỗi ngày.
- Người chơi cứu các Pet mang phấn hoa, quay về làng thấy khu vườn hồi phục.

### Vườn Bách Thảo — Khám phá và săn Pet
- Gặp nhà thực vật học **Lyra** (NPC mới, tạm đề xuất).
- Mở hướng dẫn đi săn/thu phục hoặc khu săn hiện có; không tự thay hệ capture.
- Tìm các ghi chép về đường di cư của Pet thụ phấn và một lối mòn biến mất.

### Hội Anh Hùng — Danh dự và cộng đồng
- Xác minh nhiệm vụ điều tra, cấp tư cách thành viên tập sự theo cơ chế guild sẵn có.
- Giới thiệu nhiệm vụ tiêu diệt/đánh bại quái thú, hộ tống và hoạt động cộng đồng.
- Người chơi hợp tác giải quyết chuyện vùng; không cần là 'người được chọn'.

### Thành Thái Dương — Xung đột kinh tế
- Thành phồn hoa nhất vùng, giàu có nhờ nông nghiệp, hội chợ và giao thương.
- Quan Giám Thành tạm thời lo rằng mất mùa sẽ làm giá lương thực tăng cao.
- Manh mối cho thấy có người đầu cơ Pet vận chuyển hạt giống.
- Thần Thú Emitai chỉ được gợi qua khu vườn cổ và phúc lành ánh sáng, chưa làm boss/capture.

## 4. NPC trọng tâm

| ID tạm | Tên | Vai trò | Động cơ |
|---|---|---|---|
| `MIRA` | Bà Mira | Người chăm sóc Pet tại Làng Nhân Ái | Không để các Pet nhỏ bị bỏ lại |
| `LYRA` | Lyra | Nhà nghiên cứu Vườn Bách Thảo | Tìm nguyên nhân đường di cư thay đổi |
| `GUILD_REP_CH1` | Đại diện Hội Anh Hùng | NPC đầu mối nhiệm vụ | Bảo vệ đường giao thương và dân làng |
| `SUN_STEWARD` | Quan Giám Thành Thái Dương | Chính trị/kinh tế | Tránh thiếu lương thực và bất ổn |
| `COLLECTOR_LEAD` | Trưởng đội thu gom | Đối thủ cấp vùng, không phải thủ lĩnh chính | Lợi nhuận từ Pet hiếm và hạt giống |

Tên mới là đề xuất, có thể thay trước khi xuất Content Pack chính thức.

## 5. Main path 1-1 → 1-30

**Quy ước:** Combat = stage có trận đánh; Story = chỉ thoại hoặc event; Explore = điều tra/thu thập; Mini Boss = thử thách đặc biệt; Hub = mở địa điểm cố định. Có thể kết hợp các loại. Story **không hiện sau mọi trận**. Mỗi cụm 4–6 stage mới cần một tình tiết đáng nhớ.

| Stage | Tên | Loại | Beat truyện / phần thưởng chức năng |
|---|---|---|---|
| 1-1 | Con Đường Hoa Đầu Tiên | Combat + intro | Đặt chân đến vùng mới; trận đánh đơn giản |
| 1-2 | Cột Mốc Lạ | Explore + Story | Một hướng trên cột mốc không khớp bản đồ |
| 1-3 | Làng Nhân Ái | Hub + Story | Gặp Mira, giao thư, mở Daily Gift |
| 1-4 | Vườn Hoa Im Tiếng | Combat | Một số Pet mang phấn hoa biến mất |
| 1-5 | Kẻ Canh Đường Hoa | Mini Boss | Pet hoang bảo vệ đàn của nó, không phải kẻ ác |
| 1-6 | Hạt Giống Chưa Về | Story | Mira nhờ tìm Lyra và lô hạt giống thất lạc |
| 1-7 | Lối Mòn Nhà Kính | Combat | Tiến về Vườn Bách Thảo |
| 1-8 | Vườn Bách Thảo | Hub + Story | Gặp Lyra, mở bãi săn/khám phá |
| 1-9 | Phấn Hoa Ngược Gió | Explore | Tìm những mẫu phấn bất thường |
| 1-10 | Bẫy Trong Vườn | Mini Boss | Đối đầu kẻ săn bắt Pet trái phép |
| 1-11 | Vườn Hoa Cổ | Combat | Giải cứu Pet bị dồn khỏi tuyến di cư |
| 1-12 | Nhật Ký Người Làm Vườn | Lore + Explore | Nhật ký ghi về lối mòn từng được Pet sử dụng |
| 1-13 | Đàn Pet Mang Phấn | Combat + Rescue | Giúp một đàn Pet thoát lưới bẫy |
| 1-14 | Dấu Chỉ Đường Bị Xóa | Story | Tìm ký hiệu lạ trên cột mốc thứ hai |
| 1-15 | Cầu Hoa Bỏ Hoang | Mini Boss | Mở lại lối qua khu vực bị cô lập |
| 1-16 | Hội Anh Hùng | Hub + Story | Đăng ký nhiệm vụ điều tra, mở guild quest cơ bản |
| 1-17 | Lời Hứa Người Tập Sự | Quest + Combat | Chứng minh khả năng trước hội, không cần PvP |
| 1-18 | Trạm Gác Vắng Người | Combat | Gặp dấu vết đoàn xe đã đi lạc |
| 1-19 | Đoàn Xe Không Đến | Event + Combat | Bảo vệ thương nhân, đưa họ về tuyến an toàn |
| 1-20 | Thủ Lĩnh Đội Thu Gom | Mini Boss | Khám phá kẻ mua bán Pet mang phấn hoa |
| 1-21 | Mảnh Bản Đồ Cũ | Story + Explore | Hội nhận ra cột mốc không có trên bản đồ Hoàng Gia |
| 1-22 | Con Đường Lương Thực | Combat | Tiến về Thành Thái Dương |
| 1-23 | Thành Thái Dương | Hub + Story | Gặp Quan Giám Thành, biết nguy cơ mất mùa |
| 1-24 | Kho Hạt Giống | Explore | Phát hiện sự thiếu hụt và đầu cơ hàng hóa |
| 1-25 | Thú Canh Ruộng Bậc Thang | Mini Boss | Một Pet canh vùng trồng trọt bị kích động |
| 1-26 | Lối Đi Không Còn | Combat + Explore | Dẫn nhóm Pet về đường di cư tạm thay thế |
| 1-27 | Vườn Thánh Cổ | Story | Dấu vết của Emitai và một lời dặn về sự cân bằng |
| 1-28 | Người Giữ Hạt Mầm | Elite Battle | Bảo vệ nơi cuối cùng còn giống cây cổ |
| 1-29 | Ánh Sáng Trên Đồng Hoa | Story | Lộ diện nguyên nhân khiến thủ hộ khu vườn bất an |
| 1-30 | Hoa Vệ Của Vườn Cổ | Region Boss | Hạ chiến, hóa giải hiểu nhầm, trả Pet về môi trường; vùng dần hồi phục |

### Nhịp thưởng và boss
- Mini boss ở **1-5, 1-10, 1-15, 1-20, 1-25**.
- **1-30** là boss chính; không phải Emitai.
- EXP/Peta rơi theo gameplay battle có sẵn, Story System **không cộng trùng** thưởng của combat.
- Phần thưởng địa danh/sự kiện chỉ phát một lần với quest, riêng quà Làng Nhân Ái có cooldown daily riêng.
- Mức level đối thủ tùy balance hiện có, **không quy định chỉ số cứng trong lore**.

## 6. Đoạn hội thoại mẫu (để duyệt giọng văn)

**CH1_ARRIVE — Người kể chuyện:** “Con tàu cập bến phía Nam. Trước mắt bạn, những cánh đồng hoa trải dài dưới nắng sớm. Hương cỏ mới và tiếng Pet gọi nhau vang lên khắp con đường.”

**CH1_MILESTONE — Người chơi:** “Lạ thật... Trên cột mốc có khắc một con đường, nhưng bản đồ của Rowan chẳng có lối nào như thế.”

**CH1_MIRA_FIRST — Mira:** “Cháu từ Kinh Đô đến à? Ôi, thư của Rowan! Cảm ơn cháu nhiều lắm. Vào đây nghỉ chân đi, đường xa chắc mệt rồi.”

**CH1_MIRA_WARN — Mira:** “Mấy ngày nay những Pet mang phấn hoa ít quay lại. Hoa vẫn nở, mà hạt giống thì chẳng thấy đâu. Ta lo cho mùa sau quá...”

**CH1_MIRA_GIFT — Mira:** “Làng này chẳng có nhiều của cải, nhưng mọi người vẫn góp chút đồ để giúp người đi đường. Từ mai, cứ ghé qua, bà sẽ để dành cho cháu một phần.”

**CH1_LYRA_FIRST — Lyra:** “Điều kỳ lạ không phải là chúng biến mất. Chúng đang đi theo một lộ trình khác — như thể con đường quen thuộc đã đổi hướng.”

**CH1_GUILD — Đại diện Hội Anh Hùng:** “Giúp đỡ một ngôi làng nhỏ chẳng kém phần đáng quý so với hạ một con quái thú lớn. Nếu muốn tiếp tục điều tra, Hội sẽ hỗ trợ cậu.”

**CH1_END — Người kể chuyện:** “Hoa lại nở trên những cánh đồng phía Nam. Nhưng trong túi người phiêu lưu vẫn còn một mảnh bản đồ không khớp với bất cứ tấm bản đồ hiện đại nào.”

## 7. Điều kiện mở khóa

| Flag ý niệm | Trigger đã được server xác thực |
|---|---|
| `CH1_ENTERED` | Hoàn thành `CH0_Q08` và vào vùng thành công |
| `CH1_MIRA_LETTER_DELIVERED` | Tương tác Mira và xác nhận giao quest item |
| `CH1_VILLAGE_DAILY_UNLOCKED` | Hoàn thành lần gặp Mira; gift claim được kiểm soát daily riêng |
| `CH1_BOTANICAL_GARDEN_UNLOCKED` | Clear tuyến đến 1-8 hoặc quy tắc vùng hiện hành |
| `CH1_GUILD_UNLOCKED` | Hoàn thành scene 1-16 và điều kiện của guild hiện có |
| `CH1_SUN_CITY_VISITED` | Vào Thành Thái Dương thành công |
| `CH1_REGION_BOSS_WON` | Hệ thống battle xác nhận thắng 1-30 |
| `CH2_ROUTE_UNLOCKED` | Kết thúc epilogue và điều kiện mở vùng theo thiết kế |

**Lưu ý:** User vẫn có thể mở các hub như địa danh và sử dụng dịch vụ được phép mà không cần chờ mọi story node, nếu gameplay hiện tại hỗ trợ. Quest progression và feature availability là hai hệ thống khác nhau.

## 8. Map desktop/mobile: overlay nên làm như thế nào

- Artwork **desktop** và **mobile** là hai bố cục khác nhau; không reuse cùng một cặp tọa độ node.
- Bốn hub tương ứng những landmark đã vẽ: Làng Nhân Ái, Vườn Bách Thảo, Hội Anh Hùng, Thành Thái Dương. Label và hotspot nên là React/HTML overlay.
- **Desktop**: hiển thị 4 hub + tối đa 4–6 node quanh vị trí hiện tại; đường đi nối đến mục tiêu đang active.
- **Mobile**: ưu tiên 4 hub tương tác + node hiện tại/1–2 node trước/sau; toàn bộ 30 stage trong một bảng hành trình dạng bottom sheet khi cần.
- Node overlay phải dùng tọa độ chuẩn hóa theo ảnh tương ứng và chịu được zoom/pan, Safari vertical scrolling; không vẽ node cứng vào ảnh.
- Chỉ thấy/di chuyển được theo những node và đường đã mở. Không che artwork bằng quá nhiều icon.
- Nếu user muốn vào Làng Nhân Ái hằng ngày, không bắt họ chiến đấu lại các node 1-1 đến 1-3.

## 9. Quyết định cần chốt trước khi viết Content Pack chính thức

1. **30 combat stages là xương sống gameplay**, không phải 30 cinematic. Xác nhận số stage thực tế đang có trong code.
2. NPC **Lyra**, **Đại diện Hội Anh Hùng**, **Quan Giám Thành**, **Trưởng đội thu gom** là tên/vai trò đề xuất, chưa khóa canon.
3. Bãi săn và capture dùng hệ thống thực tế; không tự tạo vật phẩm, NPC battle hoặc Pet loài mới trước khi tra codebase.
4. Hình tượng Emitai là truyền thuyết và dấu hiệu bảo hộ, **không dùng làm region boss Chapter 1**.
5. Giao thư cho Mira phải cập nhật quest từ Ch0 → Ch1 một lần duy nhất, có thể xem lại hội thoại nhưng không thưởng lại.
6. Tuyến tiếp theo là **Thung Lũng Hạnh Phúc**, để đến Thành Vinh Quang — không lẫn Thành Vinh Quang vào Cánh Đồng Vạn Hoa.
