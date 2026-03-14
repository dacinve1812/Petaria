/**
 * Tạo bảng Boss/NPC và Skills tách biệt khỏi pets.
 *
 * A. skills – kỹ năng dùng chung (nhiều boss có thể dùng cùng skill)
 * B. boss_templates – bản thiết kế Boss (không có owner, thuộc hệ thống)
 * C. boss_skills – nối boss_templates với skills
 *
 * Chạy từ thư mục petaria: node scripts/create_boss_and_skills_tables.js
 */

const path = require('path');
const { createRequire } = require('module');
const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const mysql = requireBackend('mysql2/promise');
const dotenv = requireBackend('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
  });

  try {
    // A. Bảng skills
    await conn.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        power_multiplier DECIMAL(5,2) DEFAULT 1.00,
        effect_type VARCHAR(50) DEFAULT NULL COMMENT 'Stun, Poison, Burn, Heal, ...',
        mana_cost INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Bảng skills: OK');

    // B. Bảng boss_templates (stat cố định do admin/DB, không công thức, không IV, không lên level)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS boss_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        level INT NOT NULL DEFAULT 1 COMMENT 'Chỉ hiển thị, Boss không lên level',
        base_hp INT NOT NULL DEFAULT 10 COMMENT 'HP cố định (stat dùng trực tiếp)',
        base_mp INT NOT NULL DEFAULT 10,
        base_str INT NOT NULL DEFAULT 10,
        base_def INT NOT NULL DEFAULT 10,
        base_intelligence INT NOT NULL DEFAULT 10,
        base_spd INT NOT NULL DEFAULT 10,
        accuracy INT NOT NULL DEFAULT 100 COMMENT '0-100%',
        location_id INT DEFAULT NULL COMMENT 'Khu vực xuất hiện (1=Arena, ...)',
        drop_table JSON DEFAULT NULL COMMENT '[{item_id, chance_percent}, ...]',
        respawn_minutes INT DEFAULT NULL COMMENT 'Thời gian hồi sinh (phút)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Bảng boss_templates: OK');

    // C. Bảng boss_skills (n-n)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS boss_skills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        boss_template_id INT NOT NULL,
        skill_id INT NOT NULL,
        sort_order INT DEFAULT 0,
        FOREIGN KEY (boss_template_id) REFERENCES boss_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
        UNIQUE KEY uq_boss_skill (boss_template_id, skill_id)
      )
    `);
    console.log('Bảng boss_skills: OK');

    console.log('Migration hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
