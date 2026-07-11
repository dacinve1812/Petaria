/**
 * Tạo bảng hunting_catch_config (tỉ lệ bắt pet).
 * Chạy: node scripts/migrate_hunting_catch_config.js
 */
const path = require('path');
const { createRequire } = require('module');
const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const mysql = requireBackend('mysql2/promise');
const dotenv = requireBackend('dotenv');
const huntingCatch = require('../backend/utils/huntingCatch');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
  });
  try {
    await huntingCatch.ensureCatchConfigTable(conn);
    const [rows] = await conn.query('SELECT config FROM hunting_catch_config WHERE id = 1');
    console.log('hunting_catch_config: OK', rows.length ? '(has row)' : '(empty)');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
