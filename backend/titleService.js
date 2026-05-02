/**
 * Danh hiệu (Title): tiến độ người chơi + định nghĩa title trong DB.
 */

const DEFAULT_TITLES = [
  { slug: 'fortune_maker', name: 'Fortune Maker', image_key: 't1', metric_type: 'peta_earned', threshold: 10000000, sort_order: 10 },
  { slug: 'millionaire', name: 'Millionaire', image_key: 't2', metric_type: 'peta_earned', threshold: 100000000, sort_order: 20 },
  { slug: 'super_millionaire', name: 'Super Millionaire', image_key: 't3', metric_type: 'peta_earned', threshold: 500000000, sort_order: 30 },
  { slug: 'overflowing_wealth', name: 'Overflowing Wealth', image_key: 't4', metric_type: 'peta_earned', threshold: 1000000000, sort_order: 40 },
  { slug: 'the_hunter', name: 'The Hunter', image_key: 't5', metric_type: 'pets_caught', threshold: 50, sort_order: 50 },
  { slug: 'master_hunter', name: 'Master Hunter', image_key: 't6', metric_type: 'pets_caught', threshold: 100, sort_order: 60 },
  { slug: 'hunter_supreme', name: 'The Hunter Supreme', image_key: 't7', metric_type: 'pets_caught', threshold: 500, sort_order: 70 },
  { slug: 'evo_trainer', name: 'Evo Trainer', image_key: 't8', metric_type: 'pet_evolutions', threshold: 10, sort_order: 80 },
  { slug: 'evo_mentor', name: 'Evo Mentor', image_key: 't9', metric_type: 'pet_evolutions', threshold: 50, sort_order: 90 },
  { slug: 'evo_master', name: 'Evo Master', image_key: 't10', metric_type: 'pet_evolutions', threshold: 100, sort_order: 100 },
  { slug: 'rookie_victor', name: 'Rookie Victor', image_key: 't11', metric_type: 'hunt_wins', threshold: 100, sort_order: 110 },
  { slug: 'rising_fighter', name: 'Rising Fighter', image_key: 't12', metric_type: 'hunt_wins', threshold: 500, sort_order: 120 },
  { slug: 'relentless_slayer', name: 'Relentless Slayer', image_key: 't13', metric_type: 'hunt_wins', threshold: 1000, sort_order: 130 },
  { slug: 'silver_patron', name: 'Silver Patron', image_key: 't14', metric_type: 'peta_spent', threshold: 10000000, sort_order: 140 },
  { slug: 'gold_patron', name: 'Gold Patron', image_key: 't15', metric_type: 'peta_spent', threshold: 50000000, sort_order: 150 },
  { slug: 'platinum_patron', name: 'Platinum Patron', image_key: 't16', metric_type: 'peta_spent', threshold: 200000000, sort_order: 160 },
  { slug: 'diamond_patron', name: 'Diamond Patron', image_key: 't17', metric_type: 'peta_spent', threshold: 600000000, sort_order: 170 },
  { slug: 'mythic_patron', name: 'Mythic Patron', image_key: 't18', metric_type: 'peta_spent', threshold: 1000000000, sort_order: 180 },
];

const METRIC_COLUMNS = {
  peta_earned: 'peta_earned',
  peta_spent: 'peta_spent',
  pets_caught: 'pets_caught',
  pet_evolutions: 'pet_evolutions',
  hunt_wins: 'hunt_wins',
};

function titleImageUrl(imageKey) {
  const k = String(imageKey || 't1').replace(/[^a-zA-Z0-9_-]/g, '');
  return `/images/title/${k}.png`;
}

async function ensureTitleSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS titles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(128) NOT NULL,
      image_key VARCHAR(32) NOT NULL DEFAULT 't1',
      metric_type ENUM('peta_earned','peta_spent','pets_caught','pet_evolutions','hunt_wins') NOT NULL,
      threshold BIGINT UNSIGNED NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_title_progress (
      user_id INT NOT NULL PRIMARY KEY,
      peta_earned BIGINT UNSIGNED NOT NULL DEFAULT 0,
      peta_spent BIGINT UNSIGNED NOT NULL DEFAULT 0,
      pets_caught INT UNSIGNED NOT NULL DEFAULT 0,
      pet_evolutions INT UNSIGNED NOT NULL DEFAULT 0,
      hunt_wins INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_unlocked_titles (
      user_id INT NOT NULL,
      title_id INT NOT NULL,
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, title_id),
      KEY idx_unlock_title (title_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await db.query('ALTER TABLE users ADD COLUMN equipped_title_id INT NULL');
  } catch (e) {
    if (!String(e.message || '').includes('Duplicate column')) console.warn('equipped_title_id:', e.message);
  }

  try {
    await db.query(
      'ALTER TABLE pets ADD COLUMN evolution_stage TINYINT UNSIGNED NOT NULL DEFAULT 0'
    );
  } catch (e) {
    if (!String(e.message || '').includes('Duplicate column')) console.warn('evolution_stage:', e.message);
  }
}

