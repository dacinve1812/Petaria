-- Lượt mua vé cào 3 ô / 5 ô theo ngày (đồng bộ scratch_daily_period_key với global_reset_time server)
ALTER TABLE users
  ADD COLUMN scratch_daily_period_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'Mốc kỳ vé cào (epoch ms string, giống lucky wheel)',
  ADD COLUMN scratch_daily_buys_3 INT NOT NULL DEFAULT 0,
  ADD COLUMN scratch_daily_buys_5 INT NOT NULL DEFAULT 0,
  ADD COLUMN scratch_pending_json TEXT NULL COMMENT 'Payload vé đang chờ claim (JSON)';
