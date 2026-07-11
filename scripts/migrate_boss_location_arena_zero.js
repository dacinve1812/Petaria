/**
 * Migration: boss_templates.location_id
 *   Cũ: 1 = Arena
 *   Mới: 0 = Arena; >=1 = map săn (map id / location tương ứng)
 *
 * Chạy: node scripts/migrate_boss_location_arena_zero.js
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
    const [before] = await conn.query(
      'SELECT COUNT(*) AS n FROM boss_templates WHERE location_id = 1'
    );
    const n = before[0]?.n || 0;
    const [result] = await conn.query(
      'UPDATE boss_templates SET location_id = 0 WHERE location_id = 1'
    );
    console.log(
      `boss_templates: location_id 1 → 0 (matched ${n}, affected ${result.affectedRows})`
    );
    console.log('Migrate boss location Arena=0: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
