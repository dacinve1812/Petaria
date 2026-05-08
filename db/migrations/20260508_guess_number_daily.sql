-- Đoán số: giới hạn lượt/ngày + vòng chờ (pivot/secret trên server)
ALTER TABLE users
  ADD COLUMN guess_number_period_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'Kỳ đếm lượt (epoch ms string, theo global_reset_time)',
  ADD COLUMN guess_number_daily_plays INT NOT NULL DEFAULT 0 COMMENT 'Số lần đoán đã hoàn thành trong kỳ',
  ADD COLUMN guess_number_pending_json TEXT NULL COMMENT 'Vòng đang chơi JSON {secret,pivot,minS,maxS}';
