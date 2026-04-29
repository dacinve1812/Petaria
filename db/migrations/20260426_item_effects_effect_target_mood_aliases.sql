-- Chuẩn hoá một giá trị hiển thị trong DB: các alias cũ → mood
-- (Backend vẫn map happiness/tam_trang/wellbeing → mood khi đọc CSV/API.)

UPDATE item_effects
SET effect_target = 'mood'
WHERE LOWER(TRIM(effect_target)) IN ('happiness', 'tam_trang', 'wellbeing');
