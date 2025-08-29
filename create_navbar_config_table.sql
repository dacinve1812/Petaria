-- Create navbar configuration table
CREATE TABLE IF NOT EXISTS site_navbar_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default navbar configuration
INSERT INTO site_navbar_config (config) VALUES (
  JSON_OBJECT(
    'bottomNavbar', JSON_OBJECT(
      'visible', true,
      'showMenuOnly', false
    ),
    'floatingButtons', JSON_OBJECT(
      'visible', true
    )
  )
);

-- Example of how to update navbar config:
-- UPDATE site_navbar_config 
-- SET config = JSON_OBJECT(
--   'bottomNavbar', JSON_OBJECT('visible', false, 'showMenuOnly', true),
--   'floatingButtons', JSON_OBJECT('visible', false)
-- ) 
-- WHERE id = 1;
