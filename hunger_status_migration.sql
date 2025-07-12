-- Hunger Status System Migration
-- Hệ thống status đơn giản: Chết đói (0) -> Đói (1) -> Hơi đói (2) -> Mập mạp (3)

-- 1. Thêm cột hunger_status và hunger_battles vào bảng pets
ALTER TABLE pets ADD COLUMN hunger_status INT DEFAULT 3; -- 0: Chết đói, 1: Đói, 2: Hơi đói, 3: Mập mạp
ALTER TABLE pets ADD COLUMN hunger_battles INT DEFAULT 0; -- Số trận từ lần ăn cuối

-- 2. Tạo bảng hunger_status_history để track thay đổi
CREATE TABLE hunger_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pet_id INT NOT NULL,
    old_status INT NOT NULL,
    new_status INT NOT NULL,
    old_battles INT NOT NULL,
    new_battles INT NOT NULL,
    change_reason VARCHAR(50) NOT NULL, -- 'battle', 'feeding', 'healing'
    food_item_id INT NULL, -- ID của food item nếu là feeding
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    FOREIGN KEY (food_item_id) REFERENCES items(id) ON DELETE SET NULL
);

-- 3. Tạo bảng food_recovery_items (items để hồi phục hunger status)
CREATE TABLE food_recovery_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    item_id INT NOT NULL,
    recovery_amount INT NOT NULL, -- Số status level tăng lên
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- 4. Tạo indexes cho performance
CREATE INDEX idx_pet_hunger_status ON pets(hunger_status, hunger_battles);
CREATE INDEX idx_hunger_status_history ON hunger_status_history(pet_id, created_at);

-- 5. Kiểm tra kết quả
DESCRIBE pets;
DESCRIBE hunger_status_history;
DESCRIBE food_recovery_items; 