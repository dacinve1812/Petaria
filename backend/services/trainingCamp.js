const expTable = require('../../src/data/exp_table_petaria.json');
const { refreshPetIntrinsicStats } = require('../utils/petIntrinsicStats');
const logic = require('./trainingCampLogic');

const {
  DURATIONS,
  SLOTS,
  TRAINING_LOCK_MESSAGE,
  asInt,
  durationByMinutes,
  trainingCost,
  baseCostForLevel,
  costsForBase,
  simulateTrainingTicks,
  completedTickCount,
  effectiveVipLevel,
  slotIsOpen,
  opponentUnlocked,
} = logic;

function dupColumn(err) {
  const code = err && err.code;
  const msg = String((err && err.message) || '');
  return code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column');
}

async function addColumn(db, sql) {
  try {
    await db.query(sql);
  } catch (err) {
    if (!dupColumn(err)) throw err;
  }
}

async function ensureTrainingCampSchema(db) {
  await addColumn(db, "ALTER TABLE pets ADD COLUMN activity_status VARCHAR(16) NOT NULL DEFAULT 'idle'");
  await addColumn(db, 'ALTER TABLE pets ADD COLUMN highest_training_arena_npc_id INT NULL');
  await addColumn(db, 'ALTER TABLE users ADD COLUMN vip_level TINYINT NOT NULL DEFAULT 0');
  await addColumn(db, 'ALTER TABLE boss_templates ADD COLUMN training_1h_cost BIGINT NULL');
  await db.query(`
    CREATE TABLE IF NOT EXISTS training_sessions (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      pet_id INT NOT NULL,
      camp_slot TINYINT NOT NULL,
      opponent_id INT NOT NULL,
      opponent_level INT NOT NULL,
      started_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      duration_minutes INT NOT NULL,
      processed_ticks INT NOT NULL DEFAULT 0,
      pending_exp BIGINT NOT NULL DEFAULT 0,
      start_pet_level INT NOT NULL,
      start_pet_exp BIGINT NOT NULL,
      sim_level INT NOT NULL,
      sim_exp BIGINT NOT NULL,
      cost BIGINT NOT NULL,
      currency_type VARCHAR(16) NOT NULL DEFAULT 'peta',
      status VARCHAR(16) NOT NULL DEFAULT 'RUNNING',
      claimed_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_training_user_status (user_id, status),
      KEY idx_training_pet_status (pet_id, status)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS training_camp_unlocks (
      user_id INT NOT NULL,
      slot_index TINYINT NOT NULL,
      unlocked_via VARCHAR(16) NOT NULL,
      unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, slot_index)
    )
  `);
}

function isArenaBoss(locationId) {
  return locationId == null || Number(locationId) === 0;
}

async function recordArenaTrainingUnlock(conn, petId, bossId) {
  try {
    const [[boss]] = await conn.query(
      'SELECT id, level, location_id FROM boss_templates WHERE id = ?',
      [bossId]
    );
    if (!boss || !isArenaBoss(boss.location_id)) return;
    const [[pet]] = await conn.query(
      'SELECT highest_training_arena_npc_id FROM pets WHERE id = ? FOR UPDATE',
      [petId]
    );
    if (!pet) return;
    let currentLevel = -1;
    if (pet.highest_training_arena_npc_id) {
      const [[current]] = await conn.query(
        'SELECT level FROM boss_templates WHERE id = ?',
        [pet.highest_training_arena_npc_id]
      );
      if (current) currentLevel = asInt(current.level);
    }
    if (asInt(boss.level) >= currentLevel) {
      await conn.query(
        'UPDATE pets SET highest_training_arena_npc_id = ? WHERE id = ?',
        [boss.id, petId]
      );
    }
  } catch (err) {
    if (err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054)) return;
    throw err;
  }
}

async function trainingLockMessageForPet(db, petId) {
  const id = asInt(petId);
  if (id <= 0) return null;
  try {
    const [[row]] = await db.query('SELECT activity_status FROM pets WHERE id = ? LIMIT 1', [id]);
    if (row && String(row.activity_status || '') === 'training') return TRAINING_LOCK_MESSAGE;
  } catch (err) {
    if (err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054)) return null;
    throw err;
  }
  return null;
}

