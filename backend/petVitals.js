'use strict';

/** Thang đói 0–9: giảm 1 mỗi 2 giờ (mức cao = no căng). */
const HUNGER_INTERVAL_MS = 2 * 60 * 60 * 1000;
/** Tâm trạng 0–4: giảm 1 mỗi 3 giờ (mức cao = hạnh phúc). */
const MOOD_INTERVAL_MS = 3 * 60 * 60 * 1000;

const HUNGER_MAX = 9;
const MOOD_MAX = 4;

/** Mỗi N trận (đấu trường) trừ 1 điểm hunger_status. */
const HUNGER_BATTLES_PER_POINT = 50;

/** Hunger < 3 (0–2) không được vào đấu trường. */
const MIN_HUNGER_FOR_ARENA = 3;

function clampHunger(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return HUNGER_MAX;
  return Math.max(0, Math.min(HUNGER_MAX, n));
}

function clampMood(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 2;
  return Math.max(0, Math.min(MOOD_MAX, n));
}

function canEnterArenaByHunger(level) {
  return clampHunger(level) >= MIN_HUNGER_FOR_ARENA;
}

/**
 * Đếm thêm 1 trận; cứ đủ HUNGER_BATTLES_PER_POINT trận thì trừ 1 hunger (lặp cho đến khi hết “gói” hoặc hunger = 0).
 */
function applyBattlesIncrementToHunger(currentHunger, priorBattles) {
  let h = clampHunger(currentHunger);
  let b = Math.max(0, Number(priorBattles) || 0) + 1;
  while (b >= HUNGER_BATTLES_PER_POINT && h > 0) {
    h -= 1;
    b -= HUNGER_BATTLES_PER_POINT;
  }
  return { hunger: h, hunger_battles: b };
}

/**
 * Thức ăn (type food): số bậc hunger (+) gợi ý cho một lần dùng — scale theo chỉ số ma thuật.
 * magic ~12 → +1, ~24 → +2, … trần một lần = HUNGER_MAX.
 */
function hungerRecoveryStepsFromMagic(magic) {
  const m = Math.max(1, Math.floor(Number(magic) || 1));
  const steps = Math.ceil(m / 12);
  return Math.min(HUNGER_MAX, Math.max(1, steps));
}

/**
 * Đồ chơi (type toy): số bậc mood (+) cho một lần dùng — scale theo ma thuật, trần MOOD_MAX.
 */
function moodRecoveryStepsFromMagic(magic) {
  const m = Math.max(1, Math.floor(Number(magic) || 1));
  const steps = Math.ceil(m / 15);
  return Math.min(MOOD_MAX, Math.max(1, steps));
}

function computeDecayedVitals(row) {
  const now = Date.now();
  let hunger = clampHunger(row.hunger_status);
  let mood = clampMood(row.mood);
  let hungerAt = row.hunger_vitals_at ? new Date(row.hunger_vitals_at).getTime() : now;
  let moodAt = row.mood_vitals_at ? new Date(row.mood_vitals_at).getTime() : now;
  if (Number.isNaN(hungerAt)) hungerAt = now;
  if (Number.isNaN(moodAt)) moodAt = now;

  let hungerChanged = false;
  let moodChanged = false;

  const hSteps = Math.floor((now - hungerAt) / HUNGER_INTERVAL_MS);
  if (hSteps > 0) {
    const nh = Math.max(0, hunger - hSteps);
    if (nh !== hunger) hungerChanged = true;
    hunger = nh;
    hungerAt += hSteps * HUNGER_INTERVAL_MS;
  }

  const mSteps = Math.floor((now - moodAt) / MOOD_INTERVAL_MS);
  if (mSteps > 0) {
    const nm = Math.max(0, mood - mSteps);
    if (nm !== mood) moodChanged = true;
    mood = nm;
    moodAt += mSteps * MOOD_INTERVAL_MS;
  }

  return {
    hunger,
    mood,
    hungerVitalsAt: new Date(hungerAt),
    moodVitalsAt: new Date(moodAt),
    hungerChanged,
    moodChanged,
    anchorsWereNull: !row.hunger_vitals_at || !row.mood_vitals_at,
  };
}

/** Đói 0–9: 0 tím; 1–2 đỏ; 3–6 vàng; 7–8 xanh dương; 9 xanh lá */
function vitalsColorFromHungerLevel(level) {
  const n = clampHunger(level);
  if (n <= 0) return '#6a1b9a';
  if (n <= 2) return '#c62828';
  if (n <= 6) return '#f9a825';
  if (n <= 8) return '#1565c0';
  return '#2e7d32';
}

