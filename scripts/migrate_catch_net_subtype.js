/**
 * Tag 3 lưới bắt pet: subtype = catch_net
 * item_code 90000/90001/90002
 *
 * Chạy: node scripts/migrate_catch_net_subtype.js
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
    const [r] = await conn.query(
      `UPDATE items SET subtype = 'catch_net'
       WHERE item_code IN (90000, 90001, 90002)
          OR name IN ('Lưới thường', 'Lưới Điện', 'Lưới Đặc Biệt')`
    );
    console.log(`items subtype=catch_net: affected ${r.affectedRows}`);
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
