-- Đói (hunger_status 0–9) + tâm trạng (mood 0–4), mốc thời gian decay
-- Server tự ALTER khi khởi động (ensurePetVitalsSchema); file này để chạy thủ công nếu cần.

ALTER TABLE pets ADD COLUMN hunger_vitals_at DATETIME NULL;
ALTER TABLE pets ADD COLUMN mood TINYINT NOT NULL DEFAULT 2;
ALTER TABLE pets ADD COLUMN mood_vitals_at DATETIME NULL;

-- Chuẩn hóa giá trị cũ 0–3 → thang mới 0–9 (chỉ khi chưa có mốc thời gian)
UPDATE pets
SET hunger_status = CASE COALESCE(hunger_status, 3)
  WHEN 0 THEN 0
  WHEN 1 THEN 3
  WHEN 2 THEN 6
  WHEN 3 THEN 9
  ELSE LEAST(9, GREATEST(0, hunger_status))
END
WHERE hunger_vitals_at IS NULL;

UPDATE pets
SET hunger_vitals_at = COALESCE(hunger_vitals_at, NOW()),
    mood_vitals_at = COALESCE(mood_vitals_at, NOW())
WHERE hunger_vitals_at IS NULL OR mood_vitals_at IS NULL;
