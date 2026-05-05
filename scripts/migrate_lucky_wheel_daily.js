/**
 * Migration: users.lucky_wheel_period_key + users.lucky_wheel_spins (vòng quay Game Center).
 *
 * Tương đương `db/migrations/20260504_lucky_wheel_daily.sql`, chạy bằng Node + mysql2.
 * Idempotent: chạy lại sẽ bỏ qua cột đã tồn tại.
 *
 * Usage (từ thư mục petaria):
 *   node scripts/migrate_lucky_wheel_daily.js --dry-run
 *   node scripts/migrate_lucky_wheel_daily.js
 *
 * npm:
 *   npm run migrate:lucky-wheel
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
    [schema, table, column]
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
    const steps = [
      {
        column: 'lucky_wheel_period_key',
        sql: `ALTER TABLE users
          ADD COLUMN lucky_wheel_period_key VARCHAR(64) NULL DEFAULT NULL
          COMMENT 'Mốc bắt đầu kỳ reset (epoch ms string)'`,
      },
      {
        column: 'lucky_wheel_spins',
        sql: `ALTER TABLE users
          ADD COLUMN lucky_wheel_spins INT NOT NULL DEFAULT 0
          COMMENT 'Số lần đã quay trong kỳ hiện tại'`,
      },
    ];

    for (const step of steps) {
      const exists = await columnExists(conn, schema, 'users', step.column);
      if (exists) {
        console.log(`users.${step.column}: đã tồn tại — bỏ qua`);
        continue;
      }
      console.log(`Thêm users.${step.column} …`);
      if (dryRun) {
        console.log('[dry-run]', step.sql.replace(/\s+/g, ' ').trim());
        continue;
      }
      await conn.query(step.sql);
      console.log(`users.${step.column}: OK`);
    }

    console.log(dryRun ? 'Dry-run xong.' : 'Migrate lucky wheel daily: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
