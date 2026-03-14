/**
 * Migration: Boss "chỉ dùng skill, không đánh thường"
 * 1. Bảng skills: thêm type, power_min, power_max, accuracy (nếu chưa có)
 * 2. Bảng boss_templates: thêm action_pattern JSON (nếu chưa có)
 *
 * Chạy từ thư mục petaria: node scripts/migrate_skills_and_boss_action_pattern.js
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
    const [skillCols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'skills'"
    );
    const skillNames = skillCols.map((r) => r.COLUMN_NAME);

    if (!skillNames.includes('type')) {
      await conn.query(`
        ALTER TABLE skills
        ADD COLUMN type ENUM('attack','defend') NOT NULL DEFAULT 'attack'
        COMMENT 'attack = thay Sword, defend = thay Shield'
      `);
      console.log('skills: added column type');
    }
    if (!skillNames.includes('power_min')) {
      await conn.query(`ALTER TABLE skills ADD COLUMN power_min INT NOT NULL DEFAULT 80 COMMENT 'Sàn ma thuật ảo (dùng trong công thức *0.1)'`);
      console.log('skills: added column power_min');
    }
    if (!skillNames.includes('power_max')) {
      await conn.query(`ALTER TABLE skills ADD COLUMN power_max INT NOT NULL DEFAULT 100 COMMENT 'Trần ma thuật ảo'`);
      console.log('skills: added column power_max');
    }
    if (!skillNames.includes('accuracy')) {
      await conn.query(`ALTER TABLE skills ADD COLUMN accuracy INT NOT NULL DEFAULT 100 COMMENT 'Tỷ lệ trúng 0-100'`);
      console.log('skills: added column accuracy');
    }

    const [bossCols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'boss_templates'"
    );
    const bossNames = bossCols.map((r) => r.COLUMN_NAME);
    if (!bossNames.includes('action_pattern')) {
      await conn.query(`
        ALTER TABLE boss_templates
        ADD COLUMN action_pattern JSON DEFAULT NULL
        COMMENT 'Mảng ID skill theo thứ tự lượt, VD [1,1,2]'
      `);
      console.log('boss_templates: added column action_pattern');
    }

    console.log('Migration hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
