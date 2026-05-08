/**
 * Migration: lucky_booth_state, lucky_booth_tickets, lucky_booth_draws (Xổ số).
 *
 * Tương đương `db/migrations/20260511_lucky_booth.sql`.
 *
 * Usage:
 *   node scripts/migrate_lucky_booth.js --dry-run
 *   node scripts/migrate_lucky_booth.js
 *
 * npm:
 *   npm run migrate:lucky-booth
 */

const fs = require('fs');
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

async function run() {
  const { dryRun } = parseArgs(process.argv);
  const sqlPath = path.join(__dirname, '..', 'db', 'migrations', '20260511_lucky_booth.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
    multipleStatements: true,
  });

  console.log(`Migrate lucky booth${dryRun ? '  [DRY-RUN]' : ''}`);
  try {
    if (dryRun) {
      console.log(sql.slice(0, 800) + (sql.length > 800 ? '\n...' : ''));
      console.log('Dry-run xong.');
      return;
    }
    await conn.query(sql);
    console.log('Migrate lucky booth: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
