/**
 * Đồng bộ item_effects + equipment_data với bảng items (sau khi items đã chuẩn theo item_code).
 *
 * - Xóa orphan (FK logic), xóa item_effects thừa cho vũ khí/khiên thuần (equipment + category equipment).
 * - equipment_data: magic_value = items.magic_value; với trang bị combat (category equipment):
 *   power_min = magic*10, power_max = magic*10+9 (magic mặc định tối thiểu 1).
 * - equipment_data cho item equipment + stat_boost (Minh dược…): giữ power 0–0, chỉ sync magic_value.
 * - item_effects: đồng bộ magic từ item; chuyển effect_type → percent, value_min/max = magic*10
 *   (trừ evolve, exp, status/status_cure).
 * - Xóa item_effects “rác”: item không thuộc nhóm có gameplay effect (consumable, booster, evolve,
 *   legacy food/toy/medicine, quest, repair_kit, equipment+stat_boost) — ví dụ type misc.
 * - Với mọi item `type = booster` **chưa có** dòng item_effects: INSERT một effect mặc định theo `subtype`
 *   (def/str/spd/intelligence/hp/mp → percent + magic×10; exp_boost/lvl_boost → exp flat theo tier).
 *
 * Chạy độc lập:
 *   node scripts/sync_item_effects_equipment_magic_v2.js
 *
 * Hoặc được gọi từ migrate_item_system_v2.js (sau normalizeItemEffects).
 */

const path = require('path');
const { createRequire } = require('module');

const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const mysql = requireBackend('mysql2/promise');
const dotenv = requireBackend('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const EFFECT_TARGET_ALIASES = {
  atk: 'str',
  attack: 'str',
  int: 'intelligence',
  energy: 'mp',
};

function mapEffectTarget(value) {
  const key = String(value || '').trim().toLowerCase();
  return EFFECT_TARGET_ALIASES[key] || key || 'hp';
}

function clampMagicTier(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  if (v > 99) return 99;
  return v;
}

function inferEquipmentMeta(subtype) {
  const s = String(subtype || '').toLowerCase();
  if (s.includes('shield')) {
    return { equipment_type: 'shield', slot_type: 'shield', durability_max: 100, durability_mode: 'fixed', random_break_chance: null };
  }
  if (s.includes('critical') || s === 'weapon_critical') {
    return { equipment_type: 'crit_weapon', slot_type: 'weapon', durability_max: 120, durability_mode: 'fixed', random_break_chance: null };
  }
  if (s.includes('permanent')) {
    return {
      equipment_type: 'weapon',
      slot_type: 'weapon',
      durability_max: 999999,
      durability_mode: 'unbreakable',
      random_break_chance: null,
    };
  }
  return { equipment_type: 'weapon', slot_type: 'weapon', durability_max: 120, durability_mode: 'fixed', random_break_chance: null };
}

/**
 * Một dòng effect mặc định cho booster theo subtype (khớp CSV / seed mẫu).
 * magic_value trên item → tier; percent dùng value_min = tier*10 (giống bước sync sau).
 */
function inferBoosterEffectRow(item) {
  const subtype = String(item.subtype || '').toLowerCase();
  const magicRaw = item.magic_value != null ? Number(item.magic_value) : NaN;
  const tier = Number.isFinite(magicRaw) ? Math.max(1, Math.floor(magicRaw)) : 1;
  const pct = tier * 10;

  const percentPermanent = (effectTarget) => ({
    effect_target: effectTarget,
    effect_type: 'percent',
    value_min: pct,
    value_max: pct,
    is_permanent: 1,
    duration_turns: 0,
    magic_value: tier,
  });

  if (subtype.includes('def_boost')) return percentPermanent('def');
  if (subtype.includes('str_boost')) return percentPermanent('str');
  if (subtype.includes('spd_boost')) return percentPermanent('spd');
  if (subtype.includes('int_boost')) return percentPermanent('intelligence');
  if (subtype.includes('hp_boost')) return percentPermanent('hp');
  if (subtype.includes('mp_boost')) return percentPermanent('mp');
  if (subtype.includes('exp_boost')) {
    const flat = tier * 100;
    return {
      effect_target: 'exp',
      effect_type: 'flat',
      value_min: flat,
      value_max: flat,
      is_permanent: 1,
      duration_turns: 0,
      magic_value: tier,
    };
  }
  if (subtype.includes('lvl_boost')) {
    const flat = tier * 500;
    return {
      effect_target: 'exp',
      effect_type: 'flat',
      value_min: flat,
      value_max: flat,
      is_permanent: 1,
      duration_turns: 0,
      magic_value: tier,
    };
  }
  return {
    effect_target: 'exp',
    effect_type: 'flat',
    value_min: tier * 50,
    value_max: tier * 50,
    is_permanent: 1,
    duration_turns: 0,
    magic_value: tier,
  };
}

