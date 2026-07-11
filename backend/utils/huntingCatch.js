/**
 * Hunting wild-catch config + session helpers.
 * Config stored in hunting_catch_config (JSON), editable via admin.
 */

const DEFAULT_FAIL_MESSAGES = [
  'Không được rồi! {petName} đang phản kháng dữ dội!',
  'Ôi không, hụt mất rồi!!!',
  'Suýt nữa thì được! {petName} đã thoát ra!',
  '{petName} đang rất giận dữ!',
  'Không dễ dàng vậy đâu! {petName} đã phá lưới thoát ra!',
  'Thất bại rồi! {petName} vẫn chưa chịu khuất phục.',
  'Chỉ thiếu một chút nữa thôi!!!',
  'Oops! {petName} đã vùng thoát thành công!',
  'Có vẻ {petName} không thích chiếc lưới này rồi...',
  'Chiếc lưới rung lên dữ dội... và BỤP! {petName} đã thoát ra!',
  'Không ổn rồi! {petName} đang nổi giận!',
  'Gần được rồi... nhưng {petName} đã thoát mất!',
  'Quá mạnh! Chiếc lưới không thể giữ được {petName}!',
  '{petName} đang chống trả quyết liệt!',
  'Hụt rồi! Thử lại lần nữa nhé!',
  'Á!!! Nó thoát mất rồi!',
  'Không thể tin được... {petName} đã thoát ra vào phút chót!',
  'Chiếc lưới đã thất bại! {petName} vẫn còn tự do!',
  '{petName} nhìn bạn đầy thách thức...',
  'Có vẻ bạn cần một chiếc lưới tốt hơn rồi!',
];

const DEFAULT_FEED_MESSAGES = [
  '{petName} có vẻ rất thích món này!',
  'Có vẻ món này rất hợp khẩu vị của {petName}!',
  '{petName} ăn ngon lành!',
  'Món này đúng là khoái khẩu của {petName}!',
  '{petName} tỏ ra rất thích thú!',
  'Có vẻ {petName} muốn ăn thêm nữa!',
];

const DEFAULT_CONFIG = {
  nets: {
    90000: { key: 'normal', label: 'Lưới thường', successRate: 30 },
    90001: { key: 'electric', label: 'Lưới Điện', successRate: 40 },
    90002: { key: 'magic', label: 'Lưới Đặc Biệt', successRate: 50 },
  },
  foodBonusByRarity: {
    common: 0.5,
    uncommon: 1,
    rare: 1,
    epic: 2,
    legendary: 2,
  },
  /** Trừ % khỏi tỉ lệ lưới theo rarity pet (common = 0 giữ nguyên). */
  catchPenaltyByRarity: {
    common: 0,
    uncommon: 5,
    rare: 10,
    epic: 20,
    legendary: 30,
  },
  fleeByFeedCount: [
    { minFeeds: 0, rate: 5 },
    { minFeeds: 10, rate: 10 },
    { minFeeds: 20, rate: 20 },
  ],
  fleePerFailedCatch: 5,
  maxFleeRate: 50,
  maxCatchChance: 95,
  failMessages: DEFAULT_FAIL_MESSAGES,
  feedMessages: DEFAULT_FEED_MESSAGES,
};

/** @type {Map<number, object>} */
const catchSessions = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000;

/** @type {object|null} */
let cachedConfig = null;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeConfig(raw) {
  const base = deepClone(DEFAULT_CONFIG);
  if (!raw || typeof raw !== 'object') return base;

  if (raw.nets && typeof raw.nets === 'object') {
    const nets = {};
    for (const [code, meta] of Object.entries(raw.nets)) {
      if (!meta || typeof meta !== 'object') continue;
      nets[String(code)] = {
        key: String(meta.key || 'net'),
        label: String(meta.label || `Net ${code}`),
        successRate: Math.max(0, Math.min(100, Number(meta.successRate) || 0)),
      };
    }
    if (Object.keys(nets).length) base.nets = nets;
  }

  if (raw.foodBonusByRarity && typeof raw.foodBonusByRarity === 'object') {
    for (const k of Object.keys(base.foodBonusByRarity)) {
      if (raw.foodBonusByRarity[k] != null) {
        base.foodBonusByRarity[k] = Math.max(0, Number(raw.foodBonusByRarity[k]) || 0);
      }
    }
  }

  if (raw.catchPenaltyByRarity && typeof raw.catchPenaltyByRarity === 'object') {
    for (const k of Object.keys(base.catchPenaltyByRarity)) {
      if (raw.catchPenaltyByRarity[k] != null) {
        base.catchPenaltyByRarity[k] = Math.max(0, Math.min(100, Number(raw.catchPenaltyByRarity[k]) || 0));
      }
    }
  }

  if (Array.isArray(raw.fleeByFeedCount) && raw.fleeByFeedCount.length) {
    base.fleeByFeedCount = raw.fleeByFeedCount
      .map((row) => ({
        minFeeds: Math.max(0, Math.floor(Number(row.minFeeds) || 0)),
        rate: Math.max(0, Math.min(100, Number(row.rate) || 0)),
      }))
      .sort((a, b) => a.minFeeds - b.minFeeds);
  }

  if (raw.fleePerFailedCatch != null) {
    base.fleePerFailedCatch = Math.max(0, Number(raw.fleePerFailedCatch) || 0);
  }
  if (raw.maxFleeRate != null) {
    base.maxFleeRate = Math.max(0, Math.min(100, Number(raw.maxFleeRate) || 50));
  }
  if (raw.maxCatchChance != null) {
    base.maxCatchChance = Math.max(1, Math.min(100, Number(raw.maxCatchChance) || 95));
  }
  if (Array.isArray(raw.failMessages)) {
    const msgs = raw.failMessages.map((m) => String(m || '').trim()).filter(Boolean);
    if (msgs.length) base.failMessages = msgs;
  }
  if (Array.isArray(raw.feedMessages)) {
    const msgs = raw.feedMessages.map((m) => String(m || '').trim()).filter(Boolean);
    if (msgs.length) base.feedMessages = msgs;
  }

  return base;
}

