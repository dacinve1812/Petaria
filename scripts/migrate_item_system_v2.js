/**
 * Migration: Item System V2 foundation
 *
 * Mục tiêu:
 * - Mở rộng bảng items để hỗ trợ taxonomy + item_code
 * - Mở rộng equipment_data để hỗ trợ durability mode
 * - Chuẩn hóa item_effects.effect_target/effect_type
 *
 * Cách chạy:
 *   node scripts/migrate_item_system_v2.js
 *   node scripts/migrate_item_system_v2.js --wipe-items
 */

const path = require('path');
const { createRequire } = require('module');

const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const mysql = requireBackend('mysql2/promise');
const dotenv = requireBackend('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const args = new Set(process.argv.slice(2));
const SHOULD_WIPE_ITEMS = args.has('--wipe-items');

const EFFECT_TARGET_ALIASES = {
  atk: 'str',
  attack: 'str',
  int: 'intelligence',
  energy: 'mp',
};

const EFFECT_TYPE_ALIASES = {
  status_heal: 'status_cure',
  cure_status: 'status_cure',
};

function mapEffectTarget(value) {
  const key = String(value || '').trim().toLowerCase();
  return EFFECT_TARGET_ALIASES[key] || key || 'hp';
}

function mapEffectType(value) {
  const key = String(value || '').trim().toLowerCase();
  return EFFECT_TYPE_ALIASES[key] || key || 'flat';
}

function inferCategoryFromType(typeValue) {
  const t = String(typeValue || '').trim().toLowerCase();
  if (['food'].includes(t)) return 'food';
  if (['toy'].includes(t)) return 'toy';
  if (['medicine', 'consumable'].includes(t)) return 'medicine';
  if (['booster'].includes(t)) return 'stat_boost';
  if (['evolve'].includes(t)) return 'transform';
  if (['equipment'].includes(t)) return 'equipment';
  if (['quest'].includes(t)) return 'quest';
  return 'misc';
}

async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, tableName, columnName, definition, afterColumn = null) {
  const exists = await hasColumn(conn, tableName, columnName);
  if (exists) return false;
  const afterSql = afterColumn ? ` AFTER \`${afterColumn}\`` : '';
  await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}${afterSql}`);
  return true;
}

async function ensureIndex(conn, tableName, indexName, indexSql) {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );
  if (rows.length > 0) return false;
  await conn.query(indexSql);
  return true;
}

async function wipeItemData(conn) {
  console.log('> Wiping item-related data...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('DELETE FROM inventory');
  await conn.query('DELETE FROM shop_items');
  await conn.query('DELETE FROM item_effects');
  await conn.query('DELETE FROM equipment_data');
  await conn.query('DELETE FROM food_recovery_items');
  await conn.query('DELETE FROM pet_item_usage');
  await conn.query('DELETE FROM items');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function migrateItemsRarityColumn(conn) {
  const [rows] = await conn.query(
    `
      SELECT DATA_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND COLUMN_NAME = 'rarity'
      LIMIT 1
    `
  );
  if (!rows.length) return;
  const dt = String(rows[0].DATA_TYPE || '').toLowerCase();
  if (dt === 'enum') {
    console.log('> Converting items.rarity from ENUM to VARCHAR(32) (rarity: common/rare/epic/legendary + CSV)...');
    await conn.query("ALTER TABLE items MODIFY COLUMN rarity VARCHAR(32) NOT NULL DEFAULT 'common'");
  }
  console.log('> Normalizing legacy rarity values on items...');
  await conn.query("UPDATE items SET rarity = 'legendary' WHERE LOWER(COALESCE(rarity,'')) IN ('mythic','legend','unique','artifact')");
  await conn.query("UPDATE items SET rarity = 'rare' WHERE LOWER(COALESCE(rarity,'')) = 'uncommon'");
}

async function migrateItemsTable(conn) {
  console.log('> Migrating items columns...');
  await addColumnIfMissing(conn, 'items', 'item_code', 'INT NULL', 'id');
  await addColumnIfMissing(conn, 'items', 'category', "VARCHAR(40) NOT NULL DEFAULT 'misc'", 'type');
  await addColumnIfMissing(conn, 'items', 'subtype', 'VARCHAR(60) NULL', 'category');
  await addColumnIfMissing(conn, 'items', 'magic_value', 'INT NULL', 'subtype');
  await addColumnIfMissing(conn, 'items', 'stackable', 'TINYINT(1) NOT NULL DEFAULT 1', 'magic_value');
  await addColumnIfMissing(conn, 'items', 'max_stack', 'INT NOT NULL DEFAULT 999', 'stackable');
  await addColumnIfMissing(conn, 'items', 'consume_policy', "VARCHAR(30) NOT NULL DEFAULT 'single_use'", 'max_stack');
  await addColumnIfMissing(conn, 'items', 'pet_scope', "VARCHAR(30) NOT NULL DEFAULT 'all'", 'consume_policy');
  await addColumnIfMissing(conn, 'items', 'price_currency', "VARCHAR(20) NOT NULL DEFAULT 'peta'", 'sell_price');

  await ensureIndex(
    conn,
    'items',
    'idx_items_item_code',
    'CREATE UNIQUE INDEX idx_items_item_code ON items(item_code)'
  );

  // Backfill item_code from id if null
  await conn.query('UPDATE items SET item_code = id WHERE item_code IS NULL');

  // Backfill category from type
  const [rows] = await conn.query('SELECT id, type FROM items');
  for (const row of rows) {
    const category = inferCategoryFromType(row.type);
    await conn.query('UPDATE items SET category = ? WHERE id = ?', [category, row.id]);
  }

  // Backfill consume policy + stack behavior
  await conn.query("UPDATE items SET stackable = 0, max_stack = 1, consume_policy = 'on_battle_only' WHERE type = 'equipment'");
  await conn.query("UPDATE items SET stackable = 1, max_stack = 999, consume_policy = 'single_use' WHERE type IN ('consumable', 'booster', 'evolve', 'medicine', 'toy', 'food')");
  await conn.query("UPDATE items SET price_currency = 'peta' WHERE price_currency IS NULL OR price_currency = ''");
}

async function normalizeItemClassification(conn) {
  console.log('> Normalizing item type/category conventions...');

  // Food/Toy/Medicine chuẩn mới: type = consumable, category riêng.
  await conn.query("UPDATE items SET type='consumable', category='food' WHERE type='food'");
  await conn.query("UPDATE items SET type='consumable', category='toy' WHERE type='toy'");
  await conn.query("UPDATE items SET type='consumable', category='medicine' WHERE type='medicine'");

  // Dược phẩm hồi HP/MP: consumable + medicine (ưu tiên effect non-permanent).
  await conn.query(`
    UPDATE items i
    JOIN item_effects ie ON ie.item_id = i.id
    SET i.type='consumable', i.category='medicine'
    WHERE ie.effect_target IN ('hp','mp') AND COALESCE(ie.is_permanent, 0) = 0
  `);

  // Item tăng HP/MP/EXP: booster + stat_boost.
  await conn.query(`
    UPDATE items i
    JOIN item_effects ie ON ie.item_id = i.id
    SET i.type='booster', i.category='stat_boost'
    WHERE ie.effect_target IN ('hp','mp','exp','hp_added','mp_added') AND COALESCE(ie.is_permanent, 0) = 1
  `);

  // Dược phẩm hỗ trợ chiến đấu (equip): giữ type equipment nhưng category = stat_boost.
  await conn.query(`
    UPDATE items i
    SET i.category='stat_boost'
    WHERE i.subtype IN ('accuracy_up', 'accuracy_down')
  `);
}

async function migrateEquipmentDataTable(conn) {
  console.log('> Migrating equipment_data columns...');
  await addColumnIfMissing(conn, 'equipment_data', 'durability_mode', "VARCHAR(20) NOT NULL DEFAULT 'fixed'", 'durability_max');
  await addColumnIfMissing(conn, 'equipment_data', 'random_break_chance', 'DECIMAL(5,2) NULL', 'durability_mode');
  await addColumnIfMissing(conn, 'equipment_data', 'slot_type', "VARCHAR(20) NOT NULL DEFAULT 'weapon'", 'equipment_type');

  // Mở rộng equipment_type hỗ trợ booster.
  await conn.query(
    `
      ALTER TABLE equipment_data
      MODIFY COLUMN equipment_type ENUM('weapon','shield','crit_weapon','booster') NOT NULL DEFAULT 'weapon'
    `
  );

  await conn.query(
    `
      UPDATE equipment_data
      SET slot_type = CASE
        WHEN equipment_type = 'shield' THEN 'shield'
        WHEN equipment_type = 'booster' THEN 'stat_boost'
        ELSE 'weapon'
      END
      WHERE slot_type IS NULL OR slot_type = ''
    `
  );

  // Đồng nhất mode cũ random -> unknown.
  await conn.query(
    `
      UPDATE equipment_data
      SET durability_mode = 'unknown'
      WHERE LOWER(COALESCE(durability_mode, '')) = 'random'
    `
  );

  // Unknown durability dùng random_break_chance, không dùng durability_max.
  await conn.query(
    `
      UPDATE equipment_data
      SET durability_max = NULL,
          random_break_chance = COALESCE(random_break_chance, 3.00)
      WHERE durability_mode = 'unknown'
    `
  );

  // Nếu loại trang bị không phải weapon/shield/crit_weapon thì ép về booster + stat_boost.
  await conn.query(
    `
      UPDATE equipment_data
      SET equipment_type = 'booster',
          slot_type = 'stat_boost'
      WHERE equipment_type NOT IN ('weapon', 'shield', 'crit_weapon', 'booster')
    `
  );

  // Chuẩn hóa độ bền vĩnh viễn về 999999 để thống nhất hiển thị/logic.
  await conn.query(
    `
      UPDATE equipment_data
      SET durability_max = 999999
      WHERE durability_mode = 'unbreakable' OR durability_max >= 9999
    `
  );
}

async function normalizeItemEffects(conn) {
  console.log('> Normalizing item_effects values...');
  await addColumnIfMissing(conn, 'item_effects', 'magic_value', 'INT NULL', 'duration_turns');
  const [rows] = await conn.query(
    `
      SELECT ie.id, ie.item_id, ie.effect_target, ie.effect_type, ie.magic_value, it.magic_value AS item_magic_value
      FROM item_effects ie
      LEFT JOIN items it ON ie.item_id = it.id
    `
  );
  for (const row of rows) {
    const newTarget = mapEffectTarget(row.effect_target);
    const newType = mapEffectType(row.effect_type);
    const newMagic = row.magic_value != null ? row.magic_value : row.item_magic_value;
    if (newTarget !== row.effect_target || newType !== row.effect_type || newMagic !== row.magic_value) {
      await conn.query(
        'UPDATE item_effects SET effect_target = ?, effect_type = ?, magic_value = ? WHERE id = ?',
        [newTarget, newType, newMagic, row.id]
      );
    }
  }
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

    if (SHOULD_WIPE_ITEMS) {
      await wipeItemData(conn);
    }

    await migrateItemsTable(conn);
    await migrateItemsRarityColumn(conn);
    await migrateEquipmentDataTable(conn);
    await normalizeItemEffects(conn);
    await normalizeItemClassification(conn);

    await conn.commit();
    console.log('Item System V2 migration completed successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
