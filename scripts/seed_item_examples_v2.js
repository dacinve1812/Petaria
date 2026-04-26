/**
 * Seed mẫu item theo yêu cầu gameplay mới.
 *
 * Chạy sau migrate_item_system_v2:
 *   node scripts/seed_item_examples_v2.js
 */

const path = require('path');
const { createRequire } = require('module');

const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const mysql = requireBackend('mysql2/promise');
const dotenv = requireBackend('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const sampleItems = [
  {
    item_code: 10001,
    name: 'Thần dược tiến hóa Alpha',
    description: 'Thần dược tiến hóa giúp thú cưng tăng đẳng cấp tức thời và thay đổi hình dạng.',
    type: 'evolve',
    category: 'transform',
    subtype: 'evolution_alpha',
    rarity: 'legendary',
    image_url: 'pot_acara_cloud.gif',
    buy_price: 50000,
    sell_price: 15000,
    price_currency: 'petagold',
    magic_value: 3,
    consume_policy: 'single_use',
    pet_scope: 'domestic_only',
    effects: [
      { effect_target: 'exp', effect_type: 'flat', value_min: 1500, value_max: 1500, is_permanent: 0, duration_turns: 0 },
      { effect_target: 'status', effect_type: 'status_cure', value_min: 1, value_max: 1, is_permanent: 0, duration_turns: 0 },
    ],
  },
  {
    item_code: 10101,
    name: 'Dây chuyền đá',
    description: 'Tăng phòng thủ cho thú cưng.',
    type: 'booster',
    category: 'stat_boost',
    subtype: 'def_boost',
    rarity: 'common',
    image_url: 'placeholder_necklace.gif',
    buy_price: 800,
    sell_price: 240,
    magic_value: 1,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'def', effect_type: 'flat', value_min: 1, value_max: 1, is_permanent: 1, duration_turns: 0 }],
  },
  {
    item_code: 10102,
    name: 'Nhẫn tam bảo',
    description: 'Tăng sức mạnh cho thú cưng.',
    type: 'booster',
    category: 'stat_boost',
    subtype: 'str_boost',
    rarity: 'common',
    image_url: 'placeholder_ring.gif',
    buy_price: 800,
    sell_price: 240,
    magic_value: 1,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'str', effect_type: 'flat', value_min: 1, value_max: 1, is_permanent: 1, duration_turns: 0 }],
  },
  {
    item_code: 10103,
    name: 'Giày siêu tốc',
    description: 'Tăng tốc độ cho thú cưng.',
    type: 'booster',
    category: 'stat_boost',
    subtype: 'spd_boost',
    rarity: 'common',
    image_url: 'placeholder_boots.gif',
    buy_price: 1000,
    sell_price: 300,
    magic_value: 1,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'spd', effect_type: 'flat', value_min: 1, value_max: 1, is_permanent: 1, duration_turns: 0 }],
  },
  {
    item_code: 10104,
    name: 'Sách giáo khoa Petaria',
    description: 'Tăng trí tuệ cho thú cưng.',
    type: 'booster',
    category: 'stat_boost',
    subtype: 'int_boost',
    rarity: 'common',
    image_url: 'placeholder_book.gif',
    buy_price: 1000,
    sell_price: 300,
    magic_value: 1,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'intelligence', effect_type: 'flat', value_min: 1, value_max: 1, is_permanent: 1, duration_turns: 0 }],
  },
  {
    item_code: 10105,
    name: 'Sâm tửu',
    description: 'Tăng sinh mệnh (HP) cho thú cưng.',
    type: 'booster',
    category: 'stat_boost',
    subtype: 'hp_boost',
    rarity: 'rare',
    image_url: 'battle_potion.gif',
    buy_price: 3000,
    sell_price: 900,
    price_currency: 'peta',
    magic_value: 5,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'hp', effect_type: 'flat', value_min: 5, value_max: 5, is_permanent: 1, duration_turns: 0 }],
  },
  {
    item_code: 10106,
    name: 'Nước tăng lực ngũ sắc',
    description: 'Tăng năng lượng (MP) cho thú cưng.',
    type: 'booster',
    category: 'stat_boost',
    subtype: 'mp_boost',
    rarity: 'epic',
    image_url: 'placeholder_energy_drink.gif',
    buy_price: 7000,
    sell_price: 2100,
    price_currency: 'peta',
    magic_value: 10,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'mp', effect_type: 'flat', value_min: 10, value_max: 10, is_permanent: 1, duration_turns: 0 }],
  },
  {
    item_code: 10107,
    name: 'Thần dược Exp No.1',
    description: 'Tăng kinh nghiệm cho thú cưng.',
    type: 'booster',
    category: 'stat_boost',
    subtype: 'exp_boost',
    rarity: 'common',
    image_url: 'mpo_kayla_7.gif',
    buy_price: 1200,
    sell_price: 360,
    price_currency: 'peta',
    magic_value: 1,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'exp', effect_type: 'flat', value_min: 100, value_max: 100, is_permanent: 1, duration_turns: 0 }],
  },
  {
    item_code: 13001,
    name: 'Bạch ngân kiếm',
    description: 'Vũ khí vĩnh viễn, không bao giờ gãy.',
    type: 'equipment',
    category: 'equipment',
    subtype: 'weapon_permanent',
    rarity: 'epic',
    image_url: 'placeholder_silver_sword.gif',
    buy_price: 25000,
    sell_price: 7500,
    price_currency: 'petagold',
    magic_value: 4,
    consume_policy: 'on_battle_only',
    stackable: 0,
    max_stack: 1,
    equipment: { equipment_type: 'weapon', slot_type: 'weapon', power_min: 22, power_max: 30, durability_max: 999999, durability_mode: 'unbreakable', random_break_chance: null },
  },
  {
    item_code: 13002,
    name: 'Cung Mãng xà',
    description: 'Vũ khí tấn công chí mạng.',
    type: 'equipment',
    category: 'stat_boost',
    subtype: 'weapon_critical',
    rarity: 'rare',
    image_url: 'placeholder_serpent_bow.gif',
    buy_price: 15000,
    sell_price: 4500,
    price_currency: 'petagold',
    magic_value: 3,
    consume_policy: 'on_battle_only',
    stackable: 0,
    max_stack: 1,
    equipment: { equipment_type: 'crit_weapon', slot_type: 'weapon', power_min: 16, power_max: 24, durability_max: 120, durability_mode: 'fixed', random_break_chance: null, crit_rate: 12 },
  },
  {
    item_code: 13003,
    name: 'Khiên gỗ',
    description: 'Vũ khí phòng thủ cơ bản.',
    type: 'equipment',
    category: 'stat_boost',
    subtype: 'shield_basic',
    rarity: 'common',
    image_url: 'placeholder_wood_shield.gif',
    buy_price: 1200,
    sell_price: 360,
    price_currency: 'peta',
    magic_value: 1,
    consume_policy: 'on_battle_only',
    stackable: 0,
    max_stack: 1,
    equipment: { equipment_type: 'shield', slot_type: 'shield', power_min: 5, power_max: 8, durability_max: 100, durability_mode: 'fixed', random_break_chance: null, block_rate: 8 },
  },
  {
    item_code: 11001,
    name: 'Hồng dược',
    description: 'Dược phẩm phục hồi sức khoẻ theo chỉ số ma thuật.',
    type: 'consumable',
    category: 'medicine',
    subtype: 'hp_recovery',
    rarity: 'common',
    image_url: 'placeholder_red_potion.gif',
    buy_price: 400,
    sell_price: 120,
    price_currency: 'peta',
    magic_value: 2,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'hp', effect_type: 'flat', value_min: 6, value_max: 6, is_permanent: 0, duration_turns: 0 }],
  },
  {
    item_code: 11002,
    name: 'Lục năng dược',
    description: 'Dược phẩm phục hồi năng lượng theo chỉ số ma thuật.',
    type: 'consumable',
    category: 'medicine',
    subtype: 'mp_recovery',
    rarity: 'common',
    image_url: 'placeholder_green_potion.gif',
    buy_price: 500,
    sell_price: 150,
    price_currency: 'peta',
    magic_value: 3,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'mp', effect_type: 'flat', value_min: 5, value_max: 5, is_permanent: 0, duration_turns: 0 }],
  },
  {
    item_code: 13004,
    name: 'Minh dược',
    description: 'Dược phẩm hỗ trợ chiến đấu, tăng độ chính xác cho thú của bạn.',
    type: 'equipment',
    category: 'stat_boost',
    subtype: 'accuracy_up',
    rarity: 'rare',
    image_url: 'placeholder_accuracy_up.gif',
    buy_price: 3000,
    sell_price: 900,
    price_currency: 'peta',
    magic_value: 2,
    consume_policy: 'on_battle_only',
    stackable: 0,
    max_stack: 1,
    effects: [{ effect_target: 'status', effect_type: 'flat', value_min: 2, value_max: 2, is_permanent: 0, duration_turns: 3 }],
    equipment: { equipment_type: 'booster', slot_type: 'stat_boost', power_min: 0, power_max: 0, durability_max: 60, durability_mode: 'fixed', random_break_chance: null },
  },
  {
    item_code: 13005,
    name: 'Ảo dược',
    description: 'Dược phẩm hỗ trợ chiến đấu, giảm độ chính xác của đối thủ.',
    type: 'equipment',
    category: 'stat_boost',
    subtype: 'accuracy_down',
    rarity: 'rare',
    image_url: 'placeholder_accuracy_down.gif',
    buy_price: 3000,
    sell_price: 900,
    price_currency: 'peta',
    magic_value: 2,
    consume_policy: 'on_battle_only',
    stackable: 0,
    max_stack: 1,
    effects: [{ effect_target: 'status', effect_type: 'flat', value_min: -2, value_max: -2, is_permanent: 0, duration_turns: 3 }],
    equipment: { equipment_type: 'booster', slot_type: 'stat_boost', power_min: 0, power_max: 0, durability_max: 60, durability_mode: 'fixed', random_break_chance: null },
  },
  {
    item_code: 12001,
    name: 'Sao vàng',
    description: 'Đồ chơi giúp tăng trạng thái hạnh phúc.',
    type: 'consumable',
    category: 'toy',
    subtype: 'happiness_up',
    rarity: 'common',
    image_url: 'placeholder_star_toy.gif',
    buy_price: 200,
    sell_price: 60,
    price_currency: 'peta',
    magic_value: 1,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'happiness', effect_type: 'flat', value_min: 1, value_max: 1, is_permanent: 0, duration_turns: 0 }],
  },
  {
    item_code: 12002,
    name: 'Bánh mì',
    description: 'Thức ăn cơ bản giúp thú cưng no hơn.',
    type: 'consumable',
    category: 'food',
    subtype: 'hunger_recovery',
    rarity: 'common',
    image_url: 'alf_bread.gif',
    buy_price: 100,
    sell_price: 30,
    price_currency: 'peta',
    magic_value: 1,
    consume_policy: 'single_use',
    effects: [{ effect_target: 'hunger', effect_type: 'flat', value_min: 1, value_max: 1, is_permanent: 0, duration_turns: 0 }],
  },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'petaria',
  });

  try {
    await conn.beginTransaction();

    for (const item of sampleItems) {
      const [existsRows] = await conn.query('SELECT id FROM items WHERE item_code = ? LIMIT 1', [item.item_code]);
      let itemId;
      if (existsRows.length > 0) {
        itemId = existsRows[0].id;
        await conn.query(
          `
            UPDATE items
            SET name=?, description=?, type=?, category=?, subtype=?, rarity=?, image_url=?, buy_price=?, sell_price=?,
                price_currency=?, magic_value=?, stackable=?, max_stack=?, consume_policy=?, pet_scope=?
            WHERE id=?
          `,
          [
            item.name,
            item.description || '',
            item.type,
            item.category || 'misc',
            item.subtype || null,
            item.rarity || 'common',
            item.image_url || '',
            Number(item.buy_price || 0),
            Number(item.sell_price || 0),
            item.price_currency || 'peta',
            item.magic_value ?? null,
            item.stackable ?? 1,
            item.max_stack ?? 999,
            item.consume_policy || 'single_use',
            item.pet_scope || 'all',
            itemId,
          ]
        );
      } else {
        const [insertResult] = await conn.query(
          `
            INSERT INTO items
              (item_code, name, description, type, category, subtype, rarity, image_url, buy_price, sell_price, price_currency, magic_value, stackable, max_stack, consume_policy, pet_scope)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            item.item_code,
            item.name,
            item.description || '',
            item.type,
            item.category || 'misc',
            item.subtype || null,
            item.rarity || 'common',
            item.image_url || '',
            Number(item.buy_price || 0),
            Number(item.sell_price || 0),
            item.price_currency || 'peta',
            item.magic_value ?? null,
            item.stackable ?? 1,
            item.max_stack ?? 999,
            item.consume_policy || 'single_use',
            item.pet_scope || 'all',
          ]
        );
        itemId = insertResult.insertId;
      }

      if (Array.isArray(item.effects)) {
        await conn.query('DELETE FROM item_effects WHERE item_id = ?', [itemId]);
        for (const effect of item.effects) {
          await conn.query(
            `
              INSERT INTO item_effects (item_id, effect_target, effect_type, value_min, value_max, is_permanent, duration_turns, magic_value)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              itemId,
              effect.effect_target,
              effect.effect_type,
              Number(effect.value_min ?? 0),
              Number(effect.value_max ?? 0),
              effect.is_permanent ? 1 : 0,
              Number(effect.duration_turns ?? 0),
              effect.magic_value != null ? Number(effect.magic_value) : Number(item.magic_value ?? 1),
            ]
          );
        }
      }

      if (item.equipment) {
        const eq = item.equipment;
        await conn.query(
          `
            INSERT INTO equipment_data
              (item_id, equipment_type, slot_type, power_min, power_max, durability_max, magic_value, crit_rate, block_rate, durability_mode, random_break_chance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              equipment_type=VALUES(equipment_type),
              slot_type=VALUES(slot_type),
              power_min=VALUES(power_min),
              power_max=VALUES(power_max),
              durability_max=VALUES(durability_max),
              magic_value=VALUES(magic_value),
              crit_rate=VALUES(crit_rate),
              block_rate=VALUES(block_rate),
              durability_mode=VALUES(durability_mode),
              random_break_chance=VALUES(random_break_chance)
          `,
          [
            itemId,
            eq.equipment_type || 'weapon',
            eq.slot_type || 'weapon',
            Number(eq.power_min ?? 0),
            Number(eq.power_max ?? 0),
            Number(eq.durability_max ?? 100),
            Number(item.magic_value ?? eq.magic_value ?? 1),
            eq.crit_rate != null ? Number(eq.crit_rate) : null,
            eq.block_rate != null ? Number(eq.block_rate) : null,
            eq.durability_mode || 'fixed',
            eq.random_break_chance != null ? Number(eq.random_break_chance) : null,
          ]
        );
      }
    }

    await conn.commit();
    console.log('Seed sample items completed.');
  } catch (err) {
    await conn.rollback();
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
