-- Lượt quay vòng quay may mắn / ngày (theo global_reset_time)
ALTER TABLE users
  ADD COLUMN lucky_wheel_period_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'Mốc bắt đầu kỳ reset (epoch ms string)',
  ADD COLUMN lucky_wheel_spins INT NOT NULL DEFAULT 0 COMMENT 'Số lần đã quay trong kỳ hiện tại';
