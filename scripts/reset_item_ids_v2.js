/**
 * Reset items.id về dãy 1..N và đưa AUTO_INCREMENT về sau N.
 *
 * Dùng khi muốn làm sạch dãy ID đang rời rạc (vd 136..152) nhưng vẫn giữ dữ liệu hiện có.
 * Script tự cập nhật tất cả FK đang trỏ tới items.id trong schema hiện tại.
 *
 * Chạy:
 *   node scripts/reset_item_ids_v2.js
 */

const path = require('path');
const { createRequire } = require('module');

const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const mysql = requireBackend('mysql2/promise');
const dotenv = requireBackend('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function qIdent(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
  });

  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const [itemRows] = await conn.query('SELECT id FROM items ORDER BY id ASC');
    if (!itemRows.length) {
      await conn.query('ALTER TABLE items AUTO_INCREMENT = 1');
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      await conn.commit();
      console.log('No items found. AUTO_INCREMENT reset to 1.');
      return;
    }

    const [maxRows] = await conn.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM items');
    const maxId = Number(maxRows[0]?.max_id || 0);
    const offset = maxId + 1000000;

    await conn.query('DROP TEMPORARY TABLE IF EXISTS tmp_item_id_map');
    await conn.query('CREATE TEMPORARY TABLE tmp_item_id_map (old_id INT PRIMARY KEY, new_id INT NOT NULL)');

    const mapValues = itemRows.map((row, idx) => [Number(row.id), idx + 1]);
    await conn.query('INSERT INTO tmp_item_id_map (old_id, new_id) VALUES ?', [mapValues]);

    // Bước 1: dời items.id sang vùng an toàn để tránh đụng unique key khi renumber.
    await conn.query(`UPDATE items SET id = id + ${offset}`);

    // Bước 2: cập nhật tất cả FK (item_id, ...) đang trỏ tới items.id.
    const [fkRows] = await conn.query(
      `
        SELECT TABLE_NAME, COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME = 'items'
          AND REFERENCED_COLUMN_NAME = 'id'
      `
    );

    for (const fk of fkRows) {
      const tableName = fk.TABLE_NAME;
      const columnName = fk.COLUMN_NAME;
      if (tableName === 'items') continue;
      const sql = `
        UPDATE ${qIdent(tableName)} t
        JOIN tmp_item_id_map m ON t.${qIdent(columnName)} = m.old_id
        SET t.${qIdent(columnName)} = m.new_id
      `;
      await conn.query(sql);
    }

    // Bước 3: đưa items.id từ vùng an toàn về dãy 1..N.
    await conn.query(
      `
        UPDATE items i
        JOIN tmp_item_id_map m ON i.id = (m.old_id + ?)
        SET i.id = m.new_id
      `,
      [offset]
    );

    await conn.query('ALTER TABLE items AUTO_INCREMENT = 1');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    console.log(`Done. Reindexed ${itemRows.length} items to ids 1..${itemRows.length}.`);
  } catch (err) {
    await conn.rollback();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {}
    console.error('reset_item_ids_v2 failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
