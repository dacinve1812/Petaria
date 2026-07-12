-- Shop restock: tách mức stock gốc + kỳ restock gần nhất
-- stock_limit = stock hiện tại (trừ khi mua)
-- max_stock = mức đổ đầy khi restock (NULL = không giới hạn)

ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS max_stock INT NULL AFTER stock_limit,
  ADD COLUMN IF NOT EXISTS last_restock_period_key VARCHAR(64) NULL AFTER restock_interval;

-- Backfill: lấy stock hiện tại làm max (admin nên chỉnh lại nếu đã bị trừ trước khi có cột này)
UPDATE shop_items
SET max_stock = stock_limit
WHERE stock_limit IS NOT NULL AND max_stock IS NULL;
