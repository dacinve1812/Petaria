const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/database');
const titleService = require('../titleService');

const router = express.Router();

const ABANDON_COOLDOWN_MS = 30 * 60 * 1000;
const EXPIRE_COOLDOWN_MS = 15 * 60 * 1000;

const EXCLUDED_TYPES = new Set(['quest', 'key', 'currency', 'ticket']);
const MAX_BUY_PRICE = {
  easy: 8000,
  medium: 40000,
  hard: 200000,
  special: 500000,
};

const TIER_CONFIG = {
  easy: {
    key: 'easy',
    label: 'Dễ',
    durationMs: 60 * 60 * 1000,
    requirementCount: 3,
    dailyLimit: 5,
    petaRatio: 0.5,
    petaMin: 50,
    petaMax: 5000,
  },
  medium: {
    key: 'medium',
    label: 'Trung bình',
    durationMs: 30 * 60 * 1000,
    requirementCount: 4,
    dailyLimit: 3,
    petaRatio: 0.6,
    petaMin: 100,
    petaMax: 15000,
  },
  hard: {
    key: 'hard',
    label: 'Khó',
    durationMs: 15 * 60 * 1000,
    requirementCount: 5,
    dailyLimit: 2,
    petaRatio: 0.7,
    petaMin: 200,
    petaMax: 50000,
  },
  special: {
    key: 'special',
    label: 'Đặc biệt',
    durationMs: 20 * 60 * 1000,
    requirementCount: 5,
    dailyLimit: 3,
    petaRatio: 0.75,
    petaMin: 500,
    petaMax: 100000,
  },
};

const RARITY_CANONICAL = new Set(['common', 'rare', 'epic', 'legendary']);

function normalizeItemRarity(raw) {
  const k = String(raw || '').trim().toLowerCase();
  if (RARITY_CANONICAL.has(k)) return k;
  if (k === 'normal') return 'common';
  if (k === 'legend' || k === 'unique' || k === 'artifact' || k === 'mythic') return 'legendary';
  if (k === 'uncommon') return 'rare';
  return 'common';
}

function rarityLabelVi(r) {
  const map = { common: 'Thường', rare: 'Hiếm', epic: 'Cực hiếm', legendary: 'Legend' };
  return map[normalizeItemRarity(r)] || 'Thường';
}

