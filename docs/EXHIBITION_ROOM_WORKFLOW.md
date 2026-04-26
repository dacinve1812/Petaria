# Exhibition Room Workflow

## Scope

Tài liệu mô tả tính năng **Phòng triễn lãm** trong Petaria, bao gồm:

- Luồng đưa item từ inventory vào phòng triễn lãm
- Luồng gỡ item khỏi phòng triễn lãm và trả về inventory
- Luồng sắp xếp item trái/phải
- Quy tắc hiển thị UI theo owner/non-owner

## Frontend pages and routes

- Management entry: `src/components/MyStuffManagement.js` (`/management`)
- Exhibition page: `src/components/ExhibitionRoom.js`
- Router registration: `src/App.js`

Routes:

- `GET UI /exhibition` -> phòng triễn lãm của owner (người đang đăng nhập)
- `GET UI /exhibition/:userId` -> xem phòng triễn lãm của user khác

## UI behavior

### Owner view

- Có thể:
  - Di chuyển item qua trái/phải
  - Gỡ item khỏi phòng triễn lãm
  - Copy link chia sẻ
- Header hiển thị: `Phòng Triễn Lãm của bạn`

### Non-owner view

- Chỉ xem danh sách item trưng bày
- Không hiển thị các nút thao tác owner
- Không hiển thị link chia sẻ
- Header hiển thị: `Phòng Triễn Lãm {username}`

### Exhibition stage layout

- Stage dùng grid và giữ tối đa 10 slot
- Khi có item: render item + placeholder còn trống
- Khi chưa có item nào: chỉ hiển thị thông báo:
  - `Chưa có vật phẩm nào trong phòng triễn lãm.`

## Inventory integration

Trong `ItemDetailModal` (`src/components/items/ItemDetailModal.js`):

- Action dropdown có option: `Mang vào phòng triển lãm`
- Khi chọn action này:
  - Gọi API thêm item vào triển lãm
  - Nếu thành công:
    - Trừ `quantity - 1` trong inventory
    - Nếu quantity về `0` thì remove record inventory item

Business rules:

- Không cho thêm item đang trang bị (`is_equipped = 1`)
- Không cho thêm trùng item đang có trong triển lãm
- Giới hạn tối đa 10 item / user

## Backend data model

Table chính:

- `user_exhibition_items`
  - `id` (PK)
  - `user_id` (FK -> `users.id`)
  - `item_id` (FK -> `items.id`)
  - `display_order`
  - `created_at`, `updated_at`
  - unique `(user_id, item_id)` để chặn trùng item

Table được tạo bằng `CREATE TABLE IF NOT EXISTS` trong `backend/server.js`:

- `ensureExhibitionTables()`

## Backend APIs

Nguồn: `backend/server.js`

### 1) Get exhibition list

- `GET /api/users/:userId/exhibition`
- Auth: Bearer token
- Response:
  - `items`: danh sách item trưng bày (kèm metadata item)
  - `maxItems`: mặc định `10`

### 2) Add item from inventory to exhibition

- `POST /api/inventory/:id/exhibition`
- Auth: Bearer token
- Input:
  - `:id` là `inventory.id`
- Logic:
  - Validate ownership inventory item
  - Validate not equipped
  - Validate not duplicated in exhibition
  - Validate room capacity (< 10)
  - Insert `user_exhibition_items`
  - Decrease inventory quantity by 1 (xóa row nếu về 0)

### 3) Reorder exhibition item

- `POST /api/exhibition/reorder`
- Auth: Bearer token
- Body:
  - `exhibitionItemId`
  - `direction`: `left` | `right`
- Logic:
  - Chỉ owner reorder được item của mình
  - Swap `display_order` giữa item hiện tại và item lân cận

### 4) Remove exhibition item and return inventory

- `DELETE /api/exhibition/:exhibitionItemId`
- Auth: Bearer token
- Logic:
  - Chỉ owner remove được item của mình
  - Xóa row khỏi `user_exhibition_items`
  - Trả item về inventory:
    - Nếu đã có row inventory cùng `item_id` (không equip) -> `quantity + 1`
    - Nếu chưa có -> tạo row mới quantity `1`

## Related profile behavior

`src/components/UserProfile.js`:

- Ẩn `profile-share-card` nếu không phải owner
- Thêm action row dưới profile:
  - `Xem phòng triển lãm` -> điều hướng `/exhibition/:userId`
  - `Kết bạn` -> gửi buddy request hoặc điều hướng Buddies page tùy trạng thái

## Validation checklist

Khi chỉnh sửa tính năng này, nên test tối thiểu:

1. Owner thêm item vào triển lãm từ inventory (quantity giảm đúng).
2. Item quantity = 1 được chuyển hẳn khỏi inventory.
3. Add trùng item báo đúng thông báo.
4. Full 10 item không cho add thêm.
5. Reorder trái/phải hoạt động và giữ thứ tự mới.
6. Remove item khỏi triển lãm trả item về inventory đúng quantity.
7. Non-owner không thấy link share ở:
   - User Profile
   - Exhibition Room
8. Khi phòng trống hoàn toàn chỉ hiện thông báo trống, không hiện placeholder slot.

