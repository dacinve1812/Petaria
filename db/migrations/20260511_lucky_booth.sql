-- Xổ số (Lucky booth): vé theo kỳ + lịch sử quay thưởng.
-- Chạy: npm run migrate:lucky-booth

CREATE TABLE IF NOT EXISTS lucky_booth_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  active_period_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'Kỳ đang mở bán vé (epoch ms string)'
);

INSERT IGNORE INTO lucky_booth_state (id, active_period_key) VALUES (1, NULL);

CREATE TABLE IF NOT EXISTS lucky_booth_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  period_key VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  digits CHAR(4) NOT NULL,
  username_snapshot VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lucky_booth_period_user (period_key, user_id),
  KEY idx_lucky_booth_period (period_key),
  KEY idx_lucky_booth_user (user_id)
);

CREATE TABLE IF NOT EXISTS lucky_booth_draws (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  period_key VARCHAR(64) NOT NULL,
  winning_number CHAR(4) NOT NULL,
  drawn_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_tickets INT UNSIGNED NOT NULL DEFAULT 0,
  winner_count INT UNSIGNED NOT NULL DEFAULT 0,
  jackpot_peta BIGINT UNSIGNED NOT NULL DEFAULT 0,
  winners_json LONGTEXT NULL,
  UNIQUE KEY uq_lucky_booth_draw_period (period_key)
);