function pickWeighted(entries) {
  const total = entries.reduce((s, e) => s + (Number(e.weight) || 0), 0);
  if (total <= 0) return entries[0]?.value;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= Number(e.weight) || 0;
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1]?.value;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function ensureItemHuntTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS item_hunt_quests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      tier VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      requirements_json JSON NOT NULL,
      composition_key VARCHAR(32) NULL,
      reward_peta INT NOT NULL DEFAULT 0,
      reward_weights_json JSON NULL,
      reward_item_json JSON NULL,
      expires_at DATETIME NOT NULL,
      completed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ihq_user_status (user_id, status),
      INDEX idx_ihq_expires (status, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try {
    await db.query(
      `ALTER TABLE item_hunt_quests ADD COLUMN reward_item_json JSON NULL AFTER reward_weights_json`
    );
  } catch (e) {
    const msg = String(e && e.message);
    if (!msg.includes('Duplicate column') && e.code !== 'ER_DUP_FIELDNAME') {
      /* ignore if exists */
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS item_hunt_user_state (
      user_id INT NOT NULL PRIMARY KEY,
      cooldown_until DATETIME NULL,
      daily_period_key VARCHAR(64) NULL,
      daily_easy INT NOT NULL DEFAULT 0,
      daily_medium INT NOT NULL DEFAULT 0,
      daily_hard INT NOT NULL DEFAULT 0,
      daily_special INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

let tablesReady = false;
async function ensureReady() {
  if (tablesReady) return;
  await ensureItemHuntTables();
  tablesReady = true;
}

async function fetchGlobalResetHm() {
  try {
    const [rows] = await db.query(
      `SELECT config_value FROM global_config WHERE config_key = 'global_reset_time' LIMIT 1`
    );
    if (!rows.length) return '06:00';
    return String(rows[0].config_value || '06:00').trim() || '06:00';
  } catch (_) {
    return '06:00';
  }
}

function dailyPeriodKey(now, resetHm) {
  const [rh, rm] = String(resetHm || '06:00')
    .split(':')
    .map((x) => parseInt(x, 10) || 0);
  const t = new Date(now.getTime());
  const anchor = new Date(t.getFullYear(), t.getMonth(), t.getDate(), rh, rm, 0, 0);
  if (t.getTime() < anchor.getTime()) anchor.setDate(anchor.getDate() - 1);
  return String(anchor.getTime());
}

async function getSpecialEventConfig() {
  try {
    const [rows] = await db.query(
      `SELECT config_value FROM global_config WHERE config_key = 'item_hunt_special_event' LIMIT 1`
    );
    if (!rows.length) return { enabled: false };
    const raw = rows[0].config_value;
    if (raw === '1' || raw === 'true') return { enabled: true };
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const enabled = Boolean(parsed?.enabled);
      const now = Date.now();
      const start = parsed?.starts_at ? new Date(parsed.starts_at).getTime() : null;
      const end = parsed?.ends_at ? new Date(parsed.ends_at).getTime() : null;
      if (enabled && start && now < start) return { enabled: false, opensAt: parsed.starts_at };
      if (enabled && end && now > end) return { enabled: false };
      return { enabled, label: parsed?.label || 'Sự kiện đặc biệt' };
    } catch (_) {
      return { enabled: false };
    }
  } catch (_) {
    return { enabled: false };
  }
}

async function loadItemPool() {
  const [rows] = await db.query(
    `
    SELECT id, item_code, name, image_url, description, type, category, subtype, rarity, buy_price, magic_value, stackable
    FROM items
    `
  );
  return (rows || [])
    .map((r) => ({
      ...r,
      rarity: normalizeItemRarity(r.rarity),
      type: String(r.type || '').toLowerCase(),
      buy_price: Number(r.buy_price) || 0,
      magic_value: r.magic_value != null ? Number(r.magic_value) : null,
    }))
    .filter((r) => !EXCLUDED_TYPES.has(r.type));
}

function poolByRarity(pool, rarity, tier) {
  const maxPrice = MAX_BUY_PRICE[tier] ?? 999999999;
  return pool.filter(
    (i) => i.rarity === rarity && (i.buy_price <= 0 || i.buy_price <= maxPrice)
  );
}

function pickUniqueItems(pool, count) {
  if (!pool.length || count <= 0) return [];
  const shuffled = shuffle(pool);
  const picked = [];
  const used = new Set();
  for (const item of shuffled) {
    if (used.has(item.id)) continue;
    used.add(item.id);
    picked.push(item);
    if (picked.length >= count) break;
  }
  // nếu pool quá hẹp, cho phép lặp với qty tăng
  while (picked.length < count && pool.length) {
    picked.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return picked;
}

function mergeRequirements(items) {
  const map = new Map();
  for (const item of items) {
    const prev = map.get(item.id);
    if (prev) {
      prev.qty += 1;
    } else {
      map.set(item.id, {
        item_id: item.id,
        qty: 1,
        name: item.name,
        image_url: item.image_url,
        description: item.description || '',
        type: item.type,
        category: item.category || null,
        subtype: item.subtype || null,
        rarity: item.rarity,
        magic_value: item.magic_value,
        buy_price: item.buy_price,
      });
    }
  }
  return [...map.values()];
}

function rollMediumComposition() {
  return pickWeighted([
    { value: { key: '3c1r', rarities: ['common', 'common', 'common', 'rare'] }, weight: 60 },
    { value: { key: '2c2r', rarities: ['common', 'common', 'rare', 'rare'] }, weight: 30 },
    { value: { key: '1c1r2e', rarities: ['common', 'rare', 'epic', 'epic'] }, weight: 10 },
  ]);
}

function rollHardComposition() {
  return pickWeighted([
    { value: { key: '5r', rarities: ['rare', 'rare', 'rare', 'rare', 'rare'] }, weight: 40 },
    { value: { key: '4r1e', rarities: ['rare', 'rare', 'rare', 'rare', 'epic'] }, weight: 25 },
    { value: { key: '3r2e', rarities: ['rare', 'rare', 'rare', 'epic', 'epic'] }, weight: 20 },
    { value: { key: '2r3e', rarities: ['rare', 'rare', 'epic', 'epic', 'epic'] }, weight: 10 },
    { value: { key: '5e', rarities: ['epic', 'epic', 'epic', 'epic', 'epic'] }, weight: 5 },
  ]);
}

function rollSpecialComposition() {
  return pickWeighted([
    { value: { key: '3r2e', rarities: ['rare', 'rare', 'rare', 'epic', 'epic'] }, weight: 35 },
    { value: { key: '2r3e', rarities: ['rare', 'rare', 'epic', 'epic', 'epic'] }, weight: 30 },
    { value: { key: '4e1l', rarities: ['epic', 'epic', 'epic', 'epic', 'legendary'] }, weight: 25 },
    { value: { key: '3e2l', rarities: ['epic', 'epic', 'epic', 'legendary', 'legendary'] }, weight: 10 },
  ]);
}

function rewardWeightsFor(tier, compositionKey) {
  if (tier === 'easy') {
    return [
      { rarity: 'common', weight: 65, label: rarityLabelVi('common') },
      { rarity: 'rare', weight: 35, label: rarityLabelVi('rare') },
    ];
  }
  if (tier === 'medium') {
    if (compositionKey === '3c1r') {
      return [
        { rarity: 'common', weight: 25, label: rarityLabelVi('common') },
        { rarity: 'rare', weight: 70, label: rarityLabelVi('rare') },
        { rarity: 'epic', weight: 5, label: rarityLabelVi('epic') },
      ];
    }
    if (compositionKey === '2c2r') {
      return [
        { rarity: 'common', weight: 10, label: rarityLabelVi('common') },
        { rarity: 'rare', weight: 55, label: rarityLabelVi('rare') },
        { rarity: 'epic', weight: 35, label: rarityLabelVi('epic') },
      ];
    }
    return [
      { rarity: 'rare', weight: 35, label: rarityLabelVi('rare') },
      { rarity: 'epic', weight: 50, label: rarityLabelVi('epic') },
      { rarity: 'legendary', weight: 15, label: rarityLabelVi('legendary') },
    ];
  }
  if (tier === 'hard') {
    if (compositionKey === '5r' || compositionKey === '4r1e') {
      return [
        { rarity: 'rare', weight: 40, label: rarityLabelVi('rare') },
        { rarity: 'epic', weight: 45, label: rarityLabelVi('epic') },
        { rarity: 'legendary', weight: 15, label: rarityLabelVi('legendary') },
      ];
    }
    if (compositionKey === '3r2e' || compositionKey === '2r3e') {
      return [
        { rarity: 'rare', weight: 20, label: rarityLabelVi('rare') },
        { rarity: 'epic', weight: 60, label: rarityLabelVi('epic') },
        { rarity: 'legendary', weight: 20, label: rarityLabelVi('legendary') },
      ];
    }
    return [
      { rarity: 'epic', weight: 55, label: rarityLabelVi('epic') },
      { rarity: 'legendary', weight: 45, label: rarityLabelVi('legendary') },
    ];
  }
  // special
  return [
    { rarity: 'epic', weight: 45, label: rarityLabelVi('epic') },
    { rarity: 'legendary', weight: 55, label: rarityLabelVi('legendary') },
  ];
}

function calcRewardPeta(requirements, tierCfg) {
  const total = requirements.reduce((s, r) => s + (Number(r.buy_price) || 0) * (Number(r.qty) || 1), 0);
  const avgFallback = tierCfg.petaMin * 2;
  const base = total > 0 ? total : avgFallback;
  const raw = Math.round(base * tierCfg.petaRatio);
  return clamp(raw, tierCfg.petaMin, tierCfg.petaMax);
}

function buildRequirementsFromRarities(pool, rarities, tier) {
  const picked = [];
  for (const rarity of rarities) {
    let candidates = poolByRarity(pool, rarity, tier);
    if (!candidates.length) {
      // fallback xuống rarity gần hơn
      const fallbackOrder =
        rarity === 'legendary'
          ? ['legendary', 'epic', 'rare', 'common']
          : rarity === 'epic'
            ? ['epic', 'rare', 'common']
            : rarity === 'rare'
              ? ['rare', 'common']
              : ['common', 'rare'];
      for (const fr of fallbackOrder) {
        candidates = poolByRarity(pool, fr, tier);
        if (candidates.length) break;
      }
    }
    if (!candidates.length) continue;
    // tránh trùng id nếu còn lựa chọn
    const unused = candidates.filter((c) => !picked.some((p) => p.id === c.id));
    const source = unused.length ? unused : candidates;
    picked.push(source[Math.floor(Math.random() * source.length)]);
  }
  return mergeRequirements(picked);
}

async function getOrCreateUserState(userId, periodKey) {
  const [rows] = await db.query('SELECT * FROM item_hunt_user_state WHERE user_id = ? LIMIT 1', [
    userId,
  ]);
  if (!rows.length) {
    await db.query(
      `INSERT INTO item_hunt_user_state (user_id, daily_period_key) VALUES (?, ?)`,
      [userId, periodKey]
    );
    return {
      user_id: userId,
      cooldown_until: null,
      daily_period_key: periodKey,
      daily_easy: 0,
      daily_medium: 0,
      daily_hard: 0,
      daily_special: 0,
    };
  }
  const state = rows[0];
  if (String(state.daily_period_key || '') !== String(periodKey)) {
    await db.query(
      `UPDATE item_hunt_user_state
       SET daily_period_key = ?, daily_easy = 0, daily_medium = 0, daily_hard = 0, daily_special = 0
       WHERE user_id = ?`,
      [periodKey, userId]
    );
    return {
      ...state,
      daily_period_key: periodKey,
      daily_easy: 0,
      daily_medium: 0,
      daily_hard: 0,
      daily_special: 0,
    };
  }
  return state;
}

async function getActiveQuest(userId) {
  const [rows] = await db.query(
    `SELECT * FROM item_hunt_quests WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function expireQuestIfNeeded(quest, userId) {
  if (!quest) return null;
  const expiresAt = new Date(quest.expires_at).getTime();
  if (Date.now() < expiresAt) return quest;

  await db.query(
    `UPDATE item_hunt_quests SET status = 'expired', completed_at = NOW() WHERE id = ? AND status = 'active'`,
    [quest.id]
  );
  // Cooldown tính từ thời điểm nhiệm vụ THỰC SỰ hết hạn, không phải từ lúc
  // người chơi tình cờ mở lại trang. Nếu 15 phút đó đã trôi qua thì bỏ qua cooldown.
  const untilMs = expiresAt + EXPIRE_COOLDOWN_MS;
  if (untilMs > Date.now()) {
    await db.query(
      `INSERT INTO item_hunt_user_state (user_id, cooldown_until)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE cooldown_until = VALUES(cooldown_until)`,
      [userId, new Date(untilMs)]
    );
  }
  return null;
}

async function countOwnedUnequipped(userId, itemId, runner = db) {
  const [rows] = await runner.query(
    `
    SELECT COALESCE(SUM(quantity), 0) AS qty
    FROM inventory
    WHERE player_id = ? AND item_id = ?
      AND (is_equipped = 0 OR is_equipped IS NULL)
    `,
    [userId, itemId]
  );
  return Number(rows[0]?.qty) || 0;
}

async function consumeUnequippedItems(conn, userId, itemId, needQty) {
  let remaining = needQty;
  const [rows] = await conn.query(
    `
    SELECT id, quantity FROM inventory
    WHERE player_id = ? AND item_id = ?
      AND (is_equipped = 0 OR is_equipped IS NULL)
    ORDER BY id ASC
    FOR UPDATE
    `,
    [userId, itemId]
  );
  for (const row of rows) {
    if (remaining <= 0) break;
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue;
    if (qty <= remaining) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [row.id]);
      remaining -= qty;
    } else {
      await conn.query('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [
        remaining,
        row.id,
      ]);
      remaining = 0;
    }
  }
  if (remaining > 0) {
    throw new Error('INSUFFICIENT_ITEMS');
  }
}

async function grantStackableItem(conn, userId, itemId, quantity) {
  const qty = Math.max(1, Number(quantity) || 1);
  const [itemRows] = await conn.query(
    'SELECT id, type, stackable FROM items WHERE id = ? LIMIT 1',
    [itemId]
  );
  if (!itemRows.length) return { granted: 0 };
  const item = itemRows[0];
  const isEquipment = String(item.type || '').toLowerCase() === 'equipment';
  const stackable = item.stackable === 1 || item.stackable === true;

  if (isEquipment || !stackable) {
    for (let i = 0; i < qty; i += 1) {
      await conn.query(
        'INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, 1)',
        [userId, itemId]
      );
    }
    return { granted: qty };
  }

  const [invRows] = await conn.query(
    `SELECT id FROM inventory
     WHERE player_id = ? AND item_id = ?
       AND (is_equipped = 0 OR is_equipped IS NULL)
     LIMIT 1`,
    [userId, itemId]
  );
  if (invRows.length) {
    await conn.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [
      qty,
      invRows[0].id,
    ]);
  } else {
    await conn.query('INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)', [
      userId,
      itemId,
      qty,
    ]);
  }
  return { granted: qty };
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function pickRewardItem(pool, tier, compositionKey) {
  const weights = rewardWeightsFor(tier, compositionKey);
  const rolledRarity =
    pickWeighted(weights.map((w) => ({ value: w.rarity, weight: w.weight }))) || 'common';
  let candidates = poolByRarity(pool, rolledRarity, tier);
  if (!candidates.length) {
    candidates = pool.filter((i) => i.rarity === rolledRarity);
  }
  if (!candidates.length) {
    candidates = pool;
  }
  const item = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    item_id: item.id,
    name: item.name,
    image_url: item.image_url,
    description: item.description || '',
    type: item.type,
    category: item.category || null,
    subtype: item.subtype || null,
    rarity: item.rarity,
    magic_value: item.magic_value,
    qty: 1,
  };
}

async function enrichQuestForClient(quest, userId) {
  if (!quest) return null;
  const requirements = parseJsonField(quest.requirements_json, []);
  const rewardItem = parseJsonField(quest.reward_item_json, null);
  const withOwned = [];
  for (const req of requirements) {
    const owned = await countOwnedUnequipped(userId, req.item_id);
    withOwned.push({
      ...req,
      id: req.item_id,
      owned,
      quantity: owned,
      enough: owned >= Number(req.qty || 1),
    });
  }
  const canSubmit = withOwned.every((r) => r.enough);
  const expiresAtMs = new Date(quest.expires_at).getTime();
  const remainingMs = Math.max(0, expiresAtMs - Date.now());

  return {
    id: quest.id,
    tier: quest.tier,
    tier_label: TIER_CONFIG[quest.tier]?.label || quest.tier,
    status: quest.status,
    composition_key: quest.composition_key,
    requirements: withOwned,
    reward_peta: Number(quest.reward_peta) || 0,
    reward_item: rewardItem,
    can_submit: canSubmit,
    expires_at: quest.expires_at,
    remaining_ms: remainingMs,
    created_at: quest.created_at,
  };
}

function dailyCountForTier(state, tier) {
  if (tier === 'easy') return Number(state.daily_easy) || 0;
  if (tier === 'medium') return Number(state.daily_medium) || 0;
  if (tier === 'hard') return Number(state.daily_hard) || 0;
  if (tier === 'special') return Number(state.daily_special) || 0;
  return 0;
}

function dailyColumn(tier) {
  return `daily_${tier}`;
}

// ---------- Routes ----------

router.get('/status', auth, async (req, res) => {
  try {
    await ensureReady();
    const userId = req.user.userId;
    const resetHm = await fetchGlobalResetHm();
    const periodKey = dailyPeriodKey(new Date(), resetHm);
    let state = await getOrCreateUserState(userId, periodKey);
    let quest = await getActiveQuest(userId);
    quest = await expireQuestIfNeeded(quest, userId);
    if (!quest) {
      // refresh state after possible expire cooldown write
      state = await getOrCreateUserState(userId, periodKey);
    }

    const special = await getSpecialEventConfig();
    const cooldownUntil = state.cooldown_until ? new Date(state.cooldown_until).getTime() : null;
    const cooldownRemainingMs =
      cooldownUntil && cooldownUntil > Date.now() ? cooldownUntil - Date.now() : 0;

    const tiers = Object.values(TIER_CONFIG).map((t) => {
      const used = dailyCountForTier(state, t.key);
      const specialLocked = t.key === 'special' && !special.enabled;
      const dailyFull = used >= t.dailyLimit;
      const onCooldown = cooldownRemainingMs > 0;
      const hasActive = Boolean(quest);
      return {
        key: t.key,
        label: t.label,
        duration_ms: t.durationMs,
        requirement_count: t.requirementCount,
        daily_limit: t.dailyLimit,
        daily_used: used,
        available: !specialLocked && !dailyFull && !onCooldown && !hasActive,
        locked_reason: hasActive
          ? 'Bạn đang có nhiệm vụ đang chạy'
          : onCooldown
            ? 'Đang trong thời gian chờ'
            : specialLocked
              ? 'Chỉ mở trong sự kiện'
              : dailyFull
                ? 'Đã hết lượt hôm nay'
                : null,
      };
    });

    res.json({
      tiers,
      special_event: special,
      cooldown_remaining_ms: cooldownRemainingMs,
      cooldown_until: state.cooldown_until,
      daily_period_key: periodKey,
      active_quest: quest ? await enrichQuestForClient(quest, userId) : null,
      abandon_cooldown_ms: ABANDON_COOLDOWN_MS,
      expire_cooldown_ms: EXPIRE_COOLDOWN_MS,
    });
  } catch (err) {
    console.error('item-hunt status:', err);
    res.status(500).json({ error: 'Không tải được trạng thái nhiệm vụ' });
  }
});

router.post('/accept', auth, async (req, res) => {
  try {
    await ensureReady();
    const userId = req.user.userId;
    const tier = String(req.body?.tier || '').toLowerCase();
    const tierCfg = TIER_CONFIG[tier];
    if (!tierCfg) return res.status(400).json({ error: 'Cấp độ không hợp lệ' });

    const special = await getSpecialEventConfig();
    if (tier === 'special' && !special.enabled) {
      return res.status(400).json({ error: 'Nhiệm vụ Đặc biệt chỉ mở trong sự kiện' });
    }

    const resetHm = await fetchGlobalResetHm();
    const periodKey = dailyPeriodKey(new Date(), resetHm);
    const state = await getOrCreateUserState(userId, periodKey);

    const cooldownUntil = state.cooldown_until ? new Date(state.cooldown_until).getTime() : 0;
    if (cooldownUntil > Date.now()) {
      return res.status(400).json({
        error: 'Bạn đang trong thời gian chờ trước khi nhận nhiệm vụ mới',
        cooldown_remaining_ms: cooldownUntil - Date.now(),
      });
    }

    const existing = await getActiveQuest(userId);
    if (existing) {
      return res.status(400).json({ error: 'Bạn đang có nhiệm vụ đang chạy (tối đa 1 nhiệm vụ)' });
    }

    const used = dailyCountForTier(state, tier);
    if (used >= tierCfg.dailyLimit) {
      return res.status(400).json({ error: `Đã hết lượt ${tierCfg.label} hôm nay` });
    }

    const pool = await loadItemPool();
    if (pool.length < 3) {
      return res.status(500).json({ error: 'Chưa đủ vật phẩm trong kho dữ liệu để tạo nhiệm vụ' });
    }

    let composition;
    if (tier === 'easy') {
      composition = { key: '3c', rarities: ['common', 'common', 'common'] };
    } else if (tier === 'medium') {
      composition = rollMediumComposition();
    } else if (tier === 'hard') {
      composition = rollHardComposition();
    } else {
      composition = rollSpecialComposition();
    }

    const requirements = buildRequirementsFromRarities(pool, composition.rarities, tier);
    if (!requirements.length) {
      return res.status(500).json({ error: 'Không tạo được yêu cầu vật phẩm' });
    }

    const rewardWeights = rewardWeightsFor(tier, composition.key);
    const rewardItem = pickRewardItem(pool, tier, composition.key);
    const rewardPeta = calcRewardPeta(requirements, tierCfg);
    const expiresAt = new Date(Date.now() + tierCfg.durationMs);

    const [result] = await db.query(
      `
      INSERT INTO item_hunt_quests
        (user_id, tier, status, requirements_json, composition_key, reward_peta, reward_weights_json, reward_item_json, expires_at)
      VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        tier,
        JSON.stringify(requirements),
        composition.key,
        rewardPeta,
        JSON.stringify(rewardWeights),
        JSON.stringify(rewardItem),
        expiresAt,
      ]
    );

    const col = dailyColumn(tier);
    await db.query(
      `UPDATE item_hunt_user_state SET ${col} = ${col} + 1, cooldown_until = NULL WHERE user_id = ?`,
      [userId]
    );

    const [questRows] = await db.query('SELECT * FROM item_hunt_quests WHERE id = ?', [
      result.insertId,
    ]);
    const enriched = await enrichQuestForClient(questRows[0], userId);
    res.json({ success: true, quest: enriched });
  } catch (err) {
    console.error('item-hunt accept:', err);
    res.status(500).json({ error: 'Không thể nhận nhiệm vụ' });
  }
});

router.post('/submit', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await ensureReady();
    const userId = req.user.userId;
    await conn.beginTransaction();

    const [questRows] = await conn.query(
      `SELECT * FROM item_hunt_quests WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const quest = questRows[0];
    if (!quest) {
      await conn.rollback();
      return res.status(400).json({ error: 'Không có nhiệm vụ đang chạy' });
    }

    const expiresAtMs = new Date(quest.expires_at).getTime();
    if (expiresAtMs <= Date.now()) {
      await conn.query(
        `UPDATE item_hunt_quests SET status = 'expired', completed_at = NOW() WHERE id = ?`,
        [quest.id]
      );
      const untilMs = expiresAtMs + EXPIRE_COOLDOWN_MS;
      if (untilMs > Date.now()) {
        await conn.query(
          `INSERT INTO item_hunt_user_state (user_id, cooldown_until)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE cooldown_until = VALUES(cooldown_until)`,
          [userId, new Date(untilMs)]
        );
      }
      await conn.commit();
      return res.status(400).json({ error: 'Nhiệm vụ đã hết thời gian' });
    }

    const requirements = parseJsonField(quest.requirements_json, []);
    for (const reqItem of requirements) {
      const need = Number(reqItem.qty) || 1;
      const owned = await countOwnedUnequipped(userId, reqItem.item_id, conn);
      if (owned < need) {
        await conn.rollback();
        return res.status(400).json({
          error: `Chưa đủ vật phẩm: ${reqItem.name || reqItem.item_id} (${owned}/${need})`,
        });
      }
    }

    for (const reqItem of requirements) {
      await consumeUnequippedItems(conn, userId, reqItem.item_id, Number(reqItem.qty) || 1);
    }

    let rewardItem = parseJsonField(quest.reward_item_json, null);
    if (!rewardItem?.item_id) {
      // fallback cho quest cũ chưa có reward_item_json
      const weights = parseJsonField(quest.reward_weights_json, []);
      const rolledRarity =
        pickWeighted(weights.map((w) => ({ value: w.rarity, weight: w.weight }))) || 'common';
      const pool = await loadItemPool();
      let rewardCandidates = poolByRarity(pool, rolledRarity, quest.tier);
      if (!rewardCandidates.length) {
        rewardCandidates = pool.filter((i) => i.rarity === rolledRarity);
      }
      if (!rewardCandidates.length) rewardCandidates = pool;
      const picked = rewardCandidates[Math.floor(Math.random() * rewardCandidates.length)];
      rewardItem = {
        item_id: picked.id,
        name: picked.name,
        image_url: picked.image_url,
        rarity: picked.rarity,
        qty: 1,
      };
    }

    await grantStackableItem(conn, userId, rewardItem.item_id, Number(rewardItem.qty) || 1);

    const peta = Number(quest.reward_peta) || 0;
    if (peta > 0) {
      await conn.query('UPDATE users SET peta = peta + ? WHERE id = ?', [peta, userId]);
      try {
        await titleService.recordPetaEarned(conn, userId, peta);
      } catch (e) {
        console.error('item-hunt title peta:', e);
      }
    }

    await conn.query(
      `UPDATE item_hunt_quests SET status = 'completed', completed_at = NOW() WHERE id = ?`,
      [quest.id]
    );

    await conn.commit();
    res.json({
      success: true,
      message: 'Hoàn thành nhiệm vụ!',
      reward: {
        peta,
        item: {
          id: rewardItem.item_id,
          name: rewardItem.name,
          image_url: rewardItem.image_url,
          rarity: rewardItem.rarity,
          qty: Number(rewardItem.qty) || 1,
        },
      },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.error('item-hunt submit:', err);
    if (err.message === 'INSUFFICIENT_ITEMS') {
      return res.status(400).json({ error: 'Không đủ vật phẩm trong túi' });
    }
    res.status(500).json({ error: 'Không thể nộp nhiệm vụ' });
  } finally {
    conn.release();
  }
});

router.post('/abandon', auth, async (req, res) => {
  try {
    await ensureReady();
    const userId = req.user.userId;
    const quest = await getActiveQuest(userId);
    if (!quest) return res.status(400).json({ error: 'Không có nhiệm vụ đang chạy' });

    await db.query(
      `UPDATE item_hunt_quests SET status = 'abandoned', completed_at = NOW() WHERE id = ? AND status = 'active'`,
      [quest.id]
    );
    const until = new Date(Date.now() + ABANDON_COOLDOWN_MS);
    await db.query(
      `INSERT INTO item_hunt_user_state (user_id, cooldown_until)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE cooldown_until = VALUES(cooldown_until)`,
      [userId, until]
    );

    res.json({
      success: true,
      message: 'Đã hủy nhiệm vụ. Bạn cần chờ trước khi nhận nhiệm vụ mới.',
      cooldown_remaining_ms: ABANDON_COOLDOWN_MS,
      cooldown_until: until,
    });
  } catch (err) {
    console.error('item-hunt abandon:', err);
    res.status(500).json({ error: 'Không thể hủy nhiệm vụ' });
  }
});

module.exports = router;
