function generateIVStats() {
  return {
    iv_hp: Math.floor(Math.random() * 32),
    iv_mp: Math.floor(Math.random() * 32),
    iv_str: Math.floor(Math.random() * 32),
    iv_def: Math.floor(Math.random() * 32),
    iv_intelligence: Math.floor(Math.random() * 32),
    iv_spd: Math.floor(Math.random() * 32),
  };
}

/** IV cố định (Boss / NPC) — mặc định 31. */
function fixedIVStats(value = 31) {
  const v = Math.max(0, Math.min(31, Math.floor(Number(value)) || 0));
  return {
    iv_hp: v,
    iv_mp: v,
    iv_str: v,
    iv_def: v,
    iv_intelligence: v,
    iv_spd: v,
  };
}

function calculateFinalStats(base, iv, level) {
  const getStat = (b, i) => Math.floor(((2 * b + i) * level) / 100) + 5;
  const getHP = (b, i) => (Math.floor(((2 * b + i) * level) / 100) + level + 10) * 5;

  return {
    hp: getHP(base.hp, iv.iv_hp),
    mp: getStat(base.mp, iv.iv_mp),
    str: getStat(base.str, iv.iv_str),
    def: getStat(base.def, iv.iv_def),
    intelligence: getStat(base.intelligence, iv.iv_intelligence),
    spd: getStat(base.spd, iv.iv_spd),
  };
}

/**
 * Boss Arena (location_id = 0): base_* dùng trực tiếp làm combat stats.
 * @param {{ base_hp?:*, base_mp?:*, base_str?:*, base_def?:*, base_intelligence?:*, base_spd?:* }} row
 */
function rawBossFinalStats(row) {
  return {
    hp: parseInt(row.base_hp, 10) || 10,
    mp: parseInt(row.base_mp, 10) || 10,
    str: parseInt(row.base_str, 10) || 10,
    def: parseInt(row.base_def, 10) || 10,
    intelligence: parseInt(row.base_intelligence, 10) || 10,
    spd: parseInt(row.base_spd, 10) || 10,
  };
}

/**
 * Boss map săn: base_* = base species-like (thường L1).
 * Combat stats = công thức pet với IV 31 + level encounter từ map.
 * @param {{ base_hp?:*, base_mp?:*, base_str?:*, base_def?:*, base_intelligence?:*, base_spd?:*, hp?:*, mp?:*, str?:*, def?:*, intelligence?:*, spd?:* }} row
 * @param {number} level
 */
function calculateBossFinalStats(row, level) {
  const lv = Math.max(1, Math.floor(Number(level)) || 1);
  const base = {
    hp: parseInt(row.base_hp ?? row.hp, 10) || 10,
    mp: parseInt(row.base_mp ?? row.mp, 10) || 10,
    str: parseInt(row.base_str ?? row.str, 10) || 10,
    def: parseInt(row.base_def ?? row.def, 10) || 10,
    intelligence: parseInt(row.base_intelligence ?? row.intelligence, 10) || 10,
    spd: parseInt(row.base_spd ?? row.spd, 10) || 10,
  };
  return calculateFinalStats(base, fixedIVStats(31), lv);
}

module.exports = {
  generateIVStats,
  fixedIVStats,
  calculateFinalStats,
  rawBossFinalStats,
  calculateBossFinalStats,
};
