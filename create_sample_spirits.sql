-- Tạo dữ liệu mẫu cho hệ thống Linh Thú

-- 1. Thêm các Linh Thú mẫu
INSERT INTO spirits (name, description, image_url, rarity, max_stats_count) VALUES
('Angel Puss', 'Linh thú thiên thần với sức mạnh chữa lành', 'angelpuss.gif', 'rare', 2),
('Babaa Starry', 'Linh thú cừu sao với khả năng tăng sức mạnh', 'babaa_starry.gif', 'epic', 3),
('Petpet Babyca', 'Linh thú nhỏ bé nhưng mạnh mẽ', 'petpet_babyca.gif', 'common', 2),
('Pets Babaa', 'Linh thú cừu thông thường', 'pets_babaa.gif', 'common', 2),
('Pet Advent 2004', 'Linh thú cổ xưa với sức mạnh bí ẩn', 'pet_advent_2004.gif', 'legendary', 4),
('Snicklebeast Black', 'Linh thú bóng đêm với sức mạnh tối tăm', 'snicklebeast_black.gif', 'epic', 3);

-- 2. Thêm stats cho từng Linh Thú
-- Angel Puss (Rare - 2 stats)
INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES
(1, 'hp', 50, 'flat'),
(1, 'mp', 30, 'flat');

-- Babaa Starry (Epic - 3 stats)
INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES
(2, 'str', 25, 'flat'),
(2, 'def', 20, 'flat'),
(2, 'spd', 15, 'flat');

-- Petpet Babyca (Common - 2 stats)
INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES
(3, 'hp', 20, 'flat'),
(3, 'str', 10, 'flat');

-- Pets Babaa (Common - 2 stats)
INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES
(4, 'def', 15, 'flat'),
(4, 'intelligence', 10, 'flat');

-- Pet Advent 2004 (Legendary - 4 stats)
INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES
(5, 'hp', 100, 'flat'),
(5, 'str', 50, 'flat'),
(5, 'def', 40, 'flat'),
(5, 'spd', 30, 'flat');

-- Snicklebeast Black (Epic - 3 stats)
INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES
(6, 'str', 35, 'flat'),
(6, 'spd', 25, 'flat'),
(6, 'intelligence', 20, 'flat');

-- 3. Thêm một số Linh Thú cho user test (user_id = 3)
INSERT INTO user_spirits (user_id, spirit_id, is_equipped, equipped_pet_id) VALUES
(3, 1, 0, NULL), -- Angel Puss
(3, 2, 0, NULL), -- Babaa Starry
(3, 3, 0, NULL), -- Petpet Babyca
(3, 4, 0, NULL); -- Pets Babaa

-- 4. Kiểm tra kết quả
SELECT 'Spirits created:' as info;
SELECT id, name, rarity, max_stats_count FROM spirits;

SELECT 'Spirit stats created:' as info;
SELECT s.name, ss.stat_type, ss.stat_value, ss.stat_modifier 
FROM spirit_stats ss 
JOIN spirits s ON ss.spirit_id = s.id 
ORDER BY s.id, ss.stat_type;

SELECT 'User spirits created:' as info;
SELECT us.id, s.name, us.is_equipped, us.equipped_pet_id 
FROM user_spirits us 
JOIN spirits s ON us.spirit_id = s.id 
WHERE us.user_id = 3; 