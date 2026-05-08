-- Vua ăn mày: lưu thời điểm nhận Peta gần nhất (cooldown theo giờ trong Admin)
ALTER TABLE users
  ADD COLUMN beggar_king_last_claim_ms BIGINT NULL DEFAULT NULL
  COMMENT 'Unix ms lần nhận thưởng Vua ăn mày gần nhất';
