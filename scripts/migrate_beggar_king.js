/**
 * Migration: users.beggar_king_last_claim_ms (Vua ăn mày / Game Center).
 *
 * Tương đương `db/migrations/20260507_beggar_king.sql`, chạy bằng Node + mysql2.
 * Idempotent: chạy lại sẽ bỏ qua cột đã tồn tại.
 *
 * Usage (từ thư mục petaria):
 *   node scripts/migrate_beggar_king.js --dry-run
 *   node scripts/migrate_beggar_king.js
 *
 * npm:
 *   npm run migrate:beggar-king
 *
 * Env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (đọc từ petaria/.env)
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

async function columnExists(conn, schema, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [schema, table, column],
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

  console.log(`DB: ${schema}${dryRun ? '  [DRY-RUN]' : ''}`);

  try {
    const column = 'beggar_king_last_claim_ms';
    const sql = `ALTER TABLE users
      ADD COLUMN beggar_king_last_claim_ms BIGINT NULL DEFAULT NULL
      COMMENT 'Unix ms lần nhận thưởng Vua ăn mày gần nhất'`;

    const exists = await columnExists(conn, schema, 'users', column);
    if (exists) {
      console.log(`users.${column}: đã tồn tại — bỏ qua`);
    } else {
      console.log(`Thêm users.${column} …`);
      if (dryRun) {
        console.log('[dry-run]', sql.replace(/\s+/g, ' ').trim());
      } else {
        await conn.query(sql);
        console.log(`users.${column}: OK`);
      }
    }

    console.log(dryRun ? 'Dry-run xong.' : 'Migrate beggar king: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
