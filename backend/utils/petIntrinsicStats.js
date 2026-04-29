/**
 * Intrinsic pet combat stats: IV + level formula, permanent booster_stats (JSON), *_added columns.
 * final_stats / cột hp,str,… = real + Math.round(booster) + added; battle-stats cộng thêm linh thú.
 */
const { calculateFinalStats } = require('./petStats');

const STAT_KEYS = ['hp', 'mp', 'str', 'def', 'intelligence', 'spd'];

/** Trần tương đối: mỗi chỉ số str/def/int/spd (sau cộng booster + *_added) không vượt quá 20% so với trung bình bốn chỉ số. */
const COMBAT_MEAN_RATIO_CAP = 1.2;

/**
 * Hệ số × đẳng cấp (level thú). Ranh giới:
 * [1,750]: core 10×, hp 50×, mp 20× | [751,1000]: 15, 75, 30 | >1000: 20, 100, 40
 */
function tierStatMultipliers(level) {
  const L = Math.max(1, Math.floor(Number(level) || 1));
  if (L <= 750) return { core: 10, hp: 50, mp: 20 };
  if (L <= 1000) return { core: 15, hp: 75, mp: 30 };
  return { core: 20, hp: 100, mp: 40 };
}

function boosterLimitError(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

function computeMergedIntrinsic(pet, real, booster) {
  const merged = {};
  for (const k of STAT_KEYS) {
    const br = Math.round(Number(booster[k]) || 0);
    const added = Number(pet[addedFieldForStat(k)]) || 0;
    const coreVal = Math.max(0, real[k] + br);
    merged[k] = coreVal + added;
  }
  return merged;
}

/**
 * Kiểm tra sau khi gán booster (chỉ áp nhánh tương ứng statKey).
 * HP/MP: chỉ trần tuyệt đối theo level. Combat: trần tuyệt đối + quy tắc trung bình 4 chỉ số.
 */
function assertBoosterLimitsAfterChange(statKey, petLevel, merged) {
  const L = Math.max(1, Math.floor(Number(petLevel) || 1));
  const m = tierStatMultipliers(L);

  if (statKey === 'hp') {
    const cap = m.hp * L;
    if (merged.hp > cap + 1e-6) throw boosterLimitError('BOOSTER_ABS_CAP_HP');
    return;
  }
  if (statKey === 'mp') {
    const cap = m.mp * L;
    if (merged.mp > cap + 1e-6) throw boosterLimitError('BOOSTER_ABS_CAP_MP');
    return;
  }
  if (['str', 'def', 'intelligence', 'spd'].includes(statKey)) {
    const capCore = m.core * L;
    const keysFour = ['str', 'def', 'intelligence', 'spd'];
    for (const k of keysFour) {
      if (Number(merged[k]) > capCore + 1e-6) throw boosterLimitError('BOOSTER_ABS_CAP_CORE');
    }
    const vals = keysFour.map((k) => Number(merged[k]) || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / 4;
    const maxByMean = mean * COMBAT_MEAN_RATIO_CAP;
    for (let i = 0; i < 4; i += 1) {
      if (vals[i] > maxByMean + 1e-6) throw boosterLimitError('BOOSTER_MEAN_LIMIT');
    }
  }
}

/** Phần thập phân trong booster_stats: 2 chữ số (giảm drift float, vẫn cộng dồn đủ nhạy). */
function roundBoosterStatValue(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function parseBoosterStats(raw) {
  if (!raw) return {};
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return o && typeof o === 'object' ? o : {};
  } catch (_) {
    return {};
  }
}

function addedFieldForStat(key) {
  if (key === 'intelligence') return 'intelligence_added';
  return `${key}_added`;
}

async function ensureBoosterStatsColumn(db) {
  try {
    await db.query('ALTER TABLE pets ADD COLUMN booster_stats JSON NULL');
  } catch (err) {
    const code = err && err.code;
    const msg = String((err && err.message) || '');
    if (code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column')) return;
    throw err;
  }
}

/**
 * @param {import('mysql2/promise').Pool} db - pool.promise()
 * @returns {Promise<{ merged: object, real: object, booster: object }|null>}
 */
async function refreshPetIntrinsicStats(db, petId) {
  const [rows] = await db.query(
    `SELECT p.*, ps.base_hp, ps.base_mp, ps.base_str, ps.base_def, ps.base_intelligence, ps.base_spd
     FROM pets p
     JOIN pet_species ps ON p.pet_species_id = ps.id
     WHERE p.id = ?`,
    [petId]
  );
  if (!rows || !rows.length) return null;

  const pet = rows[0];
  const base = {
    hp: parseInt(pet.base_hp, 10),
    mp: parseInt(pet.base_mp, 10),
    str: parseInt(pet.base_str, 10),
    def: parseInt(pet.base_def, 10),
    intelligence: parseInt(pet.base_intelligence, 10),
    spd: parseInt(pet.base_spd, 10),
  };
  const iv = {
    iv_hp: pet.iv_hp,
    iv_mp: pet.iv_mp,
    iv_str: pet.iv_str,
    iv_def: pet.iv_def,
    iv_intelligence: pet.iv_intelligence,
    iv_spd: pet.iv_spd,
  };
  const real = calculateFinalStats(base, iv, pet.level);
  const booster = parseBoosterStats(pet.booster_stats);

  const oldMaxHp = Number(pet.max_hp) || real.hp;
  const oldCurHp = pet.current_hp != null ? Number(pet.current_hp) : oldMaxHp;

  /** full intrinsic trước linh thú (để battle / final_stats) */
  const merged = {};
  /** str/def/spd/int/mp: chỉ real + round(booster); hp giữ merged để khớp máu tối đa */
  const core = {};
  for (const k of STAT_KEYS) {
    const br = Math.round(Number(booster[k]) || 0);
    const added = Number(pet[addedFieldForStat(k)]) || 0;
    const coreVal = Math.max(0, real[k] + br);
    core[k] = coreVal;
    merged[k] = coreVal + added;
  }

  let newCurHp = oldCurHp;
  const newMaxHp = merged.hp;
  if (oldMaxHp > 0 && newMaxHp !== oldMaxHp) {
    newCurHp = Math.round(oldCurHp * (newMaxHp / oldMaxHp));
  }
  newCurHp = Math.max(0, Math.min(newCurHp, newMaxHp));

  await db.query(
    `UPDATE pets SET
      hp = ?, max_hp = ?, mp = ?, max_mp = ?, str = ?, def = ?, intelligence = ?, spd = ?,
      current_hp = ?, final_stats = ?
    WHERE id = ?`,
    [
      merged.hp,
      merged.hp,
      merged.mp,
      merged.mp,
      core.str,
      core.def,
      core.intelligence,
      core.spd,
      newCurHp,
      JSON.stringify(merged),
      petId,
    ]
  );

  return { merged, real, booster, core };
}

/**
 * Cộng dồn booster % (ma thuật M ⇒ M%): mỗi lần dùng
 * booster_mới = booster_cũ + (real_stat + booster_cũ) * (M/100).
 * `real_stat` = chỉ số gốc IV+level (không gồm *_added). Lặp quantity lần trong một request.
 */
async function applyBoosterCompoundPercent(db, petId, statKey, magicPercentPoints, quantity) {
  if (!STAT_KEYS.includes(statKey)) return;
  const qty = Math.max(1, Number(quantity) || 1);
  const pct = Math.max(0, Number(magicPercentPoints) || 0) / 100;

  const [rows] = await db.query(
    `SELECT p.*, ps.base_hp, ps.base_mp, ps.base_str, ps.base_def, ps.base_intelligence, ps.base_spd
     FROM pets p
     JOIN pet_species ps ON p.pet_species_id = ps.id
     WHERE p.id = ?`,
    [petId]
  );
  if (!rows || !rows.length) throw new Error('Pet not found');

  const pet = rows[0];
  const base = {
    hp: parseInt(pet.base_hp, 10),
    mp: parseInt(pet.base_mp, 10),
    str: parseInt(pet.base_str, 10),
    def: parseInt(pet.base_def, 10),
    intelligence: parseInt(pet.base_intelligence, 10),
    spd: parseInt(pet.base_spd, 10),
  };
  const iv = {
    iv_hp: pet.iv_hp,
    iv_mp: pet.iv_mp,
    iv_str: pet.iv_str,
    iv_def: pet.iv_def,
    iv_intelligence: pet.iv_intelligence,
    iv_spd: pet.iv_spd,
  };
  const real = calculateFinalStats(base, iv, pet.level);
  const booster = parseBoosterStats(pet.booster_stats);

  let b = Number(booster[statKey]) || 0;
  const r = real[statKey];
  for (let i = 0; i < qty; i += 1) {
    b = b + (r + b) * pct;
  }
  booster[statKey] = roundBoosterStatValue(b);

  const merged = computeMergedIntrinsic(pet, real, booster);
  assertBoosterLimitsAfterChange(statKey, pet.level, merged);

  await db.query('UPDATE pets SET booster_stats = ? WHERE id = ?', [JSON.stringify(booster), petId]);
}

async function applyBoosterFlat(db, petId, statKey, amount) {
  if (!STAT_KEYS.includes(statKey)) return;
  const add = Number(amount) || 0;

  const [rows] = await db.query(
    `SELECT p.*, ps.base_hp, ps.base_mp, ps.base_str, ps.base_def, ps.base_intelligence, ps.base_spd
     FROM pets p
     JOIN pet_species ps ON p.pet_species_id = ps.id
     WHERE p.id = ?`,
    [petId]
  );
  if (!rows || !rows.length) throw new Error('Pet not found');

  const pet = rows[0];
  const base = {
    hp: parseInt(pet.base_hp, 10),
    mp: parseInt(pet.base_mp, 10),
    str: parseInt(pet.base_str, 10),
    def: parseInt(pet.base_def, 10),
    intelligence: parseInt(pet.base_intelligence, 10),
    spd: parseInt(pet.base_spd, 10),
  };
  const iv = {
    iv_hp: pet.iv_hp,
    iv_mp: pet.iv_mp,
    iv_str: pet.iv_str,
    iv_def: pet.iv_def,
    iv_intelligence: pet.iv_intelligence,
    iv_spd: pet.iv_spd,
  };
  const real = calculateFinalStats(base, iv, pet.level);
  const booster = parseBoosterStats(pet.booster_stats);
  booster[statKey] = roundBoosterStatValue((Number(booster[statKey]) || 0) + add);

  const merged = computeMergedIntrinsic(pet, real, booster);
  assertBoosterLimitsAfterChange(statKey, pet.level, merged);

  await db.query('UPDATE pets SET booster_stats = ? WHERE id = ?', [JSON.stringify(booster), petId]);
}

module.exports = {
  STAT_KEYS,
  parseBoosterStats,
  roundBoosterStatValue,
  ensureBoosterStatsColumn,
  refreshPetIntrinsicStats,
  applyBoosterCompoundPercent,
  applyBoosterFlat,
};