async function ensureCatchConfigTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hunting_catch_config (
      id INT NOT NULL PRIMARY KEY DEFAULT 1,
      config JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const [rows] = await db.query('SELECT id FROM hunting_catch_config WHERE id = 1');
  if (!rows.length) {
    await db.query('INSERT INTO hunting_catch_config (id, config) VALUES (1, ?)', [
      JSON.stringify(DEFAULT_CONFIG),
    ]);
  }
}

async function loadCatchConfig(db) {
  await ensureCatchConfigTable(db);
  const [rows] = await db.query('SELECT config FROM hunting_catch_config WHERE id = 1');
  let raw = rows[0]?.config;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  cachedConfig = normalizeConfig(raw);
  return cachedConfig;
}

async function saveCatchConfig(db, nextConfig) {
  const normalized = normalizeConfig(nextConfig);
  await ensureCatchConfigTable(db);
  await db.query(
    `INSERT INTO hunting_catch_config (id, config) VALUES (1, ?)
     ON DUPLICATE KEY UPDATE config = VALUES(config)`,
    [JSON.stringify(normalized)]
  );
  cachedConfig = normalized;
  return cachedConfig;
}

function getCatchConfigSync() {
  return cachedConfig || deepClone(DEFAULT_CONFIG);
}

function pruneCatchSessions() {
  const now = Date.now();
  for (const [uid, s] of catchSessions.entries()) {
    if (!s || now - (s.createdAt || 0) > SESSION_TTL_MS) catchSessions.delete(uid);
  }
}

function getCatchSession(userId) {
  pruneCatchSessions();
  return catchSessions.get(Number(userId)) || null;
}

function setCatchSession(userId, session) {
  catchSessions.set(Number(userId), {
    ...session,
    createdAt: Date.now(),
  });
}

function clearCatchSession(userId) {
  catchSessions.delete(Number(userId));
}

function foodBonusPercent(rarity, config = getCatchConfigSync()) {
  const r = String(rarity || 'common').toLowerCase();
  const map = config.foodBonusByRarity || DEFAULT_CONFIG.foodBonusByRarity;
  if (map[r] != null) return Number(map[r]) || 0;
  return Number(map.common) || 0.5;
}

/** % trừ khỏi tỉ lệ lưới theo rarity pet. */
function catchPenaltyPercent(petRarity, config = getCatchConfigSync()) {
  const r = String(petRarity || 'common').toLowerCase();
  const map = config.catchPenaltyByRarity || DEFAULT_CONFIG.catchPenaltyByRarity;
  if (map[r] != null) return Math.max(0, Number(map[r]) || 0);
  return Math.max(0, Number(map.common) || 0);
}

/** Base flee from feed count thresholds. */
function fleeRateFromFeeds(feedCount, config = getCatchConfigSync()) {
  const n = Math.max(0, Math.floor(Number(feedCount) || 0));
  const rows = config.fleeByFeedCount || DEFAULT_CONFIG.fleeByFeedCount;
  let rate = rows[0]?.rate ?? 5;
  for (const row of rows) {
    if (n >= row.minFeeds) rate = row.rate;
  }
  return rate;
}

