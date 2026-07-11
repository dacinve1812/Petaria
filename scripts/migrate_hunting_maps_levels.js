/**
 * Migration: hunting_maps — yêu cầu level vào map + range level pet/boss encounter.
 *
 * Columns:
 *   require_min_level     — cần ít nhất 1 pet đạt level này mới vào map (0 = không yêu cầu)
 *   encounter_level_min   — level tối thiểu khi gặp pet/boss
 *   encounter_level_max   — level tối đa khi gặp pet/boss
 *
 * Chạy từ thư mục petaria:
 *   node scripts/migrate_hunting_maps_levels.js
 */

const path = require('path');
const { createRequire } = require('module');
const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const mysql = requireBackend('mysql2/promise');
const dotenv = requireBackend('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function addColumnIfMissing(conn, columnName, ddl) {
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hunting_maps' AND COLUMN_NAME = ?`,
    [columnName]
  );
  if (cols.length) {
    console.log(`hunting_maps.${columnName}: already exists`);
    return;
  }
  await conn.query(`ALTER TABLE hunting_maps ADD COLUMN ${ddl}`);
  console.log(`hunting_maps.${columnName}: added`);
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
  });

  try {
    await addColumnIfMissing(
      conn,
      'require_min_level',
      `require_min_level INT NOT NULL DEFAULT 0 COMMENT 'Cần ít nhất 1 pet >= level này để vào map (0 = không yêu cầu)'`
    );
    await addColumnIfMissing(
      conn,
      'encounter_level_min',
      `encounter_level_min INT NOT NULL DEFAULT 1 COMMENT 'Level tối thiểu pet/boss khi encounter'`
    );
    await addColumnIfMissing(
      conn,
      'encounter_level_max',
      `encounter_level_max INT NOT NULL DEFAULT 1 COMMENT 'Level tối đa pet/boss khi encounter'`
    );
    console.log('Migrate hunting_maps levels: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