async function seedDefaultTitles(db) {
  const [rows] = await db.query('SELECT COUNT(*) AS c FROM titles');
  const c = rows && rows[0] ? Number(rows[0].c) : 0;
  if (c > 0) return;

  for (const t of DEFAULT_TITLES) {
    await db.query(
      `INSERT INTO titles (slug, name, image_key, metric_type, threshold, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [t.slug, t.name, t.image_key, t.metric_type, t.threshold, t.sort_order]
    );
  }
}

function getMetricFromProgress(row, metricType) {
  const col = METRIC_COLUMNS[metricType];
  if (!col || !row) return 0;
  const v = row[col];
  return Math.max(0, Number(v) || 0);
}

async function unlockTitlesForUser(db, userId) {
  const [progRows] = await db.query('SELECT * FROM user_title_progress WHERE user_id = ?', [userId]);
  const prog = progRows && progRows[0] ? progRows[0] : {};

  const [titles] = await db.query(
    'SELECT id, metric_type, threshold FROM titles WHERE is_active = 1'
  );
  for (const t of titles || []) {
    const val = getMetricFromProgress(prog, t.metric_type);
    if (val >= Number(t.threshold)) {
      await db.query(
        'INSERT IGNORE INTO user_unlocked_titles (user_id, title_id) VALUES (?, ?)',
        [userId, t.id]
      );
    }
  }
}

async function bumpMetric(db, userId, column, delta) {
  const d = Math.floor(Number(delta) || 0);
  if (!userId || d === 0) return;
  const col = METRIC_COLUMNS[column] || column;
  if (!['peta_earned', 'peta_spent', 'pets_caught', 'pet_evolutions', 'hunt_wins'].includes(col)) return;

  if (col === 'peta_earned' || col === 'peta_spent') {
    await db.query(
      `INSERT INTO user_title_progress (user_id, ${col}) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ${col} = IFNULL(${col}, 0) + VALUES(${col})`,
      [userId, d]
    );
  } else {
    await db.query(
      `INSERT INTO user_title_progress (user_id, ${col}) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ${col} = IFNULL(${col}, 0) + VALUES(${col})`,
      [userId, d]
    );
  }
  await unlockTitlesForUser(db, userId);
}

async function recordPetaEarned(db, userId, amount) {
  const n = Math.floor(Number(amount) || 0);
  if (n <= 0) return;
  await bumpMetric(db, userId, 'peta_earned', n);
}

async function recordPetaSpent(db, userId, amount) {
  const n = Math.floor(Number(amount) || 0);
  if (n === 0) return;
  if (n < 0) {
    await db.query(
      `UPDATE user_title_progress SET peta_spent = GREATEST(0, IFNULL(peta_spent, 0) + ?) WHERE user_id = ?`,
      [n, userId]
    );
    await unlockTitlesForUser(db, userId);
    return;
  }
  await bumpMetric(db, userId, 'peta_spent', n);
}

async function recordPetCatch(db, userId, n = 1) {
  await bumpMetric(db, userId, 'pets_caught', n);
}

async function recordPetEvolution(db, userId, n = 1) {
  await bumpMetric(db, userId, 'pet_evolutions', n);
}

async function recordHuntWin(db, userId, n = 1) {
  await bumpMetric(db, userId, 'hunt_wins', n);
}

async function syncEquippedTitleDisplay(db, userId) {
  const [rows] = await db.query(
    `SELECT u.equipped_title_id, t.name FROM users u LEFT JOIN titles t ON t.id = u.equipped_title_id WHERE u.id = ?`,
    [userId]
  );
  const name = rows && rows[0] && rows[0].name ? rows[0].name : null;
  await db.query('UPDATE users SET title = ? WHERE id = ?', [name, userId]);
}

async function setEquippedTitle(db, userId, titleId) {
  if (titleId == null || titleId === '') {
    await db.query('UPDATE users SET equipped_title_id = NULL, title = NULL WHERE id = ?', [userId]);
    return { equipped_title_id: null };
  }
  const tid = parseInt(titleId, 10);
  const [own] = await db.query(
    'SELECT 1 FROM user_unlocked_titles WHERE user_id = ? AND title_id = ? LIMIT 1',
    [userId, tid]
  );
  if (!own || !own.length) {
    const err = new Error('Chưa mở khóa danh hiệu này');
    err.code = 'TITLE_LOCKED';
    throw err;
  }
  await db.query('UPDATE users SET equipped_title_id = ? WHERE id = ?', [tid, userId]);
  await syncEquippedTitleDisplay(db, userId);
  return { equipped_title_id: tid };
}

module.exports = {
  titleImageUrl,
  ensureTitleSchema,
  seedDefaultTitles,
  unlockTitlesForUser,
  recordPetaEarned,
  recordPetaSpent,
  recordPetCatch,
  recordPetEvolution,
  recordHuntWin,
  syncEquippedTitleDisplay,
  setEquippedTitle,
  METRIC_COLUMNS,
  DEFAULT_TITLES,
};
