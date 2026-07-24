/**
 * Formation system — layout, skill order, bonus stats, enhance cost.
 * Shared by frontend (BattlePetSelectPage) and backend enhance API.
 */

const FORMATION_MAX_LEVEL = 40;
const FORMATION_MIN_LEVEL = 1;

/** Basic L1/L40 anchors — các đội hình khác suy ra theo tỉ lệ max */
const BASIC_ATK_L1 = 2.3;
const BASIC_ATK_L40 = 14;
const BASIC_DEF_L1 = 5.4;
const BASIC_DEF_L40 = 21;

function scaleAtkMin(maxAtL40) {
  return (maxAtL40 * BASIC_ATK_L1) / BASIC_ATK_L40;
}

function scaleDefMin(maxAtL40) {
  return (maxAtL40 * BASIC_DEF_L1) / BASIC_DEF_L40;
}

const FORMATIONS = {
  '3-2': {
    id: '3-2',
    label: '3-2',
    name: 'Đội hình cơ bản',
    nameEn: 'Basic Formation',
    title: '3 Back / 2 Front',
    back: 3,
    front: 2,
    backBonus: { stat: 'attack', maxEach: 14, minEach: BASIC_ATK_L1 },
    frontBonus: { stat: 'defense', maxEach: 21, minEach: BASIC_DEF_L1 },
  },
  '2-3': {
    id: '2-3',
    label: '2-3',
    name: 'Đội hình cân bằng',
    nameEn: 'Balanced Formation',
    title: '2 Back / 3 Front',
    back: 2,
    front: 3,
    backBonus: { stat: 'attack', maxEach: 21, minEach: scaleAtkMin(21) },
    frontBonus: { stat: 'defense', maxEach: 14, minEach: scaleDefMin(14) },
  },
  '4-1': {
    id: '4-1',
    label: '4-1',
    name: 'Đội hình tấn công',
    nameEn: 'Attack Formation',
    title: '4 Back / 1 Front',
    back: 4,
    front: 1,
    backBonus: { stat: 'attack', maxEach: 10.5, minEach: scaleAtkMin(10.5) },
    frontBonus: { stat: 'defense', maxEach: 42, minEach: scaleDefMin(42) },
  },
  '1-4': {
    id: '1-4',
    label: '1-4',
    name: 'Đội hình phòng thủ',
    nameEn: 'Protective Formation',
    title: '1 Back / 4 Front',
    back: 1,
    front: 4,
    backBonus: { stat: 'attack', maxEach: 42, minEach: scaleAtkMin(42) },
    frontBonus: { stat: 'defense', maxEach: 10.5, minEach: scaleDefMin(10.5) },
  },
};

const FORMATION_ORDER = ['3-2', '2-3', '4-1', '1-4'];

function normalizeFormationId(raw) {
  const id = String(raw || '3-2');
  return FORMATIONS[id] ? id : '3-2';
}

function getFormation(formationId) {
  return FORMATIONS[normalizeFormationId(formationId)];
}

/** Indices: 0..back-1 = back (top→bottom); back..4 = front (top→bottom) */
function getLineIndices(formationId) {
  const f = getFormation(formationId);
  const back = [];
  const front = [];
  for (let i = 0; i < f.back; i++) back.push(i);
  for (let i = f.back; i < f.back + f.front; i++) front.push(i);
  return { back, front };
}

/**
 * Skill order khi SPD bằng nhau:
 * Front dưới → trên = 1..F, rồi Back dưới → trên = F+1..5.
 * @returns {Record<number, number>} slotIndex → order
 */
function getSkillOrderBySlot(formationId) {
  const { back, front } = getLineIndices(formationId);
  /** @type {Record<number, number>} */
  const map = {};
  [...front].reverse().forEach((slot, i) => {
    map[slot] = i + 1;
  });
  [...back].reverse().forEach((slot, i) => {
    map[slot] = front.length + i + 1;
  });
  return map;
}

/** Số hiển thị trên sơ đồ (hàng trái→phải = cột trên→dưới) */
function getDiagramSkillNumbers(formationId) {
  const { back, front } = getLineIndices(formationId);
  const order = getSkillOrderBySlot(formationId);
  return {
    back: back.map((i) => order[i]),
    front: front.map((i) => order[i]),
  };
}

function clampLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return FORMATION_MIN_LEVEL;
  return Math.max(FORMATION_MIN_LEVEL, Math.min(FORMATION_MAX_LEVEL, Math.floor(n)));
}

function lerpBonus(minEach, maxEach, level) {
  const L = clampLevel(level);
  if (L <= FORMATION_MIN_LEVEL) return minEach;
  if (L >= FORMATION_MAX_LEVEL) return maxEach;
  return minEach + ((maxEach - minEach) * (L - FORMATION_MIN_LEVEL)) / (FORMATION_MAX_LEVEL - FORMATION_MIN_LEVEL);
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getFormationBonusesAtLevel(formationId, level) {
  const f = getFormation(formationId);
  const L = clampLevel(level);
  return {
    level: L,
    back: {
      stat: f.backBonus.stat,
      each: lerpBonus(f.backBonus.minEach, f.backBonus.maxEach, L),
      count: f.back,
      label: f.backBonus.stat === 'attack' ? 'All Attack (%)' : 'Defense (%)',
      labelVi: f.backBonus.stat === 'attack' ? 'Tấn công (%)' : 'Phòng thủ (%)',
    },
    front: {
      stat: f.frontBonus.stat,
      each: lerpBonus(f.frontBonus.minEach, f.frontBonus.maxEach, L),
      count: f.front,
      label: f.frontBonus.stat === 'defense' ? 'Defense (%)' : 'All Attack (%)',
      labelVi: f.frontBonus.stat === 'defense' ? 'Phòng thủ (%)' : 'Tấn công (%)',
    },
  };
}

/** Cost Peta để nâng từ level → level+1: 1500 * level (L1→L4 = 9000) */
function costForLevelStep(fromLevel) {
  const L = clampLevel(fromLevel);
  if (L >= FORMATION_MAX_LEVEL) return 0;
  return 1500 * L;
}

function costEnhanceRange(fromLevel, toLevel) {
  const from = clampLevel(fromLevel);
  const to = clampLevel(toLevel);
  if (to <= from) return 0;
  let sum = 0;
  for (let l = from; l < to; l++) sum += costForLevelStep(l);
  return sum;
}

function defaultFormationLevels() {
  /** @type {Record<string, number>} */
  const levels = {};
  FORMATION_ORDER.forEach((id) => {
    levels[id] = FORMATION_MIN_LEVEL;
  });
  return levels;
}

function normalizeLevelsMap(raw) {
  const base = defaultFormationLevels();
  if (!raw || typeof raw !== 'object') return base;
  FORMATION_ORDER.forEach((id) => {
    if (raw[id] != null) base[id] = clampLevel(raw[id]);
  });
  return base;
}

module.exports = {
  FORMATION_MAX_LEVEL,
  FORMATION_MIN_LEVEL,
  FORMATIONS,
  FORMATION_ORDER,
  normalizeFormationId,
  getFormation,
  getLineIndices,
  getSkillOrderBySlot,
  getDiagramSkillNumbers,
  clampLevel,
  formatPct,
  getFormationBonusesAtLevel,
  costForLevelStep,
  costEnhanceRange,
  defaultFormationLevels,
  normalizeLevelsMap,
};