async function ensureBoosterItemEffects(conn) {
  const [boosters] = await conn.query(
    `
      SELECT id, item_code, subtype, magic_value, name
      FROM items
      WHERE type = 'booster'
      ORDER BY COALESCE(item_code, id), id
    `
  );
  let inserted = 0;
  for (const it of boosters) {
    const [cntRows] = await conn.query('SELECT COUNT(*) AS c FROM item_effects WHERE item_id = ?', [it.id]);
    const c = Number(cntRows[0]?.c ?? 0);
    if (c > 0) continue;
    const eff = inferBoosterEffectRow(it);
    await conn.query(
      `
        INSERT INTO item_effects
          (item_id, effect_target, effect_type, value_min, value_max, is_permanent, duration_turns, magic_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        it.id,
        eff.effect_target,
        eff.effect_type,
        eff.value_min,
        eff.value_max,
        eff.is_permanent,
        eff.duration_turns,
        eff.magic_value,
      ]
    );
    inserted += 1;
    console.log(
      `> [sync] Inserted item_effect for booster id=${it.id} item_code=${it.item_code ?? 'null'} (${it.name}) → ${eff.effect_target} / ${eff.effect_type}`
    );
  }
  console.log(`> [sync] Booster item_effects auto-inserted: ${inserted} (bỏ qua item đã có ít nhất 1 effect)`);
}

async function syncItemEffectsAndEquipmentFromItems(conn) {
  console.log('> [sync] Removing item_effects / equipment_data rows without matching items...');
  await conn.query(`DELETE FROM item_effects WHERE item_id NOT IN (SELECT id FROM items)`);
  await conn.query(`DELETE FROM equipment_data WHERE item_id NOT IN (SELECT id FROM items)`);

  console.log('> [sync] Removing item_effects for pure weapon/shield items (equipment + category equipment)...');
  await conn.query(
    `
      DELETE ie FROM item_effects ie
      INNER JOIN items i ON i.id = ie.item_id
      WHERE i.type = 'equipment' AND i.category = 'equipment'
    `
  );

  console.log('> [sync] Removing item_effects on items outside gameplay effect groups (cleanup legacy rows)...');
  const [pruneRes] = await conn.query(
    `
      DELETE ie FROM item_effects ie
      INNER JOIN items i ON i.id = ie.item_id
      WHERE NOT (
        i.type IN ('consumable', 'booster', 'evolve', 'food', 'toy', 'medicine', 'quest', 'repair_kit')
        OR (i.type = 'equipment' AND i.category = 'stat_boost')
      )
    `
  );
  console.log(`> [sync] Pruned item_effects rows (non-gameplay item types): ${pruneRes.affectedRows ?? 0}`);

  await ensureBoosterItemEffects(conn);

  console.log('> [sync] Upserting equipment_data from items.magic_value (combat equipment)...');
  const [weaponItems] = await conn.query(
    `
      SELECT i.id, i.subtype, i.magic_value
      FROM items i
      WHERE i.type = 'equipment' AND i.category = 'equipment'
    `
  );

  for (const row of weaponItems) {
    const magic = clampMagicTier(row.magic_value);
    const pMin = magic * 10;
    const pMax = magic * 10 + 9;
    const meta = inferEquipmentMeta(row.subtype);
    await conn.query(
      `
        INSERT INTO equipment_data
          (item_id, equipment_type, slot_type, power_min, power_max, durability_max, durability_mode, random_break_chance, magic_value, crit_rate, block_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        ON DUPLICATE KEY UPDATE
          equipment_type = VALUES(equipment_type),
          slot_type = VALUES(slot_type),
          power_min = VALUES(power_min),
          power_max = VALUES(power_max),
          durability_max = VALUES(durability_max),
          durability_mode = VALUES(durability_mode),
          random_break_chance = VALUES(random_break_chance),
          magic_value = VALUES(magic_value),
          crit_rate = COALESCE(crit_rate, VALUES(crit_rate)),
          block_rate = COALESCE(block_rate, VALUES(block_rate))
      `,
      [
        row.id,
        meta.equipment_type,
        meta.slot_type,
        pMin,
        pMax,
        meta.durability_max,
        meta.durability_mode,
        meta.random_break_chance,
        magic,
      ]
    );
  }

  console.log('> [sync] Syncing equipment_data for battle consumables (equipment + stat_boost)...');
  const [boostEquip] = await conn.query(
    `
      SELECT i.id, i.magic_value
      FROM items i
      WHERE i.type = 'equipment' AND i.category = 'stat_boost'
    `
  );

  for (const row of boostEquip) {
    const magic = row.magic_value != null ? clampMagicTier(row.magic_value) : 1;
    await conn.query(
      `
        INSERT INTO equipment_data
          (item_id, equipment_type, slot_type, power_min, power_max, durability_max, durability_mode, random_break_chance, magic_value, crit_rate, block_rate)
        VALUES (?, 'booster', 'stat_boost', 0, 0, 60, 'fixed', NULL, ?, NULL, NULL)
        ON DUPLICATE KEY UPDATE
          equipment_type = 'booster',
          slot_type = 'stat_boost',
          power_min = 0,
          power_max = 0,
          magic_value = VALUES(magic_value)
      `,
      [row.id, magic]
    );
  }

  console.log('> [sync] Updating item_effects: magic from items + percent values (exclusions apply)...');
  const [effectRows] = await conn.query(
    `
      SELECT ie.id, ie.effect_target, ie.effect_type, ie.is_permanent,
             i.type, i.category, i.magic_value AS item_magic
      FROM item_effects ie
      INNER JOIN items i ON i.id = ie.item_id
    `
  );

  for (const r of effectRows) {
    const tgt = mapEffectTarget(r.effect_target);
    const typeLower = String(r.effect_type || '').toLowerCase();

    if (r.type === 'evolve') continue;
    if (tgt === 'exp' || tgt === 'status') continue;
    if (typeLower === 'status_cure') continue;

    const eligible =
      r.type === 'consumable' ||
      r.type === 'booster' ||
      (r.type === 'equipment' && r.category === 'stat_boost');

    if (!eligible) continue;

    const magicRaw = r.item_magic != null ? Number(r.item_magic) : NaN;
    const magicTier = Number.isFinite(magicRaw) ? Math.max(1, Math.floor(magicRaw)) : 1;
    const pct = magicTier * 10;

    await conn.query(
      `UPDATE item_effects SET effect_type = 'percent', value_min = ?, value_max = ?, magic_value = ? WHERE id = ?`,
      [pct, pct, r.item_magic != null ? Math.floor(r.item_magic) : null, r.id]
    );
  }

  const [cntRows] = await conn.query('SELECT COUNT(*) AS cnt FROM item_effects');
  console.log(`> [sync] item_effects row count after sync: ${cntRows[0]?.cnt ?? '?'}`);
  console.log('> [sync] item_effects + equipment_data sync completed.');
}

async function mainStandalone() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
  });
  try {
    await conn.beginTransaction();
    await syncItemEffectsAndEquipmentFromItems(conn);
    await conn.commit();
    console.log('sync_item_effects_equipment_magic_v2 done.');
  } catch (e) {
    await conn.rollback();
    console.error(e);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  mainStandalone();
}

module.exports = { syncItemEffectsAndEquipmentFromItems };
