# Hệ Thống Ngân Hàng Petaria - Documentation

## Tổng Quan

Hệ thống ngân hàng Petaria được phát triển dựa trên logic từ game gốc, cho phép người dùng gửi tiền vào ngân hàng để kiếm lãi suất hàng ngày. Hệ thống hỗ trợ cả Gold và PetaGold.

## Logic Chính

### 1. Hệ Thống Lãi Suất (Interest System)

- **Lãi suất mặc định**: 5%/năm
- **Tính lãi hàng ngày**: `(số_dư * lãi_suất) / 365`
- **Thu lãi**: Mỗi ngày chỉ được thu lãi một lần
- **Lãi được cộng vào**: Cả số dư ngân hàng và số dư người dùng

### 2. Giao Dịch (Transactions)

#### Gửi Tiền (Deposit)
- Chuyển tiền từ `users.gold/petagold` vào `bank_accounts.gold_balance/petagold_balance`
- Validation: Kiểm tra số tiền hợp lệ, không âm, không vượt quá số dư

#### Rút Tiền (Withdraw)
- Chuyển tiền từ `bank_accounts` về `users`
- Validation: Kiểm tra số tiền không vượt quá số dư ngân hàng

### 3. Database Schema

#### Bảng `bank_accounts`
```sql
CREATE TABLE bank_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    gold_balance DECIMAL(15,2) DEFAULT 0.00,
    petagold_balance DECIMAL(15,2) DEFAULT 0.00,
    interest_rate DECIMAL(5,2) DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_account (user_id)
);
```

#### Bảng `bank_interest_logs`
```sql
CREATE TABLE bank_interest_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    interest_date DATE NOT NULL,
    gold_interest DECIMAL(15,2) DEFAULT 0.00,
    petagold_interest DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_daily_interest (user_id, interest_date)
);
```

#### Bảng `bank_transactions`
```sql
CREATE TABLE bank_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    transaction_type ENUM('deposit', 'withdraw') NOT NULL,
    currency_type ENUM('gold', 'petagold') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## API Endpoints

### 1. Lấy Thông Tin Tài Khoản
```
GET /api/bank/account/:userId
```
**Response:**
```json
{
  "id": 1,
  "user_id": 123,
  "gold_balance": 1000.00,
  "petagold_balance": 500.00,
  "interest_rate": 5.00,
  "interest_collected_today": false,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### 2. Tạo Tài Khoản Ngân Hàng
```
POST /api/bank/create-account
```
**Body:**
```json
{
  "userId": 123
}
```

### 3. Thu Lãi Suất
```
POST /api/bank/collect-interest
```
**Body:**
```json
{
  "userId": 123
}
```
**Response:**
```json
{
  "success": true,
  "message": "Đã thu 2 Gold và 1 PetaGold lãi suất",
  "interestAmount": 3
}
```

### 4. Thực Hiện Giao Dịch
```
POST /api/bank/transaction
```
**Body:**
```json
{
  "userId": 123,
  "type": "deposit", // hoặc "withdraw"
  "amount": 100,
  "currencyType": "gold" // hoặc "petagold"
}
```

### 5. Lấy Lịch Sử Giao Dịch
```
GET /api/bank/transactions/:userId?page=1&limit=20
```

## Frontend Component

### Bank.js
- **Location**: `src/components/Bank.js`
- **Features**:
  - Hiển thị thông tin tài khoản
  - Form gửi/rút tiền
  - Thu lãi suất hàng ngày
  - Responsive design
  - Error/Success messages

### Styling
- **Location**: `src/components/Bank.css`
- **Features**:
  - Modern gradient design
  - Responsive layout
  - Smooth animations
  - Mobile-friendly

## Cách Sử Dụng

### 1. Tạo Tài Khoản
- Người dùng chưa có tài khoản sẽ thấy nút "Tạo Tài Khoản Ngân Hàng"
- Click để tạo tài khoản với số dư ban đầu = 0

### 2. Gửi Tiền
- Chọn loại tiền (Gold/PetaGold)
- Chọn "Gửi tiền"
- Nhập số tiền muốn gửi
- Click "Gửi Tiền"

### 3. Rút Tiền
- Chọn loại tiền
- Chọn "Rút tiền"
- Nhập số tiền muốn rút
- Click "Rút Tiền"

### 4. Thu Lãi Suất
- Mỗi ngày có thể thu lãi một lần
- Click "Thu Lãi Suất Hôm Nay"
- Lãi sẽ được cộng vào cả ngân hàng và ví người dùng

## Tính Năng Bảo Mật

1. **Transaction Safety**: Sử dụng database transactions để đảm bảo tính nhất quán
2. **Validation**: Kiểm tra đầu vào nghiêm ngặt
3. **Authorization**: Yêu cầu token để truy cập API
4. **Error Handling**: Xử lý lỗi toàn diện

## So Sánh Với Game Gốc

| Tính Năng | Game Gốc | Petaria Mới |
|-----------|-----------|-------------|
| Lãi suất | Cố định theo rate | 5% mặc định |
| Loại tiền | Chỉ points | Gold + PetaGold |
| UI | HTML cũ | React hiện đại |
| Database | MySQL cũ | MySQL với schema mới |
| API | PHP | Node.js/Express |

## Cài Đặt

1. **Tạo Database Tables**:
   ```bash
   mysql -u root -p petaria < create_bank_tables.sql
   ```

2. **Restart Backend Server**:
   ```bash
   cd petaria/backend
   npm start
   ```

3. **Access Bank Page**:
   - Navigate to `/bank` trong ứng dụng

## Troubleshooting

### Lỗi Thường Gặp

1. **"Chưa có tài khoản ngân hàng"**
   - Giải pháp: Tạo tài khoản mới

2. **"Đã thu lãi suất hôm nay rồi"**
   - Giải pháp: Chờ đến ngày hôm sau

3. **"Không đủ tiền"**
   - Giải pháp: Kiểm tra số dư trước khi giao dịch

### Debug

- Check browser console cho frontend errors
- Check server logs cho backend errors
- Verify database connection và table structure
