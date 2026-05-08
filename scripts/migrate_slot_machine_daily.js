/**
 * Migration: users.slot_machine_period_key + users.slot_machine_spins (Máy đánh bạc / Game Center).
 *
 * Tương đương `db/migrations/20260512_slot_machine_daily.sql`.
 * Idempotent: chạy lại sẽ bỏ qua cột đã tồn tại.
 *
 * Usage:
 *   node scripts/migrate_slot_machine_daily.js --dry-run
 *   node scripts/migrate_slot_machine_daily.js
 *
 * npm:
 *   npm run migrate:slot-machine
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
  if (!schema) throw new Error('Không có database được chọn. Kiểm tra DB_NAME trong .env.');

  console.log(`DB: ${schema}${dryRun ? '  [DRY-RUN]' : ''}`);

  try {
    const steps = [
      {
        column: 'slot_machine_period_key',
        sql: `ALTER TABLE users
          ADD COLUMN slot_machine_period_key VARCHAR(64) NULL DEFAULT NULL
          COMMENT 'Kỳ đếm lượt máy đánh bạc (epoch ms string, theo global_reset_time)'`,
      },
      {
        column: 'slot_machine_spins',
        sql: `ALTER TABLE users
          ADD COLUMN slot_machine_spins INT NOT NULL DEFAULT 0
          COMMENT 'Số lượt đã quay trong kỳ (máy đánh bạc)'`,
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

    console.log(dryRun ? 'Dry-run xong.' : 'Migrate slot machine daily: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

