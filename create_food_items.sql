-- Tạo Food Items cho Hunger Status System
-- Chạy script này sau khi chạy hunger_status_migration.sql

-- 1. Thêm food items vào bảng items (nếu chưa có)
INSERT INTO items (name, description, type, rarity, image_url, buy_price, sell_price, created_at) VALUES
-- Common food (+1 status level)
('Bánh mì cơ bản', 'Bánh mì đơn giản giúp pet no bụng.', 'food', 'common', 'alf_bread.gif', 50, 25, NOW()),
('Táo tươi', 'Táo ngọt giúp pet hết đói.', 'food', 'common', 'tropical_snowberry.gif', 60, 30, NOW()),

-- Uncommon food (+1-2 status level)
('Bánh kem ngọt', 'Bánh kem thơm ngon giúp pet no bụng hơn.', 'food', 'uncommon', 'mall_cake_wonderland.gif', 150, 75, NOW()),
('Pizza hạnh phúc', 'Pizza với hình mặt cười làm pet rất vui.', 'food', 'uncommon', 'food_smiley_pizza_3.gif', 200, 100, NOW()),

-- Rare food (+2-3 status level)
('Bữa tiệc hoàng gia', 'Bữa ăn sang trọng giúp pet no bụng hoàn toàn.', 'food', 'rare', 'foo_adca2014_aheartymeal.gif', 500, 250, NOW()),
('Thức ăn thần thánh', 'Thức ăn quý hiếm giúp pet luôn no bụng.', 'food', 'epic', 'food_diamondhotdog.gif', 1000, 500, NOW())

ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    buy_price = VALUES(buy_price),
    sell_price = VALUES(sell_price);

-- 2. Thêm vào food_recovery_items
INSERT INTO food_recovery_items (item_id, recovery_amount) VALUES
-- Common food (+1 level)
((SELECT id FROM items WHERE name = 'Bánh mì cơ bản'), 1),
((SELECT id FROM items WHERE name = 'Táo tươi'), 1),

-- Uncommon food (+1-2 level)
((SELECT id FROM items WHERE name = 'Bánh kem ngọt'), 2),
((SELECT id FROM items WHERE name = 'Pizza hạnh phúc'), 2),

-- Rare food (+2-3 level)
((SELECT id FROM items WHERE name = 'Bữa tiệc hoàng gia'), 3),
((SELECT id FROM items WHERE name = 'Thức ăn thần thánh'), 3);

-- 3. Thêm vào food shop
INSERT INTO shop_items (shop_id, item_id, custom_price, currency_type, stock_limit) 
SELECT 
    (SELECT id FROM shop_definitions WHERE code = 'food_shop' LIMIT 1) as shop_id,
    id as item_id,
    buy_price as custom_price,
    'gold' as currency_type,
    20 as stock_limit
FROM items 
WHERE name IN (
    'Bánh mì cơ bản', 'Táo tươi', 'Bánh kem ngọt', 
    'Pizza hạnh phúc', 'Bữa tiệc hoàng gia', 'Thức ăn thần thánh'
)
ON DUPLICATE KEY UPDATE 
    custom_price = VALUES(custom_price),
    stock_limit = VALUES(stock_limit);

-- 4. Kiểm tra kết quả
SELECT 
    i.name,
    i.rarity,
    i.buy_price,
    fri.recovery_amount,
    'Food Shop' as available_in
FROM items i
JOIN food_recovery_items fri ON i.id = fri.item_id
ORDER BY i.rarity, i.name; 