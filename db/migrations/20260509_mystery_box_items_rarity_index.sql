-- Hộp bí ẩn: lọc item theo rarity — index hỗ trợ truy vấn / random pool (optional).
-- Idempotent: chạy script Node `npm run migrate:mystery-box` để bỏ qua nếu index đã có.

CREATE INDEX idx_items_rarity ON items (rarity);
