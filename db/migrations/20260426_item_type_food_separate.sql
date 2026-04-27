-- Tách type `food` khỏi `consumable` (dữ liệu cũ: consumable + category = food)
-- Chạy thủ công nếu muốn; game vẫn hỗ trợ consumable+category food qua itemActsAsFoodForPetUse.

UPDATE items
SET type = 'food'
WHERE type = 'consumable'
  AND LOWER(TRIM(IFNULL(category, ''))) = 'food';
