-- Seed / cập nhật các shop tab Chung (General)
-- Backend cũng auto-migrate cột image_url khi gọi /api/shops

INSERT INTO shop_definitions (code, name, description, type_filter, currency_type, parent_category, sort_order, image_url)
VALUES
  ('food', 'Cửa Hàng Thực Phẩm', 'Bà béo Oishi: Bán thức ăn, đồ uống', 'food', 'peta', 'general', 10, '/images/shops/food.png'),
  ('pharmacy', 'Cửa Hàng Dược Phẩm', 'Đại phu Amorph: Bán các loại thuốc và độc dược', 'consumable', 'peta', 'general', 20, '/images/shops/pharmacy.png'),
  ('grocery', 'Cửa Hàng Tạp Hóa', 'Lái buôn Raaki: Bán các vật phẩm linh tinh', 'misc', 'peta', 'general', 30, '/images/shops/grocery.png'),
  ('armory', 'Cửa Hàng Binh Khí', 'Thợ rèn Zicha: Bán vũ khí, giáp trụ', 'equipment', 'peta', 'general', 40, '/images/shops/armory.png'),
  ('mystic', 'Cửa Hàng Thần Bí', 'Phù thủy Merlin: Bán vật phẩm hiếm VIP', 'misc', 'peta', 'general', 50, '/images/shops/mystic.png'),
  ('golden', 'Cửa Hàng Hoàng Kim', 'Công tước Chrono: Kỳ trân dị bảo, petaGold', 'all', 'petagold', 'general', 60, '/images/shops/golden.png'),
  ('flea', 'Chợ Trời', 'Các cửa hàng của cư dân Petaria', 'all', 'peta', 'general', 70, '/images/shops/flea.png')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  type_filter = VALUES(type_filter),
  currency_type = VALUES(currency_type),
  parent_category = VALUES(parent_category),
  sort_order = VALUES(sort_order),
  image_url = IF(image_url IS NULL OR image_url = '', VALUES(image_url), image_url);
