# 📬 Mail System APIs Documentation

## 🎯 Tổng quan
Mail System cho phép user nhận thông báo, quà tặng và tương tác với admin/system. Hệ thống hỗ trợ 3 loại sender: `user`, `admin`, `system`.

## 📋 Database Schema

### Bảng `mails`
```sql
CREATE TABLE mails (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    sender_type ENUM('user', 'admin', 'system') NOT NULL,
    sender_id INT NULL, -- NULL nếu system
    sender_name VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    attached_rewards JSON NULL, -- Format: {"peta": 100, "peta_gold": 50, "items": [{"item_id": 1, "quantity": 5}]}
    is_read BOOLEAN DEFAULT FALSE,
    is_claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expire_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);
```

## 🔧 API Endpoints

### User APIs

#### 1. GET `/api/mails/:userId`
**Lấy danh sách mail của user**

**Parameters:**
- `userId` (path): ID của user
- `filter` (query, optional): Loại filter
  - `all` (default): Tất cả mail
  - `unread`: Mail chưa đọc
  - `claimed`: Mail đã claim
  - `unclaimed`: Mail chưa claim
  - `system`: Mail từ hệ thống
  - `admin`: Mail từ admin
  - `user`: Mail từ user khác

**Response:**
```json
[
  {
    "id": 1,
    "user_id": 3,
    "sender_type": "system",
    "sender_id": null,
    "sender_name": "Hệ thống",
    "subject": "Chào mừng đến Petaria!",
    "message": "Chào mừng bạn đến với thế giới Petaria!",
    "attached_rewards": "{\"peta\": 1000, \"peta_gold\": 50, \"items\": [{\"item_id\": 8, \"quantity\": 5}]}",
    "is_read": false,
    "is_claimed": false,
    "created_at": "2025-07-29T23:41:36.000Z",
    "expire_at": "2025-08-28T23:41:36.000Z",
    "sender_username": null
  }
]
```

#### 2. POST `/api/mails/claim/:mailId`
**Claim 1 mail (nhận quà)**

**Parameters:**
- `mailId` (path): ID của mail
- `userId` (body): ID của user

**Request Body:**
```json
{
  "userId": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Claim thành công!",
  "rewards": {
    "peta": 1000,
    "peta_gold": 50,
    "items": [{"item_id": 8, "quantity": 5}]
  }
}
```

#### 3. POST `/api/mails/claim-all/:userId`
**Claim tất cả mail chưa claim**

**Parameters:**
- `userId` (path): ID của user

**Response:**
```json
{
  "success": true,
  "message": "Claim thành công 2 mail!",
  "totalPeta": 1500,
  "totalPetaGold": 60,
  "totalItems": 2
}
```

#### 4. PUT `/api/mails/:mailId/read`
**Đánh dấu mail đã đọc**

**Parameters:**
- `mailId` (path): ID của mail
- `userId` (body): ID của user

**Request Body:**
```json
{
  "userId": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã đánh dấu đọc"
}
```

#### 5. DELETE `/api/mails/:mailId`
**Xóa mail**

**Parameters:**
- `mailId` (path): ID của mail
- `userId` (body): ID của user

**Request Body:**
```json
{
  "userId": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đã xóa mail"
}
```

#### 6. GET `/api/mails/:userId/unread-count`
**Đếm mail chưa đọc**

**Parameters:**
- `userId` (path): ID của user

**Response:**
```json
{
  "unread_count": 2,
  "unclaimed_count": 1
}
```

### Admin APIs

#### 7. POST `/api/admin/mails/send`
**Admin gửi mail**

**Request Body:**
```json
{
  "user_id": 3,
  "sender_name": "Thầy Lão",
  "subject": "Phần thưởng nhiệm vụ",
  "message": "Bạn đã hoàn thành nhiệm vụ xuất sắc!",
  "attached_rewards": {
    "peta": 500,
    "peta_gold": 25,
    "items": [
      {"item_id": 4, "quantity": 2}
    ]
  },
  "expire_days": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Gửi mail thành công!"
}
```

#### 8. POST `/api/admin/mails/system-send`
**System auto send mail**

**Request Body:**
```json
{
  "user_id": 3,
  "subject": "Thưởng Daily Login",
  "message": "Chào mừng bạn quay lại! Đây là thưởng đăng nhập hằng ngày.",
  "attached_rewards": {
    "peta": 50,
    "items": [
      {"item_id": 8, "quantity": 1}
    ]
  },
  "expire_days": 7
}
```

**Response:**
```json
{
  "success": true,
  "message": "Gửi system mail thành công!"
}
```

#### 9. POST `/api/admin/mails/cleanup`
**Xóa mail hết hạn**

**Response:**
```json
{
  "success": true,
  "message": "Đã xóa 5 mail",
  "deleted_count": 5
}
```

## 🎁 Attached Rewards Format

### Currency
```json
{
  "peta": 1000,        // Gold currency
  "peta_gold": 50      // Premium currency
}
```

### Items
```json
{
  "items": [
    {"item_id": 8, "quantity": 5},   // Item ID 8, số lượng 5
    {"item_id": 4, "quantity": 2}    // Item ID 4, số lượng 2
  ]
}
```

### Combined
```json
{
  "peta": 1000,
  "peta_gold": 50,
  "items": [
    {"item_id": 8, "quantity": 5},
    {"item_id": 4, "quantity": 2}
  ]
}
```

## 🔄 Logic Claim Rewards

1. **Currency**: Cộng trực tiếp vào `users.gold` và `users.petagold`
2. **Items**: Thêm vào `inventory` table
   - Nếu item đã có: cộng thêm `quantity`
   - Nếu item chưa có: tạo record mới
3. **Mark claimed**: Set `is_claimed = TRUE`

## 🧹 Auto Cleanup Logic

Mail sẽ bị xóa tự động khi:
- `expire_at < NOW()` (hết hạn)
- `is_read = TRUE AND is_claimed = TRUE AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)` (đã đọc, đã claim, cũ hơn 30 ngày)

## 🧪 Testing

Chạy file test để kiểm tra APIs:
```bash
cd petaria/backend
node test_mail_apis.js
```

## 📝 Notes

- Mail system hỗ trợ tối đa 100 mail/user
- Admin có thể gửi mail với `sender_type = 'admin'` hoặc `'system'`
- System mail thường có `expire_days = 7` (ngắn hạn)
- Admin mail thường có `expire_days = 30` (dài hạn)
- Red dot notification dựa trên `unclaimed_count` từ API `/api/mails/:userId/unread-count` 