/** Mood 0–4: cùng ngưỡng màu với đói (quy đổi sang bậc 0–9 rồi dùng màu đói). */
function vitalsColorFromMoodLevel(level) {
  const m = clampMood(level);
  const equivalentHunger = Math.round((m / MOOD_MAX) * HUNGER_MAX);
  return vitalsColorFromHungerLevel(equivalentHunger);
}

function getHungerStatusText(level) {
  const labels = [
    'Tử Vong',
    'Sắp Chết Đói',
    'Kiệt Sức',
    'Rất Đói',
    'Đói',
    'Đói Nhẹ',
    'Hơi Đói',
    'No',
    'Rất No',
    'No Căng',
  ];
  return labels[clampHunger(level)] ?? 'Không xác định';
}

function getMoodStatusText(level) {
  const labels = ['Trầm Cảm', 'Buồn', 'Bình Thường', 'Vui Vẻ', 'Hạnh Phúc'];
  return labels[clampMood(level)] ?? 'Không xác định';
}

async function ensurePetVitalsSchema(db) {
  const alters = [
    'ALTER TABLE pets ADD COLUMN hunger_vitals_at DATETIME NULL',
    'ALTER TABLE pets ADD COLUMN mood TINYINT NOT NULL DEFAULT 2',
    'ALTER TABLE pets ADD COLUMN mood_vitals_at DATETIME NULL',
  ];
  for (const sql of alters) {
    try {
      await db.query(sql);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.error('ensurePetVitalsSchema:', e.message);
    }
  }
  try {
    await db.query(`
      UPDATE pets
      SET hunger_status = CASE COALESCE(hunger_status, 3)
        WHEN 0 THEN 0
        WHEN 1 THEN 3
        WHEN 2 THEN 6
        WHEN 3 THEN 9
        ELSE LEAST(9, GREATEST(0, hunger_status))
      END
      WHERE hunger_vitals_at IS NULL
    `);
  } catch (e) {
    console.error('ensurePetVitalsSchema migrate hunger:', e.message);
  }
  try {
    await db.query(`
      UPDATE pets
      SET hunger_vitals_at = COALESCE(hunger_vitals_at, NOW()),
          mood_vitals_at = COALESCE(mood_vitals_at, NOW())
      WHERE hunger_vitals_at IS NULL OR mood_vitals_at IS NULL
    `);
  } catch (e) {
    console.error('ensurePetVitalsSchema vitals timestamps:', e.message);
  }
}

/**
 * Áp dụng decay theo thời gian và ghi DB nếu cần.
 * @returns {Promise<object|null>} Hàng pet sau refresh (kèm hunger_status, mood đã clamp).
 */
async function refreshPetVitalsById(db, petId) {
  const [rows] = await db.query(
    `SELECT id, name, owner_id, hunger_status, hunger_battles, mood, hp, current_hp,
            hunger_vitals_at, mood_vitals_at
     FROM pets WHERE id = ?`,
    [petId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const prevHunger = clampHunger(row.hunger_status);
  const dec = computeDecayedVitals(row);

  const persist =
    dec.hungerChanged ||
    dec.moodChanged ||
    dec.anchorsWereNull ||
    prevHunger !== dec.hunger ||
    clampMood(row.mood) !== dec.mood;

  if (persist) {
    await db.query(
      `UPDATE pets SET hunger_status = ?, mood = ?, hunger_vitals_at = ?, mood_vitals_at = ? WHERE id = ?`,
      [dec.hunger, dec.mood, dec.hungerVitalsAt, dec.moodVitalsAt, petId]
    );
    if (dec.hunger === 0 && prevHunger > 0) {
      await db.query(
        'UPDATE pets SET current_hp = 0, hp = 0 WHERE id = ?',
        [petId]
      );
    }
  }

  return {
    ...row,
    hunger_status: dec.hunger,
    mood: dec.mood,
    hunger_vitals_at: dec.hungerVitalsAt,
    mood_vitals_at: dec.moodVitalsAt,
  };
}

module.exports = {
  HUNGER_MAX,
  MOOD_MAX,
  HUNGER_INTERVAL_MS,
  MOOD_INTERVAL_MS,
  HUNGER_BATTLES_PER_POINT,
  MIN_HUNGER_FOR_ARENA,
  clampHunger,
  clampMood,
  canEnterArenaByHunger,
  applyBattlesIncrementToHunger,
  hungerRecoveryStepsFromMagic,
  moodRecoveryStepsFromMagic,
  computeDecayedVitals,
  vitalsColorFromHungerLevel,
  vitalsColorFromMoodLevel,
  getHungerStatusText,
  getMoodStatusText,
  ensurePetVitalsSchema,
  refreshPetVitalsById,
};
