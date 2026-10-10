# CHAPTER 0 — KỊCH BẢN TIẾNG VIỆT

Mỗi cảnh có ID cố định để biên tập và localization. Các ACTION là chỉ dẫn của engine, không phải lời thoại hiển thị.

Chỉ đường trên Kinh thành là **highlight** hotspot. Người chơi tự bấm. Không dịch chuyển hộ.

Ari đứng trong ô **My Home** trên bản đồ Kinh thành khi chào. Bến tàu là ô riêng. Tọa độ desktop và mobile nằm trong `content/transitions.config.json`.

## CH0_OPENING — NARRATION | CAPITAL

**NARRATOR**: Giữa biển trời bao la tồn tại Petaria — vương quốc nơi con người và những sinh vật kỳ diệu cùng chung sống.

**NARRATOR**: Từ cánh đồng hoa rực rỡ đến miền tuyết trắng, từ rừng sâu đến đại dương, mỗi vùng đất đều lưu giữ những truyền thuyết riêng.

**NARRATOR**: Có người mở cửa hàng, có người chăm sóc Pet, có người mong trở thành anh hùng. Và cũng có người chỉ muốn tìm một nơi để gọi là nhà.

**NARRATOR**: Hôm nay, một hành trình mới bắt đầu tại Centre Island — Kinh Đô Petaria.

`ACTION: SHOW_CHAPTER_TITLE`

## CH0_ARI_WELCOME — DIALOGUE | CAPITAL

Ari đứng tại hotspot My Home (ô đỏ). Cảnh chơi trên bản đồ Kinh thành, không phải trong trang nhà.

**ARI**: A! Cuối cùng cũng gặp được cậu. Cậu là cư dân mới đến Centre Island hôm nay phải không?

**ARI**: Ta là Ari, hướng dẫn viên của Kinh Đô. Thành phố này rộng lắm — lạc đường một lần là chuyện bình thường!

**Lựa chọn:** Cậu muốn bắt đầu thế nào?
- Tôi muốn trở thành nhà huấn luyện! → “Thế thì trước tiên cậu cần một Pet đồng hành.”
- Tôi muốn kiếm thật nhiều Peta! → “Có chí hướng đấy! Nhưng một người bạn đồng hành cũng rất đáng quý.”
- Tôi muốn khám phá mọi vùng đất. → “Tuyệt! Petaria còn rộng hơn những gì cậu thấy trên bản đồ.”

**ARI**: Trước hết, đến Trại Mồ Côi nhé. Cô Elina đang chăm sóc những Pet chờ được nhận nuôi. Cậu bấm vào chỗ ta đang chỉ là tới.

`ACTION: HIGHLIGHT_MAP_LOCATION` → `ORPHANAGE`

## CH0_ELINA_INTRO — DIALOGUE | ORPHANAGE

**ELINA**: Chào cháu. Cháu đến tìm một người bạn đồng hành đầu tiên phải không?

**ELINA**: Những Pet ở đây đang chờ một người bạn. Mỗi bé một tính cách, nhưng đều mong gặp người biết chăm sóc mình.

**ELINA**: Cháu cứ chọn một bé trong số những Pet đang chờ. Không cần chọn theo sức mạnh. Hãy chọn người bạn mà cháu muốn cùng trưởng thành.

`ACTION: OPEN_EXISTING_ADOPTION`

Mở đúng màn nhận nuôi hiện tại. Pet nào trong danh sách cũng được. Bộ lọc starter cấu hình sau. Không tạo loài mới.

## CH0_ELINA_CONFIRM — DIALOGUE | ORPHANAGE

**ELINA**: Nhìn xem, người bạn nhỏ của cháu đang rất vui đấy!

**ELINA**: Cô chỉ mong cháu nhớ: chiến thắng thật đáng tự hào, nhưng biết chăm sóc một người bạn còn quan trọng hơn.

**ARI**: Hai người hợp nhau thật! Về nhà xem thông tin Pet nào. Nhà của cậu nằm chỗ ta đã đứng lúc nãy.

`ACTION: HIGHLIGHT_MAP_LOCATION` → `MY_HOME`

## CH0_HOME — DIALOGUE | MY_HOME

**ARI**: Chào mừng về nhà! Đây là nơi cậu quản lý Pet, kiểm tra hành trang và chuẩn bị cho những chuyến đi xa.

**ARI**: Hãy mở hồ sơ của Pet. Cậu sẽ thấy HP, MP, cấp độ và các chỉ số chiến đấu. Chưa cần nhớ hết ngay đâu!

`ACTION: OPEN_PET_PROFILE`

## CH0_HOME_DONE — DIALOGUE | MY_HOME

**ARI**: Thấy không? Mỗi Pet đều có điểm mạnh riêng. Dành thời gian tìm hiểu sẽ giúp cả hai phối hợp tốt hơn.

## CH0_HEALIA — DIALOGUE | HEALIA

**ARI**: Đây là Sông Healia. Những người chăm Pet đã tìm đến dòng nước này từ rất lâu rồi.

**ARI**: Khi Pet bị thương, cậu có thể trở lại đây để hồi phục. Hôm nay hãy thử một lần nhé.

`ACTION: OPEN_HEAL_SERVICE`

## CH0_HEALIA_DONE — DIALOGUE | HEALIA

**ARI**: Tốt rồi! Dù Pet đang khỏe, biết chỗ nghỉ ngơi cũng rất quan trọng.

## CH0_SHOP — DIALOGUE | OFFICIAL_SHOP

**BRAM**: Khách mới à? Chào mừng đến Trung Tâm Mua Sắm!

**BRAM**: Đi săn thì nhớ mang thức ăn và đồ hồi phục. Nhưng hôm nay cậu không phải tiêu Peta đâu.

