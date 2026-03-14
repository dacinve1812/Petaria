/**
 * Migration: Mở rộng bảng equipment_data
 * - Thêm: equipment_type, power_min, power_max, durability_max, magic_value, crit_rate, block_rate, element, effect_id
 * - Di chuyển: power -> magic_value (clamp 1-10), durability -> durability_max
 * - Xóa cột cũ: power, durability (sau khi backfill)
 *
 * Chạy từ thư mục petaria: node scripts/migrate_equipment_data_schema.js
 * Cần .env có DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
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
    // 1) Kiểm tra đã migrate chưa (đã có cột equipment_type)
    const [cols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'equipment_data'"
    );
    const names = cols.map((r) => r.COLUMN_NAME);

    if (names.includes('equipment_type')) {
      console.log('Bảng equipment_data đã có schema mới, bỏ qua migration.');
      return;
    }

    // Bảng chưa tồn tại hoặc không có power/durability -> tạo bảng mới (full schema)
    if (names.length === 0 || !names.includes('power') || !names.includes('durability')) {
      if (names.length === 0) {
        console.log('Bảng equipment_data chưa tồn tại, đang tạo bảng mới...');
        await conn.query(`
          CREATE TABLE equipment_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            item_id INT NOT NULL,
            equipment_type ENUM('weapon','shield','crit_weapon') NOT NULL DEFAULT 'weapon',
            power_min INT NULL,
            power_max INT NULL,
            durability_max INT NULL,
            magic_value INT NULL,
            crit_rate DECIMAL(5,2) NULL,
            block_rate DECIMAL(5,2) NULL,
            element VARCHAR(50) NULL,
            effect_id INT NULL,
            UNIQUE KEY unique_item (item_id)
          )
        `);
        console.log('Tạo bảng equipment_data hoàn tất.');
      } else {
        console.log('Bảng equipment_data không có power/durability. Chạy migration thủ công hoặc tạo bảng mới.');
      }
      return;
    }

    console.log('Đang thêm cột mới vào equipment_data...');

    await conn.query(`
      ALTER TABLE equipment_data
        ADD COLUMN equipment_type ENUM('weapon','shield','crit_weapon') NOT NULL DEFAULT 'weapon' AFTER item_id,
        ADD COLUMN power_min INT NULL AFTER equipment_type,
        ADD COLUMN power_max INT NULL AFTER power_min,
        ADD COLUMN durability_max INT NULL AFTER power_max,
        ADD COLUMN magic_value INT NULL AFTER durability_max,
        ADD COLUMN crit_rate DECIMAL(5,2) NULL AFTER magic_value,
        ADD COLUMN block_rate DECIMAL(5,2) NULL AFTER crit_rate,
        ADD COLUMN element VARCHAR(50) NULL AFTER block_rate,
        ADD COLUMN effect_id INT NULL AFTER element
    `);

    console.log('Đang backfill từ power/durability...');
    await conn.query(`
      UPDATE equipment_data
      SET
        power_min = power,
        power_max = power,
        durability_max = durability,
        magic_value = LEAST(10, GREATEST(1, COALESCE(power, 1)))
      WHERE 1=1
    `);

    console.log('Đang xóa cột cũ power, durability...');
    await conn.query(`ALTER TABLE equipment_data DROP COLUMN power, DROP COLUMN durability`);

    console.log('Migration equipment_data hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
