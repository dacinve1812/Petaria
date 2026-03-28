/**
 * Bảng hunting_maps — map săn custom (lưới, ảnh, encounter pool).
 *
 * Chạy: node scripts/create_hunting_maps_table.js
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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS hunting_maps (
        id VARCHAR(64) NOT NULL PRIMARY KEY COMMENT 'slug: chữ thường, số, gạch dưới',
        name VARCHAR(255) NOT NULL,
        entry_fee INT NOT NULL DEFAULT 0,
        currency VARCHAR(24) NOT NULL DEFAULT 'peta',
        max_steps INT NULL COMMENT 'NULL = không giới hạn bước',
        thumb VARCHAR(512) NULL,
        width INT NOT NULL,
        height INT NOT NULL,
        tile_size INT NOT NULL DEFAULT 16,
        start_x INT NOT NULL DEFAULT 0,
        start_y INT NOT NULL DEFAULT 0,
        background_url VARCHAR(1024) NOT NULL,
        foreground_url VARCHAR(1024) NULL,
        tiles_json LONGTEXT NOT NULL COMMENT 'JSON array số (0..255) length width*height',
        encounter_pool_json JSON NULL COMMENT 'mảng encounter pool',
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Bảng hunting_maps: OK');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