function ms(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function advanceSession(conn, session, now, npcLevel) {
  const total = asInt(session.duration_minutes);
  const done = completedTickCount(ms(session.started_at), ms(session.ends_at), now.getTime(), total);
  const fresh = done - asInt(session.processed_ticks);
  let pending = asInt(session.pending_exp);
  let simLevel = asInt(session.sim_level, 1);
  let simExp = asInt(session.sim_exp);
  if (fresh > 0) {
    const sim = simulateTrainingTicks({
      level: simLevel,
      exp: simExp,
      npcLevel: Math.max(1, asInt(npcLevel, asInt(session.opponent_level, 1))),
      ticks: fresh,
      expTable,
    });
    pending += sim.pendingExp;
    simLevel = sim.level;
    simExp = sim.exp;
  }
  const status = done >= total ? 'COMPLETED' : 'RUNNING';
  if (fresh > 0 || status !== session.status) {
    await conn.query(
      `UPDATE training_sessions
       SET processed_ticks = ?, pending_exp = ?, sim_level = ?, sim_exp = ?, status = ?
       WHERE id = ?`,
      [done, pending, simLevel, simExp, status, session.id]
    );
  }
  return {
    ...session,
    processed_ticks: done,
    pending_exp: pending,
    sim_level: simLevel,
    sim_exp: simExp,
    status,
  };
}

async function processUserSessions(db, userId, now = new Date()) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM training_sessions WHERE user_id = ? AND status = 'RUNNING' FOR UPDATE`,
      [userId]
    );
    for (const row of rows) {
      const [[boss]] = await conn.query('SELECT level FROM boss_templates WHERE id = ?', [row.opponent_id]);
      await advanceSession(conn, row, now, boss ? boss.level : row.opponent_level);
    }
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

function imagePath(image) {
  return image || '';
}

async function loadBattlePetIds(getRedis, matchPrefix, userId) {
  const ids = new Set();
  if (typeof getRedis !== 'function') return ids;
  try {
    const redis = getRedis();
    if (!redis) return ids;
    const raw = await redis.get(String(matchPrefix || 'match:') + userId);
    if (!raw) return ids;
    const state = JSON.parse(raw);
    if (state && state.pet_id) ids.add(Number(state.pet_id));
    if (Array.isArray(state && state.playerSquad)) {
      state.playerSquad.forEach((unit) => {
        const id = Number(unit && unit.id);
        if (id > 0) ids.add(id);
      });
    }
  } catch (_) {
    return ids;
  }
  return ids;
}

async function getCampState(db, userId, battleIds) {
  await processUserSessions(db, userId);
  const [[user]] = await db.query(
    'SELECT peta, petagold, is_vip, vip_level FROM users WHERE id = ?',
    [userId]
  );
  const vipLevel = effectiveVipLevel(user && user.vip_level, user && user.is_vip);
  const [unlockRows] = await db.query(
    'SELECT slot_index, unlocked_via FROM training_camp_unlocks WHERE user_id = ?',
    [userId]
  );
  const purchased = new Set((unlockRows || []).map((row) => asInt(row.slot_index)));
  const [sessions] = await db.query(
    `SELECT s.*, p.name AS pet_name, p.level AS pet_level, ps.image AS pet_image,
            b.name AS opponent_name, b.level AS live_level, b.image_url AS opponent_image
     FROM training_sessions s
     JOIN pets p ON p.id = s.pet_id
     JOIN pet_species ps ON ps.id = p.pet_species_id
     LEFT JOIN boss_templates b ON b.id = s.opponent_id
     WHERE s.user_id = ? AND s.status IN ('RUNNING', 'COMPLETED')
     ORDER BY s.camp_slot ASC`,
    [userId]
  );
  const bySlot = new Map((sessions || []).map((row) => [asInt(row.camp_slot), row]));
  const now = Date.now();
  const slots = SLOTS.map((slot) => {
    const open = slotIsOpen(slot.index, purchased.has(slot.index), vipLevel);
    const row = bySlot.get(slot.index) || null;
    return {
      index: slot.index,
      unlocked: open,
      purchased: purchased.has(slot.index),
      vipLevel: slot.vipLevel,
      currency: slot.currency,
      cost: slot.cost,
      label: slot.label,
      session: row ? presentSession(row, now) : null,
    };
  });

  const [pets] = await db.query(
    `SELECT p.id, p.name, p.level, p.activity_status, p.is_listed, p.highest_training_arena_npc_id,
            ps.image
     FROM pets p
     JOIN pet_species ps ON ps.id = p.pet_species_id
     WHERE p.owner_id = ?
     ORDER BY p.level DESC, p.id ASC`,
    [userId]
  );
  const busyPetIds = new Set((sessions || []).map((row) => asInt(row.pet_id)));
  const petViews = (pets || []).filter((pet) => !pet.is_listed).map((pet) => {
    let reason = '';
    if (String(pet.activity_status || '') === 'training' || busyPetIds.has(asInt(pet.id))) {
      reason = 'Đang huấn luyện';
    } else if (String(pet.activity_status || '') === 'active') {
      reason = 'Đang Active';
    } else if (battleIds && battleIds.has(asInt(pet.id))) {
      reason = 'Đang trong trận đấu';
    }
    return {
      id: pet.id,
      name: pet.name,
      level: asInt(pet.level, 1),
      image: imagePath(pet.image),
      canTrain: reason === '',
      reason,
    };
  });

  const [bosses] = await db.query(
    `SELECT id, name, level, image_url AS image, training_1h_cost, location_id
     FROM boss_templates
     WHERE location_id = 0 OR location_id IS NULL
     ORDER BY level ASC, id ASC`
  );
  const highestIds = [...new Set((pets || []).map((pet) => asInt(pet.highest_training_arena_npc_id)).filter((id) => id > 0))];
  const levelByBoss = new Map();
  if (highestIds.length) {
    const [highestRows] = await db.query(
      `SELECT id, level FROM boss_templates WHERE id IN (${highestIds.map(() => '?').join(',')})`,
      highestIds
    );
    (highestRows || []).forEach((row) => levelByBoss.set(asInt(row.id), asInt(row.level)));
  }
  const opponents = (bosses || []).map((boss) => {
    const hourly = baseCostForLevel(boss.level, boss.training_1h_cost);
    return {
      id: boss.id,
      name: boss.name,
      level: asInt(boss.level, 1),
      image: imagePath(boss.image),
      hourlyCost: hourly,
      costs: costsForBase(hourly),
    };
  });

  const petUnlocks = {};
  for (const pet of pets || []) {
    const highest = levelByBoss.get(asInt(pet.highest_training_arena_npc_id)) || 0;
    petUnlocks[pet.id] = opponents
      .filter((boss) => opponentUnlocked(boss.level, highest))
      .map((boss) => boss.id);
  }

  return {
    balances: {
      peta: asInt(user && user.peta),
      petagold: asInt(user && user.petagold),
    },
    vipLevel,
    durations: DURATIONS.map((row) => ({
      minutes: row.minutes,
      hours: row.hours,
      battles: row.minutes,
      discountPercent: row.discountPercent,
      multiplier: row.multiplierNum / row.multiplierDen,
    })),
    slots,
    pets: petViews,
    opponents,
    petUnlocks,
    serverNow: new Date().toISOString(),
  };
}

function presentSession(row, now) {
  const total = asInt(row.duration_minutes);
  const ends = ms(row.ends_at);
  const startLevel = asInt(row.start_pet_level, 1);
  const projected = asInt(row.sim_level, startLevel);
  return {
    id: row.id,
    slot: asInt(row.camp_slot),
    status: row.status,
    pet: {
      id: row.pet_id,
      name: row.pet_name,
      image: imagePath(row.pet_image),
      level: asInt(row.pet_level, 1),
    },
    opponent: {
      id: row.opponent_id,
      name: row.opponent_name || 'Đối thủ Arena',
      image: imagePath(row.opponent_image),
      level: asInt(row.live_level, asInt(row.opponent_level, 1)),
    },
    startedAt: new Date(ms(row.started_at)).toISOString(),
    endsAt: new Date(ends).toISOString(),
    durationMinutes: total,
    totalTicks: total,
    processedTicks: asInt(row.processed_ticks),
    pendingExp: asInt(row.pending_exp),
    startLevel,
    projectedLevel: projected,
    levelsGained: Math.max(0, projected - startLevel),
    cost: asInt(row.cost),
    currency: row.currency_type || 'peta',
    canClaim: row.status === 'COMPLETED' || now >= ends,
    remainingMs: Math.max(0, ends - now),
  };
}

async function unlockSlot(db, userId, slotIndex) {
  const slot = SLOTS.find((row) => row.index === asInt(slotIndex));
  if (!slot || slot.index === 1) {
    const error = new Error('Ô này không cần mở khóa.');
    error.status = 400;
    throw error;
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query(
      'SELECT peta, petagold, is_vip, vip_level FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (!user) {
      const error = new Error('Không tìm thấy tài khoản.');
      error.status = 404;
      throw error;
    }
    const [[owned]] = await conn.query(
      'SELECT slot_index FROM training_camp_unlocks WHERE user_id = ? AND slot_index = ? FOR UPDATE',
      [userId, slot.index]
    );
    if (owned) {
      const error = new Error('Ô này đã được mở vĩnh viễn.');
      error.status = 400;
      throw error;
    }
    const balanceField = slot.currency === 'petagold' ? 'petagold' : 'peta';
    if (asInt(user[balanceField]) < slot.cost) {
      const error = new Error(slot.currency === 'petagold' ? 'Không đủ Petagold.' : 'Không đủ Peta.');
      error.status = 400;
      throw error;
    }
    const [spent] = await conn.query(
      `UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ? AND ${balanceField} >= ?`,
      [slot.cost, userId, slot.cost]
    );
    if (!spent.affectedRows) {
      const error = new Error(slot.currency === 'petagold' ? 'Không đủ Petagold.' : 'Không đủ Peta.');
      error.status = 400;
      throw error;
    }
    await conn.query(
      'INSERT INTO training_camp_unlocks (user_id, slot_index, unlocked_via) VALUES (?, ?, ?)',
      [userId, slot.index, slot.currency]
    );
    const [[fresh]] = await conn.query('SELECT peta, petagold FROM users WHERE id = ?', [userId]);
    await conn.commit();
    return {
      message: `Đã mở ô huấn luyện #${slot.index}.`,
      balances: { peta: asInt(fresh.peta), petagold: asInt(fresh.petagold) },
    };
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

