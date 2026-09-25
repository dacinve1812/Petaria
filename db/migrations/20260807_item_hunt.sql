-- Item Hunt (Truy tìm vật phẩm / Kỳ Trân Các)
-- Tables are also auto-created by backend/routes/itemHunt.js on first request.

CREATE TABLE IF NOT EXISTS item_hunt_quests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  tier VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  requirements_json JSON NOT NULL,
  composition_key VARCHAR(32) NULL,
  reward_peta INT NOT NULL DEFAULT 0,
  reward_weights_json JSON NULL,
  reward_item_json JSON NULL,
  expires_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ihq_user_status (user_id, status),
  INDEX idx_ihq_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS item_hunt_user_state (
  user_id INT NOT NULL PRIMARY KEY,
  cooldown_until DATETIME NULL,
  daily_period_key VARCHAR(64) NULL,
  daily_easy INT NOT NULL DEFAULT 0,
  daily_medium INT NOT NULL DEFAULT 0,
  daily_hard INT NOT NULL DEFAULT 0,
  daily_special INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: bật nhiệm vụ Đặc biệt (event)
-- INSERT INTO global_config (config_key, config_value) VALUES
--   ('item_hunt_special_event', '{"enabled":true,"label":"Sự kiện Kỳ Trân"}')
-- ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);
