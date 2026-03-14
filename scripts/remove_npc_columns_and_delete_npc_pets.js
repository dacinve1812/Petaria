/**
 * Migration:
 * 1) Xóa tất cả pet có is_npc = 1 (hoặc is_npc = true).
 * 2) ALTER TABLE pets: DROP COLUMN is_arena_enemy, DROP COLUMN is_npc.
 *
 * Chạy từ thư mục petaria: node scripts/remove_npc_columns_and_delete_npc_pets.js
 * Cần .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
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
    const [cols] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pets'"
    );
    const names = cols.map((r) => r.COLUMN_NAME);
    const hasNpc = names.includes('is_npc');
    const hasArena = names.includes('is_arena_enemy');

    if (hasNpc) {
      const [delResult] = await conn.query('DELETE FROM pets WHERE is_npc = 1');
      console.log('Đã xóa số pet NPC:', delResult.affectedRows);
    } else {
      console.log('Bảng pets không có cột is_npc, bỏ qua bước xóa NPC.');
    }

    if (hasArena || hasNpc) {
      const drops = [];
      if (hasArena) drops.push('DROP COLUMN is_arena_enemy');
      if (hasNpc) drops.push('DROP COLUMN is_npc');
      if (drops.length) {
        await conn.query(`ALTER TABLE pets ${drops.join(', ')}`);
        console.log('Đã xóa cột:', drops.map((d) => d.replace('DROP COLUMN ', '')).join(', '));
      }
    } else {
      console.log('Không có cột is_arena_enemy/is_npc để xóa.');
    }

    console.log('Migration hoàn tất.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