**BRAM**: Ta có một gói hỗ trợ cho người mới. Nhận thử rồi kiểm tra hành trang nhé!

`ACTION: OPEN_TUTORIAL_SUPPLIES_CLAIM`

## CH0_SHOP_DONE — DIALOGUE | OFFICIAL_SHOP

**BRAM**: Khi đủ kinh nghiệm, cậu còn có thể xem chợ trời và cửa hàng của những cư dân khác. Giao thương cũng là một phần của Petaria!

## CH0_ARENA_INTRO — DIALOGUE | BATTLE_HUB

**ARI**: Có Pet rồi thì ra Đấu trường thử một trận nhé. Vào mục Đấu trường, rồi chọn Arena.

**ARI**: Quan sát HP và MP, chọn kỹ năng phù hợp rồi xem Pet phản ứng thế nào. Đối thủ đầu tiên còn non lắm.

**ARI**: Trong đó còn có Trại huấn luyện — nơi gửi Pet nhận kinh nghiệm theo thời gian. Hôm nay chưa cần tới. Khi nào muốn Pet lớn lên lúc cậu nghỉ, hãy quay lại sau.

`ACTION: HIGHLIGHT_NAV` → `/battle`

`ACTION: HIGHLIGHT_BATTLE_MODE` → `/battle/arena`

`ACTION: START_ARENA_BATTLE` → NPC Arena cấp 1 đang có

Trận này dùng Arena thật. Kỳ vọng người chơi thắng vì NPC cấp 1 rất dễ. Không có cờ thắng sẵn. Nếu thua, nhiệm vụ chưa xong và được đấu lại.

## CH0_ARENA_LOSE — DIALOGUE | ARENA

Chỉ chạy khi thua. Không phải nhịp chính của chương.

**ARI**: Không sao. Nghỉ một chút rồi vào Arena đấu lại nhé. Đối thủ ấy vẫn đang chờ.

`ACTION: OFFER_BATTLE_RETRY` → Arena, NPC cấp 1

## CH0_ARENA_WIN — DIALOGUE | ARENA

**ARI**: Hay lắm! Cậu và Pet phối hợp tốt hơn ta tưởng.

**ARI**: Nghe nói Bưu Điện đang cần người nhận nhiệm vụ. Cậu có muốn tìm thử công việc phiêu lưu đầu tiên không?

`ACTION: HIGHLIGHT_MAP_LOCATION` → `POST_OFFICE`

## CH0_ROWAN_INTRO — DIALOGUE | POST_OFFICE

**ROWAN**: Chào cậu! Ta là Rowan, phụ trách tuyến thư phía Nam của Bưu Điện Kinh Đô.

**ROWAN**: Ta có một lá thư cần được giao tận tay bà Mira ở Làng Nhân Ái, phía Cánh Đồng Vạn Hoa.

**ROWAN**: Dạo gần đây thư đi tuyến ấy thường đến muộn. Có người bảo cứ đi mãi lại quay về chỗ cũ.

**ARI**: Chắc họ không quen Đường Hoa thôi! Tuyến đó có gì khó đâu.

**ROWAN**: Kỳ lạ là vài người trong số họ đã đi tuyến này hàng chục năm…

**Lựa chọn:** Cậu có nhận chuyến thư này không?
- Tôi nhận nhiệm vụ. → “Cảm ơn cậu. Hãy trao tận tay bà Mira, đừng đưa cho người khác nhé.”
- Để tôi chuẩn bị thêm. → “Không vội. Khi sẵn sàng, quay lại gặp ta.”

`ACTION: OFFER_SERVER_QUEST_ACCEPT` chỉ khi chọn nhận. Chọn “để sau” không trao thư và không hoàn thành nhiệm vụ.

Trao thư cho bà Mira là việc của Chapter 1.

## CH0_ROWAN_ACCEPTED — DIALOGUE | POST_OFFICE

**ROWAN**: Thư đã được niêm phong. Hãy giữ cẩn thận; ta sẽ chờ tin từ Làng Nhân Ái.

**ARI**: Vậy là chuyến phiêu lưu đầu tiên bắt đầu rồi! Ra bến tàu trên Kinh thành. Ta sẽ chỉ cậu đường xuống phía Nam.

`ACTION: HIGHLIGHT_MAP_LOCATION` → `CAPITAL_PORT`

## CH0_PORT — DIALOGUE | CAPITAL_PORT

Bến tàu là ô spotlight `CAPITAL_PORT` trên bản đồ Kinh thành. Chưa có nút bấm riêng.

**ARI**: Đây là bến tàu. Ngoài Centre Island là những vùng đất rộng lớn. Có nơi đầy hoa, có nơi tuyết rơi quanh năm!

**ARI**: Nhiệm vụ của cậu là đến Làng Nhân Ái trước. Cánh Đồng Vạn Hoa nằm về phía Nam.

**ARI**: Nhớ giữ sức cho Pet. Và… khi nào có dịp, quay về Kinh Đô kể ta nghe chuyến đi nhé!

`ACTION: OPEN_WORLD_MAP` → focus `FLOWER_FIELDS` (vùng `3-1`)

## CH0_DEPART — CHAPTER | WORLD_MAP

Chạy một lần khi vào Cánh Đồng Vạn Hoa lần đầu sau khi đã nhận thư. Xem lại trong lưu trữ không phát thưởng và không đẩy chương thêm lần nữa.

**CHƯƠNG 1 — CÁNH ĐỒNG VẠN HOA — NHỮNG HẠT GIỐNG THẤT LẠC**

**NARRATOR**: Ngoài khơi Centre Island, những cánh đồng hoa trải dài dưới nắng. Và ở đâu đó giữa những con đường quen thuộc, một điều bất thường đang chờ được phát hiện.
