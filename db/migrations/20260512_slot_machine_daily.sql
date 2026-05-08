-- Máy đánh bạc: giới hạn lượt quay theo kỳ (global_reset_time)
-- Chạy: npm run migrate:slot-machine

ALTER TABLE users
  ADD COLUMN slot_machine_period_key VARCHAR(64) NULL DEFAULT NULL
  COMMENT 'Kỳ đếm lượt máy đánh bạc (epoch ms string, theo global_reset_time)';

ALTER TABLE users
  ADD COLUMN slot_machine_spins INT NOT NULL DEFAULT 0
  COMMENT 'Số lượt đã quay trong kỳ (máy đánh bạc)';