/** Total flee % = feed threshold + failCount * perFail, capped. */
function fleeRatePercent(feedCount, failCount = 0, config = getCatchConfigSync()) {
  const base = fleeRateFromFeeds(feedCount, config);
  const extra = Math.max(0, Math.floor(Number(failCount) || 0)) * (Number(config.fleePerFailedCatch) || 0);
  const max = Number(config.maxFleeRate) || 50;
  return Math.min(max, base + extra);
}

function resolveNetMeta(itemRow, config = getCatchConfigSync()) {
  if (!itemRow) return null;
  const code = Number(itemRow.item_code);
  const nets = config.nets || DEFAULT_CONFIG.nets;
  if (nets[code] || nets[String(code)]) {
    const meta = nets[code] || nets[String(code)];
    return { ...meta, itemId: itemRow.id, item_code: code };
  }
  const name = String(itemRow.name || '').toLowerCase();
  const fallback = (key, rate) => ({
    key,
    label: itemRow.name,
    successRate: rate,
    itemId: itemRow.id,
    item_code: code,
  });
  if (name.includes('điện') || name.includes('dien')) return fallback('electric', 40);
  if (name.includes('phép') || name.includes('đặc biệt') || name.includes('dac biet') || name.includes('master')) {
    return fallback('magic', 50);
  }
  if (name.includes('lưới') || name.includes('luoi') || name.includes('thường') || name.includes('thuong')) {
    return fallback('normal', 30);
  }
  if (String(itemRow.subtype || '').toLowerCase() === 'catch_net') {
    return fallback('normal', 30);
  }
  return null;
}

function isCatchNetItem(itemRow, config) {
  return Boolean(resolveNetMeta(itemRow, config));
}

function isFoodItem(itemRow) {
  const cat = String(itemRow?.category || itemRow?.item_category || '').toLowerCase();
  return itemRow?.type === 'food' || (itemRow?.type === 'consumable' && cat === 'food');
}

/**
 * Tỉ lệ bắt = (tỉ lệ lưới − penalty rarity pet) + bonus thức ăn, clamp [0, maxCatchChance].
 */
function clampCatchChance(netRate, foodBonus, config = getCatchConfigSync(), petRarity = 'common') {
  const penalty = catchPenaltyPercent(petRarity, config);
  const effectiveNet = Math.max(0, Number(netRate) - penalty);
  const total = effectiveNet + Number(foodBonus);
  const max = Number(config.maxCatchChance) || 95;
  return Math.max(0, Math.min(max, Math.round(total * 10) / 10));
}

function pickFailMessage(petName, config = getCatchConfigSync()) {
  const list = config.failMessages?.length ? config.failMessages : DEFAULT_FAIL_MESSAGES;
  const template = list[Math.floor(Math.random() * list.length)] || DEFAULT_FAIL_MESSAGES[0];
  return template.replace(/\{petName\}/gi, petName || 'Pet');
}

function pickFeedMessage(petName, config = getCatchConfigSync()) {
  const list = config.feedMessages?.length ? config.feedMessages : DEFAULT_FEED_MESSAGES;
  const template = list[Math.floor(Math.random() * list.length)] || DEFAULT_FEED_MESSAGES[0];
  return template.replace(/\{petName\}/gi, petName || 'Pet');
}

/** Map % chance → qualitative rank (no exact % shown to player). */
function successChanceRank(chance) {
  const c = Math.max(0, Number(chance) || 0);
  if (c < 10) return { key: 'very_low', label: 'Cực thấp' };
  if (c < 25) return { key: 'low', label: 'Thấp' };
  if (c < 50) return { key: 'medium', label: 'Trung bình' };
  if (c < 70) return { key: 'fairly_high', label: 'Khá cao' };
  if (c < 90) return { key: 'high', label: 'Cao' };
  return { key: 'very_high', label: 'Rất cao' };
}

/** { item_code: successRate } from config nets. */
function getNetRatesMap(config = getCatchConfigSync()) {
  const nets = config.nets || DEFAULT_CONFIG.nets;
  const out = {};
  for (const [code, meta] of Object.entries(nets)) {
    out[String(code)] = Number(meta?.successRate) || 0;
  }
  return out;
}

module.exports = {
  DEFAULT_CONFIG,
  DEFAULT_FAIL_MESSAGES,
  DEFAULT_FEED_MESSAGES,
  ensureCatchConfigTable,
  loadCatchConfig,
  saveCatchConfig,
  getCatchConfigSync,
  getCatchSession,
  setCatchSession,
  clearCatchSession,
  foodBonusPercent,
  catchPenaltyPercent,
  fleeRateFromFeeds,
  fleeRatePercent,
  resolveNetMeta,
  isCatchNetItem,
  isFoodItem,
  clampCatchChance,
  pickFailMessage,
  pickFeedMessage,
  successChanceRank,
  getNetRatesMap,
  normalizeConfig,
};
