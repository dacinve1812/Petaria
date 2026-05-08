-- Vật phẩm miễn phí: một lần mỗi kỳ (theo global_reset_time).
-- Idempotent qua script: npm run migrate:daily-free

ALTER TABLE users
  ADD COLUMN daily_free_last_claim_period_key VARCHAR(64) NULL DEFAULT NULL
  COMMENT 'Kỳ đã nhận quà (epoch ms string, theo global_reset_time)';
