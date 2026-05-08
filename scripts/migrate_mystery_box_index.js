/**
 * Migration: INDEX idx_items_rarity trên bảng items (Hộp bí ẩn / lọc rarity).
 *
 * Tương đương `db/migrations/20260509_mystery_box_items_rarity_index.sql`.
 * Idempotent: đã có index thì bỏ qua.
 *
 * Usage:
 *   node scripts/migrate_mystery_box_index.js --dry-run
 *   node scripts/migrate_mystery_box_index.js
 *
 * npm:
 *   npm run migrate:mystery-box
 */

const path = require('path');
const { createRequire } = require('module');

const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const dotenv = requireBackend('dotenv');
const mysql = requireBackend('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return { dryRun: args.has('--dry-run') || args.has('-n') };
}

async function getCurrentDb(conn) {
  const [[row]] = await conn.query('SELECT DATABASE() AS db');
  return row.db;
}

async function indexExists(conn, schema, table, indexName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [schema, table, indexName],
  );
  return Number(rows[0].c) > 0;
}

async function run() {
  const { dryRun } = parseArgs(process.argv);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
  });

  const schema = await getCurrentDb(conn);
  if (!schema) {
    throw new Error('Không có database được chọn. Kiểm tra DB_NAME trong .env.');
  }

  const INDEX_NAME = 'idx_items_rarity';
  const sql = 'CREATE INDEX idx_items_rarity ON items (rarity)';

  console.log(`DB: ${schema}${dryRun ? '  [DRY-RUN]' : ''}`);

  try {
    const exists = await indexExists(conn, schema, 'items', INDEX_NAME);
    if (exists) {
      console.log(`items.${INDEX_NAME}: đã tồn tại — bỏ qua`);
    } else {
      console.log(`Tạo ${INDEX_NAME} …`);
      if (dryRun) {
        console.log('[dry-run]', sql);
      } else {
        await conn.query(sql);
        console.log(`items.${INDEX_NAME}: OK`);
      }
    }
    console.log(dryRun ? 'Dry-run xong.' : 'Migrate mystery box index: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
