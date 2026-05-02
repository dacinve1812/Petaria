/**
 * Migration: Auction multi-asset (item / pet / spirit / currency) + bid_currency + listing flags.
 *
 * Tương đương nội dung `db/migrations/20260430_auction_multi_asset_types.sql`, chạy bằng Node + mysql2.
 * Idempotent: chạy lại sẽ bỏ qua cột/index đã tồn tại.
 *
 * Usage (từ root repo):
 *   node petaria/scripts/migrate_auction_multi_asset.js --dry-run
 *   node petaria/scripts/migrate_auction_multi_asset.js
 *
 * Từ thư mục petaria:
 *   node scripts/migrate_auction_multi_asset.js
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

async function indexExists(conn, schema, table, indexName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [schema, table, indexName]
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
    throw new Error('Không có database được chọn. Kiểm tra DB_NAME trong .env hoặc chọn DB trước khi chạy.');
  }

  console.log(`DB: ${schema}${dryRun ? '  [DRY-RUN]' : ''}`);

  try {
    // --- auctions: new columns ---
    const hasAssetType = await columnExists(conn, schema, 'auctions', 'asset_type');
    if (!hasAssetType) {
      const sql = `
        ALTER TABLE auctions
          ADD COLUMN asset_type ENUM('item','pet','spirit','currency') NOT NULL DEFAULT 'item' AFTER id,
          ADD COLUMN asset_ref_id INT NULL AFTER asset_type,
          ADD COLUMN asset_currency ENUM('peta','petagold') NULL AFTER asset_ref_id,
          ADD COLUMN asset_quantity INT NOT NULL DEFAULT 1 AFTER asset_currency,
          ADD COLUMN bid_currency ENUM('peta','petagold') NOT NULL DEFAULT 'peta' AFTER asset_quantity
      `;
      if (dryRun) {
        console.log('[dry-run] Sẽ ALTER TABLE auctions (thêm asset_type, asset_ref_id, asset_currency, asset_quantity, bid_currency)');
      } else {
        await conn.query(sql);
        console.log('OK: auctions — đã thêm các cột asset_* / bid_currency');
      }
    } else {
      console.log('Skip: auctions.asset_type đã tồn tại');
    }

    // Backfill item_id -> asset_ref_id for existing rows
    if (!dryRun) {
      const [r] = await conn.query(
        `UPDATE auctions SET asset_ref_id = item_id WHERE asset_type = 'item' AND asset_ref_id IS NULL AND item_id IS NOT NULL`
      );
      if (r.affectedRows > 0) {
        console.log(`OK: backfill asset_ref_id từ item_id (${r.affectedRows} dòng)`);
      }
    } else {
      console.log('[dry-run] Sẽ UPDATE auctions SET asset_ref_id = item_id WHERE ...');
    }

    // --- pets.is_listed ---
    if (!(await columnExists(conn, schema, 'pets', 'is_listed'))) {
      if (dryRun) {
        console.log('[dry-run] Sẽ ALTER TABLE pets ADD COLUMN is_listed ...');
      } else {
        await conn.query(
          `ALTER TABLE pets ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 0`
        );
        console.log('OK: pets.is_listed');
      }
    } else {
      console.log('Skip: pets.is_listed đã tồn tại');
    }

    // --- user_spirits.is_listed ---
    if (!(await columnExists(conn, schema, 'user_spirits', 'is_listed'))) {
      if (dryRun) {
        console.log('[dry-run] Sẽ ALTER TABLE user_spirits ADD COLUMN is_listed ...');
      } else {
        await conn.query(
          `ALTER TABLE user_spirits ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 0`
        );
        console.log('OK: user_spirits.is_listed');
      }
    } else {
      console.log('Skip: user_spirits.is_listed đã tồn tại');
    }

    // --- indexes on auctions ---
    const indexes = [
      { name: 'idx_auctions_asset_type', cols: 'asset_type' },
      { name: 'idx_auctions_asset_ref', cols: 'asset_ref_id' },
      { name: 'idx_auctions_bid_currency', cols: 'bid_currency' },
    ];
    for (const { name, cols } of indexes) {
      if (await indexExists(conn, schema, 'auctions', name)) {
        console.log(`Skip: index ${name} đã tồn tại`);
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] Sẽ CREATE INDEX ${name} ON auctions (${cols})`);
      } else {
        await conn.query(`CREATE INDEX ${name} ON auctions (${cols})`);
        console.log(`OK: CREATE INDEX ${name}`);
      }
    }

    console.log(dryRun ? '\nDry-run xong. Chạy lại không có --dry-run để ghi DB.' : '\nMigration auction: hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
