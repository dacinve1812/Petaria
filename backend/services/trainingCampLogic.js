/**
 * Pure rules for Training Camp.
 * EXP per tick uses the live Arena victory formula (enemy level × random 300..500).
 * Pet level is advanced between ticks so a later formula that depends on level
 * applies to the next tick, matching a sequence of Arena wins.
 */

const DURATION_MINUTES = [60, 120, 240, 480, 720, 1440];

const DURATIONS = [
  { minutes: 60, hours: 1, multiplierNum: 100, multiplierDen: 100, discountPercent: 0 },
  { minutes: 120, hours: 2, multiplierNum: 190, multiplierDen: 100, discountPercent: 5 },
  { minutes: 240, hours: 4, multiplierNum: 375, multiplierDen: 100, discountPercent: 6.25 },
  { minutes: 480, hours: 8, multiplierNum: 720, multiplierDen: 100, discountPercent: 10 },
  { minutes: 720, hours: 12, multiplierNum: 1050, multiplierDen: 100, discountPercent: 12.5 },
  { minutes: 1440, hours: 24, multiplierNum: 1950, multiplierDen: 100, discountPercent: 18.75 },
];

/** Base Peta cost for 1 hour, keyed by Arena NPC level. */
const COST_BY_LEVEL = {
  1: 20000,
  10: 50000,
  25: 75000,
  40: 100000,
  75: 140000,
  110: 180000,
  140: 220000,
  170: 260000,
  200: 300000,
  250: 350000,
  300: 420000,
  420: 520000,
  550: 650000,
  700: 800000,
  900: 1000000,
  1200: 1250000,
  1400: 1450000,
};

const SLOTS = [
  { index: 1, currency: null, cost: 0, vipLevel: 0, label: 'Mở mặc định' },
  { index: 2, currency: 'peta', cost: 100000, vipLevel: 1, label: '100.000 Peta hoặc VIP 1' },
  { index: 3, currency: 'petagold', cost: 50, vipLevel: 3, label: '50 Petagold hoặc VIP 3' },
  { index: 4, currency: 'petagold', cost: 200, vipLevel: 5, label: '200 Petagold hoặc VIP 5' },
];

const TICK_MS = 60 * 1000;
const TRAINING_LOCK_MESSAGE = 'Pet đang huấn luyện tại Trại huấn luyện, không thể dùng cho hoạt động khác.';

function asInt(value, fallback = 0) {
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function durationByMinutes(minutes) {
  return DURATIONS.find((row) => row.minutes === asInt(minutes)) || null;
}

function trainingCost(baseCost, minutes) {
  const duration = durationByMinutes(minutes);
  const base = Math.max(0, asInt(baseCost));
  if (!duration) return null;
  return Math.round((base * duration.multiplierNum) / duration.multiplierDen);
}

function baseCostForLevel(level, override) {
  const custom = asInt(override, 0);
  if (custom > 0) return custom;
  const lv = Math.max(1, asInt(level, 1));
  if (COST_BY_LEVEL[lv]) return COST_BY_LEVEL[lv];
  const tiers = Object.keys(COST_BY_LEVEL).map((key) => Number(key)).sort((a, b) => a - b);
  let chosen = tiers[0];
  for (const tier of tiers) {
    if (tier <= lv) chosen = tier;
  }
  return COST_BY_LEVEL[chosen];
}

function costsForBase(baseCost) {
  const costs = {};
  for (const duration of DURATIONS) {
    costs[duration.minutes] = trainingCost(baseCost, duration.minutes);
  }
  return costs;
}

/**
 * Same roll as a single Arena victory: enemyLevel * R, R in 300..500 inclusive.
 * petLevel is accepted so callers can pass the live level; the current Arena formula does not use it.
 */
function calculateArenaVictoryExp(enemyLevel, _petLevel, random = Math.random) {
  const lvl = Math.max(1, asInt(enemyLevel, 1));
  const roll = random();
  const r = 300 + Math.floor(roll * 201);
  return lvl * r;
}

/** Mirrors pets level-up in Arena: cumulative exp, threshold is expTable[level + 1]. */
function applyArenaExp(level, exp, gain, expTable) {
  let newExp = asInt(exp) + asInt(gain);
  let newLevel = Math.max(1, asInt(level, 1));
  const table = expTable || {};
  while (table[newLevel + 1] && newExp >= table[newLevel + 1]) {
    newLevel += 1;
  }
  return { level: newLevel, exp: newExp };
}

function simulateTrainingTicks({
  level,
  exp,
  npcLevel,
  ticks,
  expTable,
  random = Math.random,
  gainForTick = null,
}) {
  let pendingExp = 0;
  let curLevel = Math.max(1, asInt(level, 1));
  let curExp = asInt(exp);
  const count = Math.max(0, asInt(ticks));
  for (let index = 0; index < count; index += 1) {
    const gain = gainForTick
      ? asInt(gainForTick({ level: curLevel, exp: curExp, npcLevel, index }))
      : calculateArenaVictoryExp(npcLevel, curLevel, random);
    pendingExp += gain;
    const next = applyArenaExp(curLevel, curExp, gain, expTable);
    curLevel = next.level;
    curExp = next.exp;
  }
  return { level: curLevel, exp: curExp, pendingExp };
}

function completedTickCount(startedAtMs, endsAtMs, nowMs, durationMinutes) {
  const total = Math.max(0, asInt(durationMinutes));
  const capped = Math.min(asInt(nowMs), asInt(endsAtMs));
  const elapsed = Math.floor(Math.max(0, capped - asInt(startedAtMs)) / TICK_MS);
  return Math.min(total, Math.max(0, elapsed));
}

function qualifiesTrainingUnlock(win, remainHp, maxHp) {
  const max = asInt(maxHp);
  const remain = asInt(remainHp);
  return Boolean(win) && max > 0 && remain / max > 0.5;
}

function effectiveVipLevel(vipLevel, isVip) {
  const stored = Math.max(0, asInt(vipLevel));
  return Math.max(stored, isVip ? 1 : 0);
}

function slotIsOpen(slotIndex, purchased, vipLevel) {
  const slot = SLOTS.find((row) => row.index === asInt(slotIndex));
  if (!slot) return false;
  if (slot.index === 1) return true;
  if (purchased) return true;
  return asInt(vipLevel) >= slot.vipLevel;
}

function opponentUnlocked(opponentLevel, highestLevel) {
  if (asInt(highestLevel) <= 0) return false;
  return asInt(opponentLevel) <= asInt(highestLevel);
}

module.exports = {
  DURATION_MINUTES,
  DURATIONS,
  COST_BY_LEVEL,
  SLOTS,
  TICK_MS,
  TRAINING_LOCK_MESSAGE,
  asInt,
  durationByMinutes,
  trainingCost,
  baseCostForLevel,
  costsForBase,
  calculateArenaVictoryExp,
  applyArenaExp,
  simulateTrainingTicks,
  completedTickCount,
  qualifiesTrainingUnlock,
  effectiveVipLevel,
  slotIsOpen,
  opponentUnlocked,
};