async function startSession(db, userId, body, battleIds) {
  const slotIndex = asInt(body.slot);
  const petId = asInt(body.petId);
  const opponentId = asInt(body.opponentId);
  const minutes = asInt(body.durationMinutes);
  const duration = durationByMinutes(minutes);
  if (!SLOTS.some((slot) => slot.index === slotIndex) || petId <= 0 || opponentId <= 0 || !duration) {
    const error = new Error('Thông tin huấn luyện không hợp lệ.');
    error.status = 400;
    throw error;
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query(
      'SELECT peta, petagold, is_vip, vip_level FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (!user) {
      const error = new Error('Không tìm thấy tài khoản.');
      error.status = 404;
      throw error;
    }
    const vipLevel = effectiveVipLevel(user.vip_level, user.is_vip);
    const [[owned]] = await conn.query(
      'SELECT slot_index FROM training_camp_unlocks WHERE user_id = ? AND slot_index = ?',
      [userId, slotIndex]
    );
    if (!slotIsOpen(slotIndex, Boolean(owned), vipLevel)) {
      const error = new Error('Ô huấn luyện chưa được mở.');
      error.status = 400;
      throw error;
    }
    const [[slotBusy]] = await conn.query(
      `SELECT id FROM training_sessions
       WHERE user_id = ? AND camp_slot = ? AND status IN ('RUNNING', 'COMPLETED') FOR UPDATE`,
      [userId, slotIndex]
    );
    if (slotBusy) {
      const error = new Error('Ô này đang có phiên huấn luyện.');
      error.status = 400;
      throw error;
    }
    const [[pet]] = await conn.query(
      `SELECT id, level, current_exp, activity_status, is_listed, highest_training_arena_npc_id
       FROM pets WHERE id = ? AND owner_id = ? FOR UPDATE`,
      [petId, userId]
    );
    if (!pet || pet.is_listed) {
      const error = new Error('Pet không thuộc về bạn hoặc đang đấu giá.');
      error.status = 400;
      throw error;
    }
    if (String(pet.activity_status || '') === 'training') {
      const error = new Error(TRAINING_LOCK_MESSAGE);
      error.status = 400;
      throw error;
    }
    if (String(pet.activity_status || '') === 'active') {
      const error = new Error('Pet đang Active. Hãy bỏ Active trước khi đưa vào Trại huấn luyện.');
      error.status = 400;
      throw error;
    }
    if (battleIds && battleIds.has(petId)) {
      const error = new Error('Pet đang trong trận đấu.');
      error.status = 400;
      throw error;
    }
    const [[petBusy]] = await conn.query(
      `SELECT id FROM training_sessions WHERE pet_id = ? AND status IN ('RUNNING', 'COMPLETED') LIMIT 1`,
      [petId]
    );
    if (petBusy) {
      const error = new Error('Pet đang ở một phiên huấn luyện khác.');
      error.status = 400;
      throw error;
    }
    const [[boss]] = await conn.query(
      `SELECT id, level, location_id, training_1h_cost
       FROM boss_templates WHERE id = ?`,
      [opponentId]
    );
    if (!boss || !isArenaBoss(boss.location_id)) {
      const error = new Error('Đối thủ không thuộc Arena.');
      error.status = 400;
      throw error;
    }
    let highestLevel = 0;
    if (pet.highest_training_arena_npc_id) {
      const [[highest]] = await conn.query(
        'SELECT level FROM boss_templates WHERE id = ?',
        [pet.highest_training_arena_npc_id]
      );
      highestLevel = highest ? asInt(highest.level) : 0;
    }
    if (!opponentUnlocked(boss.level, highestLevel)) {
      const error = new Error('Chưa mở khóa đối thủ này. Hãy thắng trong Arena với hơn 50% HP.');
      error.status = 400;
      throw error;
    }
    const cost = trainingCost(baseCostForLevel(boss.level, boss.training_1h_cost), minutes);
    if (asInt(user.peta) < cost) {
      const error = new Error('Không đủ Peta.');
      error.status = 400;
      throw error;
    }
    const [spent] = await conn.query(
      'UPDATE users SET peta = peta - ? WHERE id = ? AND peta >= ?',
      [cost, userId, cost]
    );
    if (!spent.affectedRows) {
      const error = new Error('Không đủ Peta.');
      error.status = 400;
      throw error;
    }
    const started = new Date();
    const ends = new Date(started.getTime() + minutes * 60 * 1000);
    const level = asInt(pet.level, 1);
    const exp = asInt(pet.current_exp);
    await conn.query(
      `INSERT INTO training_sessions (
         user_id, pet_id, camp_slot, opponent_id, opponent_level, started_at, ends_at,
         duration_minutes, processed_ticks, pending_exp, start_pet_level, start_pet_exp,
         sim_level, sim_exp, cost, currency_type, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, 'peta', 'RUNNING')`,
      [userId, petId, slotIndex, boss.id, asInt(boss.level, 1), started, ends, minutes, level, exp, level, exp, cost]
    );
    await conn.query("UPDATE pets SET activity_status = 'training' WHERE id = ?", [petId]);
    const [[fresh]] = await conn.query('SELECT peta, petagold FROM users WHERE id = ?', [userId]);
    await conn.commit();
    return {
      message: 'Đã bắt đầu huấn luyện. Không thể hủy giữa chừng.',
      balances: { peta: asInt(fresh.peta), petagold: asInt(fresh.petagold) },
    };
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

async function claimSession(db, userId, sessionId) {
  const id = asInt(sessionId);
  if (id <= 0) {
    const error = new Error('Phiên huấn luyện không hợp lệ.');
    error.status = 400;
    throw error;
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const now = new Date();
    const [[session]] = await conn.query(
      'SELECT * FROM training_sessions WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId]
    );
    if (!session) {
      const error = new Error('Không tìm thấy phiên huấn luyện.');
      error.status = 404;
      throw error;
    }
    if (session.status === 'CLAIMED') {
      const error = new Error('Phần thưởng đã được nhận.');
      error.status = 400;
      throw error;
    }
    const [[boss]] = await conn.query('SELECT level FROM boss_templates WHERE id = ?', [session.opponent_id]);
    const advanced = await advanceSession(conn, session, now, boss ? boss.level : session.opponent_level);
    if (now.getTime() < ms(advanced.ends_at) || advanced.status !== 'COMPLETED') {
      const error = new Error('Chưa thể nhận thưởng. Phiên huấn luyện vẫn đang chạy.');
      error.status = 400;
      throw error;
    }
    const [[pet]] = await conn.query(
      'SELECT id, uuid, name, level, current_exp, owner_id FROM pets WHERE id = ? AND owner_id = ? FOR UPDATE',
      [advanced.pet_id, userId]
    );
    if (!pet) {
      const error = new Error('Pet không còn thuộc về bạn.');
      error.status = 400;
      throw error;
    }
    const startLevel = asInt(advanced.start_pet_level, asInt(pet.level, 1));
    const endLevel = asInt(advanced.sim_level, startLevel);
    const endExp = asInt(advanced.sim_exp);
    await conn.query(
      "UPDATE pets SET current_exp = ?, level = ?, activity_status = 'idle' WHERE id = ?",
      [endExp, endLevel, pet.id]
    );
    if (endLevel !== asInt(pet.level)) {
      await refreshPetIntrinsicStats(conn, pet.id);
    }
    await conn.query(
      `UPDATE training_sessions SET status = 'CLAIMED', claimed_at = ? WHERE id = ?`,
      [now, id]
    );
    await conn.commit();
    return {
      message: 'Đã nhận thưởng huấn luyện.',
      expGained: asInt(advanced.pending_exp),
      startLevel,
      endLevel,
      levelsGained: Math.max(0, endLevel - startLevel),
      petId: pet.id,
      petName: pet.name,
      petUuid: pet.uuid,
    };
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  ensureTrainingCampSchema,
  recordArenaTrainingUnlock,
  trainingLockMessageForPet,
  TRAINING_LOCK_MESSAGE,
  getCampState,
  unlockSlot,
  startSession,
  claimSession,
  loadBattlePetIds,
  processUserSessions,
};
