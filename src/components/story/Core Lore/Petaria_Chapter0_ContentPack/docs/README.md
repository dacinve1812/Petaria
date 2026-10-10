# PETARIA — Chapter 0 Content Pack v1.2

**Người Phiêu Lưu Tập Sự** | `vi-VN` | Content-only, chưa kết nối code game.

## Mục tiêu

Tuyến onboarding có hướng dẫn mềm: mở đầu → Ari đứng tại My Home trên Kinh thành, highlight Trại Mồ Côi → nhận một Pet đang chờ (bắt buộc) → vào nhà / Sông Healia / Shop (tùy chọn) → Đấu trường, chọn Arena, thắng NPC cấp 1 (bắt buộc) → Rowan tại Bưu Điện → nhận thư gửi bà Mira → highlight bến tàu (ô xanh) → mở bản đồ thế giới, chỉ phía Nam → vào Cánh Đồng Vạn Hoa thì hết chương. Trao thư là việc của Chapter 1.

## Danh mục file

- `content/manifest.json`: metadata và artwork cần tạo.
- `content/characters.vi.json`: profile các NPC và người kể chuyện.
- `content/scenes.vi.json`: tất cả hội thoại, opening, chapter transition.
- `content/quests.vi.json`: tám nhiệm vụ với điều kiện và scene liên quan.
- `content/rewards.config.json`: tham chiếu phần thưởng, chưa chốt ID item/Peta/EXP.
- `content/transitions.config.json`: logic story flow, gate và legacy handling.
- `docs/DIALOGUE_SCRIPT.md`: kịch bản để đọc và duyệt.
- `docs/INTEGRATION_GUIDE.md`: hướng dẫn cho Codex và QA.

## Canon và nguyên tắc

Giữ Core Lore Petaria đã duyệt: Kinh Đô Centre Island dưới Vua Crosus; người chơi là cư dân phiêu lưu bình thường; tình bạn cùng Pet; bí ẩn Thiên Mạch chỉ được hé lộ dần. Chapter 0 **không** giải thích Thiên Mạch, Hội Tầm Lộ hay Đại Biến Cố Phân Giới. Rowan chỉ nhắc đường phía Nam bất thường.

**Không tạo loài Pet, item hay Peta mới trong Chapter 0.** Pet đầu tiên là một Pet bất kỳ trong danh sách nhận nuôi hiện có; bộ starter sẽ cấu hình sau. Phần thưởng vẫn là tham chiếu, chưa chốt số.

Ari đứng trên bản đồ Kinh thành, trong ô My Home. Chỉ đường là highlight để người chơi tự bấm, không dịch chuyển hộ. Trại huấn luyện (`/battle/training`) chỉ được nhắc miệng. Trận bắt buộc là Arena (`/battle` → `/battle/arena`). Bến tàu là ô riêng trên Kinh thành; tọa độ desktop và mobile nằm trong `content/transitions.config.json`.
