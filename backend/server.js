const {
  randomFactor,
  isCriticalHit,
  isDodged,
  calculateDamage,
  simulateTurn,
  simulateFullBattle,
  simulateDefendTurn,
  getBossAction,
  simulateBossTurn,
} = require('./battleEngine');

const { generateIVStats, calculateFinalStats, calculateBossFinalStats, rawBossFinalStats } = require('./utils/petStats');
const huntingCatch = require('./utils/huntingCatch');
const expTable = require('../src/data/exp_table_petaria.json');

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

/** Giới hạn ô túi đồ — đọc từ petaria/.env (INVENTORY_MAX_SLOTS). Restart backend sau khi đổi. */
const INVENTORY_MAX_SLOTS = Math.max(
  1,
  Math.min(5000, parseInt(process.env.INVENTORY_MAX_SLOTS, 10) || 100)
);
/** Giới hạn số pet sở hữu — PET_MAX_SLOTS (mặc định 1000). */
const PET_MAX_SLOTS = Math.max(
  1,
  Math.min(20000, parseInt(process.env.PET_MAX_SLOTS, 10) || 1000)
);
/** Giới hạn số linh thú sở hữu — SPIRIT_MAX_SLOTS (mặc định 500). */
const SPIRIT_MAX_SLOTS = Math.max(
  1,
  Math.min(20000, parseInt(process.env.SPIRIT_MAX_SLOTS, 10) || 500)
);
console.log(
  `[config] INVENTORY_MAX_SLOTS=${INVENTORY_MAX_SLOTS} PET_MAX_SLOTS=${PET_MAX_SLOTS} SPIRIT_MAX_SLOTS=${SPIRIT_MAX_SLOTS}`
);

const petVitals = require('./petVitals');
const titleService = require('./titleService');

const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Server: SocketIOServer } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('redis');
const {
  getDefaultGameCenterConfig,
  mergeGameCenterConfig,
  buildLuckyWheelSegments,
} = require('./gameCenterConfigDefaults');
const {
  getDefaultRegionMapsConfig,
  mergeRegionMapsConfig,
} = require('./regionMapsConfigDefaults');
const {
  buildScratchTicketFromConfig,
  parsePending,
} = require('./scratchLotteryService');

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
const port = 5000; // Chọn cổng cho backend


const mysql = require('mysql2'); // Hoặc const { Pool } = require('pg');

const pool = mysql.createPool({ // Hoặc const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petaria',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = pool.promise();

async function normalizePetCurrentHp(conn, petId) {
  if (petId == null) return;
  const pid = Number(petId);
  if (!Number.isFinite(pid) || pid <= 0) return;

  const [rows] = await conn.query(
    'SELECT id, current_hp, max_hp, hp, final_stats FROM pets WHERE id = ? LIMIT 1',
    [pid]
  );
  if (!rows.length) return;
  const pet = rows[0];

  // CHECK hiện tại trong DB: current_hp IS NULL OR current_hp <= json_extract(final_stats,'$.hp')
  // Nếu final_stats.hp không tồn tại / NULL => mọi current_hp != NULL sẽ vi phạm CHECK. Khi đó set current_hp = NULL là an toàn nhất.
  let fsHp = null;
  if (pet.final_stats) {
    try {
      const fs = typeof pet.final_stats === 'string' ? JSON.parse(pet.final_stats) : pet.final_stats;
      if (fs && fs.hp != null) fsHp = Number(fs.hp);
    } catch (_) {}
  }
  if (!(Number.isFinite(fsHp) && fsHp > 0)) {
    if (pet.current_hp != null) {
      await conn.query('UPDATE pets SET current_hp = NULL WHERE id = ?', [pid]);
    }
    return;
  }

  // Nhiều DB dùng CHECK theo cột max_hp/hp; final_stats.hp có thể khác / lệch. Lấy CEILING hợp lệ = min mọi nguồn dương.
  const caps = [];
  const addCap = (raw) => {
    if (raw === null || raw === undefined) return;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) caps.push(n);
  };
  addCap(pet.max_hp);
  addCap(pet.hp);
  addCap(fsHp);
  const maxHpVal = caps.length ? Math.min(...caps) : 1;
  const curHpRaw = pet.current_hp != null ? Number(pet.current_hp) : maxHpVal;
  const curHp = Number.isFinite(curHpRaw) ? curHpRaw : maxHpVal;
  const validHp = Math.max(0, Math.min(curHp, maxHpVal));

  if (validHp !== curHp) {
    await conn.query('UPDATE pets SET current_hp = ? WHERE id = ?', [validHp, pid]);
  }
}

async function getPetHpCap(conn, petId) {
  if (petId == null) return 1;
  const pid = Number(petId);
  if (!Number.isFinite(pid) || pid <= 0) return 1;

  const [rows] = await conn.query(
    'SELECT max_hp, hp, final_stats FROM pets WHERE id = ? LIMIT 1',
    [pid]
  );
  if (!rows.length) return 1;
  const pet = rows[0];

  const caps = [];
  const addCap = (raw) => {
    if (raw === null || raw === undefined) return;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) caps.push(n);
  };
  addCap(pet.max_hp);
  addCap(pet.hp);
  if (pet.final_stats) {
    try {
      const fs = typeof pet.final_stats === 'string' ? JSON.parse(pet.final_stats) : pet.final_stats;
      if (fs && fs.hp != null) addCap(fs.hp);
    } catch (_) {}
  }
  return caps.length ? Math.min(...caps) : 1;
}

async function getFinalStatsHp(conn, petId) {
  if (petId == null) return null;
  const pid = Number(petId);
  if (!Number.isFinite(pid) || pid <= 0) return null;

  const [rows] = await conn.query(
    "SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(final_stats, '$.hp')) AS UNSIGNED) AS fs_hp FROM pets WHERE id = ? LIMIT 1",
    [pid]
  );
  if (!rows.length) return null;
  const fsHp = rows[0]?.fs_hp;
  const n = Number(fsHp);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const {
  ensureBoosterStatsColumn,
  refreshPetIntrinsicStats,
  applyBoosterCompoundPercent,
  applyBoosterFlat,
} = require('./utils/petIntrinsicStats');

ensureBoosterStatsColumn(db).catch((err) => {
  console.error('ensureBoosterStatsColumn:', err);
});

async function ensureHuntingMapsHiddenColumn(database) {
  try {
    await database.query(
      'ALTER TABLE hunting_maps ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0'
    );
    console.log('[db] hunting_maps.is_hidden column added');
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!/Duplicate column/i.test(msg)) {
      console.error('ensureHuntingMapsHiddenColumn:', e);
    }
  }
}

async function ensurePetSpeciesEvolutionColumns() {
  try {
    await db.query(
      'ALTER TABLE pet_species ADD COLUMN evolve_min_level INT NOT NULL DEFAULT 1'
    );
  } catch (err) {
    const msg = String((err && err.message) || '');
    if (!msg.includes('Duplicate column')) {
      console.error('ensurePetSpeciesEvolutionColumns evolve_min_level:', err);
    }
  }
  try {
    await db.query(
      'ALTER TABLE pet_species ADD COLUMN evolve_item_id INT NULL'
    );
  } catch (err) {
    const msg = String((err && err.message) || '');
    if (!msg.includes('Duplicate column')) {
      console.error('ensurePetSpeciesEvolutionColumns evolve_item_id:', err);
    }
  }
}

ensurePetSpeciesEvolutionColumns().catch((err) => {
  console.error('ensurePetSpeciesEvolutionColumns:', err);
});

function parseSpeciesEvolveTo(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) {
        return j.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0);
      }
    } catch (_) {
      return [];
    }
  }
  return [];
}

async function ensurePetBattleStatsColumns() {
  try {
    await db.query(
      'ALTER TABLE pets ADD COLUMN battles_lost INT NOT NULL DEFAULT 0'
    );
  } catch (err) {
    const code = err && err.code;
    const msg = String((err && err.message) || '');
    if (code !== 'ER_DUP_FIELDNAME' && !msg.includes('Duplicate column')) {
      console.error('ensurePetBattleStatsColumns battles_lost:', err);
    }
  }
  try {
    await db.query(
      'ALTER TABLE pets ADD COLUMN battles_won INT NOT NULL DEFAULT 0'
    );
  } catch (err) {
    const code = err && err.code;
    const msg = String((err && err.message) || '');
    if (code !== 'ER_DUP_FIELDNAME' && !msg.includes('Duplicate column')) {
      console.error('ensurePetBattleStatsColumns battles_won:', err);
    }
  }
}

ensurePetBattleStatsColumns().catch((err) => {
  console.error('ensurePetBattleStatsColumns:', err);
});

petVitals.ensurePetVitalsSchema(db).catch((err) => {
  console.error('ensurePetVitalsSchema:', err);
});

async function ensureUserProfilesTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INT PRIMARY KEY,
        display_name VARCHAR(100) NULL,
        gender VARCHAR(20) NULL,
        avatar_url TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_profiles_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('Error ensuring user_profiles table:', error);
  }
}

ensureUserProfilesTable();

const { ensureAuctionMailTemplatesTable } = require('./services/auctionMailTemplateService');
ensureAuctionMailTemplatesTable(db).catch((err) => {
  console.error('ensureAuctionMailTemplatesTable:', err);
});

async function ensureBuddiesTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_friendships (
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, friend_id),
        CONSTRAINT fk_user_friendships_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_user_friendships_friend
          FOREIGN KEY (friend_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS user_friend_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_friend_requests_sender
          FOREIGN KEY (sender_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_user_friend_requests_receiver
          FOREIGN KEY (receiver_id) REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_user_friend_requests_receiver_status (receiver_id, status),
        INDEX idx_user_friend_requests_sender_status (sender_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS user_presence (
        user_id INT PRIMARY KEY,
        last_seen_at DATETIME NULL,
        CONSTRAINT fk_user_presence_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('Error ensuring buddies tables:', error);
  }
}

async function ensureGuildTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS guilds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        description VARCHAR(600) NULL,
        banner_url TEXT NULL,
        admission_type VARCHAR(20) NOT NULL DEFAULT 'free',
        level TINYINT NOT NULL DEFAULT 1,
        owner_user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_guilds_name (name),
        CONSTRAINT fk_guilds_owner
          FOREIGN KEY (owner_user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_guilds_level_created (level, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_members (
        guild_name VARCHAR(60) NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_name, user_id),
        CONSTRAINT fk_guild_members_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_guild_members_user (user_id),
        INDEX idx_guild_members_role (guild_name, role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_join_requests (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        guild_name VARCHAR(60) NOT NULL,
        user_id INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_guild_join_requests_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        UNIQUE KEY uq_guild_join_requests_pending (guild_name, user_id, status),
        INDEX idx_guild_join_requests_guild_status (guild_name, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('Error ensuring guild tables:', error);
  }
}

async function ensureChatTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS global_chat_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message_text VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_global_chat_messages_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_global_chat_messages_created (created_at),
        INDEX idx_global_chat_messages_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_chat_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        guild_name VARCHAR(120) NOT NULL,
        user_id INT NOT NULL,
        message_text VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_guild_chat_messages_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        INDEX idx_guild_chat_messages_guild_id (guild_name, id),
        INDEX idx_guild_chat_messages_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_chat_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(80) NOT NULL,
        actor_user_id INT NULL,
        message_text VARCHAR(500) NOT NULL,
        payload_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_system_chat_events_user
          FOREIGN KEY (actor_user_id) REFERENCES users(id)
          ON DELETE SET NULL,
        INDEX idx_system_chat_events_created (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('Error ensuring chat tables:', error);
  }
}

async function ensureExhibitionTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_exhibition_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_id INT NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_exhibition_items_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_user_exhibition_items_item
          FOREIGN KEY (item_id) REFERENCES items(id)
          ON DELETE CASCADE,
        UNIQUE KEY uq_user_exhibition_item (user_id, item_id),
        INDEX idx_user_exhibition_order (user_id, display_order, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('Error ensuring exhibition tables:', error);
  }
}

async function ensureUserFormationsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_formations (
        user_id INT NOT NULL PRIMARY KEY,
        levels_json JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_formations_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('Error ensuring user_formations table:', error);
  }
}

async function touchUserPresenceByUserId(userId) {
  if (!userId) return;
  await db.query(
    `
      INSERT INTO user_presence (user_id, last_seen_at)
      VALUES (?, NOW())
      ON DUPLICATE KEY UPDATE last_seen_at = NOW()
    `,
    [userId]
  );
}

function getStatusLabel(onlineStatus, lastSeenAt) {
  if (!lastSeenAt) return Number(onlineStatus) === 1 ? 'away' : 'offline';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(diff)) return 'away';
  if (Number(onlineStatus) === 1 && diff <= PRESENCE_ONLINE_STALE_MS) return 'online';
  return diff <= PRESENCE_AWAY_WINDOW_MS ? 'away' : 'offline';
}

function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return null;
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return null;
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function clampGuildLevel(level) {
  const parsed = Number(level) || 1;
  return Math.max(1, Math.min(10, parsed));
}

function getGuildMemberLimitByLevel(level) {
  const normalizedLevel = clampGuildLevel(level);
  const computed = 10 + Math.round(((normalizedLevel - 1) * 20) / 9);
  return Math.max(10, Math.min(30, computed));
}

function normalizeGuildAdmissionType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'approval' ? 'approval' : 'free';
}

function normalizeGuildBannerUrl(value) {
  const normalized = String(value || '').trim();
  const isAllowedBanner = /^\/images\/guild\/banner\d+\.png$/i;
  const isAllowedFraction = /^\/images\/guild\/fraction\d+\.png$/i;

  if (normalized.includes('::')) {
    const [bannerPartRaw, fractionPartRaw] = normalized.split('::');
    const bannerPart = String(bannerPartRaw || '').trim();
    const fractionPart = String(fractionPartRaw || '').trim();
    if (isAllowedBanner.test(bannerPart) && isAllowedFraction.test(fractionPart)) {
      return `${bannerPart}::${fractionPart}`;
    }
  }

  if (isAllowedBanner.test(normalized)) return normalized;
  return '/images/guild/banner01.png';
}

function normalizeGuildRole(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'leader') return 'leader';
  if (normalized === 'officer') return 'officer';
  if (normalized === 'elite') return 'elite';
  return 'member';
}

function getGuildRolePriority(role) {
  const normalized = normalizeGuildRole(role);
  if (normalized === 'leader') return 1;
  if (normalized === 'officer') return 2;
  if (normalized === 'elite') return 3;
  return 4;
}

function normalizeGuildName(guildName) {
  return String(guildName || '').trim();
}

function getGuildRoomName(guildName) {
  const normalizedGuild = normalizeGuildName(guildName);
  return normalizedGuild ? `guild:${normalizedGuild}` : null;
}

ensureBuddiesTables();
ensureGuildTables();
ensureChatTables();
ensureExhibitionTables();
ensureUserFormationsTable();

titleService
  .ensureTitleSchema(db)
  .then(() => titleService.seedDefaultTitles(db))
  .catch((err) => console.error('Title schema:', err));

const CHAT_COOLDOWN_SECONDS = Math.max(1, Number(process.env.CHAT_COOLDOWN_SECONDS || 30));
const CHAT_MESSAGE_MAX_LENGTH = Math.min(
  150,
  Math.max(100, Number(process.env.CHAT_MESSAGE_MAX_LENGTH || 150))
);
const GUILD_RENAME_COST_PETA = 1000000;
const WORLD_CHAT_HISTORY_LIMIT = 50;
const GUILD_CHAT_HISTORY_LIMIT = 100;
const SYSTEM_CHAT_HISTORY_LIMIT = 100;
const PRESENCE_TOUCH_THROTTLE_MS = 20 * 1000;
const PRESENCE_ONLINE_STALE_MS = 70 * 1000;
const PRESENCE_AWAY_WINDOW_MS = 30 * 60 * 1000;
const onlineSocketCountByUserId = new Map();
const userLastPresenceTouchById = new Map();
const userLastChatAtById = new Map();

async function touchUserPresenceByUserIdThrottled(userId, force = false) {
  const now = Date.now();
  const lastTouch = userLastPresenceTouchById.get(userId) || 0;
  if (!force && now - lastTouch < PRESENCE_TOUCH_THROTTLE_MS) return;
  userLastPresenceTouchById.set(userId, now);
  await touchUserPresenceByUserId(userId);
}

async function resetOnlineStatusOnStartup() {
  try {
    await db.query('UPDATE users SET online_status = 0 WHERE online_status <> 0');
  } catch (error) {
    console.error('Error resetting online status on startup:', error);
  }
}

// Redis client cho Arena Match State (optional)
// Quản lý RAM: mỗi SET match phải có TTL; khi kết thúc trận (finalize) hoặc terminate phải DEL key ngay.
let redisClient = null;
const REDIS_MATCH_TTL = parseInt(process.env.REDIS_MATCH_TTL, 10) || 3600; // 1 giờ mặc định (env: REDIS_MATCH_TTL)
const REDIS_MATCH_PREFIX = 'match:';

async function initRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    redisClient = createClient({ url });
    redisClient.on('error', (err) => console.error('Redis error:', err));
    await redisClient.connect();
    console.log('Redis connected');
  } catch (e) {
    console.warn('Redis not available:', e.message);
  }
}

function getRedis() {
  return redisClient;
}

// Kiểm tra kết nối
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed: ', err);
  } else {
    console.log('Database connected successfully');
    connection.release();
  }
});

app.use(cors());
app.use(bodyParser.json());

async function getUserBasicProfile(userId) {
  const [rows] = await db.query(
    `
      SELECT
        u.id AS user_id,
        u.username,
        u.guild,
        u.online_status,
        up.display_name,
        up.avatar_url,
        p.last_seen_at
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN user_presence p ON p.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
}

function buildPresencePayload(profileRow) {
  if (!profileRow) return null;
  const status = getStatusLabel(profileRow.online_status, profileRow.last_seen_at);
  return {
    userId: profileRow.user_id,
    username: profileRow.username,
    display_name: profileRow.display_name || null,
    avatar_url: profileRow.avatar_url || null,
    guild: profileRow.guild || null,
    status,
    last_seen_at: profileRow.last_seen_at || null,
    last_seen_text: status === 'offline' ? formatLastSeen(profileRow.last_seen_at) : null,
  };
}

function toChatMessagePayload(row) {
  return {
    id: row.id,
    channel: row.channel || 'world',
    message: row.message_text,
    created_at: row.created_at,
    user: {
      user_id: row.user_id,
      username: row.username,
      display_name: row.display_name || null,
      avatar_url: row.avatar_url || null,
      guild: row.guild || null,
    },
  };
}

function toSystemMessagePayload(row) {
  let payload = row.payload_json || null;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      payload = null;
    }
  }
  return {
    id: row.id,
    channel: 'system',
    type: row.event_type || 'system',
    message: row.message_text,
    created_at: row.created_at,
    payload,
  };
}

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (typeof socket.handshake.headers?.authorization === 'string'
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : null);
    if (!token) return next(new Error('NO_TOKEN'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('INVALID_TOKEN'));
  }
});

io.on('connection', async (socket) => {
  const userId = Number(socket.data.userId);
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  socket.join('global');
  socket.join(`user:${userId}`);

  const currentCount = onlineSocketCountByUserId.get(userId) || 0;
  onlineSocketCountByUserId.set(userId, currentCount + 1);

  try {
    await db.query('UPDATE users SET online_status = 1 WHERE id = ?', [userId]);
    await touchUserPresenceByUserIdThrottled(userId, true);
    const profile = await getUserBasicProfile(userId);
    const guildRoom = getGuildRoomName(profile?.guild);
    socket.data.guildRoom = guildRoom;
    if (guildRoom) socket.join(guildRoom);
    const presencePayload = buildPresencePayload(profile);
    if (presencePayload) io.emit('presence:update', presencePayload);
  } catch (error) {
    console.error('Socket connection presence update error:', error);
  }

  socket.emit('chat:config', {
    cooldownSeconds: CHAT_COOLDOWN_SECONDS,
    maxMessageLength: CHAT_MESSAGE_MAX_LENGTH,
    channels: ['world', 'guild', 'system'],
  });

  socket.on('presence:heartbeat', async () => {
    try {
      await touchUserPresenceByUserIdThrottled(userId, false);
    } catch (error) {
      console.error('Presence heartbeat error:', error);
    }
  });

  socket.on('chat:send', async (payload = {}) => {
    try {
      const channel = String(payload?.channel || 'world').trim().toLowerCase();
      if (!['world', 'guild'].includes(channel)) {
        socket.emit('chat:error', {
          code: 'CHAT_CHANNEL_INVALID',
          message: 'Kênh chat không hợp lệ',
        });
        return;
      }
      const rawMessage = String(payload?.message || '').trim();
      if (!rawMessage) return;
      const message = rawMessage.slice(0, CHAT_MESSAGE_MAX_LENGTH);

      const lastChatAt = userLastChatAtById.get(userId) || 0;
      const now = Date.now();
      const remainingMs = CHAT_COOLDOWN_SECONDS * 1000 - (now - lastChatAt);
      if (remainingMs > 0) {
        socket.emit('chat:error', {
          code: 'CHAT_COOLDOWN',
          cooldownSeconds: CHAT_COOLDOWN_SECONDS,
          retryAfterSeconds: Math.ceil(remainingMs / 1000),
        });
        return;
      }

      userLastChatAtById.set(userId, now);
      await touchUserPresenceByUserIdThrottled(userId, true);

      if (channel === 'world') {
        const [insertResult] = await db.query(
          `
            INSERT INTO global_chat_messages (user_id, message_text)
            VALUES (?, ?)
          `,
          [userId, message]
        );

        await db.query(
          `
            DELETE FROM global_chat_messages
            WHERE id NOT IN (
              SELECT id
              FROM (
                SELECT id
                FROM global_chat_messages
                ORDER BY id DESC
                LIMIT ?
              ) AS keep_rows
            )
          `,
          [WORLD_CHAT_HISTORY_LIMIT]
        );

        const [rows] = await db.query(
          `
            SELECT
              m.id,
              m.user_id,
              m.message_text,
              m.created_at,
              u.username,
              u.guild,
              up.display_name,
              up.avatar_url
            FROM global_chat_messages m
            JOIN users u ON u.id = m.user_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE m.id = ?
            LIMIT 1
          `,
          [insertResult.insertId]
        );

        if (rows.length) {
          io.to('global').emit('chat:message', toChatMessagePayload({
            ...rows[0],
            channel: 'world',
          }));
        }
        return;
      }

      const profile = await getUserBasicProfile(userId);
      const guildName = normalizeGuildName(profile?.guild);
      if (!guildName) {
        socket.emit('chat:error', {
          code: 'GUILD_REQUIRED',
          message: 'Bạn chưa có bang hội nên không thể chat Guild',
        });
        return;
      }

      const [insertResult] = await db.query(
        `
          INSERT INTO guild_chat_messages (guild_name, user_id, message_text)
          VALUES (?, ?, ?)
        `,
        [guildName, userId, message]
      );

      await db.query(
        `
          DELETE FROM guild_chat_messages
          WHERE guild_name = ?
            AND id NOT IN (
              SELECT id
              FROM (
                SELECT id
                FROM guild_chat_messages
                WHERE guild_name = ?
                ORDER BY id DESC
                LIMIT ?
              ) AS keep_rows
            )
        `,
        [guildName, guildName, GUILD_CHAT_HISTORY_LIMIT]
      );

      const [rows] = await db.query(
        `
          SELECT
            m.id,
            m.user_id,
            m.message_text,
            m.created_at,
            u.username,
            u.guild,
            up.display_name,
            up.avatar_url
          FROM guild_chat_messages m
          JOIN users u ON u.id = m.user_id
          LEFT JOIN user_profiles up ON up.user_id = u.id
          WHERE m.id = ?
          LIMIT 1
        `,
        [insertResult.insertId]
      );

      if (rows.length) {
        const guildRoom = getGuildRoomName(guildName);
        if (guildRoom) {
          io.to(guildRoom).emit('chat:message', toChatMessagePayload({
            ...rows[0],
            channel: 'guild',
          }));
        }
      }
    } catch (error) {
      console.error('Socket chat send error:', error);
      socket.emit('chat:error', {
        code: 'CHAT_SEND_FAILED',
        message: 'Không thể gửi tin nhắn lúc này',
      });
    }
  });

  socket.on('disconnect', async () => {
    try {
      const count = onlineSocketCountByUserId.get(userId) || 0;
      if (count <= 1) {
        onlineSocketCountByUserId.delete(userId);
        await db.query('UPDATE users SET online_status = 0 WHERE id = ?', [userId]);
        await touchUserPresenceByUserIdThrottled(userId, true);
        const profile = await getUserBasicProfile(userId);
        const presencePayload = buildPresencePayload(profile);
        if (presencePayload) io.emit('presence:update', presencePayload);
      } else {
        onlineSocketCountByUserId.set(userId, count - 1);
      }
    } catch (error) {
      console.error('Socket disconnect presence update error:', error);
    }
  });
});

// Import auction routes
const auctionRoutes = require('./routes/auctions');
app.use('/api/auctions', auctionRoutes);
const { ensureAuctionMultiAssetSchema } = require('./services/auctionMultiAssetSchema');
ensureAuctionMultiAssetSchema().catch((err) =>
  console.warn('ensureAuctionMultiAssetSchema:', err && err.message)
);

// User Items API (for auction system) — lấy từ inventory (cùng nguồn với kho game), không dùng user_items
app.get('/api/user/items', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    const [items] = await db.query(`
      SELECT
        inv.id AS inventory_id,
        inv.item_id,
        inv.quantity,
        it.name,
        it.description,
        it.image_url,
        it.rarity,
        it.type
      FROM inventory inv
      JOIN items it ON inv.item_id = it.id
      LEFT JOIN equipment_data ed ON ed.item_id = it.id
      WHERE inv.player_id = ?
        AND inv.quantity > 0
        AND (inv.is_equipped = 0 OR inv.is_equipped IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM auctions a
          WHERE a.seller_id = ?
            AND a.status = 'active'
            AND (a.asset_type = 'item' OR a.asset_type IS NULL)
            AND COALESCE(NULLIF(a.asset_ref_id, 0), a.item_id) = inv.item_id
        )
        AND (
          LOWER(COALESCE(it.type, '')) <> 'equipment'
          OR ed.item_id IS NULL
          OR LOWER(COALESCE(ed.durability_mode, '')) = 'unbreakable'
          OR COALESCE(ed.durability_max, 0) >= 999999
          OR LOWER(COALESCE(ed.durability_mode, '')) IN ('unknown', 'random')
          OR (
            COALESCE(ed.durability_max, 0) > 0
            AND COALESCE(ed.durability_max, 0) < 999999
            AND COALESCE(inv.durability_left, 0) >= ed.durability_max
          )
        )
      ORDER BY it.name ASC, inv.id ASC
    `, [userId, userId]);

    res.json({ items });
  } catch (error) {
    console.error('Error fetching user items:', error);
    res.status(500).json({ message: 'Error fetching user items' });
  }
});

// Metadata vật phẩm theo id (mail, preview — không cần quyền admin)
app.get('/api/items/by-ids', async (req, res) => {
  try {
    const raw = String(req.query.ids || '');
    const ids = [
      ...new Set(
        raw
          .split(',')
          .map((x) => parseInt(String(x).trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    if (!ids.length) return res.json([]);
    const [rows] = await db.query(
      `SELECT id, name, image_url, description, type, rarity, stackable, max_stack FROM items WHERE id IN (?)`,
      [ids]
    );
    res.json(rows || []);
  } catch (err) {
    console.error('GET /api/items/by-ids:', err);
    res.status(500).json({ error: 'Không thể tải vật phẩm' });
  }
});

// Thêm multer để xử lý upload ảnh (khai báo và khởi tạo trước khi sử dụng)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });
const uploadMemory = multer({ storage: multer.memoryStorage() });

// ---------- Forum (MVP) ----------
async function ensureForumTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(80) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(300) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_forum_categories_slug (slug),
      INDEX idx_forum_categories_sort (sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      author_user_id INT NOT NULL,
      title VARCHAR(180) NOT NULL,
      body_markdown MEDIUMTEXT NOT NULL,
      is_pinned TINYINT NOT NULL DEFAULT 0,
      is_locked TINYINT NOT NULL DEFAULT 0,
      view_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_forum_threads_category FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE,
      CONSTRAINT fk_forum_threads_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_forum_threads_category_created (category_id, is_pinned, created_at),
      INDEX idx_forum_threads_author_created (author_user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_comments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      thread_id BIGINT NOT NULL,
      author_user_id INT NOT NULL,
      parent_comment_id BIGINT NULL,
      body_markdown MEDIUMTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_forum_comments_thread FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE,
      CONSTRAINT fk_forum_comments_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_forum_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES forum_comments(id) ON DELETE SET NULL,
      INDEX idx_forum_comments_thread_created (thread_id, created_at),
      INDEX idx_forum_comments_parent (parent_comment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Seed mặc định (nếu chưa có category nào)
  const [catCountRows] = await db.query(`SELECT COUNT(*) AS c FROM forum_categories`);
  const c = Number(catCountRows?.[0]?.c || 0);
  if (c === 0) {
    await db.query(
      `
        INSERT INTO forum_categories (slug, name, description, sort_order)
        VALUES
          ('thong-bao', 'Thông báo', 'Thông báo từ hệ thống / event', 1),
          ('hoi-dap', 'Hỏi đáp', 'Hỏi đáp và chia sẻ kiến thức', 2),
          ('show-pet', 'Show Pet', 'Khoe thú cưng, linh thú, build', 3),
          ('trade', 'Trade', 'Mua bán / trao đổi', 4),
          ('guide', 'Guide', 'Hướng dẫn, mẹo, kinh nghiệm', 5)
      `
    );
  }

  // Seed thread cơ bản từ "nháp" trang chủ (nếu chưa có thread nào)
  const [threadCountRows] = await db.query(`SELECT COUNT(*) AS c FROM forum_threads`);
  const tc = Number(threadCountRows?.[0]?.c || 0);
  if (tc === 0) {
    const [authorRows] = await db.query(`SELECT id FROM users ORDER BY id ASC LIMIT 1`);
    const authorUserId = authorRows?.[0]?.id ? Number(authorRows[0].id) : null;
    if (!authorUserId) return;

    const [cats] = await db.query(`SELECT id, slug FROM forum_categories`);
    const catBySlug = new Map((cats || []).map((r) => [r.slug, r.id]));
    const catThongBao = catBySlug.get('thong-bao');
    const catTrade = catBySlug.get('trade');
    const catHoiDap = catBySlug.get('hoi-dap');

    const seedThreads = [];
    if (catThongBao) {
      seedThreads.push({
        categoryId: catThongBao,
        title: 'Thông báo nhanh (tổng hợp link từ trang chủ)',
        body: [
          '### Tổng hợp thông báo',
          '- [KM nạp Petagold qua thẻ cào và thưởng peta, exp khi train pet](https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=1059984&postcount=75)',
          '- [Giới hạn 3 tài khoản/1 IP](https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=934402&postcount=59)',
          '- [Cấp độ, Điểm kinh nghiệm người chơi](https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=924284&postcount=54)',
          '- [Auto luyện cấp dành cho Firefox / Internet Explorer](https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=920496&postcount=14)',
          '- [Phóng thích thú cưng nhận peta](https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showpost.php?p=870541&postcount=49)',
          '',
          'Bạn có thể reply ở đây để góp ý/đề xuất cập nhật nội dung.',
        ].join('\n'),
        isPinned: 1,
      });
    }
    if (catTrade) {
      seedThreads.push({
        categoryId: catTrade,
        title: 'Các vấn đề về giao dịch (link tham khảo forum cũ)',
        body: [
          '### Tham khảo',
          '- [Các vấn đề về giao dịch](https://web.archive.org/web/20140329030556/http://vnpet.com/forum/showthread.php?t=34658)',
          '- [Đăng ký giao dịch ngoài chức năng của web](https://web.archive.org/web/20140329030556/http://vnpet.com/forum/showthread.php?t=70908)',
          '- [Tình trạng lừa đảo, gian lận trên Petaria](https://web.archive.org/web/20140329030556/http://www.vnpet.com/forum/showthread.php?p=166406#post166406)',
          '',
          'MVP forum mới: ưu tiên minh bạch & dễ report. Nội quy sẽ được bổ sung sau.',
        ].join('\n'),
      });
    }
    if (catHoiDap) {
      seedThreads.push({
        categoryId: catHoiDap,
        title: 'Hỏi đáp các vấn đề trong game (bắt đầu từ đây)',
        body: [
          '### Hỏi đáp',
          '- Bạn là newbie? Hãy hỏi tại đây.',
          '- Kèm ảnh/screenshot nếu có.',
          '',
          'Gợi ý: dùng nút **Ảnh** để upload và chèn vào bài/comment.',
        ].join('\n'),
      });
    }

    for (const t of seedThreads) {
      await db.query(
        `
          INSERT INTO forum_threads (category_id, author_user_id, title, body_markdown, is_pinned)
          VALUES (?, ?, ?, ?, ?)
        `,
        [t.categoryId, authorUserId, t.title, t.body, t.isPinned ? 1 : 0]
      );
    }
  }
}

ensureForumTables().catch((err) => console.error('ensureForumTables:', err));

async function ensureSiteGameCenterTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS site_game_center_config (
        id INT PRIMARY KEY,
        config JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('ensureSiteGameCenterTable:', error);
  }
}

ensureSiteGameCenterTable();

async function ensureSiteRegionMapsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS site_region_maps_config (
        id INT PRIMARY KEY,
        config JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('ensureSiteRegionMapsTable:', error);
  }
}

ensureSiteRegionMapsTable();

function getForumUploadDir() {
  // Static hosting via CRA `public/` → served as `/images/forum/threads/*`
  return path.resolve(__dirname, '..', 'public', 'images', 'forum', 'threads');
}

const forumStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = getForumUploadDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const safeOriginal = String(file.originalname || 'image')
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 120);
    cb(null, `${Date.now()}-${uuidv4()}-${safeOriginal}`);
  },
});
const forumUpload = multer({
  storage: forumStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

function getGameCenterUploadDir() {
  return path.resolve(__dirname, '..', 'public', 'images', 'entertainment', 'uploads');
}

const gcStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = getGameCenterUploadDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const safeOriginal = String(file.originalname || 'asset')
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 120);
    cb(null, `${Date.now()}-${uuidv4()}-${safeOriginal}`);
  },
});

const gcUpload = multer({
  storage: gcStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

function requireAuthUserId(req, res) {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  return userId;
}

async function getUserRoleById(userId) {
  if (!userId) return 'user';
  const [rows] = await db.query(`SELECT role FROM users WHERE id = ? LIMIT 1`, [userId]);
  return rows?.[0]?.role || 'user';
}

async function canManageForumThread(userId, threadId) {
  const [rows] = await db.query(
    `SELECT id, author_user_id FROM forum_threads WHERE id = ? LIMIT 1`,
    [threadId]
  );
  if (!rows.length) return { ok: false, reason: 'NOT_FOUND' };
  const thread = rows[0];
  if (Number(thread.author_user_id) === Number(userId)) return { ok: true, thread };
  const role = await getUserRoleById(userId);
  if (String(role).toLowerCase() === 'admin') return { ok: true, thread };
  return { ok: false, reason: 'FORBIDDEN', thread };
}

app.get('/api/forum/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT id, slug, name, description, sort_order
        FROM forum_categories
        ORDER BY sort_order ASC, id ASC
      `
    );
    res.json(rows || []);
  } catch (err) {
    console.error('GET /api/forum/categories:', err);
    res.status(500).json({ message: 'Không thể tải danh mục' });
  }
});

app.get('/api/forum/categories/:slug/threads', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    if (!slug) return res.status(400).json({ message: 'Thiếu category slug' });

    const [cats] = await db.query(`SELECT id, slug, name FROM forum_categories WHERE slug = ? LIMIT 1`, [slug]);
    if (!cats.length) return res.status(404).json({ message: 'Không tìm thấy category' });
    const category = cats[0];

    const [threads] = await db.query(
      `
        SELECT
          t.id,
          t.title,
          t.is_pinned,
          t.is_locked,
          t.view_count,
          t.created_at,
          t.updated_at,
          u.id AS author_user_id,
          u.username,
          up.display_name,
          up.avatar_url,
          (
            SELECT COUNT(*)
            FROM forum_comments c
            WHERE c.thread_id = t.id
          ) AS comment_count
        FROM forum_threads t
        JOIN users u ON u.id = t.author_user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE t.category_id = ?
        ORDER BY t.is_pinned DESC, t.updated_at DESC
        LIMIT ? OFFSET ?
      `,
      [category.id, limit, offset]
    );

    res.json({ category, threads: threads || [], limit, offset });
  } catch (err) {
    console.error('GET /api/forum/categories/:slug/threads:', err);
    res.status(500).json({ message: 'Không thể tải danh sách thread' });
  }
});

app.get('/api/forum/threads/:id', async (req, res) => {
  try {
    const threadId = parseInt(req.params.id, 10);
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return res.status(400).json({ message: 'Thread id không hợp lệ' });
    }

    await db.query(`UPDATE forum_threads SET view_count = view_count + 1 WHERE id = ?`, [threadId]);

    const [rows] = await db.query(
      `
        SELECT
          t.id,
          t.category_id,
          cat.slug AS category_slug,
          cat.name AS category_name,
          t.title,
          t.body_markdown,
          t.is_pinned,
          t.is_locked,
          t.view_count,
          t.created_at,
          t.updated_at,
          u.id AS author_user_id,
          u.username,
          u.role AS author_role,
          u.online_status AS author_online_status,
          up.display_name,
          up.avatar_url
        FROM forum_threads t
        JOIN forum_categories cat ON cat.id = t.category_id
        JOIN users u ON u.id = t.author_user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE t.id = ?
        LIMIT 1
      `,
      [threadId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy thread' });
    const thread = rows[0];

    const [comments] = await db.query(
      `
        SELECT
          c.id,
          c.thread_id,
          c.parent_comment_id,
          c.body_markdown,
          c.created_at,
          c.updated_at,
          u.id AS author_user_id,
          u.username,
          u.role AS author_role,
          u.online_status AS author_online_status,
          up.display_name,
          up.avatar_url
        FROM forum_comments c
        JOIN users u ON u.id = c.author_user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE c.thread_id = ?
        ORDER BY c.created_at ASC, c.id ASC
      `,
      [threadId]
    );

    res.json({ thread, comments: comments || [] });
  } catch (err) {
    console.error('GET /api/forum/threads/:id:', err);
    res.status(500).json({ message: 'Không thể tải thread' });
  }
});

app.get('/api/forum/my/threads', async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const [threads] = await db.query(
      `
        SELECT
          t.id,
          t.title,
          t.is_pinned,
          t.is_locked,
          t.view_count,
          t.created_at,
          t.updated_at,
          cat.slug AS category_slug,
          cat.name AS category_name,
          (
            SELECT COUNT(*)
            FROM forum_comments c
            WHERE c.thread_id = t.id
          ) AS comment_count
        FROM forum_threads t
        JOIN forum_categories cat ON cat.id = t.category_id
        WHERE t.author_user_id = ?
        ORDER BY t.updated_at DESC
        LIMIT ? OFFSET ?
      `,
      [userId, limit, offset]
    );
    res.json({ threads: threads || [], limit, offset });
  } catch (err) {
    console.error('GET /api/forum/my/threads:', err);
    res.status(500).json({ message: 'Không thể tải bài của bạn' });
  }
});

app.post('/api/forum/threads', async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const categorySlug = String(req.body?.categorySlug || '').trim();
    const title = String(req.body?.title || '').trim();
    const bodyMarkdown = String(req.body?.content || '').trim();

    if (!categorySlug || !title || !bodyMarkdown) {
      return res.status(400).json({ message: 'Thiếu categorySlug/title/content' });
    }
    if (title.length < 4 || title.length > 180) {
      return res.status(400).json({ message: 'Title phải từ 4 đến 180 ký tự' });
    }
    if (bodyMarkdown.length < 10) {
      return res.status(400).json({ message: 'Nội dung quá ngắn' });
    }

    const [cats] = await db.query(`SELECT id, slug FROM forum_categories WHERE slug = ? LIMIT 1`, [categorySlug]);
    if (!cats.length) return res.status(404).json({ message: 'Category không tồn tại' });

    const [result] = await db.query(
      `
        INSERT INTO forum_threads (category_id, author_user_id, title, body_markdown)
        VALUES (?, ?, ?, ?)
      `,
      [cats[0].id, userId, title, bodyMarkdown]
    );
    const threadId = result.insertId;
    res.json({ success: true, threadId });
  } catch (err) {
    console.error('POST /api/forum/threads:', err);
    res.status(500).json({ message: 'Không thể tạo thread' });
  }
});

app.put('/api/forum/threads/:id', async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const threadId = parseInt(req.params.id, 10);
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return res.status(400).json({ message: 'Thread id không hợp lệ' });
    }

    const title = String(req.body?.title || '').trim();
    const bodyMarkdown = String(req.body?.content || '').trim();
    if (!title || !bodyMarkdown) return res.status(400).json({ message: 'Thiếu title/content' });
    if (title.length < 4 || title.length > 180) {
      return res.status(400).json({ message: 'Title phải từ 4 đến 180 ký tự' });
    }
    if (bodyMarkdown.length < 10) return res.status(400).json({ message: 'Nội dung quá ngắn' });

    const perm = await canManageForumThread(userId, threadId);
    if (!perm.ok && perm.reason === 'NOT_FOUND') return res.status(404).json({ message: 'Thread không tồn tại' });
    if (!perm.ok) return res.status(403).json({ message: 'Bạn không có quyền sửa thread này' });

    await db.query(
      `
        UPDATE forum_threads
        SET title = ?, body_markdown = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [title, bodyMarkdown, threadId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/forum/threads/:id:', err);
    res.status(500).json({ message: 'Không thể sửa thread' });
  }
});

app.delete('/api/forum/threads/:id', async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const threadId = parseInt(req.params.id, 10);
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return res.status(400).json({ message: 'Thread id không hợp lệ' });
    }

    const perm = await canManageForumThread(userId, threadId);
    if (!perm.ok && perm.reason === 'NOT_FOUND') return res.status(404).json({ message: 'Thread không tồn tại' });
    if (!perm.ok) return res.status(403).json({ message: 'Bạn không có quyền xóa thread này' });

    await db.query(`DELETE FROM forum_threads WHERE id = ?`, [threadId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/forum/threads/:id:', err);
    res.status(500).json({ message: 'Không thể xóa thread' });
  }
});

app.post('/api/forum/threads/:id/comments', async (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    const threadId = parseInt(req.params.id, 10);
    const bodyMarkdown = String(req.body?.content || '').trim();
    const parentCommentIdRaw = req.body?.parentCommentId;
    const parentCommentId =
      parentCommentIdRaw == null || parentCommentIdRaw === ''
        ? null
        : parseInt(parentCommentIdRaw, 10);

    if (!Number.isFinite(threadId) || threadId <= 0) {
      return res.status(400).json({ message: 'Thread id không hợp lệ' });
    }
    if (!bodyMarkdown || bodyMarkdown.length < 1) {
      return res.status(400).json({ message: 'Thiếu nội dung comment' });
    }

    const [threadRows] = await db.query(`SELECT id, is_locked FROM forum_threads WHERE id = ? LIMIT 1`, [threadId]);
    if (!threadRows.length) return res.status(404).json({ message: 'Thread không tồn tại' });
    if (Number(threadRows[0].is_locked) === 1) return res.status(403).json({ message: 'Thread đã bị khóa' });

    if (parentCommentId != null) {
      if (!Number.isFinite(parentCommentId) || parentCommentId <= 0) {
        return res.status(400).json({ message: 'parentCommentId không hợp lệ' });
      }
      const [parentRows] = await db.query(
        `SELECT id FROM forum_comments WHERE id = ? AND thread_id = ? LIMIT 1`,
        [parentCommentId, threadId]
      );
      if (!parentRows.length) return res.status(400).json({ message: 'Parent comment không tồn tại' });
    }

    const [result] = await db.query(
      `
        INSERT INTO forum_comments (thread_id, author_user_id, parent_comment_id, body_markdown)
        VALUES (?, ?, ?, ?)
      `,
      [threadId, userId, parentCommentId, bodyMarkdown]
    );

    await db.query(`UPDATE forum_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [threadId]);

    res.json({ success: true, commentId: result.insertId });
  } catch (err) {
    console.error('POST /api/forum/threads/:id/comments:', err);
    res.status(500).json({ message: 'Không thể gửi comment' });
  }
});

app.post('/api/forum/upload-image', (req, res) => {
  try {
    const userId = requireAuthUserId(req, res);
    if (!userId) return;

    forumUpload.single('image')(req, res, (err) => {
      if (err) {
        console.error('Forum upload error:', err);
        return res.status(400).json({ message: 'Upload thất bại' });
      }
      if (!req.file) return res.status(400).json({ message: 'Thiếu file' });

      // URL public cho frontend: /images/forum/threads/<filename>
      const url = `/images/forum/threads/${req.file.filename}`;
      res.json({ success: true, url });
    });
  } catch (err) {
    console.error('POST /api/forum/upload-image:', err);
    res.status(500).json({ message: 'Upload thất bại' });
  }
});

// API endpoints sẽ được thêm vào đây

// Site Configuration API Endpoints
app.get('/api/site-config/pages', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM site_pages ORDER BY created_at ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching site pages:', error);
    res.status(500).json({ error: 'Failed to fetch site pages' });
  }
});

app.get('/api/site-config/pages/:path', async (req, res) => {
  try {
    const { path } = req.params;
    const [rows] = await db.query('SELECT * FROM site_pages WHERE path = ?', [path]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    const page = rows[0];
    
    // Lấy custom elements cho trang này
    const [elementRows] = await db.query(
      'SELECT * FROM site_custom_elements WHERE page_id = ? ORDER BY sort_order ASC',
      [page.id]
    );
    
    res.json({
      ...page,
      customElements: elementRows
    });
  } catch (error) {
    console.error('Error fetching page config:', error);
    res.status(500).json({ error: 'Failed to fetch page config' });
  }
});

app.post('/api/site-config/pages', async (req, res) => {
  try {

    const { id, path, name, component, config } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO site_pages (id, path, name, component, config) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       name = VALUES(name), 
       component = VALUES(component), 
       config = VALUES(config),
       updated_at = CURRENT_TIMESTAMP`,
      [id, path, name, component, JSON.stringify(config)]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error saving page config:', error);
    res.status(500).json({ error: 'Failed to save page config' });
  }
});

app.post('/api/site-config/elements', async (req, res) => {
  try {
    const { pageId, elements } = req.body;
    
    // Xóa elements cũ
    await db.query('DELETE FROM site_custom_elements WHERE page_id = ?', [pageId]);
    
    // Thêm elements mới
    if (elements && elements.length > 0) {
      const values = elements.map((element, index) => [
        element.id,
        pageId,
        element.type,
        element.content || null,
        element.imageSrc || null,
        element.imageAlt || null,
        JSON.stringify(element.styles),
        index
      ]);
      
      await db.query(
        `INSERT INTO site_custom_elements 
         (id, page_id, element_type, content, image_src, image_alt, styles, sort_order) 
         VALUES ?`,
        [values]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving custom elements:', error);
    res.status(500).json({ error: 'Failed to save custom elements' });
  }
});

app.get('/api/site-config/saved-configs', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sc.*, sp.name as page_name 
      FROM site_saved_configs sc
      JOIN site_pages sp ON sc.page_id = sp.id
      ORDER BY sc.created_at DESC
    `);
    
    // Parse JSON fields
    const parsedRows = rows.map(row => ({
      ...row,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      customElements: typeof row.custom_elements === 'string' ? JSON.parse(row.custom_elements) : row.custom_elements
    }));
    
    res.json(parsedRows);
  } catch (error) {
    console.error('Error fetching saved configs:', error);
    res.status(500).json({ error: 'Failed to fetch saved configs' });
  }
});

app.post('/api/site-config/saved-configs', async (req, res) => {
  try {

    const { id, name, pageId, config, customElements } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO site_saved_configs (id, name, page_id, config, custom_elements, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
       name = VALUES(name),
       page_id = VALUES(page_id),
       config = VALUES(config),
       custom_elements = VALUES(custom_elements)`,
      [id, name, pageId, JSON.stringify(config), JSON.stringify(customElements)]
    );
    
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.delete('/api/site-config/saved-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM site_saved_configs WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved config:', error);
    res.status(500).json({ error: 'Failed to delete saved config' });
  }
});

// ---------- Trung tâm giải trí — vòng quay (helpers) ----------
const LUCKY_WHEEL_SERVER_HISTORY_MAX = 500;

function luckyWheelRandIntInclusive(min, max) {
  let a = Math.ceil(Number(min));
  let b = Math.floor(Number(max));
  if (!Number.isFinite(a)) a = 0;
  if (!Number.isFinite(b)) b = a;
  if (b < a) {
    const t = a;
    a = b;
    b = t;
  }
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

/** Một vòng Đoán số: so sánh số ẩn với mốc pivot (client chỉ thấy pivot). */
function guessNumberBuildRound(minS, maxS) {
  let min = Math.ceil(Number(minS));
  let max = Math.floor(Number(maxS));
  if (!Number.isFinite(min)) min = 1;
  if (!Number.isFinite(max)) max = 99;
  if (max < min) {
    const t = min;
    min = max;
    max = t;
  }
  if (min >= max) return null;
  let secret = luckyWheelRandIntInclusive(min, max);
  let pivot = luckyWheelRandIntInclusive(min, max);
  let guard = 0;
  while (pivot === secret && guard < 50) {
    pivot = luckyWheelRandIntInclusive(min, max);
    secret = luckyWheelRandIntInclusive(min, max);
    guard += 1;
  }
  if (pivot === secret) {
    pivot = secret === min ? min + 1 : secret - 1;
  }
  return { secret, pivot, minS: min, maxS: max };
}

/** Chuỗi khóa kỳ “ngày game” theo lần reset gần nhất (global_reset_time). */
function luckyWheelDailyPeriodKey(now, resetHm) {
  const [rh, rm] = String(resetHm || '19:00')
    .trim()
    .split(':')
    .map((x) => parseInt(x, 10) || 0);
  const t = new Date(now.getTime());
  const anchor = new Date(t.getFullYear(), t.getMonth(), t.getDate(), rh, rm, 0, 0);
  if (t.getTime() < anchor.getTime()) {
    anchor.setDate(anchor.getDate() - 1);
  }
  return String(anchor.getTime());
}

function luckyWheelPickSegmentIndex(segments) {
  if (!segments?.length) return 0;
  const total = segments.reduce((s, x) => s + (Number(x.weight) || 1), 0);
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i += 1) {
    r -= Number(segments[i].weight) || 1;
    if (r <= 0) return i;
  }
  return 0;
}

async function luckyWheelFetchGlobalResetHm(conn) {
  const [resetRows] = await conn.query(
    `SELECT config_value FROM global_config WHERE config_key = 'global_reset_time' LIMIT 1`
  );
  if (!resetRows.length) return '19:00';
  return String(resetRows[0].config_value || '19:00').trim() || '19:00';
}

function luckyWheelFormatPrizeLog(seg, rewardMeta) {
  const label = String(seg?.label ?? '').trim() || '—';
  const rarity = String(seg?.rarity ?? '').trim();
  const base = rarity ? `${label} (${rarity})` : label;
  const c = String(seg?.currency || '').toLowerCase();
  if (c === 'peta' || c === 'petagold') {
    const amt = rewardMeta?.amount;
    const unit = c === 'peta' ? 'Peta' : 'Peta Gold';
    if (Number.isFinite(amt)) return `${base} — ${amt} ${unit}`;
    return base;
  }
  /** Chỉ thêm tên DB khi khác label ô quay — tránh "Tên (Hiếm) — Tên" */
  if (rewardMeta?.itemName) {
    const itemName = String(rewardMeta.itemName).trim();
    if (
      itemName &&
      itemName.toLowerCase() !== label.toLowerCase()
    ) {
      return `${base} — ${itemName}`;
    }
  }
  return base;
}

async function luckyWheelGrantReward(conn, userId, seg) {
  const cur = String(seg.currency || '').toLowerCase();
  if (cur === 'peta') {
    const amount = luckyWheelRandIntInclusive(seg.amountMin, seg.amountMax);
    await conn.query('UPDATE users SET peta = peta + ? WHERE id = ?', [amount, userId]);
    try {
      await titleService.recordPetaEarned(conn, userId, amount);
    } catch (e) {
      console.error('title earn (lucky wheel):', e);
    }
    return { kind: 'peta', amount };
  }
  if (cur === 'petagold') {
    const amount = luckyWheelRandIntInclusive(seg.amountMin, seg.amountMax);
    await conn.query('UPDATE users SET petagold = petagold + ? WHERE id = ?', [amount, userId]);
    return { kind: 'petagold', amount };
  }
  const itemId = seg.itemId != null ? parseInt(seg.itemId, 10) : NaN;
  if (!Number.isFinite(itemId) || itemId <= 0) {
    const err = new Error('ITEM_NOT_CONFIGURED');
    err.code = 'ITEM_NOT_CONFIGURED';
    throw err;
  }
  await grantMailItemsToInventory(conn, userId, itemId, 1, {
    overflowToMail: true,
    mailMeta: {
      subject: 'Túi đồ đầy — phần thưởng Vòng quay',
      message:
        'Túi đồ đã đầy nên phần thưởng Vòng quay được gửi vào thư. Dọn túi rồi nhận đính kèm.',
      senderName: 'Vòng quay may mắn',
    },
  });
  const [nameRows] = await conn.query('SELECT name FROM items WHERE id = ?', [itemId]);
  const itemName = nameRows.length ? nameRows[0].name : `Item #${itemId}`;
  return { kind: 'item', itemId, quantity: 1, itemName };
}

function luckyWheelPrependHistory(gcConfig, username, prizeLine) {
  const timeStr = new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const entry = { user: username, prize: prizeLine, time: timeStr };
  const prev = Array.isArray(gcConfig.luckyWheel?.serverHistory) ? gcConfig.luckyWheel.serverHistory : [];
  gcConfig.luckyWheel.serverHistory = [entry, ...prev].slice(0, LUCKY_WHEEL_SERVER_HISTORY_MAX);
  return gcConfig.luckyWheel.serverHistory;
}

// ---------- Trung tâm giải trí (config công khai) ----------
app.get('/api/game-center/config', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1'
    );
    let stored = null;
    if (rows.length) {
      const c = rows[0].config;
      if (c == null) stored = null;
      else if (typeof c === 'string') {
        try {
          stored = JSON.parse(c);
        } catch {
          stored = null;
        }
      } else if (typeof c === 'object') {
        stored = c;
      }
    }
    res.json(mergeGameCenterConfig(stored));
  } catch (error) {
    console.error('GET /api/game-center/config', error);
    res.json(getDefaultGameCenterConfig());
  }
});

function parseStoredJsonConfig(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
}

// ---------- Region maps (spot path / huntingMapId) ----------
app.get('/api/region-maps/config', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT config FROM site_region_maps_config WHERE id = 1 LIMIT 1'
    );
    const stored = rows.length ? parseStoredJsonConfig(rows[0].config) : null;
    res.json(mergeRegionMapsConfig(stored));
  } catch (error) {
    console.error('GET /api/region-maps/config', error);
    res.json(getDefaultRegionMapsConfig());
  }
});

/**
 * GET /api/game-center/lucky-wheel/status
 * Lượt đã quay / max trong kỳ hiện tại (reset theo global_reset_time).
 */
app.get('/api/game-center/lucky-wheel/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;

    const [resetRows] = await db.query(
      `SELECT config_value FROM global_config WHERE config_key = 'global_reset_time' LIMIT 1`
    );
    const resetHm = resetRows.length
      ? String(resetRows[0].config_value || '19:00').trim() || '19:00'
      : '19:00';
    const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

    const [userRows] = await db.query(
      `SELECT lucky_wheel_period_key, lucky_wheel_spins FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!userRows.length) return res.status(404).json({ error: 'Không tìm thấy người chơi' });

    let spinsUsed = Number(userRows[0].lucky_wheel_spins) || 0;
    if (String(userRows[0].lucky_wheel_period_key || '') !== periodKey) {
      spinsUsed = 0;
    }

    const [gcRows] = await db.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1');
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') {
        storedGc = c;
      }
    }
    const gcConfig = mergeGameCenterConfig(storedGc);
    const maxSpins = Math.max(1, parseInt(gcConfig.luckyWheel?.maxPurchasesPerDay, 10) || 2);

    res.json({
      spinsUsedToday: spinsUsed,
      maxSpinsPerDay: maxSpins,
    });
  } catch (error) {
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error: 'DB chưa có cột lucky_wheel (chạy migration db/migrations/20260504_lucky_wheel_daily.sql).',
      });
    }
    console.error('GET /api/game-center/lucky-wheel/status', error);
    res.status(500).json({ error: 'Lỗi tải trạng thái vòng quay' });
  }
});

/**
 * POST /api/game-center/lucky-wheel/spin
 * Random có trọng số trên server, giới hạn lượt/ngày (theo global_reset_time), cộng thưởng + ghi lịch sử.
 */
app.post('/api/game-center/lucky-wheel/spin', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập để quay' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const resetHm = await luckyWheelFetchGlobalResetHm(conn);
    const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

    const [userRows] = await conn.query(
      `SELECT id, username, lucky_wheel_period_key, lucky_wheel_spins FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const u = userRows[0];
    const username = String(u.username || '').trim() || `User#${userId}`;

    let spins = Number(u.lucky_wheel_spins) || 0;
    if (String(u.lucky_wheel_period_key || '') !== periodKey) {
      spins = 0;
      await conn.query('UPDATE users SET lucky_wheel_period_key = ?, lucky_wheel_spins = 0 WHERE id = ?', [
        periodKey,
        userId,
      ]);
    }

    const [gcRows] = await conn.query(
      'SELECT config FROM site_game_center_config WHERE id = 1 FOR UPDATE'
    );
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') {
        storedGc = c;
      }
    }

    const gcConfig = mergeGameCenterConfig(storedGc);
    const lw = gcConfig.luckyWheel;
    const maxSpins = Math.max(1, parseInt(lw.maxPurchasesPerDay, 10) || 2);
    const segments = buildLuckyWheelSegments(lw);

    if (segments.length < 2) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cấu hình vòng quay chưa đủ ô' });
    }

    if (spins >= maxSpins) {
      await conn.rollback();
      return res.status(429).json({
        error: 'Đã hết lượt quay trong kỳ hiện tại',
        spinsUsedToday: spins,
        maxSpinsPerDay: maxSpins,
      });
    }

    const segmentIndex = luckyWheelPickSegmentIndex(segments);
    const wonSeg = segments[segmentIndex];

    let rewardMeta;
    try {
      rewardMeta = await luckyWheelGrantReward(conn, userId, wonSeg);
    } catch (e) {
      await conn.rollback();
      if (e.code === 'ITEM_NOT_CONFIGURED') {
        return res.status(400).json({ error: 'Ô trúng chưa gán vật phẩm (itemId) trên Admin' });
      }
      throw e;
    }

    const newSpins = spins + 1;
    await conn.query(
      'UPDATE users SET lucky_wheel_spins = ?, lucky_wheel_period_key = ? WHERE id = ?',
      [newSpins, periodKey, userId]
    );

    const prizeLine = luckyWheelFormatPrizeLog(wonSeg, rewardMeta);
    const serverHistory = luckyWheelPrependHistory(gcConfig, username, prizeLine);
    await conn.query(
      `INSERT INTO site_game_center_config (id, config) VALUES (1, ?)
       ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(gcConfig)]
    );

    await conn.commit();

    const cur = String(wonSeg.currency || '').toLowerCase();
    const rolled =
      cur === 'peta' || cur === 'petagold' ? rewardMeta.amount : null;
    const lastWin = {
      ...wonSeg,
      amountMin: rolled != null ? rolled : wonSeg.amountMin,
      amountMax: rolled != null ? rolled : wonSeg.amountMax,
    };

    res.json({
      success: true,
      segmentIndex,
      reward: rewardMeta,
      lastWin,
      spinsUsedToday: newSpins,
      maxSpinsPerDay: maxSpins,
      serverHistory,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error: 'DB chưa có cột lucky_wheel (chạy migration db/migrations/20260504_lucky_wheel_daily.sql).',
      });
    }
    console.error('POST /api/game-center/lucky-wheel/spin', error);
    res.status(500).json({ error: 'Không quay được vòng quay' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * GET /api/game-center/scratch/status
 * Lượt đã mua / giới hạn vé 3 ô & 5 ô trong kỳ (theo global_reset_time).
 */
app.get('/api/game-center/scratch/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;
    const conn = await db.getConnection();
    try {
      const resetHm = await luckyWheelFetchGlobalResetHm(conn);
      const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);
      const [rows] = await conn.query(
        `SELECT scratch_daily_period_key, scratch_daily_buys_3, scratch_daily_buys_5, scratch_pending_json
         FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy người chơi' });
      const u = rows[0];
      let buys3 = Number(u.scratch_daily_buys_3) || 0;
      let buys5 = Number(u.scratch_daily_buys_5) || 0;
      if (String(u.scratch_daily_period_key || '') !== periodKey) {
        buys3 = 0;
        buys5 = 0;
      }
      let storedGc = null;
      const [gcRows] = await conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1');
      if (gcRows.length && gcRows[0].config != null) {
        const c = gcRows[0].config;
        if (typeof c === 'string') {
          try {
            storedGc = JSON.parse(c);
          } catch {
            storedGc = null;
          }
        } else if (typeof c === 'object') storedGc = c;
      }
      const gcConfig = mergeGameCenterConfig(storedGc);
      const sl = gcConfig.scratchLottery || {};
      const max3 = Math.max(0, parseInt(sl.ticket3?.dailyBuyLimit, 10) || 0);
      const max5 = Math.max(0, parseInt(sl.ticket5?.dailyBuyLimit, 10) || 0);
      const pend = parsePending(u.scratch_pending_json);
      let pendingResume = null;
      if (pend && Array.isArray(pend.ids) && (pend.mode === 3 || pend.mode === 5)) {
        pendingResume = {
          mode: pend.mode,
          ids: pend.ids,
        };
      }

      res.json({
        periodKey,
        buysToday3: buys3,
        buysToday5: buys5,
        maxBuysPerDay3: max3,
        maxBuysPerDay5: max5,
        hasPendingTicket: !!pend,
        pendingResume,
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột scratch (chạy migration db/migrations/20260506_scratch_lottery_daily.sql).',
      });
    }
    console.error('GET /api/game-center/scratch/status', error);
    res.status(500).json({ error: 'Lỗi tải trạng thái vé cào' });
  }
});

/**
 * POST /api/game-center/scratch/purchase { mode: 3 | 5 }
 * Trừ Peta, tăng lượt/ngày, lưu vé chờ claim (JSON).
 */
app.post('/api/game-center/scratch/purchase', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;
    const mode = parseInt(req.body?.mode, 10);
    if (mode !== 3 && mode !== 5) return res.status(400).json({ error: 'mode phải là 3 hoặc 5' });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const resetHm = await luckyWheelFetchGlobalResetHm(conn);
    const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

    const [userRows] = await conn.query(
      `SELECT id, peta, scratch_daily_period_key, scratch_daily_buys_3, scratch_daily_buys_5, scratch_pending_json
       FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const u = userRows[0];

    if (parsePending(u.scratch_pending_json)) {
      await conn.rollback();
      return res.status(409).json({ error: 'Bạn đang có vé chưa nhận thưởng. Hãy cào xong vé hiện tại.' });
    }

    let buys3 = Number(u.scratch_daily_buys_3) || 0;
    let buys5 = Number(u.scratch_daily_buys_5) || 0;
    if (String(u.scratch_daily_period_key || '') !== periodKey) {
      buys3 = 0;
      buys5 = 0;
      await conn.query(
        'UPDATE users SET scratch_daily_period_key = ?, scratch_daily_buys_3 = 0, scratch_daily_buys_5 = 0 WHERE id = ?',
        [periodKey, userId]
      );
    }

    const [gcRows] = await conn.query('SELECT config FROM site_game_center_config WHERE id = 1 FOR UPDATE');
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') storedGc = c;
    }
    const gcConfig = mergeGameCenterConfig(storedGc);
    const sl = gcConfig.scratchLottery;
    const t = mode === 3 ? sl?.ticket3 : sl?.ticket5;
    const maxBuys = Math.max(0, parseInt(t?.dailyBuyLimit, 10) || 0);
    const buys = mode === 3 ? buys3 : buys5;
    if (maxBuys > 0 && buys >= maxBuys) {
      await conn.rollback();
      return res.status(429).json({ error: 'Đã hết lượt mua vé trong kỳ hiện tại', maxBuysPerDay: maxBuys });
    }

    const price = Math.max(0, Number(t?.pricePeta) || 0);
    const petaBal = Number(u.peta) || 0;
    if (petaBal < price) {
      await conn.rollback();
      return res.status(402).json({ error: 'Không đủ Peta', petaRemaining: petaBal, pricePeta: price });
    }

    const ticket = buildScratchTicketFromConfig(sl, Array.isArray(sl?.symbols) ? sl.symbols : [], mode);
    if (!ticket) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cấu hình vé cào chưa hợp lệ (ticket3/ticket5)' });
    }

    const pendingPayload = JSON.stringify(ticket);
    const newBuys = buys + 1;
    const col = mode === 3 ? 'scratch_daily_buys_3' : 'scratch_daily_buys_5';

    await conn.query(
      `UPDATE users SET peta = peta - ?, scratch_pending_json = ?, ${col} = ?, scratch_daily_period_key = ? WHERE id = ?`,
      [price, pendingPayload, newBuys, periodKey, userId]
    );

    await conn.commit();

    const [[after]] = await db.query(
      `SELECT scratch_daily_buys_3, scratch_daily_buys_5, peta FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const petaRemaining = Number(after.peta) || 0;

    res.json({
      success: true,
      mode: ticket.mode,
      ids: ticket.ids,
      petaRemaining,
      buysToday3: Number(after.scratch_daily_buys_3) || 0,
      buysToday5: Number(after.scratch_daily_buys_5) || 0,
      maxBuysPerDay3: Math.max(0, parseInt(sl.ticket3?.dailyBuyLimit, 10) || 0),
      maxBuysPerDay5: Math.max(0, parseInt(sl.ticket5?.dailyBuyLimit, 10) || 0),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột scratch (chạy migration db/migrations/20260506_scratch_lottery_daily.sql).',
      });
    }
    console.error('POST /api/game-center/scratch/purchase', error);
    res.status(500).json({ error: 'Không mua được vé cào' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * POST /api/game-center/scratch/claim { revealedIndices: number[] }
 * Xác nhận đã cào đủ ô trùng — cộng Peta và xóa pending.
 */
app.post('/api/game-center/scratch/claim', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;
    const revealedRaw = req.body?.revealedIndices;
    const revealedIndices = Array.isArray(revealedRaw) ? revealedRaw : [];

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [userRows] = await conn.query(
      `SELECT id, scratch_pending_json FROM users WHERE id = ? FOR UPDATE`,
      [userId]
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }

    const pending = parsePending(userRows[0].scratch_pending_json);
    if (!pending || !Array.isArray(pending.ids)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Không có vé chờ nhận thưởng' });
    }

    const { ids, winSymbolId, rewardPeta, requiredMatch } = pending;
    const count = ids.length;

    const uniq = [
      ...new Set(
        revealedIndices
          .map((x) => parseInt(x, 10))
          .filter((i) => Number.isFinite(i) && i >= 0 && i < count),
      ),
    ];

    let winSeen = 0;
    for (const i of uniq) {
      if (ids[i] === winSymbolId) winSeen += 1;
    }

    const need = parseInt(requiredMatch, 10) || 0;
    if (winSeen < need) {
      await conn.rollback();
      return res.status(400).json({
        error: `Cần cào mở ít nhất ${need} ô trùng đúng biểu tượng trúng`,
      });
    }

    const granted = Math.max(0, Number(rewardPeta) || 0);

    await conn.query('UPDATE users SET peta = peta + ?, scratch_pending_json = NULL WHERE id = ?', [
      granted,
      userId,
    ]);
    try {
      if (granted > 0) await titleService.recordPetaEarned(conn, userId, granted);
    } catch (e) {
      console.error('title earn (scratch):', e);
    }

    await conn.commit();

    const [[row]] = await db.query(`SELECT peta FROM users WHERE id = ? LIMIT 1`, [userId]);
    const petaRemaining = Number(row?.peta) || 0;

    res.json({
      success: true,
      grantedPeta: granted,
      petaRemaining,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột scratch (chạy migration db/migrations/20260506_scratch_lottery_daily.sql).',
      });
    }
    console.error('POST /api/game-center/scratch/claim', error);
    res.status(500).json({ error: 'Không nhận được thưởng' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * GET /api/game-center/beggar-king/status
 * Cấu hình Vua ăn mày + cooldown theo user (nếu có token).
 */
app.get('/api/game-center/beggar-king/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      } catch (_) {
        userId = null;
      }
    }

    const [gcRows] = await db.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1');
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') storedGc = c;
    }
    const gcConfig = mergeGameCenterConfig(storedGc);
    const bk = gcConfig.beggarKing || {};
    const minPeta = Math.max(0, Number(bk.minPeta) || 100);
    const maxPeta = Math.max(minPeta, Number(bk.maxPeta) || 5000);
    const cooldownHours = Math.max(0, Number(bk.cooldownHours) || 6);
    const cooldownMs = cooldownHours * 3600 * 1000;

    let lastClaimMs = null;
    if (userId) {
      try {
        const [rows] = await db.query(
          'SELECT beggar_king_last_claim_ms FROM users WHERE id = ? LIMIT 1',
          [userId],
        );
        if (rows.length && rows[0].beggar_king_last_claim_ms != null) {
          lastClaimMs = Number(rows[0].beggar_king_last_claim_ms);
        }
      } catch (e) {
        if (e && e.code === 'ER_BAD_FIELD_ERROR') {
          return res.status(503).json({
            error:
              'DB chưa có cột beggar_king (chạy migration db/migrations/20260507_beggar_king.sql hoặc npm run migrate:beggar-king).',
          });
        }
        throw e;
      }
    }

    const now = Date.now();
    let nextAvailableMs = null;
    let canClaim = false;
    if (userId) {
      if (lastClaimMs == null || !Number.isFinite(lastClaimMs)) {
        canClaim = true;
      } else {
        nextAvailableMs = lastClaimMs + cooldownMs;
        canClaim = now >= nextAvailableMs;
      }
    }

    res.json({
      minPeta,
      maxPeta,
      cooldownHours,
      cooldownMs,
      lastClaimMs,
      nextAvailableMs: canClaim ? null : nextAvailableMs,
      canClaim: !!userId && canClaim,
      loggedIn: !!userId,
    });
  } catch (error) {
    console.error('GET /api/game-center/beggar-king/status', error);
    res.status(500).json({ error: 'Lỗi tải trạng thái Vua ăn mày' });
  }
});

/**
 * POST /api/game-center/beggar-king/claim
 * Random Peta trong [min,max], cooldown theo Admin — cộng vào users.peta.
 */
app.post('/api/game-center/beggar-king/claim', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập để nhận Peta' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [gcRows] = await conn.query(
      'SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1',
    );
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') storedGc = c;
    }
    const gcConfig = mergeGameCenterConfig(storedGc);
    const bk = gcConfig.beggarKing || {};
    const minPeta = Math.max(0, Number(bk.minPeta) || 100);
    const maxPeta = Math.max(minPeta, Number(bk.maxPeta) || 5000);
    const cooldownHours = Math.max(0, Number(bk.cooldownHours) || 6);
    const cooldownMs = cooldownHours * 3600 * 1000;

    const [userRows] = await conn.query(
      `SELECT id, peta, beggar_king_last_claim_ms FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const u = userRows[0];
    const lastMs =
      u.beggar_king_last_claim_ms != null ? Number(u.beggar_king_last_claim_ms) : null;
    const now = Date.now();
    if (lastMs != null && Number.isFinite(lastMs)) {
      const nextAt = lastMs + cooldownMs;
      if (now < nextAt) {
        await conn.rollback();
        return res.status(429).json({
          error: 'Chưa hết thời gian chờ',
          nextAvailableMs: nextAt,
        });
      }
    }

    const amount = luckyWheelRandIntInclusive(minPeta, maxPeta);
    await conn.query(
      'UPDATE users SET peta = peta + ?, beggar_king_last_claim_ms = ? WHERE id = ?',
      [amount, now, userId],
    );
    try {
      if (amount > 0) await titleService.recordPetaEarned(conn, userId, amount);
    } catch (e) {
      console.error('title earn (beggar king):', e);
    }

    await conn.commit();

    const [[row]] = await db.query(`SELECT peta FROM users WHERE id = ? LIMIT 1`, [userId]);
    const petaRemaining = Number(row?.peta) || 0;

    res.json({
      success: true,
      grantedPeta: amount,
      petaRemaining,
      nextAvailableMs: now + cooldownMs,
      minPeta,
      maxPeta,
      cooldownHours,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột beggar_king (chạy migration db/migrations/20260507_beggar_king.sql hoặc npm run migrate:beggar-king).',
      });
    }
    console.error('POST /api/game-center/beggar-king/claim', error);
    res.status(500).json({ error: 'Không nhận được Peta' });
  } finally {
    if (conn) conn.release();
  }
});

function guessNumberLoadConfig(conn) {
  return conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1').then(([gcRows]) => {
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') storedGc = c;
    }
    const gcConfig = mergeGameCenterConfig(storedGc);
    const gn = gcConfig.guessNumber || {};
    const minSecret = Math.max(0, Number(gn.minSecret) || 1);
    const maxSecret = Math.max(minSecret, Number(gn.maxSecret) || 99);
    const rewardPetaWin = Math.max(0, Number(gn.rewardPetaWin) || 10000);
    const penaltyPetaLose = Math.max(0, Number(gn.penaltyPetaLose) || 5000);
    const maxPlaysPerDay = Math.max(1, Math.min(500, parseInt(gn.maxPlaysPerDay, 10) || 10));
    return { minSecret, maxSecret, rewardPetaWin, penaltyPetaLose, maxPlaysPerDay };
  });
}

/**
 * GET /api/game-center/guess-number/status
 */
app.get('/api/game-center/guess-number/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      } catch (_) {
        userId = null;
      }
    }

    const conn = await db.getConnection();
    let cfg;
    try {
      cfg = await guessNumberLoadConfig(conn);
    } finally {
      conn.release();
    }

    const { minSecret, maxSecret, rewardPetaWin, penaltyPetaLose, maxPlaysPerDay } = cfg;

    let playsToday = 0;
    let pendingPivot = null;
    if (userId) {
      try {
        const c2 = await db.getConnection();
        try {
          const resetHm = await luckyWheelFetchGlobalResetHm(c2);
          const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);
          const [ur] = await c2.query(
            `SELECT guess_number_period_key, guess_number_daily_plays, guess_number_pending_json FROM users WHERE id = ? LIMIT 1`,
            [userId],
          );
          if (ur.length) {
            const u = ur[0];
            let p = Number(u.guess_number_daily_plays) || 0;
            if (String(u.guess_number_period_key || '') !== periodKey) p = 0;
            playsToday = p;
            const pend = parsePending(u.guess_number_pending_json);
            if (pend != null && Number.isFinite(Number(pend.pivot))) pendingPivot = Number(pend.pivot);
          }
        } finally {
          c2.release();
        }
      } catch (e) {
        if (e && e.code === 'ER_BAD_FIELD_ERROR') {
          return res.status(503).json({
            error:
              'DB chưa có cột guess_number (chạy migration db/migrations/20260508_guess_number_daily.sql hoặc npm run migrate:guess-number).',
          });
        }
        throw e;
      }
    }

    res.json({
      minSecret,
      maxSecret,
      rewardPetaWin,
      penaltyPetaLose,
      maxPlaysPerDay,
      playsToday,
      playsRemaining: userId != null ? Math.max(0, maxPlaysPerDay - playsToday) : null,
      pendingPivot,
      hasPending: pendingPivot != null,
      loggedIn: !!userId,
    });
  } catch (error) {
    console.error('GET /api/game-center/guess-number/status', error);
    res.status(500).json({ error: 'Lỗi tải trạng thái Đoán số' });
  }
});

/**
 * POST /api/game-center/guess-number/start-round
 * Tạo (hoặc trả lại) mốc pivot — không tính lượt cho đến khi submit.
 */
app.post('/api/game-center/guess-number/start-round', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const resetHm = await luckyWheelFetchGlobalResetHm(conn);
    const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

    const cfg = await guessNumberLoadConfig(conn);
    const { minSecret, maxSecret, maxPlaysPerDay } = cfg;
    const roundDef = guessNumberBuildRound(minSecret, maxSecret);
    if (!roundDef) {
      await conn.rollback();
      return res.status(400).json({ error: 'minSecret phải nhỏ hơn maxSecret trong Admin' });
    }

    const [userRows] = await conn.query(
      `SELECT id, guess_number_period_key, guess_number_daily_plays, guess_number_pending_json FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const u = userRows[0];

    let plays = Number(u.guess_number_daily_plays) || 0;
    if (String(u.guess_number_period_key || '') !== periodKey) {
      plays = 0;
      await conn.query(
        'UPDATE users SET guess_number_period_key = ?, guess_number_daily_plays = 0 WHERE id = ?',
        [periodKey, userId],
      );
    }

    const existing = parsePending(u.guess_number_pending_json);
    if (existing != null && Number.isFinite(Number(existing.pivot))) {
      await conn.commit();
      return res.json({
        pivot: Number(existing.pivot),
        minSecret,
        maxSecret,
        playsToday: plays,
        playsRemaining: Math.max(0, maxPlaysPerDay - plays),
        maxPlaysPerDay,
      });
    }

    if (plays >= maxPlaysPerDay) {
      await conn.rollback();
      return res.status(429).json({
        error: 'Đã hết lượt chơi trong kỳ hiện tại',
        playsToday: plays,
        maxPlaysPerDay,
      });
    }

    const payload = JSON.stringify({
      secret: roundDef.secret,
      pivot: roundDef.pivot,
      minS: roundDef.minS,
      maxS: roundDef.maxS,
    });
    await conn.query(
      'UPDATE users SET guess_number_pending_json = ?, guess_number_period_key = ? WHERE id = ?',
      [payload, periodKey, userId],
    );

    await conn.commit();

    res.json({
      pivot: roundDef.pivot,
      minSecret,
      maxSecret,
      playsToday: plays,
      playsRemaining: Math.max(0, maxPlaysPerDay - plays),
      maxPlaysPerDay,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột guess_number (chạy migration db/migrations/20260508_guess_number_daily.sql hoặc npm run migrate:guess-number).',
      });
    }
    console.error('POST /api/game-center/guess-number/start-round', error);
    res.status(500).json({ error: 'Không bắt đầu được vòng' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * POST /api/game-center/guess-number/submit { choice: 'high' | 'low' }
 */
app.post('/api/game-center/guess-number/submit', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;
    const choice = String(req.body?.choice || '').toLowerCase();
    if (choice !== 'high' && choice !== 'low') {
      return res.status(400).json({ error: 'choice phải là high hoặc low' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const resetHm = await luckyWheelFetchGlobalResetHm(conn);
    const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

    const cfg = await guessNumberLoadConfig(conn);
    const { rewardPetaWin, penaltyPetaLose, maxPlaysPerDay } = cfg;

    const [userRows] = await conn.query(
      `SELECT id, peta, guess_number_period_key, guess_number_daily_plays, guess_number_pending_json FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const u = userRows[0];

    let plays = Number(u.guess_number_daily_plays) || 0;
    if (String(u.guess_number_period_key || '') !== periodKey) {
      plays = 0;
      await conn.query(
        'UPDATE users SET guess_number_period_key = ?, guess_number_daily_plays = 0 WHERE id = ?',
        [periodKey, userId],
      );
    }

    const pending = parsePending(u.guess_number_pending_json);
    if (
      !pending ||
      !Number.isFinite(Number(pending.secret)) ||
      !Number.isFinite(Number(pending.pivot))
    ) {
      await conn.rollback();
      return res.status(400).json({ error: 'Chưa có vòng đoán — hãy bắt đầu vòng mới' });
    }

    const secret = Number(pending.secret);
    const pivot = Number(pending.pivot);
    const answerHigher = secret > pivot;
    const answerLower = secret < pivot;
    const correct =
      (choice === 'high' && answerHigher) || (choice === 'low' && answerLower);

    if (plays >= maxPlaysPerDay) {
      await conn.rollback();
      return res.status(429).json({
        error: 'Đã hết lượt chơi trong kỳ hiện tại',
        playsToday: plays,
        maxPlaysPerDay,
      });
    }

    const petaBal = Number(u.peta) || 0;
    if (!correct && penaltyPetaLose > 0 && petaBal < penaltyPetaLose) {
      await conn.rollback();
      return res.status(402).json({
        error: 'Không đủ Peta để trừ khi đoán sai',
        petaRemaining: petaBal,
        penaltyPetaLose,
      });
    }

    let delta = 0;
    if (correct) {
      delta = rewardPetaWin;
      if (delta > 0) {
        await conn.query('UPDATE users SET peta = peta + ? WHERE id = ?', [delta, userId]);
        try {
          await titleService.recordPetaEarned(conn, userId, delta);
        } catch (e) {
          console.error('title earn (guess number):', e);
        }
      }
    } else if (penaltyPetaLose > 0) {
      delta = -penaltyPetaLose;
      await conn.query('UPDATE users SET peta = GREATEST(0, peta - ?) WHERE id = ?', [
        penaltyPetaLose,
        userId,
      ]);
    }

    const newPlays = plays + 1;
    await conn.query(
      'UPDATE users SET guess_number_daily_plays = ?, guess_number_pending_json = NULL WHERE id = ?',
      [newPlays, userId],
    );

    await conn.commit();

    const [[row]] = await db.query(`SELECT peta FROM users WHERE id = ? LIMIT 1`, [userId]);
    const petaRemaining = Number(row?.peta) || 0;

    res.json({
      success: true,
      correct,
      secret,
      pivot,
      deltaPeta: delta,
      petaRemaining,
      rewardPetaWin,
      penaltyPetaLose,
      playsToday: newPlays,
      playsRemaining: Math.max(0, maxPlaysPerDay - newPlays),
      maxPlaysPerDay,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột guess_number (chạy migration db/migrations/20260508_guess_number_daily.sql hoặc npm run migrate:guess-number).',
      });
    }
    console.error('POST /api/game-center/guess-number/submit', error);
    res.status(500).json({ error: 'Không hoàn thành được vòng' });
  } finally {
    if (conn) conn.release();
  }
});

/** Gom item id theo rarity đã chuẩn hóa (cho Hộp bí ẩn). */
function mysteryBoxBuildRarityPools(itemRows) {
  const pools = { common: [], rare: [], epic: [], legendary: [] };
  for (const row of itemRows) {
    const k = normalizeItemRarity(row.rarity);
    if (pools[k]) pools[k].push(Number(row.id));
  }
  return pools;
}

function mysteryBoxPickWeightedRarity(rarityWeights, pools) {
  const viable = (rarityWeights || [])
    .map((rw) => ({
      rarity: normalizeItemRarity(rw.rarity),
      weight: Math.max(0, Number(rw.weight) || 0),
    }))
    .filter((x) => x.weight > 0 && (pools[x.rarity] || []).length > 0);
  if (!viable.length) return null;
  const total = viable.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of viable) {
    r -= x.weight;
    if (r <= 0) return x.rarity;
  }
  return viable[viable.length - 1].rarity;
}

function mysteryBoxPickRandomItemId(poolIds) {
  if (!poolIds?.length) return null;
  const idx = Math.floor(Math.random() * poolIds.length);
  return poolIds[idx];
}

async function mysteryBoxGrantItemToInventory(conn, playerId, itemId) {
  const result = await grantMailItemsToInventory(conn, playerId, itemId, 1, {
    overflowToMail: true,
    mailMeta: {
      subject: 'Túi đồ đầy — phần thưởng Hộp bí ẩn',
      message:
        'Túi đồ đã đầy nên phần thưởng Hộp bí ẩn được gửi vào thư. Dọn túi rồi nhận đính kèm.',
      senderName: 'Hộp bí ẩn',
    },
  });
  if (result.destination === 'none') {
    return { ok: false, error: 'Phần thưởng không tồn tại trong catalog' };
  }
  return { ok: true, destination: result.destination, mailed: result.mailed };
}

function mysteryBoxLoadGc(conn) {
  return conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1').then(([gcRows]) => {
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') storedGc = c;
    }
    return mergeGameCenterConfig(storedGc);
  });
}

/**
 * GET /api/game-center/mystery-box/status
 */
app.get('/api/game-center/mystery-box/status', async (req, res) => {
  try {
    const conn = await db.getConnection();
    let gcConfig;
    let itemRows;
    try {
      gcConfig = await mysteryBoxLoadGc(conn);
      const [rows] = await conn.query('SELECT id, rarity FROM items');
      itemRows = rows;
    } finally {
      conn.release();
    }

    const mb = gcConfig.mysteryBox || {};
    const rawWeights = Array.isArray(mb.rarityWeights) ? mb.rarityWeights : [];
    const normalized = rawWeights.map((rw) => ({
      rarity: normalizeItemRarity(rw.rarity),
      weight: Math.max(0, Number(rw.weight) || 0),
    }));
    const totalW = normalized.reduce((s, x) => s + x.weight, 0);
    const rarityWeights = normalized.map((x) => ({
      rarity: x.rarity,
      weight: x.weight,
      percent: totalW > 0 ? Math.round((10000 * x.weight) / totalW) / 100 : 0,
    }));

    const pools = mysteryBoxBuildRarityPools(itemRows);
    const poolCounts = {};
    for (const k of ['common', 'rare', 'epic', 'legendary']) {
      poolCounts[k] = (pools[k] || []).length;
    }

    res.json({
      rarityWeights,
      canonicalRarities: ['common', 'rare', 'epic', 'legendary'],
      poolCounts,
      /** Viable = có ít nhất 1 item trong DB cho rarity đó */
      viableRarities: ['common', 'rare', 'epic', 'legendary'].filter((k) => (pools[k] || []).length > 0),
    });
  } catch (error) {
    console.error('GET /api/game-center/mystery-box/status', error);
    res.status(500).json({ error: 'Lỗi tải Hộp bí ẩn' });
  }
});

/**
 * POST /api/game-center/mystery-box/exchange { inventoryId }
 * Tiêu thụ 1 đơn vị vật phẩm trong kho → random item theo tỉ lệ rarity (catalog).
 */
app.post('/api/game-center/mystery-box/exchange', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;
    const inventoryId = Number(req.body?.inventoryId);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ error: 'inventoryId không hợp lệ' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const gcConfig = await mysteryBoxLoadGc(conn);
    const mb = gcConfig.mysteryBox || {};
    const rarityWeights = Array.isArray(mb.rarityWeights) ? mb.rarityWeights : [];

    const [itemRows] = await conn.query('SELECT id, rarity FROM items');
    const pools = mysteryBoxBuildRarityPools(itemRows);

    const rolledRarity = mysteryBoxPickWeightedRarity(rarityWeights, pools);
    if (!rolledRarity) {
      await conn.rollback();
      return res.status(503).json({
        error:
          'Không có vật phẩm nào trong catalog cho các rarity đã cấu hình (hoặc bảng items trống).',
      });
    }

    const rewardPool = pools[rolledRarity] || [];
    const rewardItemId = mysteryBoxPickRandomItemId(rewardPool);
    if (rewardItemId == null) {
      await conn.rollback();
      return res.status(503).json({ error: `Không có item rarity ${rolledRarity} trong catalog.` });
    }

    const [invRows] = await conn.query(
      `SELECT i.id, i.player_id, i.quantity, i.is_equipped, i.item_id,
              it.name AS item_name, it.image_url AS consumed_image_url, it.rarity AS consumed_rarity
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.player_id = ?
       FOR UPDATE`,
      [inventoryId, userId],
    );

    if (!invRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy vật phẩm trong kho' });
    }

    const inv = invRows[0];
    if (Number(inv.is_equipped) === 1) {
      await conn.rollback();
      return res.status(400).json({ error: 'Không thể cho vào hộp vật phẩm đang trang bị' });
    }

    const qty = Number(inv.quantity) || 0;
    if (qty < 1) {
      await conn.rollback();
      return res.status(400).json({ error: 'Không đủ số lượng' });
    }

    if (qty <= 1) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [inventoryId]);
    } else {
      await conn.query('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?', [inventoryId]);
    }

    const grant = await mysteryBoxGrantItemToInventory(conn, userId, rewardItemId);
    if (!grant.ok) {
      await conn.rollback();
      return res.status(500).json({ error: grant.error || 'Không thêm được phần thưởng' });
    }

    await conn.commit();

    const [[rewardItem]] = await db.query(
      `SELECT id, name, image_url, rarity, type FROM items WHERE id = ? LIMIT 1`,
      [rewardItemId],
    );

    res.json({
      success: true,
      rolledRarity,
      consumed: {
        inventoryId,
        itemId: Number(inv.item_id),
        name: inv.item_name,
        rarity: normalizeItemRarity(inv.consumed_rarity),
        imageUrl: inv.consumed_image_url || '',
      },
      reward: rewardItem
        ? {
            itemId: rewardItem.id,
            name: rewardItem.name,
            image_url: rewardItem.image_url,
            rarity: normalizeItemRarity(rewardItem.rarity),
            type: rewardItem.type,
          }
        : null,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('POST /api/game-center/mystery-box/exchange', error);
    res.status(500).json({ error: 'Không đổi được hộp' });
  } finally {
    if (conn) conn.release();
  }
});

function dailyFreeLoadGc(conn) {
  return conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1').then(([gcRows]) => {
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') storedGc = c;
    }
    return mergeGameCenterConfig(storedGc);
  });
}

/** Random số lượng vật phẩm trong [min, max] cho quà miễn phí ngày. */
function dailyFreeRollItemCount(minS, maxS) {
  let a = Math.ceil(Number(minS));
  let b = Math.floor(Number(maxS));
  if (!Number.isFinite(a)) a = 1;
  if (!Number.isFinite(b)) b = a;
  if (b < a) {
    const t = a;
    a = b;
    b = t;
  }
  a = Math.max(1, Math.min(20, a));
  b = Math.max(a, Math.min(20, b));
  return luckyWheelRandIntInclusive(a, b);
}

/**
 * GET /api/game-center/daily-free/status
 */
app.get('/api/game-center/daily-free/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      } catch (_) {
        userId = null;
      }
    }

    const conn = await db.getConnection();
    let gcConfig;
    try {
      gcConfig = await dailyFreeLoadGc(conn);
    } finally {
      conn.release();
    }

    const df = gcConfig.dailyFree || {};
    const rawWeights = Array.isArray(df.rarityWeights) ? df.rarityWeights : [];
    const normalized = rawWeights.map((rw) => ({
      rarity: normalizeItemRarity(rw.rarity),
      weight: Math.max(0, Number(rw.weight) || 0),
    }));
    const totalW = normalized.reduce((s, x) => s + x.weight, 0);
    const rarityWeights = normalized.map((x) => ({
      rarity: x.rarity,
      weight: x.weight,
      percent: totalW > 0 ? Math.round((10000 * x.weight) / totalW) / 100 : 0,
    }));

    const minItemsPerClaim = Math.max(1, Math.min(20, parseInt(df.minItemsPerClaim, 10) || 1));
    const maxItemsPerClaim = Math.max(
      minItemsPerClaim,
      Math.min(20, parseInt(df.maxItemsPerClaim, 10) || minItemsPerClaim),
    );

    const [itemRows] = await db.query('SELECT id, rarity FROM items');
    const pools = mysteryBoxBuildRarityPools(itemRows);
    const poolCounts = {};
    for (const k of ['common', 'rare', 'epic', 'legendary']) {
      poolCounts[k] = (pools[k] || []).length;
    }

    let canClaim = null;
    let loggedIn = !!userId;
    if (userId) {
      try {
        const c2 = await db.getConnection();
        try {
          const resetHm = await luckyWheelFetchGlobalResetHm(c2);
          const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);
          const [ur] = await c2.query(
            `SELECT daily_free_last_claim_period_key FROM users WHERE id = ? LIMIT 1`,
            [userId],
          );
          if (ur.length) {
            const last = ur[0].daily_free_last_claim_period_key;
            canClaim = String(last || '') !== periodKey;
          } else {
            canClaim = true;
          }
        } finally {
          c2.release();
        }
      } catch (e) {
        if (e && e.code === 'ER_BAD_FIELD_ERROR') {
          return res.status(503).json({
            error:
              'DB chưa có cột daily_free (chạy migration db/migrations/20260510_daily_free_claim.sql hoặc npm run migrate:daily-free).',
          });
        }
        throw e;
      }
    }

    res.json({
      minItemsPerClaim,
      maxItemsPerClaim,
      rarityWeights,
      canonicalRarities: ['common', 'rare', 'epic', 'legendary'],
      poolCounts,
      viableRarities: ['common', 'rare', 'epic', 'legendary'].filter((k) => (pools[k] || []).length > 0),
      loggedIn,
      canClaim,
    });
  } catch (error) {
    console.error('GET /api/game-center/daily-free/status', error);
    res.status(500).json({ error: 'Lỗi tải Vật phẩm miễn phí' });
  }
});

/**
 * POST /api/game-center/daily-free/claim
 * Một lần mỗi kỳ (global_reset_time); random 1..N item theo rarityWeights + catalog.
 */
app.post('/api/game-center/daily-free/claim', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const resetHm = await luckyWheelFetchGlobalResetHm(conn);
    const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

    const gcConfig = await dailyFreeLoadGc(conn);
    const df = gcConfig.dailyFree || {};
    const rarityWeightsCfg = Array.isArray(df.rarityWeights) ? df.rarityWeights : [];
    const minItemsPerClaim = Math.max(1, Math.min(20, parseInt(df.minItemsPerClaim, 10) || 1));
    const maxItemsPerClaim = Math.max(
      minItemsPerClaim,
      Math.min(20, parseInt(df.maxItemsPerClaim, 10) || minItemsPerClaim),
    );

    const [userRows] = await conn.query(
      `SELECT id, daily_free_last_claim_period_key FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const u = userRows[0];
    if (String(u.daily_free_last_claim_period_key || '') === periodKey) {
      await conn.rollback();
      return res.status(429).json({ error: 'Bạn đã nhận quà trong kỳ hiện tại' });
    }

    const [itemRows] = await conn.query('SELECT id, rarity FROM items');
    const pools = mysteryBoxBuildRarityPools(itemRows);

    const n = dailyFreeRollItemCount(minItemsPerClaim, maxItemsPerClaim);
    const rewards = [];

    for (let i = 0; i < n; i += 1) {
      const rolledRarity = mysteryBoxPickWeightedRarity(rarityWeightsCfg, pools);
      if (!rolledRarity) {
        await conn.rollback();
        return res.status(503).json({
          error:
            'Không có vật phẩm trong catalog cho các rarity đã cấu hình (hoặc items trống).',
        });
      }
      const rewardItemId = mysteryBoxPickRandomItemId(pools[rolledRarity]);
      if (rewardItemId == null) {
        await conn.rollback();
        return res.status(503).json({ error: `Không có item rarity ${rolledRarity} trong catalog.` });
      }
      const grant = await mysteryBoxGrantItemToInventory(conn, userId, rewardItemId);
      if (!grant.ok) {
        await conn.rollback();
        return res.status(500).json({ error: grant.error || 'Không thêm được vào kho' });
      }
      const [[rewardRow]] = await conn.query(
        `SELECT id, name, image_url, rarity, type FROM items WHERE id = ? LIMIT 1`,
        [rewardItemId],
      );
      if (rewardRow) {
        rewards.push({
          itemId: rewardRow.id,
          name: rewardRow.name,
          image_url: rewardRow.image_url,
          rarity: normalizeItemRarity(rewardRow.rarity),
          type: rewardRow.type,
        });
      }
    }

    await conn.query(
      'UPDATE users SET daily_free_last_claim_period_key = ? WHERE id = ?',
      [periodKey, userId],
    );

    await conn.commit();

    res.json({
      success: true,
      itemCount: n,
      rewards,
      minItemsPerClaim,
      maxItemsPerClaim,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột daily_free (chạy migration db/migrations/20260510_daily_free_claim.sql hoặc npm run migrate:daily-free).',
      });
    }
    console.error('POST /api/game-center/daily-free/claim', error);
    res.status(500).json({ error: 'Không nhận được quà' });
  } finally {
    if (conn) conn.release();
  }
});

function luckyBoothLoadGc(conn) {
  return conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1').then(([gcRows]) => {
    let storedGc = null;
    if (gcRows.length && gcRows[0].config != null) {
      const c = gcRows[0].config;
      if (typeof c === 'string') {
        try {
          storedGc = JSON.parse(c);
        } catch {
          storedGc = null;
        }
      } else if (typeof c === 'object') storedGc = c;
    }
    return mergeGameCenterConfig(storedGc);
  });
}

function luckyBoothRandomWinningNumber() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function luckyBoothNormalizeDigits(body) {
  if (!body || typeof body !== 'object') return null;
  const ds = body.digits;
  if (typeof ds === 'string' && /^\d{4}$/.test(ds.trim())) return ds.trim();
  if (Array.isArray(ds) && ds.length === 4) {
    const parts = ds.map((x) => String(x ?? '').replace(/\D/g, '').slice(0, 1));
    const s = parts.join('');
    if (/^\d{4}$/.test(s)) return s;
  }
  return null;
}

async function luckyBoothExecuteDraw(conn, closedPeriodKey, gcConfig) {
  const lb = gcConfig.luckyBooth || {};
  const jackpotPeta = Math.max(0, Math.floor(Number(lb.jackpotPeta) || 0));

  const [ticketRows] = await conn.query(
    `SELECT user_id, digits, username_snapshot FROM lucky_booth_tickets WHERE period_key = ? ORDER BY id ASC`,
    [closedPeriodKey],
  );
  const totalTickets = ticketRows.length;
  const winningNumber = luckyBoothRandomWinningNumber();
  const winners = ticketRows.filter((t) => String(t.digits) === winningNumber);
  const winnerCount = winners.length;
  let shareEach = 0;
  if (winnerCount > 0 && jackpotPeta > 0) {
    shareEach = Math.floor(jackpotPeta / winnerCount);
  }

  const winnersPayload = [];
  for (const w of winners) {
    const username = String(w.username_snapshot || w.user_id || '');
    winnersPayload.push({
      userId: Number(w.user_id),
      username,
      digits: String(w.digits),
      petaShare: shareEach,
    });
    if (shareEach > 0) {
      await conn.query('UPDATE users SET peta = peta + ? WHERE id = ?', [shareEach, w.user_id]);
      try {
        await titleService.recordPetaEarned(conn, w.user_id, shareEach);
      } catch (e) {
        console.error('title earn (lucky booth):', e);
      }
    }

    // Luôn gửi thư thông báo khi trúng (kể cả jackpot = 0 — vẫn báo số trúng)
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 30);
    const drawLabel = (() => {
      const n = Number(closedPeriodKey);
      if (!Number.isFinite(n) || n <= 0) return String(closedPeriodKey);
      return new Date(n).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    })();
    const rewardLine =
      shareEach > 0
        ? `Bạn nhận được ${shareEach.toLocaleString('vi-VN')} Peta (đã cộng vào tài khoản).`
        : 'Jackpot là 0 Peta — không có thưởng tiền, nhưng vẫn ghi nhận bạn đã trúng số.';
    await conn.query(
      `INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
       VALUES (?, 'system', 'Công ty Xổ số — Làng Hảo Vọng', ?, ?, NULL, ?)`,
      [
        w.user_id,
        'Chúc mừng — Trúng độc đắc Xổ số!',
        [
          `Chúc mừng ${username || 'bạn'}!`,
          '',
          'Bạn đã trúng giải độc đắc từ chương trình Xổ số của Làng Hảo Vọng.',
          `Số trúng thưởng: ${winningNumber}`,
          `Ngày sổ (kỳ): ${drawLabel}`,
          rewardLine,
          '',
          '(Đến làng hảo vọng để xem)',
          '',
          'Chúc bạn may mắn ở những kỳ tiếp theo!',
        ].join('\n'),
        expireAt,
      ],
    );
  }

  const winnersJson = JSON.stringify(winnersPayload);
  await conn.query(
    `INSERT INTO lucky_booth_draws (period_key, winning_number, drawn_at, total_tickets, winner_count, jackpot_peta, winners_json)
     VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
    [closedPeriodKey, winningNumber, totalTickets, winnerCount, jackpotPeta, winnersJson],
  );
}

async function luckyBoothMaybeAdvancePeriod(conn) {
  const resetHm = await luckyWheelFetchGlobalResetHm(conn);
  const nowPeriod = luckyWheelDailyPeriodKey(new Date(), resetHm);

  const [stateRows] = await conn.query(
    'SELECT active_period_key FROM lucky_booth_state WHERE id = 1 FOR UPDATE',
  );
  const stateRow = stateRows[0];
  if (!stateRow) {
    await conn.query('INSERT INTO lucky_booth_state (id, active_period_key) VALUES (1, ?)', [nowPeriod]);
    return;
  }
  let active = stateRow.active_period_key;

  if (active == null || active === '') {
    await conn.query('UPDATE lucky_booth_state SET active_period_key = ? WHERE id = 1', [nowPeriod]);
    return;
  }
  if (String(active) === String(nowPeriod)) return;

  const gcConfig = await luckyBoothLoadGc(conn);
  const [[dupDraw]] = await conn.query('SELECT id FROM lucky_booth_draws WHERE period_key = ? LIMIT 1', [active]);
  if (!dupDraw) {
    await luckyBoothExecuteDraw(conn, active, gcConfig);
  }
  await conn.query('DELETE FROM lucky_booth_tickets WHERE period_key = ?', [active]);
  await conn.query('UPDATE lucky_booth_state SET active_period_key = ? WHERE id = 1', [nowPeriod]);
}

function luckyBoothTableMissing(err) {
  return (
    err &&
    (err.code === 'ER_NO_SUCH_TABLE' ||
      err.errno === 1146 ||
      (typeof err.message === 'string' && err.message.includes("doesn't exist")))
  );
}

/** Khi user đăng nhập / tải profile: đóng kỳ cũ + cộng Peta thắng (không cần vào làng hay claim thư). */
async function luckyBoothAdvanceOnSession() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    await luckyBoothMaybeAdvancePeriod(conn);
    await conn.commit();
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) {
        /* ignore */
      }
    }
    if (!luckyBoothTableMissing(e)) {
      console.error('luckyBoothAdvanceOnSession:', e);
    }
  } finally {
    if (conn) conn.release();
  }
}

/**
 * GET /api/game-center/lucky-booth/status
 */
app.get('/api/game-center/lucky-booth/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      } catch (_) {
        userId = null;
      }
    }

    let conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await luckyBoothMaybeAdvancePeriod(conn);
      await conn.commit();
    } catch (e) {
      if (conn) await conn.rollback();
      throw e;
    } finally {
      if (conn) conn.release();
      conn = null;
    }

    const gcConn = await db.getConnection();
    let gcConfig;
    try {
      gcConfig = await luckyBoothLoadGc(gcConn);
    } finally {
      gcConn.release();
    }

    const lb = gcConfig.luckyBooth || {};
    const ticketPrice = Math.max(0, Number(lb.ticketPrice) || 0);
    const jackpotPeta = Math.max(0, Math.floor(Number(lb.jackpotPeta) || 0));

    const [[st]] = await db.query('SELECT active_period_key FROM lucky_booth_state WHERE id = 1 LIMIT 1');
    const activePeriodKey = st?.active_period_key ?? null;

    const [drawRows] = await db.query(
      `SELECT period_key, winning_number, drawn_at, total_tickets, winner_count, jackpot_peta, winners_json
       FROM lucky_booth_draws ORDER BY drawn_at DESC, id DESC LIMIT 1`,
    );

    let lastDraw = null;
    if (drawRows.length) {
      const d = drawRows[0];
      let winners = [];
      try {
        const wj = d.winners_json;
        if (typeof wj === 'string') winners = JSON.parse(wj || '[]');
        else if (Array.isArray(wj)) winners = wj;
        else winners = [];
        if (!Array.isArray(winners)) winners = [];
      } catch {
        winners = [];
      }
      lastDraw = {
        periodKey: d.period_key,
        winningNumber: d.winning_number,
        drawnAt: d.drawn_at,
        totalTickets: Number(d.total_tickets) || 0,
        winnerCount: Number(d.winner_count) || 0,
        jackpotPeta: Number(d.jackpot_peta) || 0,
        winners,
      };
    }

    let myTicket = null;
    if (userId && activePeriodKey) {
      const [tr] = await db.query(
        `SELECT digits FROM lucky_booth_tickets WHERE period_key = ? AND user_id = ? LIMIT 1`,
        [activePeriodKey, userId],
      );
      if (tr.length) myTicket = { digits: String(tr[0].digits) };
    }

    res.json({
      ticketPrice,
      jackpotPeta,
      activePeriodKey,
      lastDraw,
      myTicket,
      loggedIn: !!userId,
    });
  } catch (error) {
    if (luckyBoothTableMissing(error)) {
      return res.status(503).json({
        error:
          'DB chưa có bảng Xổ số (chạy migration db/migrations/20260511_lucky_booth.sql hoặc npm run migrate:lucky-booth).',
      });
    }
    console.error('GET /api/game-center/lucky-booth/status', error);
    res.status(500).json({ error: 'Lỗi tải Xổ số' });
  }
});

/**
 * POST /api/game-center/lucky-booth/purchase { digits: "1234" | digits: [a,b,c,d] }
 */
app.post('/api/game-center/lucky-booth/purchase', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;
    const digits = luckyBoothNormalizeDigits(req.body || {});
    if (!digits) {
      return res.status(400).json({ error: 'Chọn đủ 4 chữ số (0000–9999)' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();
    await luckyBoothMaybeAdvancePeriod(conn);

    const gcConfig = await luckyBoothLoadGc(conn);
    const lb = gcConfig.luckyBooth || {};
    const ticketPrice = Math.max(0, Math.floor(Number(lb.ticketPrice) || 0));

    const [[st]] = await conn.query('SELECT active_period_key FROM lucky_booth_state WHERE id = 1 FOR UPDATE');
    const activePeriodKey = st?.active_period_key;
    if (!activePeriodKey) {
      await conn.rollback();
      return res.status(503).json({ error: 'Chưa khởi tạo kỳ xổ số' });
    }

    const [dup] = await conn.query(
      `SELECT id FROM lucky_booth_tickets WHERE period_key = ? AND user_id = ? LIMIT 1`,
      [activePeriodKey, userId],
    );
    if (dup.length) {
      await conn.rollback();
      return res.status(429).json({ error: 'Bạn đã mua vé trong kỳ này' });
    }

    const [ur] = await conn.query('SELECT id, peta, username FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!ur.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const petaBal = Number(ur[0].peta) || 0;
    if (petaBal < ticketPrice) {
      await conn.rollback();
      return res.status(402).json({ error: 'Không đủ Peta để mua vé', petaRemaining: petaBal });
    }

    await conn.query('UPDATE users SET peta = peta - ? WHERE id = ?', [ticketPrice, userId]);
    try {
      await titleService.recordPetaSpent(conn, userId, ticketPrice);
    } catch (e) {
      console.error('title spend (lucky booth):', e);
    }

    const usernameSnapshot = String(ur[0].username || '').slice(0, 128);
    await conn.query(
      `INSERT INTO lucky_booth_tickets (period_key, user_id, digits, username_snapshot)
       VALUES (?, ?, ?, ?)`,
      [activePeriodKey, userId, digits, usernameSnapshot || null],
    );

    await conn.commit();

    const [[row]] = await db.query(`SELECT peta FROM users WHERE id = ? LIMIT 1`, [userId]);
    const petaRemaining = Number(row?.peta) || 0;

    res.json({
      success: true,
      digits,
      ticketPrice,
      petaRemaining,
      periodKey: activePeriodKey,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (luckyBoothTableMissing(error)) {
      return res.status(503).json({
        error:
          'DB chưa có bảng Xổ số (chạy migration db/migrations/20260511_lucky_booth.sql hoặc npm run migrate:lucky-booth).',
      });
    }
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(429).json({ error: 'Bạn đã mua vé trong kỳ này' });
    }
    console.error('POST /api/game-center/lucky-booth/purchase', error);
    res.status(500).json({ error: 'Không mua được vé' });
  } finally {
    if (conn) conn.release();
  }
});

function slotMachinePickIconId(reelIcons) {
  if (!reelIcons?.length) return '';
  return String(reelIcons[Math.floor(Math.random() * reelIcons.length)].id || '');
}

function slotMachineEvaluate(ids, rules) {
  const [a, b, c] = ids;
  const tripleSame = a && a === b && b === c;
  const anyPair = a === b || b === c || a === c;
  const list = rules?.length ? rules : [];

  const jackpot = list.find((r) => r.kind === 'triple_icon' && r.iconId);
  if (jackpot && tripleSame && a === jackpot.iconId) {
    return { tier: 'jackpot', msg: jackpot.rewardDescription || jackpot.label || 'Jackpot' };
  }
  const tripleRule = list.find((r) => r.kind === 'triple_same');
  if (tripleSame && tripleRule) {
    return { tier: 'triple', msg: tripleRule.rewardDescription || tripleRule.label || 'Ba giống nhau' };
  }
  const pairRule = list.find((r) => r.kind === 'any_pair');
  if (anyPair && pairRule) {
    return { tier: 'pair', msg: pairRule.rewardDescription || pairRule.label || 'Hai trùng' };
  }
  return { tier: 'none', msg: 'Không đủ điều kiện — quay lại sau.' };
}

async function grantSlotSpiritToUser(conn, userId, spiritId) {
  const sid = Number(spiritId);
  if (!Number.isFinite(sid) || sid <= 0) return { ok: false, error: 'spiritId không hợp lệ' };
  const [rows] = await conn.query('SELECT id, name, image FROM spirits WHERE id = ? LIMIT 1', [sid]);
  if (!rows.length) return { ok: false, error: 'Spirit không tồn tại' };
  const cap = await getSpiritCapacity(conn, userId);
  if (cap.freeSlots < 1) {
    await sendSystemRewardMail(
      conn,
      userId,
      { spirits: [{ spirit_id: sid, quantity: 1 }] },
      {
        senderName: 'Máy đánh bạc',
        subject: 'Kho linh thú đầy — phần thưởng gửi vào thư',
        message: `Bạn đã đạt giới hạn linh thú (${cap.maxSlots}). Linh thú được đính kèm thư — dọn kho rồi nhận.`,
      }
    );
    return {
      ok: true,
      destination: 'mail',
      spirit: { spiritId: sid, name: rows[0].name, image: rows[0].image },
    };
  }
  await conn.query(
    `INSERT INTO user_spirits (user_id, spirit_id, is_equipped, equipped_pet_id)
     VALUES (?, ?, FALSE, NULL)`,
    [userId, sid],
  );
  return {
    ok: true,
    destination: 'inventory',
    spirit: { spiritId: sid, name: rows[0].name, image: rows[0].image },
  };
}

/**
 * GET /api/game-center/slot-machine/status
 * Trả giá quay + lượt còn lại theo kỳ.
 */
app.get('/api/game-center/slot-machine/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      } catch (_) {
        userId = null;
      }
    }

    const conn = await db.getConnection();
    try {
      const [gcRows] = await conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1');
      let stored = null;
      if (gcRows.length && gcRows[0].config != null) {
        const c = gcRows[0].config;
        if (typeof c === 'string') {
          try {
            stored = JSON.parse(c);
          } catch {
            stored = null;
          }
        } else if (typeof c === 'object') stored = c;
      }
      const gcConfig = mergeGameCenterConfig(stored);
      const sm = gcConfig.slotMachine || {};
      const spinPricePeta = Math.max(0, Math.floor(Number(sm.spinPricePeta) || 0));
      const maxPlaysPerDay = Math.max(1, Math.min(500, parseInt(sm.maxPlaysPerDay, 10) || 10));
      const pairRewardPeta = Math.max(0, Math.floor(Number(sm.pairRewardPeta) || 0));

      let playsToday = 0;
      let canSpin = null;
      if (userId) {
        try {
          const resetHm = await luckyWheelFetchGlobalResetHm(conn);
          const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);
          const [ur] = await conn.query(
            `SELECT slot_machine_period_key, slot_machine_spins FROM users WHERE id = ? LIMIT 1`,
            [userId],
          );
          if (ur.length) {
            const u = ur[0];
            let p = Number(u.slot_machine_spins) || 0;
            if (String(u.slot_machine_period_key || '') !== periodKey) p = 0;
            playsToday = p;
            canSpin = p < maxPlaysPerDay;
          } else {
            canSpin = true;
          }
        } catch (e) {
          if (e && e.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(503).json({
              error:
                'DB chưa có cột slot_machine (chạy migration db/migrations/20260512_slot_machine_daily.sql hoặc npm run migrate:slot-machine).',
            });
          }
          throw e;
        }
      }

      res.json({
        spinPricePeta,
        maxPlaysPerDay,
        pairRewardPeta,
        playsToday,
        playsRemaining: userId != null ? Math.max(0, maxPlaysPerDay - playsToday) : null,
        canSpin,
        loggedIn: !!userId,
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('GET /api/game-center/slot-machine/status', error);
    res.status(500).json({ error: 'Lỗi tải máy đánh bạc' });
  }
});

/**
 * GET /api/game-center/playable-alerts
 * Các game còn lượt / còn chơi được trong kỳ hiện tại (để hiện badge).
 * mystery-box không có quota — client tự xử lý “đã vào trang trong kỳ”.
 */
app.get('/api/game-center/playable-alerts', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;

    const conn = await db.getConnection();
    try {
      try {
        await conn.beginTransaction();
        await luckyBoothMaybeAdvancePeriod(conn);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        if (!luckyBoothTableMissing(e)) throw e;
      }

      const resetHm = await luckyWheelFetchGlobalResetHm(conn);
      const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

      const [gcRows] = await conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1');
      let storedGc = null;
      if (gcRows.length && gcRows[0].config != null) {
        const c = gcRows[0].config;
        if (typeof c === 'string') {
          try {
            storedGc = JSON.parse(c);
          } catch {
            storedGc = null;
          }
        } else if (typeof c === 'object') storedGc = c;
      }
      const gcConfig = mergeGameCenterConfig(storedGc);

      const [userRows] = await conn.query(
        `SELECT
           lucky_wheel_period_key, lucky_wheel_spins,
           scratch_daily_period_key, scratch_daily_buys_3, scratch_daily_buys_5, scratch_pending_json,
           beggar_king_last_claim_ms,
           daily_free_last_claim_period_key,
           guess_number_period_key, guess_number_daily_plays, guess_number_pending_json,
           slot_machine_period_key, slot_machine_spins
         FROM users WHERE id = ? LIMIT 1`,
        [userId],
      );
      if (!userRows.length) return res.status(404).json({ error: 'Không tìm thấy người chơi' });
      const u = userRows[0];

      const alerts = {
        'lucky-wheel': false,
        'scratch-lottery': false,
        'beggar-king': false,
        'daily-free': false,
        'lucky-booth': false,
        'guess-number': false,
        'slot-machine': false,
        'mystery-box': true,
      };

      const maxWheel = Math.max(1, parseInt(gcConfig.luckyWheel?.maxPurchasesPerDay, 10) || 2);
      let wheelSpins = Number(u.lucky_wheel_spins) || 0;
      if (String(u.lucky_wheel_period_key || '') !== periodKey) wheelSpins = 0;
      alerts['lucky-wheel'] = wheelSpins < maxWheel;

      const sl = gcConfig.scratchLottery || {};
      const max3 = Math.max(0, parseInt(sl.ticket3?.dailyBuyLimit, 10) || 0);
      const max5 = Math.max(0, parseInt(sl.ticket5?.dailyBuyLimit, 10) || 0);
      let buys3 = Number(u.scratch_daily_buys_3) || 0;
      let buys5 = Number(u.scratch_daily_buys_5) || 0;
      if (String(u.scratch_daily_period_key || '') !== periodKey) {
        buys3 = 0;
        buys5 = 0;
      }
      const pendScratch = parsePending(u.scratch_pending_json);
      alerts['scratch-lottery'] =
        !!pendScratch || (max3 > 0 && buys3 < max3) || (max5 > 0 && buys5 < max5);

      const bk = gcConfig.beggarKing || {};
      const cooldownMs = Math.max(0, Number(bk.cooldownHours) || 6) * 3600 * 1000;
      const lastClaimMs =
        u.beggar_king_last_claim_ms != null ? Number(u.beggar_king_last_claim_ms) : null;
      alerts['beggar-king'] =
        lastClaimMs == null || !Number.isFinite(lastClaimMs) || Date.now() >= lastClaimMs + cooldownMs;

      alerts['daily-free'] = String(u.daily_free_last_claim_period_key || '') !== periodKey;

      let activePeriodKey = null;
      try {
        const [[st]] = await conn.query(
          'SELECT active_period_key FROM lucky_booth_state WHERE id = 1 LIMIT 1',
        );
        activePeriodKey = st?.active_period_key ?? null;
        if (activePeriodKey) {
          const [tr] = await conn.query(
            `SELECT id FROM lucky_booth_tickets WHERE period_key = ? AND user_id = ? LIMIT 1`,
            [activePeriodKey, userId],
          );
          alerts['lucky-booth'] = tr.length === 0;
        }
      } catch (e) {
        if (!luckyBoothTableMissing(e)) throw e;
      }

      const gn = await guessNumberLoadConfig(conn);
      let gnPlays = Number(u.guess_number_daily_plays) || 0;
      if (String(u.guess_number_period_key || '') !== periodKey) gnPlays = 0;
      const gnPend = parsePending(u.guess_number_pending_json);
      const gnHasPending = gnPend != null && Number.isFinite(Number(gnPend.pivot));
      alerts['guess-number'] =
        gnHasPending || gnPlays < Math.max(1, Number(gn.maxPlaysPerDay) || 1);

      const sm = gcConfig.slotMachine || {};
      const smMax = Math.max(1, Math.min(500, parseInt(sm.maxPlaysPerDay, 10) || 10));
      let smPlays = Number(u.slot_machine_spins) || 0;
      if (String(u.slot_machine_period_key || '') !== periodKey) smPlays = 0;
      alerts['slot-machine'] = smPlays < smMax;

      res.json({ periodKey, alerts });
    } finally {
      conn.release();
    }
  } catch (error) {
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error: 'DB thiếu cột game-center — chạy migrations tương ứng.',
      });
    }
    console.error('GET /api/game-center/playable-alerts', error);
    res.status(500).json({ error: 'Lỗi tải cảnh báo game center' });
  }
});

/**
 * POST /api/game-center/slot-machine/spin
 * Server quyết định kết quả + cộng thưởng.
 */
app.post('/api/game-center/slot-machine/spin', async (req, res) => {
  let conn;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const gcConfig = await (async () => {
      const [gcRows] = await conn.query('SELECT config FROM site_game_center_config WHERE id = 1 LIMIT 1');
      let stored = null;
      if (gcRows.length && gcRows[0].config != null) {
        const c = gcRows[0].config;
        if (typeof c === 'string') {
          try {
            stored = JSON.parse(c);
          } catch {
            stored = null;
          }
        } else if (typeof c === 'object') stored = c;
      }
      return mergeGameCenterConfig(stored);
    })();

    const sm = gcConfig.slotMachine || {};
    const spinPricePeta = Math.max(0, Math.floor(Number(sm.spinPricePeta) || 0));
    const maxPlaysPerDay = Math.max(1, Math.min(500, parseInt(sm.maxPlaysPerDay, 10) || 10));
    const pairRewardPeta = Math.max(0, Math.floor(Number(sm.pairRewardPeta) || 0));
    const reelIcons = Array.isArray(sm.reelIcons) ? sm.reelIcons : [];
    const rules = Array.isArray(sm.winRules) ? sm.winRules : [];
    if (!reelIcons.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Chưa có icon guồng (Admin)' });
    }

    const resetHm = await luckyWheelFetchGlobalResetHm(conn);
    const periodKey = luckyWheelDailyPeriodKey(new Date(), resetHm);

    const [uRows] = await conn.query(
      `SELECT id, peta, petagold, slot_machine_period_key, slot_machine_spins FROM users WHERE id = ? FOR UPDATE`,
      [userId],
    );
    if (!uRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    }
    const u = uRows[0];
    let plays = Number(u.slot_machine_spins) || 0;
    if (String(u.slot_machine_period_key || '') !== periodKey) {
      plays = 0;
      await conn.query(
        'UPDATE users SET slot_machine_period_key = ?, slot_machine_spins = 0 WHERE id = ?',
        [periodKey, userId],
      );
    }
    if (plays >= maxPlaysPerDay) {
      await conn.rollback();
      return res.status(429).json({ error: 'Đã hết lượt quay trong kỳ hiện tại', maxPlaysPerDay });
    }

    const petaBal = Number(u.peta) || 0;
    if (petaBal < spinPricePeta) {
      await conn.rollback();
      return res.status(402).json({ error: 'Không đủ Peta để quay', petaRemaining: petaBal, spinPricePeta });
    }

    if (spinPricePeta > 0) {
      await conn.query('UPDATE users SET peta = peta - ? WHERE id = ?', [spinPricePeta, userId]);
      try {
        await titleService.recordPetaSpent(conn, userId, spinPricePeta);
      } catch (e) {
        console.error('title spend (slot machine):', e);
      }
    }

    const a = slotMachinePickIconId(reelIcons);
    const b = slotMachinePickIconId(reelIcons);
    const c = slotMachinePickIconId(reelIcons);
    const reels = [a, b, c];
    const out = slotMachineEvaluate(reels, rules);

    const rewards = [];
    let deltaPetagold = 0;

    if (out.tier === 'jackpot') {
      // 777: nhận 10 petagold
      deltaPetagold = 10;
      await conn.query('UPDATE users SET petagold = petagold + ? WHERE id = ?', [deltaPetagold, userId]);
      rewards.push({ kind: 'petagold', amount: deltaPetagold, label: 'PetaGold' });
    } else if (out.tier === 'triple') {
      const icon = reelIcons.find((x) => String(x.id) === String(a));
      const rewardKind = String(icon?.reward?.kind || 'placeholder');
      if (rewardKind === 'item' && icon?.reward?.itemId != null) {
        const itemId = Number(icon.reward.itemId);
        await grantMailItemsToInventory(conn, userId, itemId, 1, {
          overflowToMail: true,
          mailMeta: {
            subject: 'Túi đồ đầy — phần thưởng Máy đánh bạc',
            message:
              'Túi đồ đã đầy nên phần thưởng Máy đánh bạc được gửi vào thư. Dọn túi rồi nhận đính kèm.',
            senderName: 'Máy đánh bạc',
          },
        });
        const [[it]] = await conn.query(
          `SELECT id, name, image_url, rarity, type FROM items WHERE id = ? LIMIT 1`,
          [itemId],
        );
        rewards.push({
          kind: 'item',
          itemId,
          name: it?.name || `Item #${itemId}`,
          image_url: it?.image_url || '',
          rarity: normalizeItemRarity(it?.rarity),
        });
      } else if (rewardKind === 'spirit' && icon?.reward?.spiritId != null) {
        const g = await grantSlotSpiritToUser(conn, userId, icon.reward.spiritId);
        if (g.ok && g.spirit) {
          rewards.push({
            kind: 'spirit',
            spiritId: g.spirit.spiritId,
            name: g.spirit.name,
            image: g.spirit.image,
          });
        }
      }
    } else if (out.tier === 'pair' && pairRewardPeta > 0) {
      await conn.query('UPDATE users SET peta = peta + ? WHERE id = ?', [pairRewardPeta, userId]);
      try {
        await titleService.recordPetaEarned(conn, userId, pairRewardPeta);
      } catch (e) {
        console.error('title earn (slot pair):', e);
      }
      rewards.push({ kind: 'peta', amount: pairRewardPeta, label: 'Peta' });
    }

    const newPlays = plays + 1;
    await conn.query('UPDATE users SET slot_machine_spins = ? WHERE id = ?', [newPlays, userId]);

    await conn.commit();

    const [[bal]] = await db.query('SELECT peta, petagold FROM users WHERE id = ? LIMIT 1', [userId]);
    res.json({
      success: true,
      reels,
      tier: out.tier,
      message: out.msg,
      rewards,
      petagoldRemaining: Number(bal?.petagold) || 0,
      petaRemaining: Number(bal?.peta) || 0,
      spinPricePeta,
      playsToday: newPlays,
      playsRemaining: Math.max(0, maxPlaysPerDay - newPlays),
      maxPlaysPerDay,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(503).json({
        error:
          'DB chưa có cột slot_machine (chạy migration db/migrations/20260512_slot_machine_daily.sql hoặc npm run migrate:slot-machine).',
      });
    }
    console.error('POST /api/game-center/slot-machine/spin', error);
    res.status(500).json({ error: 'Không quay được máy' });
  } finally {
    if (conn) conn.release();
  }
});

// ---------- Hunting maps (public read — dữ liệu trong bảng hunting_maps) ----------
function huntingMapRowToFullClient(row) {
  let tiles = [];
  try {
    tiles = typeof row.tiles_json === 'string' ? JSON.parse(row.tiles_json) : row.tiles_json;
    if (!Array.isArray(tiles)) tiles = [];
  } catch {
    tiles = [];
  }
  let encounterPool = [];
  try {
    const ep = row.encounter_pool_json;
    if (ep == null) encounterPool = [];
    else encounterPool = typeof ep === 'string' ? JSON.parse(ep) : ep;
    if (!Array.isArray(encounterPool)) encounterPool = [];
  } catch {
    encounterPool = [];
  }
  const fg = row.foreground_url && String(row.foreground_url).trim() ? String(row.foreground_url).trim() : null;
  const hid = row.is_hidden;
  const isHidden = hid === 1 || hid === true || hid === '1';
  const requireMinLevel = Math.max(0, parseInt(row.require_min_level, 10) || 0);
  let encounterLevelMin = Math.max(1, parseInt(row.encounter_level_min, 10) || 1);
  let encounterLevelMax = Math.max(1, parseInt(row.encounter_level_max, 10) || 1);
  if (encounterLevelMax < encounterLevelMin) {
    const t = encounterLevelMin;
    encounterLevelMin = encounterLevelMax;
    encounterLevelMax = t;
  }
  return {
    id: row.id,
    name: row.name,
    entryFee: row.entry_fee,
    currency: row.currency,
    maxSteps: row.max_steps,
    thumb: row.thumb || '',
    width: row.width,
    height: row.height,
    tileSize: row.tile_size,
    start: { x: row.start_x, y: row.start_y },
    assets: {
      background: row.background_url,
      ...(fg ? { foreground: fg } : {}),
    },
    tiles,
    encounterPool,
    isHidden,
    requireMinLevel,
    encounterLevelMin,
    encounterLevelMax,
  };
}

function huntingMapRowToListClient(row) {
  const hid = row.is_hidden;
  const isHidden = hid === 1 || hid === true || hid === '1';
  const requireMinLevel = Math.max(0, parseInt(row.require_min_level, 10) || 0);
  let encounterLevelMin = Math.max(1, parseInt(row.encounter_level_min, 10) || 1);
  let encounterLevelMax = Math.max(1, parseInt(row.encounter_level_max, 10) || 1);
  if (encounterLevelMax < encounterLevelMin) {
    const t = encounterLevelMin;
    encounterLevelMin = encounterLevelMax;
    encounterLevelMax = t;
  }
  return {
    id: row.id,
    name: row.name,
    entryFee: row.entry_fee,
    currency: row.currency,
    maxSteps: row.max_steps,
    thumb: row.thumb || '',
    width: row.width,
    height: row.height,
    tileSize: row.tile_size,
    sort_order: row.sort_order,
    updated_at: row.updated_at,
    isHidden,
    requireMinLevel,
    encounterLevelMin,
    encounterLevelMax,
  };
}

app.get('/api/hunting/maps', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, entry_fee, currency, max_steps, thumb, width, height, tile_size, sort_order, updated_at, is_hidden,
              require_min_level, encounter_level_min, encounter_level_max
       FROM hunting_maps
       WHERE (is_hidden IS NULL OR is_hidden = 0)
       ORDER BY sort_order ASC, id ASC`
    );
    res.json(rows.map(huntingMapRowToListClient));
  } catch (err) {
    console.error('GET /api/hunting/maps', err);
    res.status(500).json({ message: 'Lỗi tải danh sách map săn' });
  }
});

app.get('/api/hunting/maps/:id', async (req, res) => {
  const id = String(req.params.id || '').toLowerCase();
  if (id === 'forest') {
    return res.status(404).json({ message: 'Map forest là built-in (client)' });
  }
  try {
    const [rows] = await db.query(
      `SELECT * FROM hunting_maps WHERE id = ? AND (is_hidden IS NULL OR is_hidden = 0)`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy map' });
    res.json(huntingMapRowToFullClient(rows[0]));
  } catch (err) {
    console.error('GET /api/hunting/maps/:id', err);
    res.status(500).json({ message: 'Lỗi tải map' });
  }
});

/**
 * Hunting catch — session + feed + ném lưới.
 * Stat pet chỉ tính khi bắt thành công.
 */
function authUserIdFromReq(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded.userId;
  } catch {
    return null;
  }
}

/** Bắt đầu / reset phiên bắt cho encounter hiện tại */
app.post('/api/hunting/catch/session', async (req, res) => {
  const uid = authUserIdFromReq(req);
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const speciesId = parseInt(req.body.speciesId ?? req.body.species_id, 10);
  const level = Math.max(1, Math.min(100, parseInt(req.body.level, 10) || 1));
  const name = req.body.name != null ? String(req.body.name).trim() : '';

  if (!Number.isFinite(speciesId) || speciesId <= 0) {
    return res.status(400).json({ message: 'Thiếu speciesId' });
  }

  try {
    await huntingCatch.loadCatchConfig(db);
  } catch (e) {
    console.error('loadCatchConfig', e);
  }
  const cfg = huntingCatch.getCatchConfigSync();

  let petRarity = 'common';
  try {
    const [spRows] = await db.query('SELECT rarity, name FROM pet_species WHERE id = ?', [speciesId]);
    if (spRows.length) {
      petRarity = String(spRows[0].rarity || 'common').toLowerCase();
      if (!name && spRows[0].name) {
        // keep request name if provided
      }
    }
  } catch (e) {
    console.error('catch session species lookup', e);
  }

  const catchPenalty = huntingCatch.catchPenaltyPercent(petRarity, cfg);

  huntingCatch.setCatchSession(uid, {
    speciesId,
    level,
    name,
    petRarity,
    feedCount: 0,
    foodBonus: 0,
    failCount: 0,
  });

  res.json({
    ok: true,
    feedCount: 0,
    foodBonus: 0,
    failCount: 0,
    petRarity,
    catchPenalty,
    netRates: huntingCatch.getNetRatesMap(cfg),
    maxCatchChance: cfg.maxCatchChance,
  });
});

/** Cho ăn — cộng bonus theo rarity; roll chạy thoát theo feed + failCount */
app.post('/api/hunting/catch/feed', async (req, res) => {
  const uid = authUserIdFromReq(req);
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const inventoryId = parseInt(req.body.inventoryId ?? req.body.foodInventoryId, 10);
  if (!Number.isFinite(inventoryId) || inventoryId <= 0) {
    return res.status(400).json({ message: 'Thiếu inventoryId thức ăn' });
  }

  let session = huntingCatch.getCatchSession(uid);
  if (!session) {
    return res.status(400).json({ message: 'Chưa có phiên bắt — mở lại màn hình bắt.' });
  }

  const cfg = huntingCatch.getCatchConfigSync();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [invRows] = await conn.query(
      `SELECT i.id, i.quantity, i.player_id, i.item_id,
              it.name, it.type, it.category, it.rarity, it.image_url
       FROM inventory i
       JOIN items it ON it.id = i.item_id
       WHERE i.id = ? AND i.player_id = ?
       FOR UPDATE`,
      [inventoryId, uid]
    );
    if (!invRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy item trong túi' });
    }
    const inv = invRows[0];
    if (!huntingCatch.isFoodItem(inv)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Item này không phải thức ăn' });
    }
    const qty = Number(inv.quantity) || 0;
    if (qty < 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'Hết thức ăn' });
    }

    if (qty <= 1) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [inventoryId]);
    } else {
      await conn.query('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?', [inventoryId]);
    }

    const addBonus = huntingCatch.foodBonusPercent(inv.rarity, cfg);
    const feedCount = (session.feedCount || 0) + 1;
    const foodBonus = Math.round(((session.foodBonus || 0) + addBonus) * 10) / 10;
    const failCount = session.failCount || 0;
    const fleeRate = huntingCatch.fleeRatePercent(feedCount, failCount, cfg);
    const fled = Math.random() * 100 < fleeRate;

    await conn.commit();

    if (fled) {
      huntingCatch.clearCatchSession(uid);
      return res.json({
        fled: true,
        message: 'Pet hoảng sợ và chạy mất!',
        feedCount,
        foodBonus,
      });
    }

    huntingCatch.setCatchSession(uid, {
      ...session,
      feedCount,
      foodBonus,
      failCount,
    });

    const petName = session.name || 'Pet';
    res.json({
      fled: false,
      feedCount,
      foodBonus,
      message: huntingCatch.pickFeedMessage(petName, cfg),
    });
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/hunting/catch/feed', err);
    res.status(500).json({ message: 'Lỗi khi cho ăn' });
  } finally {
    conn.release();
  }
});

/**
 * Ném lưới bắt.
 * Body: { netInventoryId, speciesId?, level?, name? }
 * Stat chỉ tạo khi success.
 */
app.post('/api/hunting/catch', async (req, res) => {
  const uid = authUserIdFromReq(req);
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const netInventoryId = parseInt(req.body.netInventoryId ?? req.body.inventoryId, 10);
  if (!Number.isFinite(netInventoryId) || netInventoryId <= 0) {
    return res.status(400).json({ message: 'Chọn một lưới để bắt' });
  }

  let session = huntingCatch.getCatchSession(uid);
  const speciesId = parseInt(
    req.body.speciesId ?? req.body.species_id ?? session?.speciesId,
    10
  );
  const level = Math.max(
    1,
    Math.min(100, parseInt(req.body.level ?? session?.level, 10) || 1)
  );
  const petNameRaw =
    req.body.name != null ? String(req.body.name).trim() : session?.name || '';

  if (!Number.isFinite(speciesId) || speciesId <= 0) {
    return res.status(400).json({ message: 'Thiếu speciesId' });
  }

  if (!session || session.speciesId !== speciesId) {
    huntingCatch.setCatchSession(uid, {
      speciesId,
      level,
      name: petNameRaw,
      feedCount: 0,
      foodBonus: 0,
      failCount: 0,
    });
    session = huntingCatch.getCatchSession(uid);
  }

  const cfg = huntingCatch.getCatchConfigSync();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [invRows] = await conn.query(
      `SELECT i.id, i.quantity, i.player_id, i.item_id,
              it.name, it.type, it.category, it.subtype, it.rarity, it.item_code, it.image_url
       FROM inventory i
       JOIN items it ON it.id = i.item_id
       WHERE i.id = ? AND i.player_id = ?
       FOR UPDATE`,
      [netInventoryId, uid]
    );
    if (!invRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lưới trong túi' });
    }
    const inv = invRows[0];
    const netMeta = huntingCatch.resolveNetMeta(inv, cfg);
    if (!netMeta) {
      await conn.rollback();
      return res.status(400).json({ message: 'Item này không phải lưới bắt' });
    }
    const qty = Number(inv.quantity) || 0;
    if (qty < 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'Hết lưới' });
    }

    const [speciesRows] = await conn.query(
      `SELECT id, name, image, type, rarity,
              base_hp, base_mp, base_str, base_def, base_intelligence, base_spd
       FROM pet_species WHERE id = ?`,
      [speciesId]
    );
    if (!speciesRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy species' });
    }
    const species = speciesRows[0];

    if (qty <= 1) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [netInventoryId]);
    } else {
      await conn.query('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?', [netInventoryId]);
    }

    const foodBonus = Number(session.foodBonus) || 0;
    const petRarity = String(species.rarity || 'common').toLowerCase();
    const successChance = huntingCatch.clampCatchChance(
      netMeta.successRate,
      foodBonus,
      cfg,
      petRarity
    );
    const roll = Math.random() * 100;
    const success = roll < successChance;
    const displayNameHint = petNameRaw || species.name || 'Pet';

    if (!success) {
      await conn.commit();
      const failCount = (session.failCount || 0) + 1;
      huntingCatch.setCatchSession(uid, {
        ...session,
        failCount,
      });
      const failMessage = huntingCatch.pickFailMessage(displayNameHint, cfg);
      return res.json({
        success: false,
        fled: false,
        message: failMessage,
        foodBonus,
        failCount,
      });
    }

    const base = {
      hp: parseInt(species.base_hp, 10) || 10,
      mp: parseInt(species.base_mp, 10) || 10,
      str: parseInt(species.base_str, 10) || 10,
      def: parseInt(species.base_def, 10) || 10,
      intelligence: parseInt(species.base_intelligence, 10) || 10,
      spd: parseInt(species.base_spd, 10) || 10,
    };
    const iv = generateIVStats();
    const finalStats = calculateFinalStats(base, iv, level);
    const petUuid = uuidv4();
    const displayName = petNameRaw || species.name;
    const createdDate = new Date();
    // Cumulative EXP floor for this level (not 0) — matches admin create & battle level-up logic
    const currentExp = Number(expTable[level]) || 0;
    const expToNextLevel = Number(expTable[level + 1]) || currentExp || 100;

    const petCap = await getPetCapacity(conn, uid);
    const petFull = petCap.freeSlots < 1;

    const [insPet] = await conn.query(
      `INSERT INTO pets (
        uuid, name, hp, str, def, intelligence, spd, mp,
        owner_id, pet_species_id, level, max_hp, current_hp, max_mp,
        created_date, final_stats,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd,
        current_exp, exp_to_next_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        petUuid,
        displayName,
        finalStats.hp,
        finalStats.str,
        finalStats.def,
        finalStats.intelligence,
        finalStats.spd,
        finalStats.mp,
        petFull ? null : uid,
        species.id,
        level,
        finalStats.hp,
        finalStats.hp,
        finalStats.mp,
        createdDate,
        JSON.stringify(finalStats),
        iv.iv_hp,
        iv.iv_mp,
        iv.iv_str,
        iv.iv_def,
        iv.iv_intelligence,
        iv.iv_spd,
        currentExp,
        expToNextLevel,
      ]
    );
    const newPetId = insPet?.insertId;
    if (petFull && newPetId) {
      await sendSystemRewardMail(
        conn,
        uid,
        { auction_transfer_pet_ids: [newPetId] },
        {
          senderName: 'Đi săn',
          subject: 'Kho pet đầy — thú bắt được gửi vào thư',
          message: `Bạn đã đạt giới hạn pet (${petCap.maxSlots}). ${displayName} (Lv.${level}) được đính kèm thư — dọn kho rồi nhận.`,
        }
      );
    } else {
      await conn.query('UPDATE users SET hasPet = TRUE WHERE id = ? AND hasPet = FALSE', [uid]);
    }
    await conn.commit();

    huntingCatch.clearCatchSession(uid);
    if (!petFull) {
      try {
        await titleService.recordPetCatch(db, uid, 1);
      } catch (e) {
        console.error('titleService.recordPetCatch (hunting):', e);
      }
    }

    return res.status(201).json({
      success: true,
      fled: false,
      message: petFull
        ? `Kho pet đã đầy. ${displayName} đã được gửi vào hộp thư.`
        : 'Bắt thành công',
      uuid: petUuid,
      name: displayName,
      level,
      species_id: species.id,
      final_stats: finalStats,
      image: species.image,
      successChance,
      net: netMeta,
      foodBonus,
      destination: petFull ? 'mail' : 'pets',
    });
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/hunting/catch', err);
    return res.status(500).json({ message: 'Lỗi khi ném lưới' });
  } finally {
    conn.release();
  }
});

app.post('/api/hunting/catch/cancel', async (req, res) => {
  const uid = authUserIdFromReq(req);
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });
  huntingCatch.clearCatchSession(uid);
  res.json({ ok: true });
});

/**
 * Nhận vật phẩm từ encounter săn → kho (reuse grantMailItemsToInventory: stack / equipment).
 * Body: { itemId, quantity?, mapId? }
 */
app.post('/api/hunting/claim-item', async (req, res) => {
  const uid = authUserIdFromReq(req);
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const itemId = parseInt(req.body.itemId ?? req.body.item_id, 10);
  const quantity = Math.max(1, Math.min(99, parseInt(req.body.quantity ?? req.body.qty, 10) || 1));
  const mapId =
    req.body.mapId != null || req.body.map_id != null
      ? String(req.body.mapId ?? req.body.map_id).trim()
      : '';

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return res.status(400).json({ message: 'Thiếu itemId' });
  }

  try {
    const [itemRows] = await db.query('SELECT id, name FROM items WHERE id = ?', [itemId]);
    if (!itemRows.length) {
      return res.status(404).json({ message: 'Vật phẩm không tồn tại' });
    }

    if (mapId) {
      const [mapRows] = await db.query(
        'SELECT encounter_pool_json FROM hunting_maps WHERE id = ? LIMIT 1',
        [mapId]
      );
      if (mapRows.length) {
        let pool = mapRows[0].encounter_pool_json;
        if (typeof pool === 'string') {
          try {
            pool = JSON.parse(pool);
          } catch {
            pool = [];
          }
        }
        const allowed =
          Array.isArray(pool) &&
          pool.some(
            (row) =>
              row &&
              String(row.kind || '').toLowerCase() === 'item' &&
              Number(row.item_id ?? row.itemId) === itemId
          );
        if (!allowed) {
          return res.status(400).json({ message: 'Vật phẩm không thuộc bản đồ săn này' });
        }
      }
    }

    const grantResult = await grantMailItemsToInventory(db, uid, itemId, quantity, {
      overflowToMail: true,
      mailMeta: {
        subject: 'Túi đồ đầy — vật phẩm đi săn',
        message:
          'Túi đồ đã đầy nên vật phẩm nhặt khi đi săn được gửi vào thư. Dọn túi rồi nhận đính kèm.',
        senderName: 'Đi săn',
      },
    });
    const viaMail = grantResult.mailed > 0;
    const viaInv = grantResult.granted > 0;
    let message;
    if (viaMail && !viaInv) {
      message = `Túi đồ đã đầy. ${itemRows[0].name} ×${quantity} đã được gửi vào hộp thư.`;
    } else if (viaMail && viaInv) {
      message = `Đã nhận ${itemRows[0].name} ×${grantResult.granted} vào túi; ×${grantResult.mailed} gửi vào hộp thư (túi gần đầy).`;
    } else {
      message = `Đã nhận ${itemRows[0].name} ×${quantity} vào túi đồ.`;
    }
    res.json({
      ok: true,
      itemId,
      quantity,
      name: itemRows[0].name,
      destination: grantResult.destination,
      granted: grantResult.granted,
      mailed: grantResult.mailed,
      message,
    });
  } catch (err) {
    console.error('POST /api/hunting/claim-item', err);
    res.status(500).json({ message: 'Lỗi khi nhận vật phẩm' });
  }
});

// Navbar Configuration API Endpoints
app.get('/api/site-config/navbar', async (req, res) => {
  try {
    const query = 'SELECT config FROM site_navbar_config ORDER BY id DESC LIMIT 1';
    const [rows] = await db.execute(query);
    
    if (rows.length > 0) {
      const config = typeof rows[0].config === 'string' 
        ? JSON.parse(rows[0].config) 
        : rows[0].config;
      res.json(config);
    } else {
      // Return default configuration if no config exists
      const defaultNavbarConfig = {
        bottomNavbar: {
          visible: true,
          showMenuOnly: false
        },
        floatingButtons: {
          visible: true
        }
      };
      res.json(defaultNavbarConfig);
    }
  } catch (error) {
    console.error('Error fetching navbar config:', error);
    res.status(500).json({ error: 'Failed to fetch navbar config' });
  }
});

app.post('/api/site-config/navbar', async (req, res) => {
  try {
    const config = req.body;
    
    // Insert or update navbar configuration
    const query = `
      INSERT INTO site_navbar_config (config) 
      VALUES (?) 
      ON DUPLICATE KEY UPDATE 
      config = VALUES(config),
      updated_at = CURRENT_TIMESTAMP
    `;
    
    await db.execute(query, [JSON.stringify(config)]);
    
    console.log('Navbar config updated:', config);
    res.json({ message: 'Navbar config updated successfully' });
  } catch (error) {
    console.error('Error updating navbar config:', error);
    res.status(500).json({ error: 'Failed to update navbar config' });
  }
});

// ======================================================== BANK SYSTEM ========================================================

// GET /api/bank/account/:userId - Lấy thông tin tài khoản ngân hàng
app.get('/api/bank/account/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Lấy thông tin tài khoản ngân hàng
    const [accountRows] = await db.query(`
      SELECT * FROM bank_accounts WHERE user_id = ?
    `, [userId]);

    if (!accountRows.length) {
      return res.status(404).json({ error: 'Chưa có tài khoản ngân hàng' });
    }

    const account = accountRows[0];

    // Tự động cộng lãi suất hàng ngày (compound interest)
    await calculateAndAddDailyInterest(userId, account);

    // Lấy lại thông tin tài khoản sau khi cộng lãi
    const [updatedAccountRows] = await db.query(`
      SELECT ba.*, u.is_vip,
              bir_peta.interest_rate as petagold_interest_rate
      FROM bank_accounts ba
      JOIN users u ON ba.user_id = u.id
      LEFT JOIN bank_interest_rates bir_peta ON bir_peta.currency_type = 'petagold' AND bir_peta.is_active = TRUE
      WHERE ba.user_id = ?
    `, [userId]);

    const updatedAccount = updatedAccountRows[0];

    res.json({
      ...updatedAccount,
      interest_collected_today: true // Luôn true vì lãi được tự động cộng
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông tin tài khoản ngân hàng:', err);
    res.status(500).json({ error: 'Lỗi khi lấy thông tin tài khoản ngân hàng' });
  }
});

// Helper function để tính và cộng lãi suất hàng ngày
async function calculateAndAddDailyInterest(userId, account) {
  const today = new Date().toISOString().split('T')[0];
  
  // Kiểm tra xem đã cộng lãi hôm nay chưa
  const [interestRows] = await db.query(`
    SELECT * FROM bank_interest_logs 
    WHERE user_id = ? AND interest_date = ?
  `, [userId, today]);

  if (interestRows.length > 0) {
    return; // Đã cộng lãi hôm nay rồi
  }

  // Lấy thông tin VIP và lãi suất
  const [userRows] = await db.query(`
    SELECT is_vip FROM users WHERE id = ?
  `, [userId]);
  
  const isVip = userRows[0]?.is_vip || false;

  // Tính lãi kép cho Peta
  const petaInterest = (account.peta_balance * (account.interest_rate / 100)) / 365;

  // Tính lãi kép cho PetaGold (chỉ VIP)
  let petagoldInterest = 0;
  if (isVip && account.petagold_balance > 0) {
    const [rateRows] = await db.query(`
      SELECT interest_rate FROM bank_interest_rates 
      WHERE currency_type = 'petagold' AND is_active = TRUE
    `);
    
    if (rateRows.length > 0) {
      const petagoldRate = rateRows[0].interest_rate;
      petagoldInterest = (account.petagold_balance * (petagoldRate / 100)) / 365;
    }
  }

  if (petaInterest <= 0 && petagoldInterest <= 0) {
    return; // Không có lãi để cộng
  }

  // Cộng lãi vào tài khoản ngân hàng
  await db.query(`
    UPDATE bank_accounts 
    SET peta_balance = peta_balance + ?, petagold_balance = petagold_balance + ?
    WHERE user_id = ?
  `, [petaInterest, petagoldInterest, userId]);

  // Ghi log
  await db.query(`
    INSERT INTO bank_interest_logs (user_id, interest_date, peta_interest, petagold_interest)
    VALUES (?, ?, ?, ?)
  `, [userId, today, petaInterest, petagoldInterest]);
}

// POST /api/bank/create-account - Tạo tài khoản ngân hàng
app.post('/api/bank/create-account', async (req, res) => {
  const { userId } = req.body;

  try {
    // Kiểm tra xem đã có tài khoản chưa
    const [existingRows] = await db.query(`
      SELECT id FROM bank_accounts WHERE user_id = ?
    `, [userId]);

    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'Đã có tài khoản ngân hàng' });
    }

    // Tạo tài khoản mới
    await db.query(`
      INSERT INTO bank_accounts (user_id, peta_balance, petagold_balance, interest_rate)
      VALUES (?, 0.00, 0.00, 5.00)
    `, [userId]);

    res.json({ success: true, message: 'Tạo tài khoản ngân hàng thành công' });
  } catch (err) {
    console.error('Lỗi khi tạo tài khoản ngân hàng:', err);
    res.status(500).json({ error: 'Lỗi khi tạo tài khoản ngân hàng' });
  }
});

// Note: collect-interest API removed - interest is now automatically added daily

// POST /api/bank/transaction - Thực hiện giao dịch (gửi/rút tiền)
app.post('/api/bank/transaction', async (req, res) => {
  const { userId, type, amount, currencyType } = req.body;

  try {
    // Validation
    if (!['deposit', 'withdraw'].includes(type)) {
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' });
    }

    if (!['peta', 'petagold'].includes(currencyType)) {
      return res.status(400).json({ error: 'Loại tiền không hợp lệ' });
    }

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' });
    }

    // Lấy thông tin tài khoản ngân hàng
    const [accountRows] = await db.query(`
      SELECT * FROM bank_accounts WHERE user_id = ?
    `, [userId]);

    if (!accountRows.length) {
      return res.status(404).json({ error: 'Chưa có tài khoản ngân hàng' });
    }

    const account = accountRows[0];

    // Lấy thông tin user
    const [userRows] = await db.query(`
      SELECT peta, petagold FROM users WHERE id = ?
    `, [userId]);

    if (!userRows.length) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const user = userRows[0];

    await db.query('START TRANSACTION');

    if (type === 'deposit') {
      // Gửi tiền vào ngân hàng
      const userBalance = currencyType === 'peta' ? user.peta : user.petagold;
      const bankBalance = currencyType === 'peta' ? account.peta_balance : account.petagold_balance;

      if (amount > userBalance) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Không đủ tiền để gửi' });
      }

      // Trừ tiền từ user, cộng vào ngân hàng
      await db.query(`
        UPDATE users SET ${currencyType} = ${currencyType} - ? WHERE id = ?
      `, [amount, userId]);

      await db.query(`
        UPDATE bank_accounts SET ${currencyType}_balance = ${currencyType}_balance + ? WHERE user_id = ?
      `, [amount, userId]);

      // Ghi log giao dịch
      await db.query(`
        INSERT INTO bank_transactions (user_id, transaction_type, currency_type, amount, balance_before, balance_after)
        VALUES (?, 'deposit', ?, ?, ?, ?)
      `, [userId, currencyType, amount, bankBalance, bankBalance + amount]);

      res.json({
        success: true,
        message: `Đã gửi ${amount} ${currencyType === 'peta' ? 'Peta' : 'PetaGold'} vào ngân hàng`
      });

    } else if (type === 'withdraw') {
      // Rút tiền từ ngân hàng
      const bankBalance = currencyType === 'peta' ? account.peta_balance : account.petagold_balance;

      if (amount > bankBalance) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Không đủ tiền trong tài khoản ngân hàng' });
      }

      // Trừ tiền từ ngân hàng, cộng vào user
      await db.query(`
        UPDATE bank_accounts SET ${currencyType}_balance = ${currencyType}_balance - ? WHERE user_id = ?
      `, [amount, userId]);

      await db.query(`
        UPDATE users SET ${currencyType} = ${currencyType} + ? WHERE id = ?
      `, [amount, userId]);

      // Ghi log giao dịch
      await db.query(`
        INSERT INTO bank_transactions (user_id, transaction_type, currency_type, amount, balance_before, balance_after)
        VALUES (?, 'withdraw', ?, ?, ?, ?)
      `, [userId, currencyType, amount, bankBalance, bankBalance - amount]);

      res.json({
        success: true,
        message: `Đã rút ${amount} ${currencyType === 'peta' ? 'Peta' : 'PetaGold'} từ ngân hàng`
      });
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Lỗi khi thực hiện giao dịch:', err);
    res.status(500).json({ error: 'Lỗi khi thực hiện giao dịch' });
  }
});

// GET /api/bank/transactions/:userId - Lấy lịch sử giao dịch
app.get('/api/bank/transactions/:userId', async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const offset = (page - 1) * limit;

    const [transactions] = await db.query(`
      SELECT * FROM bank_transactions 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);

    const [countRows] = await db.query(`
      SELECT COUNT(*) as total FROM bank_transactions WHERE user_id = ?
    `, [userId]);

    res.json({
      transactions,
      total: countRows[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Lỗi khi lấy lịch sử giao dịch:', err);
    res.status(500).json({ error: 'Lỗi khi lấy lịch sử giao dịch' });
  }
});

// API Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Kiểm tra username đã tồn tại hay chưa
    pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username],
      async (err, results) => {
        if (err) {
          console.error('Error checking username: ', err);
          return res.status(500).json({ message: 'Error checking username' });
        }

        if (results.length > 0) {
          // Username đã tồn tại
          return res.status(409).json({ message: 'Username đã được sử dụng' });
        }

        // Username chưa tồn tại, tiếp tục đăng ký
        const hashedPassword = await bcrypt.hash(password, 10); // Mã hóa mật khẩu
        pool.query(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, hashedPassword, 'user'],
          (insertErr, insertResults) => {
            if (insertErr) {
              console.error('Error registering user: ', insertErr);
              return res.status(500).json({ message: 'Error registering user' });
            } else {
              return res.json({ message: 'Đăng ký thành công' });
            }
          }
        );
      }
    );
  } catch (err) {
    console.error('Error hashing password: ', err);
    return res.status(500).json({ message: 'Error hashing password' });
  }
});

// API Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  pool.query(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, results) => {
      if (err) {
        console.error('Error logging in: ', err);
        res.status(500).json({ message: 'Error logging in' });
      } else {
        if (results.length > 0) {
          const user = results[0];
          const passwordMatch = await bcrypt.compare(password, user.password); // So sánh mật khẩu
          if (passwordMatch) {
            // Cập nhật online_status
            pool.query(
              'UPDATE users SET online_status = 1 WHERE username = ?',
              [username],
              async (updateErr, updateResults) => {
                if (updateErr) {
                  console.error('Error updating online_status:', updateErr);
                  // Xử lý lỗi cập nhật online_status (tùy chọn)
                }
                try {
                  await touchUserPresenceByUserId(user.id);
                } catch (presenceErr) {
                  console.error('Error updating user presence on login:', presenceErr);
                }

                // Đóng kỳ xổ số (nếu đổi ngày) + cộng Peta thắng ngay khi login
                await luckyBoothAdvanceOnSession();

                const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key', {
                  expiresIn: '23h',
                });
                res.json({
                  message: 'User logged in successfully',
                  token: token,
                  hasPet: user.hasPet // Trả về hasPet status
                });
              }
            );
          } else {
            res.status(401).json({ message: 'Tài khoản hoặc mật khẩu không đúng' }); // Hiển thị ở Login page
          }
        } else {
          res.status(401).json({ message: 'Invalid credentials' });
        }
      }
    }
  );
});

// API Refresh Token
app.post('/refresh-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify the token (even if expired, we can still decode it)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', { ignoreExpiration: true });
    
    // Check if user still exists and is active
    const [users] = await db.query('SELECT id, username, role, hasPet FROM users WHERE id = ?', [decoded.userId]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = users[0];
    const isAdmin = user.role === 'admin'; // ✅ Check role từ database
    
    // Generate new token
    const newToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '23h',
    });

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      isAdmin: isAdmin,
      hasPet: user.hasPet || false
    });
    
  } catch (err) {
    console.error('Error refreshing token:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// API Get User Profile
app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    await touchUserPresenceByUserId(decoded.userId);
    await luckyBoothAdvanceOnSession();
    
    const [users] = await db.query(`
      SELECT
        u.id,
        u.username,
        u.role,
        u.hasPet,
        u.peta,
        u.petagold,
        u.real_name,
        u.birthday,
        up.display_name,
        up.gender,
        up.avatar_url
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `, [decoded.userId]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = users[0];
    
    res.json({
      userId: user.id,
      username: user.username,
      displayName: user.display_name || null,
      effectiveName: user.display_name || user.username,
      role: user.role,
      isAdmin: user.role === 'admin',
      hasPet: user.hasPet || false,
      peta: user.peta || 0,
      petagold: user.petagold || 0,
      realName: user.real_name || '',
      birthday: user.birthday || null,
      gender: user.gender || '',
      avatarUrl: user.avatar_url || ''
    });
    
  } catch (err) {
    console.error('Error getting user profile:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.get('/api/assets/character-images', (req, res) => {
  try {
    const candidateDirs = [
      path.resolve(__dirname, '..', 'public', 'images', 'character'),
      path.resolve(__dirname, 'public', 'images', 'character'),
    ];

    const characterDir = candidateDirs.find((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
    if (!characterDir) {
      return res.json({ images: [] });
    }

    const files = fs.readdirSync(characterDir)
      .filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file))
      .sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));

    const images = files.map((file) => `/images/character/${file}`);
    res.json({ images });
  } catch (error) {
    console.error('Error listing character images:', error);
    res.status(500).json({ message: 'Không thể tải danh sách ảnh nhân vật' });
  }
});

app.put('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const {
      realName,
      birthday,
      displayName,
      gender,
      avatarUrl
    } = req.body || {};

    await db.query(
      'UPDATE users SET real_name = ?, birthday = ? WHERE id = ?',
      [
        typeof realName === 'string' ? realName.trim() || null : null,
        birthday || null,
        userId
      ]
    );

    await db.query(
      `
        INSERT INTO user_profiles (user_id, display_name, gender, avatar_url)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          display_name = VALUES(display_name),
          gender = VALUES(gender),
          avatar_url = VALUES(avatar_url)
      `,
      [
        userId,
        typeof displayName === 'string' ? displayName.trim() || null : null,
        typeof gender === 'string' ? gender.trim() || null : null,
        typeof avatarUrl === 'string' ? avatarUrl.trim() || null : null
      ]
    );

    res.json({ success: true, message: 'Cập nhật hồ sơ thành công' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Không thể cập nhật hồ sơ' });
  }
});

app.put('/api/user/password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Mật khẩu mới phải từ 8 ký tự' });
    }

    const [rows] = await db.query('SELECT password FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    const isMatch = await bcrypt.compare(String(currentPassword), rows[0].password || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Không thể đổi mật khẩu' });
  }
});

async function getAuthUserIdFromRequest(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return null;
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  return decoded.userId;
}

app.get('/api/guilds', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const [userRows] = await db.query('SELECT guild FROM users WHERE id = ? LIMIT 1', [userId]);
    const myGuildName = normalizeGuildName(userRows[0]?.guild);

    const [rows] = await db.query(
      `
        SELECT
          g.id,
          g.name,
          g.description,
          g.banner_url,
          g.admission_type,
          g.level,
          g.owner_user_id,
          g.created_at,
          u.username AS owner_username,
          up.display_name AS owner_display_name,
          COALESCE(m.member_count, 0) AS member_count
        FROM guilds g
        JOIN users u ON u.id = g.owner_user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN (
          SELECT guild, COUNT(*) AS member_count
          FROM users
          WHERE guild IS NOT NULL AND TRIM(guild) <> ''
          GROUP BY guild
        ) m ON m.guild = g.name
        ORDER BY g.level DESC, member_count DESC, g.created_at ASC
        LIMIT 200
      `
    );

    const guilds = rows.map((row) => {
      const memberLimit = getGuildMemberLimitByLevel(row.level);
      return {
        ...row,
        level: clampGuildLevel(row.level),
        member_limit: memberLimit,
        member_count: Number(row.member_count) || 0,
        is_full: Number(row.member_count) >= memberLimit,
      };
    });

    const myGuild = myGuildName
      ? guilds.find((g) => String(g.name).toLowerCase() === myGuildName.toLowerCase()) || null
      : null;

    res.json({
      myGuildName: myGuildName || null,
      myGuild,
      canCreateGuild: !myGuildName,
      guilds,
    });
  } catch (error) {
    console.error('Error fetching guilds:', error);
    res.status(500).json({ message: 'Không thể tải danh sách bang hội' });
  }
});

app.post('/api/guilds', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const bannerUrl = normalizeGuildBannerUrl(req.body?.bannerUrl);
    const admissionType = normalizeGuildAdmissionType(req.body?.admissionType);

    if (name.length < 3 || name.length > 60) {
      return res.status(400).json({ message: 'Tên bang hội phải từ 3-60 ký tự' });
    }
    if (description.length > 600) {
      return res.status(400).json({ message: 'Mô tả bang hội tối đa 600 ký tự' });
    }

    await connection.beginTransaction();

    const [userRows] = await connection.query(
      'SELECT id, guild, peta FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    if (!userRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    const currentGuild = normalizeGuildName(userRows[0].guild);
    if (currentGuild) {
      await connection.rollback();
      return res.status(409).json({ message: 'Bạn đã ở trong một bang hội' });
    }

    const [existsRows] = await connection.query(
      'SELECT id FROM guilds WHERE name = ? LIMIT 1',
      [name]
    );
    if (existsRows.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'Tên bang hội đã tồn tại' });
    }

    const initialLevel = 1;
    await connection.query(
      `
        INSERT INTO guilds (name, description, banner_url, admission_type, level, owner_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [name, description || null, bannerUrl || null, admissionType, initialLevel, userId]
    );
    await connection.query('UPDATE users SET guild = ? WHERE id = ?', [name, userId]);
    await connection.query(
      'INSERT INTO guild_members (guild_name, user_id, role) VALUES (?, ?, ?)',
      [name, userId, 'leader']
    );

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Tạo bang hội thành công',
      guild: {
        name,
        description: description || null,
        banner_url: bannerUrl || null,
        admission_type: admissionType,
        level: initialLevel,
        member_limit: getGuildMemberLimitByLevel(initialLevel),
        member_count: 1,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error creating guild:', error);
    res.status(500).json({ message: 'Không thể tạo bang hội lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/guilds/my', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const incomingName = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const bannerUrl = normalizeGuildBannerUrl(req.body?.bannerUrl);
    const admissionType = normalizeGuildAdmissionType(req.body?.admissionType);

    if (incomingName.length < 3 || incomingName.length > 60) {
      return res.status(400).json({ message: 'Tên bang hội phải từ 3-60 ký tự' });
    }
    if (description.length > 600) {
      return res.status(400).json({ message: 'Mô tả bang hội tối đa 600 ký tự' });
    }

    await connection.beginTransaction();

    const [userRows] = await connection.query(
      'SELECT id, guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    if (!userRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const currentGuildName = normalizeGuildName(userRows[0].guild);
    if (!currentGuildName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }

    const [guildRows] = await connection.query(
      'SELECT * FROM guilds WHERE name = ? LIMIT 1 FOR UPDATE',
      [currentGuildName]
    );
    if (!guildRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy bang hội hiện tại' });
    }

    const guildRow = guildRows[0];
    if (Number(guildRow.owner_user_id) !== Number(userId)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Chỉ chủ bang mới có thể chỉnh sửa' });
    }

    const renameRequested = incomingName.toLowerCase() !== currentGuildName.toLowerCase();
    if (renameRequested) {
      const [existsRows] = await connection.query(
        'SELECT id FROM guilds WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
        [incomingName, guildRow.id]
      );
      if (existsRows.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Tên bang hội đã tồn tại' });
      }

      const petaBalance = Number(userRows[0].peta) || 0;
      if (petaBalance < GUILD_RENAME_COST_PETA) {
        await connection.rollback();
        return res.status(400).json({
          message: `Đổi tên guild cần ${GUILD_RENAME_COST_PETA.toLocaleString('vi-VN')} Peta`,
        });
      }
    }

    await connection.query(
      `
        UPDATE guilds
        SET name = ?, description = ?, banner_url = ?, admission_type = ?
        WHERE id = ?
      `,
      [incomingName, description || null, bannerUrl || null, admissionType, guildRow.id]
    );

    if (renameRequested) {
      await connection.query('UPDATE users SET peta = peta - ? WHERE id = ?', [
        GUILD_RENAME_COST_PETA,
        userId,
      ]);
      try {
        await titleService.recordPetaSpent(db, userId, GUILD_RENAME_COST_PETA);
      } catch (e) {
        console.error('title spend (guild rename):', e);
      }
      await connection.query('UPDATE users SET guild = ? WHERE guild = ?', [incomingName, currentGuildName]);
      await connection.query('UPDATE guild_chat_messages SET guild_name = ? WHERE guild_name = ?', [
        incomingName,
        currentGuildName,
      ]);
      await connection.query('UPDATE guild_members SET guild_name = ? WHERE guild_name = ?', [
        incomingName,
        currentGuildName,
      ]);
      await connection.query('UPDATE guild_join_requests SET guild_name = ? WHERE guild_name = ?', [
        incomingName,
        currentGuildName,
      ]);
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Cập nhật bang hội thành công',
      renameCostPaid: renameRequested ? GUILD_RENAME_COST_PETA : 0,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error updating guild:', error);
    res.status(500).json({ message: 'Không thể cập nhật bang hội lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/guilds/my/members', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const [userRows] = await db.query('SELECT guild FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    const guildName = normalizeGuildName(userRows[0].guild);
    if (!guildName) {
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }

    const [guildRows] = await db.query(
      'SELECT id, owner_user_id FROM guilds WHERE name = ? LIMIT 1',
      [guildName]
    );
    if (!guildRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }
    const guild = guildRows[0];

    await db.query(
      `
        INSERT IGNORE INTO guild_members (guild_name, user_id, role)
        SELECT
          ? AS guild_name,
          u.id AS user_id,
          CASE
            WHEN u.id = ? THEN 'leader'
            ELSE 'member'
          END AS role
        FROM users u
        WHERE u.guild = ?
      `,
      [guildName, guild.owner_user_id, guildName]
    );

    const [membersRows] = await db.query(
      `
        SELECT
          u.id AS user_id,
          u.username,
          u.online_status,
          up.display_name,
          up.avatar_url,
          p.last_seen_at,
          gm.role,
          gm.joined_at
        FROM guild_members gm
        JOIN users u ON u.id = gm.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_presence p ON p.user_id = u.id
        WHERE gm.guild_name = ?
        ORDER BY
          CASE gm.role
            WHEN 'leader' THEN 1
            WHEN 'officer' THEN 2
            WHEN 'elite' THEN 3
            ELSE 4
          END ASC,
          gm.joined_at ASC
      `,
      [guildName]
    );

    const [roleRows] = await db.query(
      'SELECT role FROM guild_members WHERE guild_name = ? AND user_id = ? LIMIT 1',
      [guildName, userId]
    );
    const requesterRole = roleRows.length
      ? normalizeGuildRole(roleRows[0].role)
      : Number(userId) === Number(guild.owner_user_id)
      ? 'leader'
      : 'member';
    const canApprove = requesterRole === 'leader' || requesterRole === 'officer';

    const [pendingRows] = await db.query(
      `
        SELECT COUNT(*) AS pending_count
        FROM guild_join_requests
        WHERE guild_name = ? AND status = 'pending'
      `,
      [guildName]
    );
    const pendingCount = Number(pendingRows?.[0]?.pending_count) || 0;

    const members = membersRows.map((row) => {
      const status = getStatusLabel(row.online_status, row.last_seen_at);
      return {
        ...row,
        role: normalizeGuildRole(row.role),
        role_priority: getGuildRolePriority(row.role),
        status,
        last_seen_text: status === 'offline' ? formatLastSeen(row.last_seen_at) : null,
      };
    });

    res.json({
      guildName,
      requesterRole,
      canApprove,
      pendingCount,
      members,
    });
  } catch (error) {
    console.error('Error fetching guild members:', error);
    res.status(500).json({ message: 'Không thể tải danh sách thành viên bang hội' });
  }
});

app.get('/api/guilds/:guildName', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const guildNameParam = normalizeGuildName(decodeURIComponent(req.params.guildName || ''));
    if (!guildNameParam) {
      return res.status(400).json({ message: 'Thiếu tên bang hội' });
    }

    const [guildRows] = await db.query(
      `
        SELECT
          g.id,
          g.name,
          g.description,
          g.banner_url,
          g.admission_type,
          g.level,
          g.owner_user_id,
          g.created_at,
          u.username AS owner_username,
          up.display_name AS owner_display_name,
          up.avatar_url AS owner_avatar_url,
          COALESCE(m.member_count, 0) AS member_count
        FROM guilds g
        JOIN users u ON u.id = g.owner_user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN (
          SELECT guild, COUNT(*) AS member_count
          FROM users
          WHERE guild IS NOT NULL AND TRIM(guild) <> ''
          GROUP BY guild
        ) m ON m.guild = g.name
        WHERE LOWER(g.name) = LOWER(?)
        LIMIT 1
      `,
      [guildNameParam]
    );

    if (!guildRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }

    const guild = guildRows[0];
    const memberLimit = getGuildMemberLimitByLevel(guild.level);

    const [userRows] = await db.query('SELECT guild FROM users WHERE id = ? LIMIT 1', [userId]);
    const myGuildName = normalizeGuildName(userRows[0]?.guild);

    const [roleRows] = await db.query(
      'SELECT role FROM guild_members WHERE guild_name = ? AND user_id = ? LIMIT 1',
      [guild.name, userId]
    );
    const myRole = roleRows.length ? normalizeGuildRole(roleRows[0].role) : null;

    const [pendingRows] = await db.query(
      `
        SELECT id
        FROM guild_join_requests
        WHERE guild_name = ? AND user_id = ? AND status = 'pending'
        LIMIT 1
      `,
      [guild.name, userId]
    );

    res.json({
      guild: {
        ...guild,
        level: clampGuildLevel(guild.level),
        member_count: Number(guild.member_count) || 0,
        member_limit: memberLimit,
        is_full: Number(guild.member_count) >= memberLimit,
      },
      myGuildName: myGuildName || null,
      myRole,
      canEdit: Number(guild.owner_user_id) === Number(userId),
      canApply: !myGuildName && Number(guild.member_count) < memberLimit,
      hasPendingRequest: pendingRows.length > 0,
    });
  } catch (error) {
    console.error('Error fetching guild detail:', error);
    res.status(500).json({ message: 'Không thể tải thông tin bang hội' });
  }
});

app.post('/api/guilds/:guildName/apply', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const guildNameParam = normalizeGuildName(decodeURIComponent(req.params.guildName || ''));
    if (!guildNameParam) {
      return res.status(400).json({ message: 'Thiếu tên bang hội' });
    }

    await connection.beginTransaction();

    const [userRows] = await connection.query(
      'SELECT id, guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    if (!userRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    const myGuildName = normalizeGuildName(userRows[0].guild);
    if (myGuildName) {
      await connection.rollback();
      return res.status(409).json({ message: 'Bạn đã ở trong một bang hội' });
    }

    const [guildRows] = await connection.query(
      `
        SELECT id, name, admission_type, level
        FROM guilds
        WHERE LOWER(name) = LOWER(?)
        LIMIT 1
        FOR UPDATE
      `,
      [guildNameParam]
    );
    if (!guildRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }

    const guild = guildRows[0];
    const [memberRows] = await connection.query(
      `
        SELECT COUNT(*) AS member_count
        FROM users
        WHERE guild = ?
      `,
      [guild.name]
    );
    const memberCount = Number(memberRows?.[0]?.member_count) || 0;
    const memberLimit = getGuildMemberLimitByLevel(guild.level);
    if (memberCount >= memberLimit) {
      await connection.rollback();
      return res.status(409).json({ message: 'Bang hội đã đủ thành viên' });
    }

    if (normalizeGuildAdmissionType(guild.admission_type) === 'free') {
      await connection.query('UPDATE users SET guild = ? WHERE id = ?', [guild.name, userId]);
      await connection.query(
        `
          INSERT INTO guild_members (guild_name, user_id, role)
          VALUES (?, ?, 'member')
          ON DUPLICATE KEY UPDATE role = VALUES(role), updated_at = CURRENT_TIMESTAMP
        `,
        [guild.name, userId]
      );
      await connection.query(
        `
          UPDATE guild_join_requests
          SET status = 'accepted'
          WHERE guild_name = ? AND user_id = ? AND status = 'pending'
        `,
        [guild.name, userId]
      );
      await connection.query(
        `
          UPDATE guild_join_requests
          SET status = 'cancelled'
          WHERE user_id = ? AND guild_name <> ? AND status = 'pending'
        `,
        [userId, guild.name]
      );
      await connection.commit();
      return res.json({ success: true, joined: true, message: 'Gia nhập bang hội thành công' });
    }

    const [pendingRows] = await connection.query(
      `
        SELECT id
        FROM guild_join_requests
        WHERE guild_name = ? AND user_id = ? AND status = 'pending'
        LIMIT 1
      `,
      [guild.name, userId]
    );
    if (pendingRows.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'Bạn đã gửi yêu cầu gia nhập bang hội này' });
    }

    await connection.query(
      `
        INSERT INTO guild_join_requests (guild_name, user_id, status)
        VALUES (?, ?, 'pending')
      `,
      [guild.name, userId]
    );
    await connection.commit();
    res.json({ success: true, joined: false, message: 'Đã gửi yêu cầu xin gia nhập bang hội' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error applying to guild:', error);
    res.status(500).json({ message: 'Không thể xin gia nhập bang hội lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/guilds/my/applications', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const [rows] = await db.query(
      `
        SELECT
          r.id AS request_id,
          r.guild_name,
          r.created_at,
          g.admission_type,
          g.level,
          COALESCE(m.member_count, 0) AS member_count
        FROM guild_join_requests r
        JOIN guilds g ON g.name = r.guild_name
        LEFT JOIN (
          SELECT guild, COUNT(*) AS member_count
          FROM users
          WHERE guild IS NOT NULL AND TRIM(guild) <> ''
          GROUP BY guild
        ) m ON m.guild = g.name
        WHERE r.user_id = ? AND r.status = 'pending'
        ORDER BY r.created_at DESC
      `,
      [userId]
    );

    const applications = rows.map((row) => ({
      ...row,
      member_limit: getGuildMemberLimitByLevel(row.level),
    }));

    res.json({ applications });
  } catch (error) {
    console.error('Error fetching guild applications:', error);
    res.status(500).json({ message: 'Không thể tải danh sách bang hội đã nộp đơn' });
  }
});

app.delete('/api/guilds/my/applications/:requestId', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const requestId = Number(req.params.requestId);
    if (!requestId) {
      return res.status(400).json({ message: 'requestId không hợp lệ' });
    }

    const [result] = await db.query(
      `
        UPDATE guild_join_requests
        SET status = 'cancelled'
        WHERE id = ? AND user_id = ? AND status = 'pending'
      `,
      [requestId, userId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Không tìm thấy đơn đang chờ để hủy' });
    }

    res.json({ success: true, message: 'Đã hủy đơn xin gia nhập' });
  } catch (error) {
    console.error('Error cancelling guild application:', error);
    res.status(500).json({ message: 'Không thể hủy đơn lúc này' });
  }
});

app.get('/api/guilds/my/join-requests', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const [userRows] = await db.query('SELECT guild FROM users WHERE id = ? LIMIT 1', [userId]);
    const guildName = normalizeGuildName(userRows[0]?.guild);
    if (!guildName) {
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }

    const [guildRows] = await db.query(
      'SELECT owner_user_id FROM guilds WHERE name = ? LIMIT 1',
      [guildName]
    );
    if (!guildRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }
    const ownerUserId = Number(guildRows[0].owner_user_id);

    const [roleRows] = await db.query(
      'SELECT role FROM guild_members WHERE guild_name = ? AND user_id = ? LIMIT 1',
      [guildName, userId]
    );
    const requesterRole = roleRows.length
      ? normalizeGuildRole(roleRows[0].role)
      : Number(userId) === ownerUserId
      ? 'leader'
      : 'member';
    const canApprove = requesterRole === 'leader' || requesterRole === 'officer';
    if (!canApprove) {
      return res.status(403).json({ message: 'Bạn không có quyền duyệt đơn' });
    }

    const [rows] = await db.query(
      `
        SELECT
          r.id AS request_id,
          r.user_id,
          r.created_at,
          u.username,
          u.online_status,
          up.display_name,
          up.avatar_url,
          p.last_seen_at
        FROM guild_join_requests r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_presence p ON p.user_id = u.id
        WHERE r.guild_name = ? AND r.status = 'pending'
        ORDER BY r.created_at ASC
      `,
      [guildName]
    );

    const requests = rows.map((row) => {
      const status = getStatusLabel(row.online_status, row.last_seen_at);
      return {
        ...row,
        status,
        last_seen_text: status === 'offline' ? formatLastSeen(row.last_seen_at) : null,
      };
    });

    res.json({ guildName, requesterRole, requests });
  } catch (error) {
    console.error('Error fetching guild join requests:', error);
    res.status(500).json({ message: 'Không thể tải danh sách đơn xin gia nhập' });
  }
});

app.post('/api/guilds/my/members/:memberUserId/kick', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const memberUserId = Number(req.params.memberUserId);
    if (!memberUserId) {
      return res.status(400).json({ message: 'memberUserId không hợp lệ' });
    }

    await connection.beginTransaction();

    const [actorRows] = await connection.query(
      'SELECT guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    const guildName = normalizeGuildName(actorRows[0]?.guild);
    if (!guildName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }

    const [actorRoleRows] = await connection.query(
      'SELECT role FROM guild_members WHERE guild_name = ? AND user_id = ? LIMIT 1',
      [guildName, userId]
    );
    const actorRole = actorRoleRows.length
      ? normalizeGuildRole(actorRoleRows[0].role)
      : 'member';
    if (!['leader', 'officer'].includes(actorRole)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền kick thành viên' });
    }
    if (Number(memberUserId) === Number(userId)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Bạn không thể tự kick chính mình' });
    }

    const [targetRoleRows] = await connection.query(
      `
        SELECT gm.role, u.guild
        FROM guild_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.guild_name = ? AND gm.user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [guildName, memberUserId]
    );
    if (!targetRoleRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy thành viên trong guild' });
    }

    const targetRole = normalizeGuildRole(targetRoleRows[0].role);
    const actorPriority = getGuildRolePriority(actorRole);
    const targetPriority = getGuildRolePriority(targetRole);
    if (!(actorPriority < targetPriority)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Bạn không thể kick role này' });
    }

    await connection.query('UPDATE users SET guild = NULL WHERE id = ?', [memberUserId]);
    await connection.query('DELETE FROM guild_members WHERE guild_name = ? AND user_id = ?', [
      guildName,
      memberUserId,
    ]);
    await connection.query(
      `
        UPDATE guild_join_requests
        SET status = 'cancelled'
        WHERE user_id = ? AND status = 'pending'
      `,
      [memberUserId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Đã kick thành viên khỏi bang hội' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error kicking guild member:', error);
    res.status(500).json({ message: 'Không thể kick thành viên lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/guilds/my/members/:memberUserId/role', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const memberUserId = Number(req.params.memberUserId);
    const nextRole = normalizeGuildRole(req.body?.role);
    if (!memberUserId) {
      return res.status(400).json({ message: 'memberUserId không hợp lệ' });
    }

    await connection.beginTransaction();

    const [actorRows] = await connection.query(
      'SELECT guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    const guildName = normalizeGuildName(actorRows[0]?.guild);
    if (!guildName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }

    const [guildRows] = await connection.query(
      'SELECT id, owner_user_id FROM guilds WHERE name = ? LIMIT 1 FOR UPDATE',
      [guildName]
    );
    if (!guildRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }
    const guild = guildRows[0];
    if (Number(userId) !== Number(guild.owner_user_id)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Chỉ Leader mới có thể đổi role' });
    }
    if (Number(memberUserId) === Number(userId)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Leader không thể tự đổi role tại đây' });
    }

    const [targetRows] = await connection.query(
      `
        SELECT gm.role
        FROM guild_members gm
        WHERE gm.guild_name = ? AND gm.user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [guildName, memberUserId]
    );
    if (!targetRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy thành viên trong guild' });
    }

    if (nextRole === 'leader') {
      await connection.query(
        'UPDATE guild_members SET role = ? WHERE guild_name = ? AND user_id = ?',
        ['officer', guildName, userId]
      );
      await connection.query(
        'UPDATE guild_members SET role = ? WHERE guild_name = ? AND user_id = ?',
        ['leader', guildName, memberUserId]
      );
      await connection.query('UPDATE guilds SET owner_user_id = ? WHERE id = ?', [
        memberUserId,
        guild.id,
      ]);
      await connection.commit();
      return res.json({ success: true, message: 'Đã chuyển quyền Leader thành công' });
    }

    await connection.query(
      'UPDATE guild_members SET role = ? WHERE guild_name = ? AND user_id = ?',
      [nextRole, guildName, memberUserId]
    );
    await connection.commit();
    res.json({ success: true, message: 'Đã cập nhật role thành viên' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error updating guild member role:', error);
    res.status(500).json({ message: 'Không thể đổi role lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/guilds/my/disband', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const confirmName = normalizeGuildName(req.body?.confirmName);
    if (!confirmName) {
      return res.status(400).json({ message: 'Thiếu tên bang hội xác nhận' });
    }

    await connection.beginTransaction();

    const [userRows] = await connection.query(
      'SELECT guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    const guildName = normalizeGuildName(userRows[0]?.guild);
    if (!guildName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }
    if (guildName !== confirmName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Tên bang hội xác nhận không khớp' });
    }

    const [guildRows] = await connection.query(
      'SELECT id, owner_user_id FROM guilds WHERE name = ? LIMIT 1 FOR UPDATE',
      [guildName]
    );
    if (!guildRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }
    const guild = guildRows[0];
    if (Number(guild.owner_user_id) !== Number(userId)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Chỉ Leader mới có thể disband guild' });
    }

    const [memberCountRows] = await connection.query(
      'SELECT COUNT(*) AS member_count FROM users WHERE guild = ?',
      [guildName]
    );
    const memberCount = Number(memberCountRows?.[0]?.member_count) || 0;
    if (memberCount !== 1) {
      await connection.rollback();
      return res.status(409).json({ message: 'Chỉ có thể disband khi guild còn đúng 1 thành viên' });
    }

    const [roleRows] = await connection.query(
      'SELECT role FROM guild_members WHERE guild_name = ? AND user_id = ? LIMIT 1',
      [guildName, userId]
    );
    const role = roleRows.length ? normalizeGuildRole(roleRows[0].role) : 'member';
    if (role !== 'leader') {
      await connection.rollback();
      return res.status(403).json({ message: 'Chỉ Leader mới có thể disband guild' });
    }

    await connection.query('UPDATE users SET guild = NULL WHERE guild = ?', [guildName]);
    await connection.query('DELETE FROM guild_members WHERE guild_name = ?', [guildName]);
    await connection.query(
      'UPDATE guild_join_requests SET status = \'cancelled\' WHERE guild_name = ? AND status = \'pending\'',
      [guildName]
    );
    await connection.query('DELETE FROM guilds WHERE id = ?', [guild.id]);

    await connection.commit();
    res.json({ success: true, message: 'Đã giải tán bang hội thành công' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error disbanding guild:', error);
    res.status(500).json({ message: 'Không thể giải tán bang hội lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/guilds/my/join-requests/:requestId/approve', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const requestId = Number(req.params.requestId);
    if (!requestId) {
      return res.status(400).json({ message: 'requestId không hợp lệ' });
    }

    await connection.beginTransaction();

    const [userRows] = await connection.query(
      'SELECT guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    const guildName = normalizeGuildName(userRows[0]?.guild);
    if (!guildName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }

    const [guildRows] = await connection.query(
      'SELECT id, owner_user_id, level FROM guilds WHERE name = ? LIMIT 1 FOR UPDATE',
      [guildName]
    );
    if (!guildRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }
    const guild = guildRows[0];

    const [roleRows] = await connection.query(
      'SELECT role FROM guild_members WHERE guild_name = ? AND user_id = ? LIMIT 1',
      [guildName, userId]
    );
    const requesterRole = roleRows.length
      ? normalizeGuildRole(roleRows[0].role)
      : Number(userId) === Number(guild.owner_user_id)
      ? 'leader'
      : 'member';
    if (!['leader', 'officer'].includes(requesterRole)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền duyệt đơn' });
    }

    const [requestRows] = await connection.query(
      `
        SELECT id, user_id, status
        FROM guild_join_requests
        WHERE id = ? AND guild_name = ? AND status = 'pending'
        LIMIT 1
        FOR UPDATE
      `,
      [requestId, guildName]
    );
    if (!requestRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đơn chờ duyệt' });
    }
    const targetUserId = Number(requestRows[0].user_id);

    const [targetUserRows] = await connection.query(
      'SELECT guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [targetUserId]
    );
    if (!targetUserRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy người nộp đơn' });
    }
    if (normalizeGuildName(targetUserRows[0].guild)) {
      await connection.query(
        'UPDATE guild_join_requests SET status = \'cancelled\' WHERE user_id = ? AND status = \'pending\'',
        [targetUserId]
      );
      await connection.commit();
      return res.status(409).json({ message: 'Người chơi này đã gia nhập bang hội khác' });
    }

    const [memberRows] = await connection.query(
      'SELECT COUNT(*) AS member_count FROM users WHERE guild = ?',
      [guildName]
    );
    const memberCount = Number(memberRows?.[0]?.member_count) || 0;
    const memberLimit = getGuildMemberLimitByLevel(guild.level);
    if (memberCount >= memberLimit) {
      await connection.rollback();
      return res.status(409).json({ message: 'Bang hội đã đủ thành viên' });
    }

    await connection.query('UPDATE users SET guild = ? WHERE id = ?', [guildName, targetUserId]);
    await connection.query(
      `
        INSERT INTO guild_members (guild_name, user_id, role)
        VALUES (?, ?, 'member')
        ON DUPLICATE KEY UPDATE role = 'member', updated_at = CURRENT_TIMESTAMP
      `,
      [guildName, targetUserId]
    );
    await connection.query(
      `
        UPDATE guild_join_requests
        SET status = 'accepted'
        WHERE id = ?
      `,
      [requestId]
    );
    await connection.query(
      `
        UPDATE guild_join_requests
        SET status = 'cancelled'
        WHERE user_id = ? AND status = 'pending'
      `,
      [targetUserId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Đã duyệt đơn và thêm thành viên vào bang hội' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error approving guild join request:', error);
    res.status(500).json({ message: 'Không thể duyệt đơn lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/guilds/my/join-requests/:requestId/reject', async (req, res) => {
  let connection = null;
  try {
    connection = await db.getConnection();
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const requestId = Number(req.params.requestId);
    if (!requestId) {
      return res.status(400).json({ message: 'requestId không hợp lệ' });
    }

    await connection.beginTransaction();

    const [userRows] = await connection.query(
      'SELECT guild FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );
    const guildName = normalizeGuildName(userRows[0]?.guild);
    if (!guildName) {
      await connection.rollback();
      return res.status(400).json({ message: 'Bạn chưa ở trong bang hội nào' });
    }

    const [guildRows] = await connection.query(
      'SELECT owner_user_id FROM guilds WHERE name = ? LIMIT 1 FOR UPDATE',
      [guildName]
    );
    if (!guildRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy bang hội' });
    }
    const ownerUserId = Number(guildRows[0].owner_user_id);

    const [roleRows] = await connection.query(
      'SELECT role FROM guild_members WHERE guild_name = ? AND user_id = ? LIMIT 1',
      [guildName, userId]
    );
    const requesterRole = roleRows.length
      ? normalizeGuildRole(roleRows[0].role)
      : Number(userId) === ownerUserId
      ? 'leader'
      : 'member';
    if (!['leader', 'officer'].includes(requesterRole)) {
      await connection.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền từ chối đơn' });
    }

    const [requestRows] = await connection.query(
      `
        SELECT id, user_id
        FROM guild_join_requests
        WHERE id = ? AND guild_name = ? AND status = 'pending'
        LIMIT 1
        FOR UPDATE
      `,
      [requestId, guildName]
    );
    if (!requestRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đơn chờ duyệt' });
    }
    const targetUserId = Number(requestRows[0].user_id);

    await connection.query('UPDATE guild_join_requests SET status = \'rejected\' WHERE id = ?', [requestId]);
    await connection.query(
      'UPDATE guild_join_requests SET status = \'cancelled\' WHERE user_id = ? AND status = \'pending\'',
      [targetUserId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Đã từ chối đơn xin gia nhập' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback error
      }
    }
    console.error('Error rejecting guild join request:', error);
    res.status(500).json({ message: 'Không thể từ chối đơn lúc này' });
  } finally {
    if (connection) connection.release();
  }
});

async function fetchWorldChatHistory(limit, beforeId) {
  const params = [];
  let whereClause = '';
  if (beforeId > 0) {
    whereClause = 'WHERE m.id < ?';
    params.push(beforeId);
  }
  const [rows] = await db.query(
    `
      SELECT
        m.id,
        m.user_id,
        m.message_text,
        m.created_at,
        u.username,
        u.guild,
        up.display_name,
        up.avatar_url
      FROM global_chat_messages m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      ${whereClause}
      ORDER BY m.id DESC
      LIMIT ?
    `,
    [...params, limit]
  );
  return rows.reverse().map((row) => toChatMessagePayload({ ...row, channel: 'world' }));
}

app.get('/api/chat/world', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const limit = Math.min(
      WORLD_CHAT_HISTORY_LIMIT,
      Math.max(1, Number(req.query.limit || WORLD_CHAT_HISTORY_LIMIT))
    );
    const beforeId = Number(req.query.beforeId || 0);
    const messages = await fetchWorldChatHistory(limit, beforeId);

    res.json({
      cooldownSeconds: CHAT_COOLDOWN_SECONDS,
      maxMessageLength: CHAT_MESSAGE_MAX_LENGTH,
      messages,
    });
  } catch (error) {
    console.error('Error fetching world chat messages:', error);
    res.status(500).json({ message: 'Không thể tải lịch sử chat World' });
  }
});

app.get('/api/chat/global', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const limit = Math.min(
      WORLD_CHAT_HISTORY_LIMIT,
      Math.max(1, Number(req.query.limit || WORLD_CHAT_HISTORY_LIMIT))
    );
    const beforeId = Number(req.query.beforeId || 0);
    const messages = await fetchWorldChatHistory(limit, beforeId);

    res.json({
      cooldownSeconds: CHAT_COOLDOWN_SECONDS,
      maxMessageLength: CHAT_MESSAGE_MAX_LENGTH,
      messages,
    });
  } catch (error) {
    console.error('Error fetching global chat messages:', error);
    res.status(500).json({ message: 'Không thể tải lịch sử chat' });
  }
});

app.get('/api/chat/guild', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const [profileRows] = await db.query('SELECT guild FROM users WHERE id = ? LIMIT 1', [userId]);
    const guildName = normalizeGuildName(profileRows[0]?.guild);
    if (!guildName) {
      return res.status(403).json({
        requiresGuild: true,
        message: 'Bạn chưa có bang hội nên không thể chat Guild',
        messages: [],
      });
    }

    const limit = Math.min(GUILD_CHAT_HISTORY_LIMIT, Math.max(1, Number(req.query.limit || GUILD_CHAT_HISTORY_LIMIT)));
    const [rows] = await db.query(
      `
        SELECT
          m.id,
          m.user_id,
          m.message_text,
          m.created_at,
          u.username,
          u.guild,
          up.display_name,
          up.avatar_url
        FROM guild_chat_messages m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE m.guild_name = ?
        ORDER BY m.id DESC
        LIMIT ?
      `,
      [guildName, limit]
    );

    res.json({
      cooldownSeconds: CHAT_COOLDOWN_SECONDS,
      maxMessageLength: CHAT_MESSAGE_MAX_LENGTH,
      guild: guildName,
      messages: rows.reverse().map((row) => toChatMessagePayload({ ...row, channel: 'guild' })),
    });
  } catch (error) {
    console.error('Error fetching guild chat messages:', error);
    res.status(500).json({ message: 'Không thể tải lịch sử chat Guild' });
  }
});

app.get('/api/chat/system', async (req, res) => {
  try {
    const userId = await getAuthUserIdFromRequest(req, res);
    if (!userId) return;
    await touchUserPresenceByUserIdThrottled(userId, false);

    const limit = Math.min(SYSTEM_CHAT_HISTORY_LIMIT, Math.max(1, Number(req.query.limit || SYSTEM_CHAT_HISTORY_LIMIT)));
    const [rows] = await db.query(
      `
        SELECT id, event_type, actor_user_id, message_text, payload_json, created_at
        FROM system_chat_events
        ORDER BY id DESC
        LIMIT ?
      `,
      [limit]
    );

    res.json({
      messages: rows.reverse().map(toSystemMessagePayload),
    });
  } catch (error) {
    console.error('Error fetching system chat events:', error);
    res.status(500).json({ message: 'Không thể tải lịch sử hệ thống' });
  }
});

app.post('/api/realtime/legend-caught', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserIdThrottled(userId, true);

    const profile = await getUserBasicProfile(userId);
    if (!profile) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    const petName = String(req.body?.petName || 'Legend Pet').trim() || 'Legend Pet';
    const rarity = String(req.body?.rarity || 'Legend').trim() || 'Legend';
    const createdAt = new Date().toISOString();
    const actorName = profile.display_name || profile.username || 'Người chơi';
    const systemMessageText = `Người chơi ${actorName} vừa bắt được ${petName} (${rarity})`;
    const systemPayload = {
      type: 'legend:caught',
      user: {
        user_id: profile.user_id,
        username: profile.username,
        display_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null,
      },
      petName,
      rarity,
      created_at: createdAt,
    };

    const [eventInsert] = await db.query(
      `
        INSERT INTO system_chat_events (event_type, actor_user_id, message_text, payload_json)
        VALUES (?, ?, ?, ?)
      `,
      ['legend:caught', userId, systemMessageText, JSON.stringify(systemPayload)]
    );

    await db.query(
      `
        DELETE FROM system_chat_events
        WHERE id NOT IN (
          SELECT id
          FROM (
            SELECT id
            FROM system_chat_events
            ORDER BY id DESC
            LIMIT ?
          ) AS keep_rows
        )
      `,
      [SYSTEM_CHAT_HISTORY_LIMIT]
    );

    io.to('global').emit('legend:caught', systemPayload);
    io.to('global').emit('system:event', {
      id: eventInsert.insertId,
      channel: 'system',
      type: 'legend:caught',
      message: systemMessageText,
      created_at: createdAt,
      payload: systemPayload,
    });

    res.json({ success: true, message: 'Đã broadcast sự kiện bắt pet hiếm' });
  } catch (error) {
    console.error('Error broadcasting legend event:', error);
    res.status(500).json({ message: 'Không thể broadcast sự kiện' });
  }
});

app.get('/api/buddies', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const [friends] = await db.query(
      `
        SELECT
          u.id AS user_id,
          u.username,
          u.guild,
          u.online_status,
          up.display_name,
          up.avatar_url,
          p.last_seen_at,
          f.created_at AS friendship_created_at
        FROM user_friendships f
        JOIN users u ON u.id = f.friend_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_presence p ON p.user_id = u.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT 50
      `,
      [userId]
    );

    const [receivedRequests] = await db.query(
      `
        SELECT
          r.id AS request_id,
          r.created_at,
          u.id AS user_id,
          u.username,
          u.guild,
          up.display_name,
          up.avatar_url
        FROM user_friend_requests r
        JOIN users u ON u.id = r.sender_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE r.receiver_id = ? AND r.status = 'pending'
        ORDER BY r.created_at DESC
      `,
      [userId]
    );

    const [sentRequests] = await db.query(
      `
        SELECT
          r.id AS request_id,
          r.created_at,
          u.id AS user_id,
          u.username,
          u.guild,
          up.display_name,
          up.avatar_url
        FROM user_friend_requests r
        JOIN users u ON u.id = r.receiver_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE r.sender_id = ? AND r.status = 'pending'
        ORDER BY r.created_at DESC
      `,
      [userId]
    );

    const [recommended] = await db.query(
      `
        SELECT
          u.id AS user_id,
          u.username,
          u.guild,
          u.online_status,
          up.display_name,
          up.avatar_url,
          p.last_seen_at
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_presence p ON p.user_id = u.id
        WHERE
          u.id <> ?
          AND NOT EXISTS (
            SELECT 1
            FROM user_friendships f
            WHERE f.user_id = ? AND f.friend_id = u.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM user_friend_requests r
            WHERE r.status = 'pending'
              AND (
                (r.sender_id = ? AND r.receiver_id = u.id)
                OR (r.sender_id = u.id AND r.receiver_id = ?)
              )
          )
        ORDER BY RAND()
        LIMIT 5
      `,
      [userId, userId, userId, userId]
    );

    const normalizeStatus = (row) => {
      const status = getStatusLabel(row.online_status, row.last_seen_at);
      return {
        ...row,
        status,
        last_seen_text: status === 'offline' ? formatLastSeen(row.last_seen_at) : null,
      };
    };

    res.json({
      friends: friends.map(normalizeStatus),
      receivedRequests,
      sentRequests,
      recommended: recommended.map(normalizeStatus),
      counts: {
        friends: friends.length,
        receivedRequests: receivedRequests.length,
        sentRequests: sentRequests.length,
      },
    });
  } catch (error) {
    console.error('Error fetching buddies overview:', error);
    res.status(500).json({ message: 'Không thể tải dữ liệu bạn bè' });
  }
});

app.get('/api/buddies/search', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const keyword = String(req.query.q || '').trim();
    if (!keyword) return res.json({ users: [] });

    const likeQuery = `%${keyword}%`;
    const [rows] = await db.query(
      `
        SELECT
          u.id AS user_id,
          u.username,
          u.guild,
          u.online_status,
          up.display_name,
          up.avatar_url,
          p.last_seen_at,
          CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS is_friend,
          CASE WHEN outgoing.id IS NULL THEN 0 ELSE 1 END AS has_outgoing_request,
          CASE WHEN incoming.id IS NULL THEN 0 ELSE 1 END AS has_incoming_request
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN user_presence p ON p.user_id = u.id
        LEFT JOIN user_friendships f
          ON f.user_id = ? AND f.friend_id = u.id
        LEFT JOIN user_friend_requests outgoing
          ON outgoing.sender_id = ? AND outgoing.receiver_id = u.id AND outgoing.status = 'pending'
        LEFT JOIN user_friend_requests incoming
          ON incoming.sender_id = u.id AND incoming.receiver_id = ? AND incoming.status = 'pending'
        WHERE
          u.id <> ?
          AND (
            u.username LIKE ?
            OR up.display_name LIKE ?
            OR CAST(u.id AS CHAR) = ?
          )
        ORDER BY
          (CASE WHEN CAST(u.id AS CHAR) = ? THEN 0 ELSE 1 END),
          u.username ASC
        LIMIT 50
      `,
      [userId, userId, userId, userId, likeQuery, likeQuery, keyword, keyword]
    );

    const users = rows.map((row) => {
      const status = getStatusLabel(row.online_status, row.last_seen_at);
      return {
        ...row,
        status,
        last_seen_text: status === 'offline' ? formatLastSeen(row.last_seen_at) : null,
      };
    });

    res.json({ users });
  } catch (error) {
    console.error('Error searching buddies:', error);
    res.status(500).json({ message: 'Không thể tìm kiếm người chơi' });
  }
});

app.post('/api/buddies/requests', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const receiverId = Number(req.body?.receiverId);
    if (!receiverId) return res.status(400).json({ message: 'Thiếu receiverId' });
    if (receiverId === userId) return res.status(400).json({ message: 'Không thể tự kết bạn với chính mình' });

    const [userExists] = await db.query('SELECT id FROM users WHERE id = ? LIMIT 1', [receiverId]);
    if (!userExists.length) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    const [friendExists] = await db.query(
      'SELECT 1 FROM user_friendships WHERE user_id = ? AND friend_id = ? LIMIT 1',
      [userId, receiverId]
    );
    if (friendExists.length) return res.status(409).json({ message: 'Hai bạn đã là bạn bè' });

    const [pendingExists] = await db.query(
      `
        SELECT 1
        FROM user_friend_requests
        WHERE status = 'pending'
          AND (
            (sender_id = ? AND receiver_id = ?)
            OR (sender_id = ? AND receiver_id = ?)
          )
        LIMIT 1
      `,
      [userId, receiverId, receiverId, userId]
    );
    if (pendingExists.length) return res.status(409).json({ message: 'Đã có lời mời kết bạn đang chờ xử lý' });

    await db.query(
      'INSERT INTO user_friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)',
      [userId, receiverId, 'pending']
    );

    res.json({ success: true, message: 'Đã gửi lời mời kết bạn' });
  } catch (error) {
    console.error('Error sending buddy request:', error);
    res.status(500).json({ message: 'Không thể gửi lời mời kết bạn' });
  }
});

app.post('/api/buddies/requests/:requestId/accept', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const requestId = Number(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: 'requestId không hợp lệ' });

    await conn.beginTransaction();
    const [rows] = await conn.query(
      `
        SELECT id, sender_id, receiver_id, status
        FROM user_friend_requests
        WHERE id = ?
        FOR UPDATE
      `,
      [requestId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lời mời' });
    }

    const request = rows[0];
    if (request.receiver_id !== userId) {
      await conn.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền chấp nhận lời mời này' });
    }
    if (request.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ message: 'Lời mời đã được xử lý trước đó' });
    }

    await conn.query(
      'UPDATE user_friend_requests SET status = ? WHERE id = ?',
      ['accepted', requestId]
    );

    await conn.query(
      `
        INSERT INTO user_friendships (user_id, friend_id)
        VALUES (?, ?), (?, ?)
        ON DUPLICATE KEY UPDATE created_at = created_at
      `,
      [request.sender_id, request.receiver_id, request.receiver_id, request.sender_id]
    );

    await conn.query(
      `
        UPDATE user_friend_requests
        SET status = 'cancelled'
        WHERE status = 'pending'
          AND sender_id = ?
          AND receiver_id = ?
      `,
      [request.receiver_id, request.sender_id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Đã chấp nhận lời mời kết bạn' });
  } catch (error) {
    try { await conn.rollback(); } catch (_) {}
    console.error('Error accepting buddy request:', error);
    res.status(500).json({ message: 'Không thể chấp nhận lời mời' });
  } finally {
    conn.release();
  }
});

app.post('/api/buddies/requests/:requestId/reject', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const requestId = Number(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: 'requestId không hợp lệ' });

    const [result] = await db.query(
      `
        UPDATE user_friend_requests
        SET status = 'rejected'
        WHERE id = ? AND receiver_id = ? AND status = 'pending'
      `,
      [requestId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Không tìm thấy lời mời chờ xử lý' });
    }

    res.json({ success: true, message: 'Đã từ chối lời mời kết bạn' });
  } catch (error) {
    console.error('Error rejecting buddy request:', error);
    res.status(500).json({ message: 'Không thể từ chối lời mời' });
  }
});

app.post('/api/buddies/requests/:requestId/cancel', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const requestId = Number(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: 'requestId không hợp lệ' });

    const [result] = await db.query(
      `
        UPDATE user_friend_requests
        SET status = 'cancelled'
        WHERE id = ? AND sender_id = ? AND status = 'pending'
      `,
      [requestId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Không tìm thấy lời mời chờ xử lý' });
    }

    res.json({ success: true, message: 'Đã hủy lời mời kết bạn' });
  } catch (error) {
    console.error('Error canceling buddy request:', error);
    res.status(500).json({ message: 'Không thể hủy lời mời' });
  }
});

app.delete('/api/buddies/:friendId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await touchUserPresenceByUserId(userId);

    const friendId = Number(req.params.friendId);
    if (!friendId) return res.status(400).json({ message: 'friendId không hợp lệ' });

    const [result] = await db.query(
      `
        DELETE FROM user_friendships
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
      `,
      [userId, friendId, friendId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Không tìm thấy bạn bè cần xóa' });
    }

    await db.query(
      `
        UPDATE user_friend_requests
        SET status = 'cancelled'
        WHERE status = 'pending'
          AND (
            (sender_id = ? AND receiver_id = ?)
            OR (sender_id = ? AND receiver_id = ?)
          )
      `,
      [userId, friendId, friendId, userId]
    );

    res.json({ success: true, message: 'Đã xóa bạn bè' });
  } catch (error) {
    console.error('Error removing buddy:', error);
    res.status(500).json({ message: 'Không thể xóa bạn bè' });
  }
});

// API Lấy Danh Sách Thú Cưng Của Người Dùng
app.get('/users/:userId/pets', (req, res) => {
  const userId = req.params.userId;
  const token = req.headers.authorization?.split(' ')[1]; // Lấy token từ header

  if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); // Xác thực token
      const tokenUserId = decodedToken.userId;

      // Kiểm tra xem user có quyền truy cập pets của userId này không
      if (tokenUserId !== parseInt(userId)) {
          return res.status(403).json({ message: 'Forbidden: You can only access your own pets' });
      }

      /** Luôn ẩn pet đang treo đấu giá (giống item đã trừ khỏi túi). */
      const hideListedSql = `
        AND (p.is_listed = 0 OR p.is_listed IS NULL)
      `;
      const auctionEligible = String(req.query.auction_eligible || '') === '1';
      const auctionEligibleExtraSql = auctionEligible
        ? `
        AND NOT EXISTS (
          SELECT 1 FROM user_spirits us WHERE us.equipped_pet_id = p.id AND us.is_equipped = 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM inventory i WHERE i.equipped_pet_id = p.id AND i.is_equipped = 1
        )
      `
        : '';

      pool.query(`
        SELECT
          p.id,
          p.uuid,
          p.name,
          ps.name AS species_name,
          ps.image,
          p.level,
          p.current_exp,
          p.current_hp,
          p.hp,
          p.mp,
          p.str,
          p.def,
          p.intelligence,
          p.spd,
          p.final_stats,
          p.hunger_status,
          p.hunger_vitals_at,
          p.mood,
          p.mood_vitals_at
        FROM pets p
        JOIN pet_species ps ON p.pet_species_id = ps.id
        WHERE p.owner_id = ?
        ${hideListedSql}
        ${auctionEligibleExtraSql}
      `, [userId], async (err, results) => {
        if (err) {
          console.error('Error fetching user pets: ', err);
          res.status(500).json({ message: 'Error fetching user pets' });
        } else {
          // Decay hunger/mood in-memory so list reflects "Tử Vong" without N writes
          const pets = results.map((pet) => {
            const dec = petVitals.computeDecayedVitals(pet);
            return {
              ...pet,
              hunger_status: dec.hunger,
              mood: dec.mood,
              hunger_status_text: petVitals.getHungerStatusText(dec.hunger),
            };
          });
          try {
            const [cntRows] = await pool.promise().query(
              'SELECT COUNT(*) AS c FROM pets WHERE owner_id = ?',
              [userId]
            );
            const slotCount = Number(cntRows[0]?.c) || pets.length;
            res.json({
              pets,
              slotCount,
              maxSlots: PET_MAX_SLOTS,
              freeSlots: Math.max(0, PET_MAX_SLOTS - slotCount),
            });
          } catch (e) {
            res.json({
              pets,
              slotCount: pets.length,
              maxSlots: PET_MAX_SLOTS,
              freeSlots: Math.max(0, PET_MAX_SLOTS - pets.length),
            });
          }
        }
      });
  } catch (err) {
      console.error('Error verifying token: ', err);
      return res.status(401).json({ message: 'Invalid token' });
  }
});


/********************************************************************************************************************
*
ADMIN API
*

********************************************************************************************************************/

// API Get Pets (Admin) -> Suy nghĩ sau
app.get('/api/admin/pets', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      `SELECT 
        p.uuid, p.name, p.level, 
        ps.name AS species_name,
        u.username AS owner_name,
        p.iv_hp, p.iv_mp, p.iv_str, p.iv_def, p.iv_intelligence, p.iv_spd
       FROM pets p
       LEFT JOIN pet_species ps ON p.pet_species_id = ps.id
       LEFT JOIN users u ON p.owner_id = u.id
       ORDER BY p.created_date DESC`
    );

    res.json(results);
  } catch (err) {
    console.error('Error fetching all pets for admin:', err);
    res.status(500).json({ message: 'Server error fetching pets' });
  }
});

// API Create Pet Species (Admin)
app.post('/api/admin/pet-species', (req, res) => {
  const {
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to,
    evolve_min_level,
    evolve_item_id,
  } = req.body;

  const sql = `
    INSERT INTO pet_species
    (name, image, type, description, rarity,
     base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, evolve_to,
     evolve_min_level, evolve_item_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const eml =
    evolve_min_level != null && evolve_min_level !== ''
      ? Math.max(1, parseInt(evolve_min_level, 10) || 1)
      : 1;
  const eItem =
    evolve_item_id != null && evolve_item_id !== ''
      ? parseInt(evolve_item_id, 10)
      : null;

  const values = [
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to ? JSON.stringify(evolve_to) : null,
    eml,
    Number.isFinite(eItem) && eItem > 0 ? eItem : null,
  ];

  pool.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error creating pet species:', err);
      res.status(500).json({ message: 'Error creating pet species' });
    } else {
      res.json({ message: 'Pet species created successfully', speciesId: results.insertId });
    }
  });
});

// API Get Pet Types (Admin)
app.get('/api/admin/pet-species', (req, res) => {
  pool.query('SELECT * FROM pet_species', (err, results) => {
    if (err) {
      console.error('Error fetching pet species: ', err);
      res.status(500).json({ message: 'Error fetching pet species' });
    } else {
      res.json(results);
    }
  });
});

// API Delete Pet Type (Admin)
app.delete('/api/admin/pet-species/:id', (req, res) => {
  const id = req.params.id;

  pool.query('DELETE FROM pet_species WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error deleting pet species:', err);
      res.status(500).json({ message: 'Error deleting pet species' });
    } else {
      res.json({ message: 'Pet species deleted successfully' });
    }
  });
});

// API Update Pet Type (Admin)
app.put('/api/admin/pet-species/:id', (req, res) => {
  const id = req.params.id;
  const {
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to,
    evolve_min_level,
    evolve_item_id,
  } = req.body;

  const sql = `
    UPDATE pet_species SET
      name = ?, image = ?, type = ?, description = ?, rarity = ?,
      base_hp = ?, base_mp = ?, base_str = ?, base_def = ?, base_intelligence = ?, base_spd = ?,
      evolve_to = ?,
      evolve_min_level = ?, evolve_item_id = ?
    WHERE id = ?
  `;

  const eml =
    evolve_min_level != null && evolve_min_level !== ''
      ? Math.max(1, parseInt(evolve_min_level, 10) || 1)
      : 1;
  const eItem =
    evolve_item_id != null && evolve_item_id !== ''
      ? parseInt(evolve_item_id, 10)
      : null;

  const values = [
    name, image, type, description, rarity,
    base_hp, base_mp, base_str, base_def, base_intelligence, base_spd,
    evolve_to ? JSON.stringify(evolve_to) : null,
    eml,
    Number.isFinite(eItem) && eItem > 0 ? eItem : null,
    id
  ];

  pool.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error updating pet species:', err);
      res.status(500).json({ message: 'Error updating pet species' });
    } else {
      res.json({ message: 'Pet species updated successfully' });
    }
  });
});

// Pet species - download CSV (admin)
app.get('/api/admin/pet-species/csv', (req, res) => {
  pool.query('SELECT * FROM pet_species ORDER BY id', (err, results) => {
    if (err) {
      console.error('Error fetching pet species for CSV:', err);
      return res.status(500).json({ message: 'Error fetching pet species' });
    }
    const rows = results || [];
    const headers = ['id', 'name', 'image', 'type', 'description', 'rarity', 'base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd', 'evolve_to', 'created_at'];
    const escape = (v) => {
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=pet_species.csv');
    res.send('\uFEFF' + csv);
  });
});

// Pet species - upload CSV (admin): UPDATE when id exists, else INSERT
app.post('/api/admin/pet-species/csv', uploadMemory.single('file'), (req, res) => {
  if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
  const text = req.file.buffer.toString('utf8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return res.status(400).json({ message: 'CSV trống hoặc thiếu header' });
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const required = ['name', 'image'];
  if (!required.every(k => headers.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: name, image' });
  const num = (v, d) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : d);
  let updated = 0, inserted = 0;
  const next = (idx) => {
    if (idx >= lines.length - 1) return res.json({ success: true, updated, inserted });
    const line = lines[idx + 1];
    const values = [];
    let cur = '', inQuoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuoted = !inQuoted; continue; }
      if (!inQuoted && c === ',') { values.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    values.push(cur.trim());
    const o = {};
    headers.forEach((h, i) => { o[h] = values[i]; });
    const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
    const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
    const evolveTo = (o.evolve_to != null && String(o.evolve_to).trim() !== '') ? String(o.evolve_to).trim() : null;
    const vals = [
      o.name ?? '', o.image ?? '', o.type ?? '', o.description ?? '', o.rarity ?? '',
      num(o.base_hp, 0), num(o.base_mp, 0), num(o.base_str, 0), num(o.base_def, 0),
      num(o.base_intelligence, 0), num(o.base_spd, 0), evolveTo
    ];
    if (id == null) {
      pool.query(
        'INSERT INTO pet_species (name, image, type, description, rarity, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, evolve_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        vals,
        (err2) => {
          if (err2) return res.status(500).json({ message: 'Lỗi thêm mới' });
          inserted++;
          next(idx + 1);
        }
      );
      return;
    }
    pool.query('SELECT 1 FROM pet_species WHERE id = ? LIMIT 1', [id], (err1, ex) => {
      if (err1) return res.status(500).json({ message: 'Lỗi kiểm tra id' });
      const doUpdate = ex && ex.length > 0;
      if (doUpdate) {
        pool.query(
          'UPDATE pet_species SET name=?, image=?, type=?, description=?, rarity=?, base_hp=?, base_mp=?, base_str=?, base_def=?, base_intelligence=?, base_spd=?, evolve_to=? WHERE id=?',
          [...vals, id],
          (err2) => {
            if (err2) return res.status(500).json({ message: 'Lỗi cập nhật' });
            updated++;
            next(idx + 1);
          }
        );
      } else {
        pool.query(
          'INSERT INTO pet_species (name, image, type, description, rarity, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, evolve_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          vals,
          (err2) => {
            if (err2) return res.status(500).json({ message: 'Lỗi thêm mới' });
            inserted++;
            next(idx + 1);
          }
        );
      }
    });
  };
  next(0);
});

// Tiến hóa — phải đăng ký trước GET /api/pets/:uuid để không bị nuốt path
app.get('/api/pets/:uuid/evolution-info', async (req, res) => {
  const uuid = req.params.uuid;
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const [rows] = await db.query(
      `SELECT p.id AS pet_id, p.uuid, p.name AS pet_name, p.level, p.owner_id, p.pet_species_id,
              p.evolution_stage,
              ps.name AS species_name, ps.image AS species_image, ps.type AS species_type,
              ps.evolve_to, ps.evolve_min_level, ps.evolve_item_id
       FROM pets p
       JOIN pet_species ps ON ps.id = p.pet_species_id
       WHERE p.uuid = ? AND p.owner_id = ?
       LIMIT 1`,
      [uuid, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    const row = rows[0];
    const targetIds = parseSpeciesEvolveTo(row.evolve_to);
    const minLevel = Math.max(1, parseInt(row.evolve_min_level, 10) || 1);
    const itemId = row.evolve_item_id != null ? parseInt(row.evolve_item_id, 10) : null;
    const petLevel = parseInt(row.level, 10) || 1;
    const meetsLevel = petLevel >= minLevel;

    let itemRow = null;
    let inventoryQty = 0;
    if (itemId && Number.isFinite(itemId)) {
      const [it] = await db.query(
        'SELECT id, name, image_url, type FROM items WHERE id = ? LIMIT 1',
        [itemId]
      );
      itemRow = it[0] || null;
      const [invSum] = await db.query(
        'SELECT COALESCE(SUM(quantity), 0) AS qty FROM inventory WHERE player_id = ? AND item_id = ?',
        [userId, itemId]
      );
      inventoryQty = Number(invSum[0]?.qty || 0);
    }

    const targets = [];
    for (const tid of targetIds) {
      const [tRows] = await db.query(
        'SELECT id, name, image, type FROM pet_species WHERE id = ? LIMIT 1',
        [tid]
      );
      if (tRows.length) {
        targets.push({
          species_id: tRows[0].id,
          name: tRows[0].name,
          image: tRows[0].image,
          type: tRows[0].type,
        });
      }
    }

    const needsItem = itemId != null && Number.isFinite(itemId) && itemId > 0;
    const hasItem = !needsItem || inventoryQty > 0;
    const canEvolve =
      targetIds.length > 0 &&
      meetsLevel &&
      hasItem &&
      targets.length > 0;

    let reason = null;
    if (targetIds.length === 0 || targets.length === 0) {
      reason = 'Loài này không có nhánh tiến hóa (evolve_to trống).';
    } else if (!meetsLevel) {
      reason = `Cần đạt cấp ${minLevel} (hiện ${petLevel}).`;
    } else if (!hasItem && needsItem) {
      reason = 'Thiếu vật phẩm tiến hóa trong túi đồ.';
    }

    res.json({
      pet_id: row.pet_id,
      uuid: row.uuid,
      pet_name: row.pet_name,
      pet_level: petLevel,
      evolution_stage: row.evolution_stage,
      current: {
        species_id: row.pet_species_id,
        name: row.species_name,
        image: row.species_image,
        type: row.species_type,
      },
      requirements: {
        min_level: minLevel,
        meets_level: meetsLevel,
        item_id: needsItem ? itemId : null,
        item: itemRow
          ? {
              id: itemRow.id,
              name: itemRow.name,
              image_url: itemRow.image_url,
              type: itemRow.type,
            }
          : null,
        inventory_quantity: inventoryQty,
        needs_item: needsItem,
      },
      targets,
      can_evolve: canEvolve,
      reason,
    });
  } catch (err) {
    console.error('GET /api/pets/:uuid/evolution-info:', err);
    res.status(500).json({ message: 'Lỗi tải thông tin tiến hóa' });
  }
});

app.post('/api/pets/:uuid/evolve', async (req, res) => {
  const uuid = req.params.uuid;
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const targetSpeciesId = parseInt(req.body?.targetSpeciesId ?? req.body?.target_species_id, 10);
  if (!Number.isFinite(targetSpeciesId) || targetSpeciesId <= 0) {
    return res.status(400).json({ message: 'Thiếu targetSpeciesId hợp lệ' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [pRows] = await conn.query(
      `SELECT p.*, ps.evolve_to, ps.evolve_min_level, ps.evolve_item_id
       FROM pets p
       JOIN pet_species ps ON ps.id = p.pet_species_id
       WHERE p.uuid = ? AND p.owner_id = ?
       LIMIT 1 FOR UPDATE`,
      [uuid, userId]
    );
    if (!pRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pet not found' });
    }
    const pet = pRows[0];
    const petId = pet.id;
    const allowed = parseSpeciesEvolveTo(pet.evolve_to);
    if (!allowed.includes(targetSpeciesId)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Loài đích không nằm trong evolve_to của loài hiện tại.' });
    }

    const minLevel = Math.max(1, parseInt(pet.evolve_min_level, 10) || 1);
    const petLevel = parseInt(pet.level, 10) || 1;
    if (petLevel < minLevel) {
      await conn.rollback();
      return res.status(400).json({ message: `Cần đạt cấp ${minLevel} để tiến hóa.` });
    }

    const itemReq = pet.evolve_item_id != null ? parseInt(pet.evolve_item_id, 10) : null;
    if (itemReq != null && Number.isFinite(itemReq) && itemReq > 0) {
      const [invRows] = await conn.query(
        'SELECT id, quantity FROM inventory WHERE player_id = ? AND item_id = ? AND quantity >= 1 ORDER BY id ASC LIMIT 1 FOR UPDATE',
        [userId, itemReq]
      );
      if (!invRows.length) {
        await conn.rollback();
        return res.status(400).json({ message: 'Không có vật phẩm tiến hóa trong túi đồ.' });
      }
      const invId = invRows[0].id;
      const q = parseInt(invRows[0].quantity, 10) || 0;
      await conn.query('UPDATE inventory SET quantity = ? WHERE id = ?', [Math.max(0, q - 1), invId]);
      if (q - 1 <= 0) {
        await conn.query('DELETE FROM inventory WHERE id = ?', [invId]);
      }
    }

    await conn.query(
      'UPDATE pets SET pet_species_id = ?, evolution_stage = COALESCE(evolution_stage, 0) + 1 WHERE id = ?',
      [targetSpeciesId, petId]
    );
    await refreshPetIntrinsicStats(conn, petId);
    await normalizePetCurrentHp(conn, petId);
    try {
      await titleService.recordPetEvolution(conn, userId, 1);
    } catch (e) {
      console.error('titleService.recordPetEvolution:', e);
    }

    await conn.commit();
    res.json({ message: 'Tiến hóa thành công!', target_species_id: targetSpeciesId });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('POST /api/pets/:uuid/evolve:', err);
    res.status(500).json({ message: 'Lỗi khi tiến hóa' });
  } finally {
    if (conn) conn.release();
  }
});

// API Lấy Thông Tin Chi Tiết Thú Cưng Theo ID/UUID
app.get('/api/pets/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  pool.query(`
      SELECT p.*, pt.name AS pet_types_name, pt.image
      FROM pets p
      JOIN pet_species pt ON p.pet_species_id = pt.id
      WHERE p.uuid = ?
  `, [uuid], (err, results) => {
      if (err) {
          console.error('Error fetching pet details: ', err);
          res.status(500).json({ message: 'Error fetching pet details' });
      } else {
          if (results.length > 0) {
              res.json(results[0]);
          } else {
              res.status(404).json({ message: 'Pet not found' });
          }
      }
  });
});

// Đổi tên thú cưng (chủ sở hữu)
app.patch('/api/pets/:uuid', async (req, res) => {
  const uuid = req.params.uuid;
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const rawName = req.body?.name ?? req.body?.pet_name;
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name || name.length > 100) {
    return res.status(400).json({ message: 'Tên không hợp lệ (1–100 ký tự).' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id FROM pets WHERE uuid = ? AND owner_id = ? LIMIT 1',
      [uuid, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    await db.query('UPDATE pets SET name = ? WHERE uuid = ? AND owner_id = ?', [name, uuid, userId]);
    const [updated] = await db.query(
      `SELECT p.*, pt.name AS pet_types_name, pt.image
       FROM pets p
       JOIN pet_species pt ON p.pet_species_id = pt.id
       WHERE p.uuid = ?
       LIMIT 1`,
      [uuid]
    );
    res.json(updated[0] || { message: 'Đã đổi tên', name });
  } catch (err) {
    console.error('PATCH /api/pets/:uuid:', err);
    res.status(500).json({ message: 'Lỗi khi đổi tên thú cưng' });
  }
});

// API Delete Pet
app.delete('/api/admin/pets/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  pool.query('DELETE FROM pets WHERE uuid = ?', [uuid], (err, results) => {
      if (err) {
          console.error('Error deleting pet: ', err);
          return res.status(500).json({ message: 'Error deleting pet' });
      } else if (results.affectedRows > 0) {
          res.json({ message: 'Pet deleted successfully' });
      } else {
          res.status(404).json({ message: 'Pet not found' });
      }
  });
});

// API Delete Pet (User) — phóng thích / xóa 1 pet: gỡ trang bị + linh thú gắn pet rồi mới DELETE
app.delete('/api/pets/:uuid/release', async (req, res) => {
  const uuid = req.params.uuid;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let conn;
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decodedToken.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id FROM pets WHERE uuid = ? AND owner_id = ? LIMIT 1',
      [uuid, userId]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pet not found' });
    }
    const petId = rows[0].id;

    await conn.query(
      'UPDATE inventory SET is_equipped = 0, equipped_pet_id = NULL WHERE equipped_pet_id = ? AND player_id = ?',
      [petId, userId]
    );
    await conn.query(
      'UPDATE user_spirits SET is_equipped = 0, equipped_pet_id = NULL WHERE equipped_pet_id = ? AND user_id = ?',
      [petId, userId]
    );

    const [delResult] = await conn.query(
      'DELETE FROM pets WHERE id = ? AND owner_id = ?',
      [petId, userId]
    );
    if (!delResult || delResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pet not found (during deletion)' });
    }

    const [remaining] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM pets WHERE owner_id = ?',
      [userId]
    );
    if (Number(remaining[0]?.cnt ?? 0) === 0) {
      await conn.query('UPDATE users SET hasPet = FALSE WHERE id = ?', [userId]);
    }

    await conn.commit();
    res.json({ message: 'Pet released successfully' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Error releasing pet:', err);
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Error releasing pet' });
  } finally {
    if (conn) conn.release();
  }
});

// Xóa toàn bộ thú của user — dùng khi muốn “reset pet” và nhận lại pet mới
app.post('/api/pets/release-all', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  const confirm =
    req.body?.confirm === true ||
    req.body?.confirm === 'true' ||
    req.body?.confirm === 1;
  if (!confirm) {
    return res.status(400).json({
      message: 'Gửi JSON { "confirm": true } để xác nhận xóa hết thú cưng của tài khoản.',
    });
  }

  let conn;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [petRows] = await conn.query('SELECT id FROM pets WHERE owner_id = ?', [userId]);
    const ids = (petRows || []).map((p) => p.id).filter((id) => id != null);
    if (ids.length === 0) {
      await conn.query('UPDATE users SET hasPet = FALSE WHERE id = ?', [userId]);
      await conn.commit();
      return res.json({ success: true, message: 'Bạn không còn thú cưng nào.', removed: 0 });
    }

    const ph = ids.map(() => '?').join(',');
    await conn.query(
      `UPDATE inventory SET is_equipped = 0, equipped_pet_id = NULL WHERE player_id = ? AND equipped_pet_id IN (${ph})`,
      [userId, ...ids]
    );
    await conn.query(
      `UPDATE user_spirits SET is_equipped = 0, equipped_pet_id = NULL WHERE user_id = ? AND equipped_pet_id IN (${ph})`,
      [userId, ...ids]
    );
    await conn.query('DELETE FROM pets WHERE owner_id = ?', [userId]);
    await conn.query('UPDATE users SET hasPet = FALSE WHERE id = ?', [userId]);

    await conn.commit();
    res.json({
      success: true,
      message: `Đã phóng thích ${ids.length} thú cưng.`,
      removed: ids.length,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Error release-all pets:', err);
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Lỗi khi xóa toàn bộ thú cưng' });
  } finally {
    if (conn) conn.release();
  }
});

// API Get Orphanage Pets (Rarity Common, Level 1) 

let orphanagePets = [];
app.get('/api/orphanage-pets', async (req, res) => {
  const level = 1;

  try {
    const [results] = await pool.promise().query(
      `SELECT id, name, image, type, rarity,
              base_hp AS hp, base_mp AS mp, base_str AS str,
              base_def AS def, base_intelligence AS intelligence, base_spd AS spd
       FROM pet_species WHERE rarity = 'Common'`
    );

    if (results.length === 0) {
      return res.status(404).json({ message: 'No common pets found' });
    }

    orphanagePets = [];
    for (let i = 0; i < 4; i++) {
      const petSpecies = results[Math.floor(Math.random() * results.length)];
      const iv = generateIVStats();
      const finalStats = calculateFinalStats({
        hp: petSpecies.hp,
        mp: petSpecies.mp,
        str: petSpecies.str,
        def: petSpecies.def,
        intelligence: petSpecies.intelligence,
        spd: petSpecies.spd
      }, iv, level);

      orphanagePets.push({
        tempId: uuidv4(),
        pet_species_id: petSpecies.id,
        name: petSpecies.name,
        image: petSpecies.image,
        type: petSpecies.type,
        rarity: petSpecies.rarity,
        level,
        ...iv,
        ...finalStats
      });
    }

    res.json(orphanagePets);
  } catch (err) {
    console.error('Error fetching orphanage pets:', err);
    res.status(500).json({ message: 'Server error while fetching pets' });
  }
});

app.post('/api/adopt-pet', async (req, res) => {
  const { tempId, owner_id, petName } = req.body;
  const token = req.headers.authorization?.split(' ')[1]; // Lấy token từ header

  if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); // Xác thực token
      const tokenUserId = decodedToken.userId;

      // Kiểm tra xem user có quyền adopt pet cho owner_id này không
      if (tokenUserId !== parseInt(owner_id)) {
          return res.status(403).json({ message: 'Forbidden: You can only adopt pets for yourself' });
      }

      const tempPet = orphanagePets.find(pet => pet.tempId === tempId);
      if (!tempPet) return res.status(400).json({ message: 'Invalid temporary pet ID' });

      const adoptCap = await getPetCapacity(db, tokenUserId);
      if (adoptCap.freeSlots < 1) {
        return res.status(400).json({
          message: `Kho pet đã đầy (${adoptCap.slotCount}/${adoptCap.maxSlots}).`,
          slotCount: adoptCap.slotCount,
          maxSlots: adoptCap.maxSlots,
        });
      }

  const {
    pet_species_id, iv_hp, iv_mp, iv_str, iv_def,
    iv_intelligence, iv_spd, hp, mp, str, def, intelligence, spd
  } = tempPet;

  const petUuid = uuidv4();
  const level = 1;
  const createdDate = new Date();
  const max_hp = hp;
  const max_mp = mp;
  const finalStats = { hp, mp, str, def, intelligence, spd };

  try {
    const [speciesResult] = await pool.promise().query(
      'SELECT type FROM pet_species WHERE id = ?',
      [pet_species_id]
    );

    if (speciesResult.length === 0) {
      return res.status(400).json({ message: 'Invalid pet species ID' });
    }

    const type = speciesResult[0].type;

    await pool.promise().query(
      `INSERT INTO pets (
        uuid, name, hp, str, def, intelligence, spd, mp,
        owner_id, pet_species_id, level, max_hp, current_hp, max_mp,
        created_date, final_stats,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        petUuid, petName, hp, str, def, intelligence, spd, mp,
        owner_id, pet_species_id, level, max_hp, hp, max_mp,
        createdDate, JSON.stringify(finalStats),
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
      ]
    );

    // Update user's hasPet status to TRUE when they adopt their first pet
    await pool.promise().query(
      'UPDATE users SET hasPet = TRUE WHERE id = ? AND hasPet = FALSE',
      [owner_id]
    );

    try {
      await titleService.recordPetCatch(db, owner_id, 1);
    } catch (e) {
      console.error('titleService.recordPetCatch:', e);
    }

    orphanagePets = orphanagePets.filter(pet => pet.tempId !== tempId);
    res.json({ message: 'Pet adopted successfully', uuid: petUuid });
  } catch (error) {
    console.error('Error adopting pet:', error);
    res.status(500).json({ message: 'Error adopting pet' });
  }
  } catch (err) {
      console.error('Error verifying token: ', err);
      return res.status(401).json({ message: 'Invalid token' });
  }
});



// API Get User Info
app.get('/users/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  if (isNaN(userId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  try {
    const [results] = await db.query(
      `
    SELECT
      u.id,
      u.username,
      u.peta,
      u.petagold,
      u.real_name,
      u.guild,
      u.title,
      u.ranking,
      u.online_status,
      u.birthday,
      u.role,
      u.equipped_title_id,
      up.display_name,
      up.gender,
      up.avatar_url,
      t.name AS equipped_title_name,
      t.image_key AS equipped_title_image_key,
      t.slug AS equipped_title_slug
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN titles t ON t.id = u.equipped_title_id
    WHERE u.id = ?
    LIMIT 1
  `,
      [userId]
    );

    if (results.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const row = results[0];
    if (row.equipped_title_image_key) {
      row.equipped_title_image_url = titleService.titleImageUrl(row.equipped_title_image_key);
    }
    res.json(row);
  } catch (err) {
    console.error('Error fetching user info: ', err);
    res.status(500).json({ message: 'Error fetching user info' });
  }
});

app.get('/api/titles', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, slug, name, image_key, metric_type, threshold, sort_order FROM titles WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    res.json(
      (rows || []).map((r) => ({
        ...r,
        image_url: titleService.titleImageUrl(r.image_key),
      }))
    );
  } catch (err) {
    console.error('GET /api/titles', err);
    res.status(500).json({ message: 'Error loading titles' });
  }
});

app.get('/api/user/titles-state', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    await titleService.unlockTitlesForUser(db, userId);
    const [progRows] = await db.query('SELECT * FROM user_title_progress WHERE user_id = ?', [userId]);
    const [unlocked] = await db.query(
      `SELECT t.id, t.slug, t.name, t.image_key, t.metric_type, t.threshold, u.unlocked_at
       FROM user_unlocked_titles u
       JOIN titles t ON t.id = u.title_id
       WHERE u.user_id = ?
       ORDER BY t.sort_order ASC, t.id ASC`,
      [userId]
    );
    const [eqRows] = await db.query('SELECT equipped_title_id FROM users WHERE id = ?', [userId]);
    const equipped_title_id = eqRows && eqRows[0] ? eqRows[0].equipped_title_id : null;
    res.json({
      progress: progRows[0] || {},
      unlocked: (unlocked || []).map((r) => ({
        ...r,
        image_url: titleService.titleImageUrl(r.image_key),
      })),
      equipped_title_id,
    });
  } catch (err) {
    console.error('GET /api/user/titles-state', err);
    res.status(500).json({ message: 'Error loading title state' });
  }
});

app.put('/api/user/equipped-title', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;
    const { titleId } = req.body;
    const result = await titleService.setEquippedTitle(db, userId, titleId);
    res.json(result);
  } catch (e) {
    if (e.code === 'TITLE_LOCKED') return res.status(400).json({ message: e.message });
    console.error('PUT /api/user/equipped-title', e);
    res.status(500).json({ message: e.message || 'Error' });
  }
});

// API: Get user role
app.get('/api/users/:userId/role', (req, res) => {
  const userId = parseInt(req.params.userId);

  if (isNaN(userId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  pool.query('SELECT id, username, role FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user role: ', err);
      res.status(500).json({ message: 'Error fetching user role' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      id: results[0].id,
      username: results[0].username,
      role: results[0].role
    });
  });
});

// API: Update user role (admin only)
app.put('/api/users/:userId/role', (req, res) => {
  const userId = parseInt(req.params.userId);
  const { role } = req.body;
  const { adminUserId } = req.body; // ID của admin thực hiện thay đổi

  if (isNaN(userId)) {
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  // Validate role
  const validRoles = ['user', 'admin', 'moderator'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ message: 'Invalid role' });
    return;
  }

  // Check if adminUserId is admin
  pool.query('SELECT role FROM users WHERE id = ?', [adminUserId], (err, results) => {
    if (err) {
      console.error('Error checking admin role: ', err);
      res.status(500).json({ message: 'Error checking admin role' });
      return;
    }

    if (results.length === 0 || results[0].role !== 'admin') {
      res.status(403).json({ message: 'Only admins can change user roles' });
      return;
    }

    // Update user role
    pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId], (updateErr, updateResults) => {
      if (updateErr) {
        console.error('Error updating user role: ', updateErr);
        res.status(500).json({ message: 'Error updating user role' });
        return;
      }

      if (updateResults.affectedRows === 0) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json({ 
        message: 'User role updated successfully',
        userId,
        newRole: role
      });
    });
  });
});

// API: Admin tạo pet thủ công
// API: Admin tạo pet thủ công (không cần owner_id và không cần type)
app.post('/api/admin/pets', async (req, res) => {
  let {
    name, pet_species_id, level = 1,
    iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
  } = req.body;
  try {
    const [speciesResult] = await pool.promise().query(
      `SELECT base_hp AS hp, base_mp AS mp, base_str AS str, base_def AS def,
              base_intelligence AS intelligence, base_spd AS spd
       FROM pet_species WHERE id = ?`, [pet_species_id]
    );

    if (speciesResult.length === 0) {
      return res.status(400).json({ message: 'Invalid pet species ID' });
    }
    const base = speciesResult[0];
    base.hp = parseInt(base.hp);
    base.mp = parseInt(base.mp);
    base.str = parseInt(base.str);
    base.def = parseInt(base.def);
    base.intelligence = parseInt(base.intelligence);
    base.spd = parseInt(base.spd);
    level = parseInt(level || '1');
    const iv = {
      iv_hp: parseInt(iv_hp),
      iv_mp: parseInt(iv_mp),
      iv_str: parseInt(iv_str),
      iv_def: parseInt(iv_def),
      iv_intelligence: parseInt(iv_intelligence),
      iv_spd: parseInt(iv_spd)
    };

    // console.log('BASE STATS:', base, 'IV:', iv, 'LEVEL:', level);
    const final = calculateFinalStats(base, iv, level);
    // console.log('FINAL STATS:', final);
    const createdDate = new Date();
    const petUuid = uuidv4();
    const currentExp = expTable[level] || 0;

    await pool.promise().query(
      `INSERT INTO pets (
        uuid, name, hp, str, def, intelligence, spd, mp,
        pet_species_id, level, max_hp, max_mp,
        created_date, final_stats, current_exp,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      petUuid, name, final.hp, final.str, final.def, final.intelligence, final.spd, final.mp,
      pet_species_id, level, final.hp, final.mp,
      createdDate, JSON.stringify(final), currentExp,
      iv.iv_hp, iv.iv_mp, iv.iv_str, iv.iv_def, iv.iv_intelligence, iv.iv_spd,
      0, expToNext,
      JSON.stringify(stats),
      1
    ]);

    res.json({ message: 'Pet created successfully', uuid: petUuid });
  } catch (err) {
    console.error('Error creating pet manually:', err);
    res.status(500).json({ message: 'Server error when creating pet' });
  }
});

app.delete('/api/admin/pets/:uuid', async (req, res) => {
  const { uuid } = req.params;

  try {
    // Kiểm tra pet có tồn tại và chưa có chủ
    const [result] = await pool.promise().query(
      'SELECT * FROM pets WHERE uuid = ? AND owner_id IS NULL',
      [uuid]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: 'Pet không tồn tại hoặc đã có chủ.' });
    }

    // Xoá pet
    await pool.promise().query('DELETE FROM pets WHERE uuid = ?', [uuid]);
    res.json({ message: 'Pet đã được xoá (admin).' });
  } catch (err) {
    console.error('Error deleting pet by admin:', err);
    res.status(500).json({ message: 'Lỗi server khi xoá pet' });
  }
});


/************************************* ITEMS ********************************************** */

const ITEM_EFFECT_TARGET_ALIASES = {
  atk: 'str',
  attack: 'str',
  int: 'intelligence',
  intelligence: 'intelligence',
  hp: 'hp',
  mp: 'mp',
  str: 'str',
  def: 'def',
  spd: 'spd',
  exp: 'exp',
  status: 'status',
  hunger: 'hunger',
  happiness: 'mood',
  mood: 'mood',
  tam_trang: 'mood',
  wellbeing: 'mood',
  energy: 'mp',
};

const ITEM_EFFECT_TYPE_ALIASES = {
  flat: 'flat',
  percent: 'percent',
  status_cure: 'status_cure',
};

function normalizeEffectTarget(rawValue) {
  const key = String(rawValue || '').trim().toLowerCase();
  return ITEM_EFFECT_TARGET_ALIASES[key] || key || 'hp';
}

function normalizeEffectType(rawValue) {
  const key = String(rawValue || '').trim().toLowerCase();
  return ITEM_EFFECT_TYPE_ALIASES[key] || 'flat';
}

function normalizeEffectRow(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    effect_target: normalizeEffectTarget(row.effect_target),
    effect_type: normalizeEffectType(row.effect_type),
  };
}

/**
 * Thuốc HP/MP trong catalog (consumable + category medicine + subtype hp_recovery/mp_recovery)
 * có thể chưa có dòng trong item_effects — vẫn cho phép dùng: % hồi theo magic_value trên item.
 */
function buildSyntheticMedicineEffectFromItemRow(itemRow) {
  if (!itemRow || typeof itemRow !== 'object') return null;
  const typ = String(itemRow.type || '').toLowerCase().trim();
  const cat = String(itemRow.category || '').toLowerCase().trim();
  const sub = String(itemRow.subtype || '').toLowerCase().trim();
  const isMedicine =
    cat === 'medicine' && (typ === 'consumable' || typ === 'medicine');
  if (!isMedicine) return null;
  if (sub === 'hp_recovery') {
    return normalizeEffectRow({
      effect_target: 'hp',
      effect_type: 'percent',
      value_min: 0,
      value_max: 0,
      is_permanent: 0,
      magic_value: itemRow.magic_value,
    });
  }
  if (sub === 'mp_recovery') {
    return normalizeEffectRow({
      effect_target: 'mp',
      effect_type: 'percent',
      value_min: 0,
      value_max: 0,
      is_permanent: 0,
      magic_value: itemRow.magic_value,
    });
  }
  return null;
}

function resolveEffectMagicValue(effect, itemRow) {
  const fromEffect = Number(effect?.magic_value);
  if (Number.isFinite(fromEffect) && fromEffect > 0) return fromEffect;
  const fromItem = Number(itemRow?.magic_value);
  if (Number.isFinite(fromItem) && fromItem > 0) return fromItem;
  return 1;
}

function resolveEffectAmount(effect, quantity, itemRow, options = {}) {
  const base = (Number(effect?.value_min) || 0) * Math.max(1, Number(quantity) || 1);
  if (!options.scaleByMagic) return base;
  return base * resolveEffectMagicValue(effect, itemRow);
}

/**
 * Booster EXP dạng %: ma thuật M ⇒ +M% tổng EXP hiện tại (current_exp) tại thời điểm dùng.
 * Ví dụ current_exp 45980, magic 1 ⇒ floor(45980 * 1 / 100) = 459.
 * `value_min` trong admin (10, 20…) có thể chỉ để hiển thị tier — không nhân thêm, tránh double với magic.
 */
function resolveExpBoostPercentOfCurrent(effect, quantity, currentExp, itemRow) {
  const qty = Math.max(1, Number(quantity) || 1);
  const cur = Math.max(0, Number(currentExp) || 0);
  const magic = resolveEffectMagicValue(effect, itemRow);
  return Math.floor((cur * magic * qty) / 100);
}

/**
 * Hồi HP / MP (consumable medicine hoặc nhánh food có target hp/mp), effect_type percent:
 * ma thuật M ⇒ cộng floor(max_pool × M × qty / 100) vào current_hp hoặc mp (trần bởi max).
 */
function resolveMedicineHpMpPercentRecovery(effect, quantity, maxPool, itemRow) {
  const qty = Math.max(1, Number(quantity) || 1);
  const cap = Math.max(1, Number(maxPool) || 1);
  const magic = resolveEffectMagicValue(effect, itemRow);
  return Math.floor((cap * magic * qty) / 100);
}

/** effect_type=percent: value_min là % (0–100+). Hồi theo maxBase (VD max_hp, thang đói 10). */
function resolveEffectPercentOfMax(effect, quantity, maxBase) {
  const pct = Number(effect?.value_min) || 0;
  const q = Math.max(1, Number(quantity) || 1);
  const cap = Math.max(1, Number(maxBase) || 1);
  return Math.round(cap * (pct / 100)) * q;
}

/**
 * Hunger / Mood (thang 0–maxScale): effect_type = percent.
 * value_min = "điểm phần trăm" (10 ⇒ 10%, 20 ⇒ 20%). Nhân với chỉ số ma thuật (effect/item, mặc định 1).
 * Cứ mỗi 10 điểm phần trăm hiệu lực (sau nhân ma thuật) = +1 bậc trên thang.
 * Ví dụ: value_min 10 + magic 1 → +1 bậc; value_min 10 + magic 2 → +2 bậc (tới cap).
 */
function resolveVitalsStepsFromPercent(effect, quantity, itemRow, maxScale) {
  const pct = Number(effect?.value_min) || 0;
  const q = Math.max(1, Number(quantity) || 1);
  const magic = resolveEffectMagicValue(effect, itemRow);
  const effectivePct = pct * magic;
  const steps = Math.floor(effectivePct / 10);
  const cap = Math.max(0, Number(maxScale) || 0);
  return Math.min(cap * q, steps * q);
}

/** effect_type=percent: value_min = magic_tier*10 → cộng tier điểm (VD 20 → +2) cho stat_added / hp_added. */
function resolveTierPointsFromPercentEffect(effect, quantity) {
  const pct = Number(effect?.value_min) || 0;
  const tier = Math.max(0, Math.round(pct / 10));
  return tier * Math.max(1, Number(quantity) || 1);
}

/** Type riêng `food`, hoặc dữ liệu cũ consumable + category food */
function itemActsAsFoodForPetUse(row) {
  const cat = String(row?.category || '').toLowerCase();
  return row?.type === 'food' || (row?.type === 'consumable' && cat === 'food');
}

/** Type `toy`, hoặc consumable + category toy (định tuyến qua handleFoodItem: mood + ma thuật / % / flat). */
function itemActsAsToyForPetUse(row) {
  const cat = String(row?.category || '').toLowerCase();
  return row?.type === 'toy' || (row?.type === 'consumable' && cat === 'toy');
}

function normalizeEquipmentType(rawValue) {
  const key = String(rawValue || '').trim().toLowerCase();
  if (key === 'crit_wepaon') return 'crit_weapon';
  if (['weapon', 'shield', 'crit_weapon', 'booster'].includes(key)) return key;
  return 'booster';
}

function normalizeSlotType(rawValue, equipmentType) {
  const key = String(rawValue || '').trim().toLowerCase();
  if (['weapon', 'shield', 'stat_boost'].includes(key)) return key;
  if (equipmentType === 'shield') return 'shield';
  if (equipmentType === 'booster') return 'stat_boost';
  return 'weapon';
}

function normalizeDurabilityMode(rawValue) {
  const key = String(rawValue || '').trim().toLowerCase();
  if (['fixed', 'unknown', 'unbreakable'].includes(key)) return key;
  if (key === 'random') return 'unknown';
  return 'fixed';
}

/** Chuẩn hóa rarity: chỉ common | rare | epic | legendary (lưu trong DB là legendary; CSV/UI có thể gõ legend). */
const ITEM_RARITY_CANONICAL = new Set(['common', 'rare', 'epic', 'legendary']);
function normalizeItemRarity(rawValue) {
  const k = String(rawValue || '').trim().toLowerCase();
  if (ITEM_RARITY_CANONICAL.has(k)) return k;
  if (k === 'normal') return 'common';
  if (k === 'legend' || k === 'unique' || k === 'artifact' || k === 'mythic') return 'legendary';
  if (k === 'uncommon') return 'rare';
  return 'common';
}

async function consumeEquipmentDurability(inventoryId, amount = 1) {
  const [metaRows] = await pool.promise().query(
    `SELECT i.id, i.item_id, i.durability_left, it.name AS item_name,
            ed.durability_max, ed.durability_mode, ed.random_break_chance
     FROM inventory i
     LEFT JOIN items it ON i.item_id = it.id
     LEFT JOIN equipment_data ed ON i.item_id = ed.item_id
     WHERE i.id = ?`,
    [inventoryId]
  );
  if (!metaRows.length) return { not_found: true };

  const meta = metaRows[0];
  const durabilityMode = String(meta.durability_mode || '').toLowerCase();
  const maxDurability = Number(meta.durability_max || 0);
  const isPermanentDurability = durabilityMode === 'unbreakable' || maxDurability >= 999999;
  const isRandomDurability = durabilityMode === 'unknown' || durabilityMode === 'random';

  if (isPermanentDurability) {
    return {
      not_found: false,
      item_destroyed: false,
      durability_left: Number(meta.durability_left ?? 999999),
      is_permanent_durability: true,
      is_random_durability: false,
      item_name: meta.item_name || 'Equipment',
      break_reason: null,
    };
  }

  if (isRandomDurability) {
    const breakChance = Number(meta.random_break_chance ?? 3);
    const roll = Math.random() * 100;
    const broken = roll < breakChance;
    if (broken) {
      await pool.promise().query('DELETE FROM inventory WHERE id = ?', [inventoryId]);
      return {
        not_found: false,
        item_destroyed: true,
        durability_left: 0,
        is_permanent_durability: false,
        is_random_durability: true,
        item_name: meta.item_name || 'Equipment',
        break_reason: 'random',
      };
    }

    return {
      not_found: false,
      item_destroyed: false,
      durability_left: Number(meta.durability_left ?? 1),
      is_permanent_durability: false,
      is_random_durability: true,
      item_name: meta.item_name || 'Equipment',
      break_reason: null,
    };
  }

  await pool.promise().query(
    'UPDATE inventory SET durability_left = GREATEST(durability_left - ?, 0) WHERE id = ?',
    [amount, inventoryId]
  );
  const [itemRows] = await pool.promise().query('SELECT durability_left FROM inventory WHERE id = ?', [inventoryId]);
  const durabilityLeft = itemRows[0]?.durability_left ?? 0;
  if (Number(durabilityLeft) <= 0) {
    await pool.promise().query('DELETE FROM inventory WHERE id = ?', [inventoryId]);
    return {
      not_found: false,
      item_destroyed: true,
      durability_left: 0,
      is_permanent_durability: false,
      is_random_durability: false,
      item_name: meta.item_name || 'Equipment',
      break_reason: 'fixed',
    };
  }

  return {
    not_found: false,
    item_destroyed: false,
    durability_left: Number(durabilityLeft),
    is_permanent_durability: false,
    is_random_durability: false,
    item_name: meta.item_name || 'Equipment',
    break_reason: null,
  };
}

const checkAdminRoleItems = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [decoded.userId]);
    if (!rows.length || rows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = { userId: decoded.userId };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.put('/api/admin/game-center/config', checkAdminRoleItems, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid config' });
    }
    const normalized = mergeGameCenterConfig(req.body);
    await db.query(
      `INSERT INTO site_game_center_config (id, config) VALUES (1, ?)
       ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(normalized)]
    );
    res.json({ success: true, config: normalized });
  } catch (error) {
    console.error('PUT /api/admin/game-center/config', error);
    res.status(500).json({ error: 'Failed to save game center config' });
  }
});

app.put('/api/admin/region-maps/config', checkAdminRoleItems, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid config' });
    }
    const normalized = mergeRegionMapsConfig(req.body);
    await db.query(
      `INSERT INTO site_region_maps_config (id, config) VALUES (1, ?)
       ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(normalized)]
    );
    res.json({ success: true, config: normalized });
  } catch (error) {
    console.error('PUT /api/admin/region-maps/config', error);
    res.status(500).json({ error: 'Failed to save region maps config' });
  }
});

app.post('/api/admin/game-center/upload', checkAdminRoleItems, (req, res) => {
  gcUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('game-center upload:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File quá lớn (tối đa 15MB)' });
      }
      return res.status(400).json({ error: 'Upload thất bại' });
    }
    if (!req.file) return res.status(400).json({ error: 'Thiếu file' });
    const url = `/images/entertainment/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  });
});

app.get('/api/admin/titles', checkAdminRoleItems, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM titles ORDER BY sort_order ASC, id ASC');
    res.json(rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi tải titles' });
  }
});

app.post('/api/admin/titles', checkAdminRoleItems, async (req, res) => {
  try {
    const { slug, name, image_key, metric_type, threshold, sort_order, is_active } = req.body;
    if (!slug || !name || !metric_type) {
      return res.status(400).json({ message: 'Thiếu slug, name hoặc metric_type' });
    }
    const [r] = await db.query(
      `INSERT INTO titles (slug, name, image_key, metric_type, threshold, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(slug).trim(),
        String(name).trim(),
        String(image_key || 't1').trim(),
        metric_type,
        Math.max(0, parseInt(threshold, 10) || 0),
        parseInt(sort_order, 10) || 0,
        is_active === false ? 0 : 1,
      ]
    );
    const [rows] = await db.query('SELECT * FROM titles WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      return res.status(409).json({ message: 'Slug đã tồn tại' });
    }
    console.error(err);
    res.status(500).json({ message: 'Lỗi tạo title' });
  }
});

app.put('/api/admin/titles/:id', checkAdminRoleItems, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { slug, name, image_key, metric_type, threshold, sort_order, is_active } = req.body;
    await db.query(
      `UPDATE titles SET slug = ?, name = ?, image_key = ?, metric_type = ?, threshold = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        String(slug || '').trim(),
        String(name || '').trim(),
        String(image_key || 't1').trim(),
        metric_type,
        Math.max(0, parseInt(threshold, 10) || 0),
        parseInt(sort_order, 10) || 0,
        is_active === false ? 0 : 1,
        id,
      ]
    );
    const [rows] = await db.query('SELECT * FROM titles WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi cập nhật title' });
  }
});

app.delete('/api/admin/titles/:id', checkAdminRoleItems, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('UPDATE users SET equipped_title_id = NULL, title = NULL WHERE equipped_title_id = ?', [id]);
    await db.query('DELETE FROM user_unlocked_titles WHERE title_id = ?', [id]);
    const [r] = await db.query('DELETE FROM titles WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi xóa title' });
  }
});

// Admin - Tạo vật phẩm mới
app.post('/api/admin/items', checkAdminRoleItems, (req, res) => {
  const {
    item_code,
    name,
    description,
    type,
    category,
    subtype,
    rarity,
    image_url,
    buy_price,
    sell_price,
    price_currency,
    magic_value,
    stackable,
    max_stack,
    consume_policy,
    pet_scope,
  } = req.body;
  const priceCurrency = String(price_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
  const itemCode = item_code != null && item_code !== '' ? parseInt(item_code, 10) : null;
  const rarityNorm = normalizeItemRarity(rarity);
  const magicVal = magic_value != null && magic_value !== '' ? parseInt(magic_value, 10) : null;
  const stackVal = stackable === 0 || stackable === false || stackable === '0' ? 0 : 1;
  const maxStackVal = max_stack != null && max_stack !== '' ? parseInt(max_stack, 10) : 999;
  const consumePol = String(consume_policy || 'single_use').slice(0, 30) || 'single_use';
  const petSc = String(pet_scope || 'all').slice(0, 30) || 'all';

  pool.query(
    `INSERT INTO items (item_code, name, description, type, category, subtype, rarity, image_url, buy_price, sell_price, price_currency, magic_value, stackable, max_stack, consume_policy, pet_scope)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number.isFinite(itemCode) ? itemCode : null,
      name,
      description,
      type,
      category ?? null,
      subtype ?? null,
      rarityNorm,
      image_url,
      buy_price,
      sell_price,
      priceCurrency,
      Number.isFinite(magicVal) ? magicVal : null,
      stackVal,
      Number.isFinite(maxStackVal) && maxStackVal > 0 ? maxStackVal : 999,
      consumePol,
      petSc,
    ],
    (err, results) => {
      if (err) {
        console.error('Error creating item:', err);
        return res.status(500).json({ message: err.sqlMessage || 'Error creating item' });
      }
      res.json({ message: 'Item created successfully', id: results.insertId });
    }
  );
});

// Admin - Xem toàn bộ vật phẩm
app.get('/api/admin/items', checkAdminRoleItems, (req, res) => {
  pool.query('SELECT * FROM items', (err, results) => {
    if (err) {
      console.error('Error fetching items:', err);
      return res.status(500).json({ message: 'Error fetching items' });
    }
    res.json(results);
  });
});


//Admin - Edit vật phẩm
app.put('/api/admin/items/:id', checkAdminRoleItems, (req, res) => {
  const { id } = req.params;
  const {
    item_code,
    name,
    description,
    type,
    category,
    subtype,
    rarity,
    image_url,
    buy_price,
    sell_price,
    price_currency,
    magic_value,
    stackable,
    max_stack,
    consume_policy,
    pet_scope,
  } = req.body;
  const priceCurrency = String(price_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
  const itemCode = item_code != null && item_code !== '' ? parseInt(item_code, 10) : null;
  const rarityNorm = normalizeItemRarity(rarity);
  const magicVal = magic_value != null && magic_value !== '' ? parseInt(magic_value, 10) : null;
  const stackVal = stackable === 0 || stackable === false || stackable === '0' ? 0 : 1;
  const maxStackVal = max_stack != null && max_stack !== '' ? parseInt(max_stack, 10) : 999;
  const consumePol = String(consume_policy || 'single_use').slice(0, 30) || 'single_use';
  const petSc = String(pet_scope || 'all').slice(0, 30) || 'all';

  const sql = `
    UPDATE items
    SET item_code = ?, name = ?, description = ?, type = ?, category = ?, subtype = ?, rarity = ?, image_url = ?, buy_price = ?, sell_price = ?, price_currency = ?,
        magic_value = ?, stackable = ?, max_stack = ?, consume_policy = ?, pet_scope = ?
    WHERE id = ?
  `;

  pool.query(sql, [
    Number.isFinite(itemCode) ? itemCode : null,
    name,
    description,
    type,
    category ?? null,
    subtype ?? null,
    rarityNorm,
    image_url,
    buy_price,
    sell_price,
    priceCurrency,
    Number.isFinite(magicVal) ? magicVal : null,
    stackVal,
    Number.isFinite(maxStackVal) && maxStackVal > 0 ? maxStackVal : 999,
    consumePol,
    petSc,
    id,
  ], (err, results) => {
    if (err) {
      console.error('Error updating item:', err);
      return res.status(500).json({ message: err.sqlMessage || 'Error updating item' });
    }

    res.json({ message: 'Item updated successfully' });
  });
});

//Admin - Delete vật phẩm
app.delete('/api/admin/items/:id', checkAdminRoleItems, (req, res) => {
  const { id } = req.params;

  pool.query('DELETE FROM items WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error deleting item:', err);
      return res.status(500).json({ message: 'Error deleting item' });
    }

    res.json({ message: 'Item deleted successfully' });
  });
});

// Lấy toàn bộ equipment_data (schema mới: equipment_type, power_min, power_max, durability_max, magic_value, crit_rate, block_rate, element, effect_id)
app.get('/api/admin/equipment-stats', checkAdminRoleItems, (req, res) => {
  const sql = `SELECT * FROM equipment_data`;
  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching equipment data:', err);
      return res.status(500).json({ message: 'Error fetching equipment data' });
    }
    res.json(results);
  });
});

app.post('/api/admin/equipment-stats', checkAdminRoleItems, (req, res) => {
  const {
    item_id,
    equipment_type = 'weapon',
    slot_type,
    power_min,
    power_max,
    durability_max,
    durability_mode,
    random_break_chance,
    magic_value,
    crit_rate,
    block_rate,
    element,
    effect_id,
  } = req.body;
  const normalizedEquipmentType = normalizeEquipmentType(equipment_type);
  const normalizedSlotType = normalizeSlotType(slot_type, normalizedEquipmentType);
  const normalizedDurabilityMode = normalizeDurabilityMode(durability_mode);
  const normalizedDurabilityMax = normalizedDurabilityMode === 'unknown' ? null : (durability_max ?? null);
  const normalizedRandomBreakChance = normalizedDurabilityMode === 'unknown' ? (random_break_chance ?? 3) : (random_break_chance ?? null);
  const sql = `INSERT INTO equipment_data (item_id, equipment_type, slot_type, power_min, power_max, durability_max, durability_mode, random_break_chance, magic_value, crit_rate, block_rate, element, effect_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 equipment_type = VALUES(equipment_type),
                 slot_type = VALUES(slot_type),
                 power_min = VALUES(power_min),
                 power_max = VALUES(power_max),
                 durability_max = VALUES(durability_max),
                 durability_mode = VALUES(durability_mode),
                 random_break_chance = VALUES(random_break_chance),
                 magic_value = VALUES(magic_value),
                 crit_rate = VALUES(crit_rate),
                 block_rate = VALUES(block_rate),
                 element = VALUES(element),
                 effect_id = VALUES(effect_id)`;

  pool.query(
    sql,
    [
      item_id,
      normalizedEquipmentType,
      normalizedSlotType,
      power_min ?? null,
      power_max ?? null,
      normalizedDurabilityMax,
      normalizedDurabilityMode,
      normalizedRandomBreakChance,
      magic_value ?? null,
      crit_rate ?? null,
      block_rate ?? null,
      element ?? null,
      effect_id ?? null,
    ],
    (err, results) => {
      if (err) {
        console.error('Error saving equipment data:', err);
        return res.status(500).json({ message: 'Error saving equipment data' });
      }
      res.json({ message: 'Equipment data saved successfully' });
    }
  );
});

app.put('/api/admin/equipment-stats/:id', checkAdminRoleItems, (req, res) => {
  const { id } = req.params;
  const {
    item_id,
    equipment_type,
    slot_type,
    power_min,
    power_max,
    durability_max,
    durability_mode,
    random_break_chance,
    magic_value,
    crit_rate,
    block_rate,
    element,
    effect_id,
  } = req.body;
  const normalizedEquipmentType = normalizeEquipmentType(equipment_type ?? 'weapon');
  const normalizedSlotType = normalizeSlotType(slot_type, normalizedEquipmentType);
  const normalizedDurabilityMode = normalizeDurabilityMode(durability_mode);
  const normalizedDurabilityMax = normalizedDurabilityMode === 'unknown' ? null : (durability_max ?? null);
  const normalizedRandomBreakChance = normalizedDurabilityMode === 'unknown' ? (random_break_chance ?? 3) : (random_break_chance ?? null);

  const sql = `UPDATE equipment_data
               SET item_id = ?, equipment_type = ?, slot_type = ?, power_min = ?, power_max = ?, durability_max = ?, durability_mode = ?, random_break_chance = ?, magic_value = ?, crit_rate = ?, block_rate = ?, element = ?, effect_id = ?
               WHERE id = ?`;

  pool.query(
    sql,
    [
      item_id,
      normalizedEquipmentType,
      normalizedSlotType,
      power_min ?? null,
      power_max ?? null,
      normalizedDurabilityMax,
      normalizedDurabilityMode,
      normalizedRandomBreakChance,
      magic_value ?? null,
      crit_rate ?? null,
      block_rate ?? null,
      element ?? null,
      effect_id ?? null,
      id,
    ],
    (err, results) => {
      if (err) {
        console.error('Error updating equipment data:', err);
        return res.status(500).json({ message: 'Error updating equipment data' });
      }
      res.json({ message: 'Equipment data updated successfully' });
    }
  );
});

// get items 
app.get('/api/admin/item-effects', checkAdminRoleItems, (req, res) => {
  const sql = `SELECT * FROM item_effects`;
  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching item effects:', err);
      return res.status(500).json({ message: 'Error fetching item effects' });
    }
    res.json((results || []).map((row) => normalizeEffectRow(row)));
  });
});

// Get item effects for a specific item
app.get('/api/item-effects/:itemId', (req, res) => {
  const { itemId } = req.params;
  const sql = `SELECT * FROM item_effects WHERE item_id = ?`;
  pool.query(sql, [itemId], (err, results) => {
    if (err) {
      console.error('Error fetching item effects:', err);
      return res.status(500).json({ message: 'Error fetching item effects' });
    }
    res.json((results || []).map((row) => normalizeEffectRow(row)));
  });
});

// Get equipment data for a specific item (schema mới: equipment_type, magic_value, durability_max, ...)
app.get('/api/equipment-data/:itemId', (req, res) => {
  const { itemId } = req.params;
  const sql = `SELECT * FROM equipment_data WHERE item_id = ?`;
  pool.query(sql, [itemId], (err, results) => {
    if (err) {
      console.error('Error fetching equipment data:', err);
      return res.status(500).json({ message: 'Error fetching equipment data' });
    }
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Equipment data not found' });
    }
  });
});

app.post('/api/admin/item-effects', checkAdminRoleItems, (req, res) => {
  const {
    item_id, effect_target, effect_type,
    value_min, value_max, is_permanent, duration_turns, magic_value
  } = req.body;
  const normalizedTarget = normalizeEffectTarget(effect_target);
  const normalizedType = normalizeEffectType(effect_type);

  const sql = `INSERT INTO item_effects 
    (item_id, effect_target, effect_type, value_min, value_max, is_permanent, duration_turns, magic_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  pool.query(sql, [
    item_id, normalizedTarget, normalizedType,
    value_min, value_max, is_permanent, duration_turns, magic_value ?? null
  ], (err, results) => {
    if (err) {
      console.error('Error creating item effect:', err);
      return res.status(500).json({ message: 'Error creating item effect' });
    }
    res.json({ message: 'Item effect created successfully' });
  });
});

app.put('/api/admin/item-effects/:id', checkAdminRoleItems, (req, res) => {
  const { id } = req.params;
  const {
    item_id, effect_target, effect_type,
    value_min, value_max, is_permanent, duration_turns, magic_value
  } = req.body;
  const normalizedTarget = normalizeEffectTarget(effect_target);
  const normalizedType = normalizeEffectType(effect_type);

  const sql = `UPDATE item_effects SET 
    item_id = ?, effect_target = ?, effect_type = ?, 
    value_min = ?, value_max = ?, is_permanent = ?, duration_turns = ?, magic_value = ?
    WHERE id = ?`;

  pool.query(sql, [
    item_id, normalizedTarget, normalizedType,
    value_min, value_max, is_permanent, duration_turns, magic_value ?? null, id
  ], (err, results) => {
    if (err) {
      console.error('Error updating item effect:', err);
      return res.status(500).json({ message: 'Error updating item effect' });
    }
    res.json({ message: 'Item effect updated successfully' });
  });
});


/************************************* SHOP ********************************************** */

let shopRestockColumnsReady = false;

async function ensureShopRestockColumns(dbConn = db) {
  if (shopRestockColumnsReady) return;
  try {
    const [cols] = await dbConn.query(
      `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_items'
         AND COLUMN_NAME IN ('max_stock', 'last_restock_period_key')`
    );
    const have = new Set((cols || []).map((r) => r.c));
    if (!have.has('max_stock')) {
      await dbConn.query('ALTER TABLE shop_items ADD COLUMN max_stock INT NULL AFTER stock_limit');
    }
    if (!have.has('last_restock_period_key')) {
      await dbConn.query(
        'ALTER TABLE shop_items ADD COLUMN last_restock_period_key VARCHAR(64) NULL AFTER restock_interval'
      );
    }
    await dbConn.query(
      `UPDATE shop_items SET max_stock = stock_limit
       WHERE stock_limit IS NOT NULL AND max_stock IS NULL`
    );
    shopRestockColumnsReady = true;
  } catch (e) {
    console.error('ensureShopRestockColumns:', e.message || e);
    // Vẫn đánh dấu để tránh spam ALTER lỗi lặp; restock sẽ no-op nếu thiếu cột
    shopRestockColumnsReady = true;
  }
}

/** Khóa kỳ restock theo global_reset_time (daily / weekly / monthly). */
function shopRestockPeriodKey(now, resetHm, interval) {
  const cycle = String(interval || 'none').toLowerCase();
  if (cycle === 'none' || !cycle) return null;
  const [rh, rm] = String(resetHm || '06:00')
    .trim()
    .split(':')
    .map((x) => parseInt(x, 10) || 0);
  const t = new Date(now.getTime());

  if (cycle === 'daily') {
    return luckyWheelDailyPeriodKey(t, resetHm);
  }

  if (cycle === 'weekly') {
    // Kỳ = Chủ nhật gần nhất tại giờ reset (hoặc tuần trước nếu chưa tới)
    const day = t.getDay(); // 0 = CN
    const anchorDate = new Date(t.getFullYear(), t.getMonth(), t.getDate() - day, rh, rm, 0, 0);
    if (t.getTime() < anchorDate.getTime()) {
      anchorDate.setDate(anchorDate.getDate() - 7);
    }
    return `w:${anchorDate.getTime()}`;
  }

  if (cycle === 'monthly') {
    let anchor = new Date(t.getFullYear(), t.getMonth(), 1, rh, rm, 0, 0);
    if (t.getTime() < anchor.getTime()) {
      anchor = new Date(t.getFullYear(), t.getMonth() - 1, 1, rh, rm, 0, 0);
    }
    return `m:${anchor.getFullYear()}-${anchor.getMonth() + 1}`;
  }

  return null;
}

/**
 * Restock lazy: nếu sang kỳ mới thì đổ stock_limit = max_stock cho item có restock_interval.
 * Shop-level shop_restock_interval dùng làm fallback khi item.restock_interval = none.
 */
async function ensureShopItemsRestocked(dbConn, shopId) {
  await ensureShopRestockColumns(dbConn);
  const resetHm = await luckyWheelFetchGlobalResetHm(dbConn);
  const now = new Date();

  const [shopRows] = await dbConn.query(
    'SELECT id, shop_restock_interval FROM shop_definitions WHERE id = ? LIMIT 1',
    [shopId]
  );
  if (!shopRows.length) return { restocked: 0 };
  const shopInterval = String(shopRows[0].shop_restock_interval || 'none').toLowerCase();

  let items;
  try {
    const [rows] = await dbConn.query(
      `SELECT id, stock_limit, max_stock, restock_interval, last_restock_period_key
       FROM shop_items WHERE shop_id = ?`,
      [shopId]
    );
    items = rows;
  } catch (e) {
    console.error('ensureShopItemsRestocked select:', e.message || e);
    return { restocked: 0 };
  }

  let restocked = 0;
  for (const item of items) {
    const interval = String(item.restock_interval || 'none').toLowerCase();
    if (interval === 'none' || !interval) continue;

    const maxStock =
      item.max_stock != null && item.max_stock !== ''
        ? Number(item.max_stock)
        : item.stock_limit != null
          ? Number(item.stock_limit)
          : null;
    if (maxStock == null || !Number.isFinite(maxStock)) continue; // unlimited

    const periodKey = shopRestockPeriodKey(now, resetHm, interval);
    if (!periodKey) continue;
    if (String(item.last_restock_period_key || '') === periodKey) continue;

    await dbConn.query(
      `UPDATE shop_items
       SET stock_limit = ?, max_stock = COALESCE(max_stock, ?), last_restock_period_key = ?
       WHERE id = ?`,
      [maxStock, maxStock, periodKey, item.id]
    );
    restocked += 1;
  }

  if (restocked > 0) {
    try {
      await dbConn.query('UPDATE shop_definitions SET last_restock_time = NOW() WHERE id = ?', [shopId]);
    } catch (_) {
      /* cột có thể chưa có trên DB cũ */
    }
  }
  return { restocked };
}

function normalizeShopStockLimit(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

const GENERAL_SHOP_SEEDS = [
  { code: 'food', name: 'Cửa Hàng Thực Phẩm', description: 'Bà béo Oishi: Bán thức ăn, đồ uống', type_filter: 'food', currency_type: 'peta', sort_order: 10, image_url: '/images/shops/food.png', parent_category: 'general' },
  { code: 'pharmacy', name: 'Cửa Hàng Dược Phẩm', description: 'Đại phu Amorph: Bán các loại thuốc và độc dược', type_filter: 'consumable', currency_type: 'peta', sort_order: 20, image_url: '/images/shops/pharmacy.png', parent_category: 'general' },
  { code: 'grocery', name: 'Cửa Hàng Tạp Hóa', description: 'Lái buôn Raaki: Bán các vật phẩm linh tinh', type_filter: 'misc', currency_type: 'peta', sort_order: 30, image_url: '/images/shops/grocery.png', parent_category: 'general' },
  { code: 'armory', name: 'Cửa Hàng Binh Khí', description: 'Thợ rèn Zicha: Bán vũ khí, giáp trụ', type_filter: 'equipment', currency_type: 'peta', sort_order: 40, image_url: '/images/shops/armory.png', parent_category: 'general' },
  { code: 'mystic', name: 'Cửa Hàng Thần Bí', description: 'Phù thủy Merlin: Bán vật phẩm hiếm VIP', type_filter: 'misc', currency_type: 'peta', sort_order: 50, image_url: '/images/shops/mystic.png', parent_category: 'general' },
  { code: 'golden', name: 'Cửa Hàng Hoàng Kim', description: 'Công tước Chrono: Kỳ trân dị bảo, petaGold', type_filter: 'all', currency_type: 'petagold', sort_order: 60, image_url: '/images/shops/golden.png', parent_category: 'general' },
  { code: 'flea', name: 'Chợ Trời', description: 'Các cửa hàng của cư dân Petaria', type_filter: 'all', currency_type: 'peta', sort_order: 70, image_url: '/images/shops/flea.png', parent_category: 'general' },
];

const EXCHANGE_SHOP_SEEDS = [
  { code: 'peta', name: 'Peta', description: 'Đổi thưởng bằng Peta', type_filter: 'all', currency_type: 'peta', sort_order: 10, parent_category: 'exchange' },
  { code: 'petagold', name: 'PetaGold', description: 'Đổi thưởng bằng PetaGold', type_filter: 'all', currency_type: 'petagold', sort_order: 20, parent_category: 'exchange' },
  { code: 'arena', name: 'Arena', description: 'Đổi thưởng Arena Points', type_filter: 'all', currency_type: 'arena', sort_order: 30, parent_category: 'exchange' },
  { code: 'honor', name: 'Honor', description: 'Đổi thưởng Honor Points', type_filter: 'all', currency_type: 'honor', sort_order: 40, parent_category: 'exchange' },
  { code: 'guild', name: 'Guild', description: 'Đổi thưởng Guild Points', type_filter: 'all', currency_type: 'guild', sort_order: 50, parent_category: 'exchange' },
  { code: 'guildwar', name: 'Guild War', description: 'Đổi thưởng Guild War Points', type_filter: 'all', currency_type: 'guildwar', sort_order: 60, parent_category: 'exchange' },
];

const PREMIUM_SHOP_SEEDS = [
  { code: 'monthly', name: 'Gói tháng', description: 'Shop cao cấp gói tháng', type_filter: 'all', currency_type: 'petagold', sort_order: 10, parent_category: 'premium' },
  { code: 'special', name: 'Đặc biệt', description: 'Shop cao cấp đặc biệt', type_filter: 'all', currency_type: 'petagold', sort_order: 20, parent_category: 'premium' },
  { code: 'limited', name: 'Giới hạn', description: 'Shop cao cấp giới hạn', type_filter: 'all', currency_type: 'petagold', sort_order: 30, parent_category: 'premium' },
  { code: 'daily', name: 'Hàng ngày', description: 'Shop cao cấp hàng ngày', type_filter: 'all', currency_type: 'petagold', sort_order: 40, parent_category: 'premium' },
];

const ALL_SHOP_SEEDS = [...GENERAL_SHOP_SEEDS, ...EXCHANGE_SHOP_SEEDS, ...PREMIUM_SHOP_SEEDS];

let generalShopsSeeded = false;

async function ensureGeneralShopsSeeded(dbConn = db) {
  if (generalShopsSeeded) return;
  try {
    // Cột phụ nếu thiếu (DB cũ)
    const [cols] = await dbConn.query(
      `SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_definitions'`
    );
    const have = new Set((cols || []).map((r) => String(r.c || '').toLowerCase()));
    if (!have.has('parent_category')) {
      await dbConn.query(
        `ALTER TABLE shop_definitions ADD COLUMN parent_category VARCHAR(32) NULL DEFAULT NULL`
      );
    }
    if (!have.has('currency_type')) {
      await dbConn.query(
        `ALTER TABLE shop_definitions ADD COLUMN currency_type VARCHAR(32) NULL DEFAULT 'peta'`
      );
    }
    if (!have.has('sort_order')) {
      await dbConn.query(
        `ALTER TABLE shop_definitions ADD COLUMN sort_order INT NULL DEFAULT 0`
      );
    }
    if (!have.has('image_url')) {
      await dbConn.query(
        `ALTER TABLE shop_definitions ADD COLUMN image_url VARCHAR(512) NULL DEFAULT NULL`
      );
    }
    if (!have.has('is_active')) {
      await dbConn.query(
        `ALTER TABLE shop_definitions ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`
      );
    }

    for (const s of ALL_SHOP_SEEDS) {
      const parent = s.parent_category || 'general';
      const [ex] = await dbConn.query(
        'SELECT id, image_url, is_active, parent_category FROM shop_definitions WHERE code = ? LIMIT 1',
        [s.code]
      );
      if (ex.length) {
        // Shop đã xóa mềm: không seed lại / không ghi đè
        if (Number(ex[0].is_active) === 0) continue;
        const keepImage = String(ex[0].image_url || '').trim();
        const imageUrl = keepImage || s.image_url || null;
        // Giữ parent_category nếu đã gán; chỉ điền khi đang trống
        const existingParent = String(ex[0].parent_category || '').trim();
        const nextParent = existingParent || parent;
        await dbConn.query(
          `UPDATE shop_definitions
           SET name = ?, description = ?, type_filter = ?, currency_type = ?, parent_category = ?, sort_order = ?,
               image_url = ?
           WHERE code = ? AND COALESCE(is_active, 1) = 1`,
          [
            s.name,
            s.description,
            s.type_filter,
            s.currency_type,
            nextParent,
            s.sort_order,
            imageUrl,
            s.code,
          ]
        );
      } else {
        await dbConn.query(
          `INSERT INTO shop_definitions (code, name, description, type_filter, currency_type, parent_category, sort_order, image_url, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            s.code,
            s.name,
            s.description,
            s.type_filter,
            s.currency_type,
            parent,
            s.sort_order,
            s.image_url || null,
          ]
        );
      }
    }
    generalShopsSeeded = true;
  } catch (e) {
    console.error('ensureGeneralShopsSeeded:', e.message || e);
    generalShopsSeeded = true;
  }
}

// 1. API: Lấy danh sách cửa hàng: 
// Dành cho người chơi hoặc admin để hiện danh sách các shop.

app.get('/api/shops', async (req, res) => {
  try {
    await ensureGeneralShopsSeeded(db);
    const [shops] = await db.query(
      `SELECT * FROM shop_definitions
       WHERE COALESCE(is_active, 1) = 1
       ORDER BY sort_order ASC, id ASC`
    );
    res.json(shops);
  } catch (err) {
    console.error('Lỗi khi query shop_definitions:', err);
    // Fallback nếu thiếu cột sort_order / is_active
    try {
      const [shops] = await db.query('SELECT * FROM shop_definitions');
      res.json(shops);
    } catch (e2) {
      res.status(500).json({ error: 'Lỗi khi lấy danh sách cửa hàng' });
    }
  }
});

// 2. API: Lấy danh sách item của 1 cửa hàng
// Trả về item đang được bán trong shop tương ứng với shop_code
app.get('/api/shop/:shop_code', async (req, res) => {
  const { shop_code } = req.params;

  try {
    const [shopRows] = await db.query(
      'SELECT id FROM shop_definitions WHERE code = ?',
      [shop_code]
    );

    if (!shopRows.length) {
      return res.status(404).json({ error: 'Shop không tồn tại' });
    }

    const shop = shopRows[0];
    await ensureShopItemsRestocked(db, shop.id);

    const [items] = await db.query(`
      SELECT 
        si.id AS shop_item_id,
        si.item_id,
        si.shop_id,
        si.custom_price,
        si.currency_type,
        si.stock_limit,
        si.max_stock,
        si.restock_interval,
        si.available_from,
        si.available_until,
        i.name,
        i.description,
        i.type,
        i.category,
        i.rarity,
        i.image_url,
        i.magic_value,
        i.sell_price,
        i.price_currency,
        i.id AS id,
        ed.durability_max,
        ed.durability_mode,
        COALESCE(si.custom_price, i.buy_price) AS price
      FROM shop_items si
      JOIN items i ON si.item_id = i.id
      LEFT JOIN equipment_data ed ON i.id = ed.item_id
      WHERE si.shop_id = ?
      ORDER BY si.id DESC
    `, [shop.id]);

    res.json(items);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách item trong shop:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy item trong shop' });
  }
});

// 3.API Admin: Thêm item vào shop (bulk)
//Cho phép admin thêm nhiều item vào 1 cửa hàng cùng lúc
app.post('/api/admin/shop-items/bulk-add', async (req, res) => {
  const { shop_id, item_ids, custom_price, currency_type } = req.body;

  if (!shop_id || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ error: 'Thiếu thông tin' });
  }

  try {
    const placeholders = item_ids.map(() => '(?, ?, ?, ?)').join(', ');
    const flatValues = item_ids.flatMap(itemId => [shop_id, itemId, custom_price ?? null, currency_type ?? 'peta']);

    const sql = `INSERT INTO shop_items (shop_id, item_id, custom_price, currency_type) VALUES ${placeholders}`;
    await db.query(sql, flatValues);

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi khi thêm item vào shop:', err);
    res.status(500).json({ error: 'Lỗi khi thêm item vào shop' });
  }
});



// User - Mua item

// POST /api/shop/buy
app.post('/api/shop/buy', async (req, res) => {
  const { shop_code, item_id, user_id, quantity = 1 } = req.body;

  try {
    // 1. Lấy shop ID từ code
    const [shopRows] = await db.query(`SELECT id FROM shop_definitions WHERE code = ?`, [shop_code]);
    if (!shopRows.length) return res.status(404).json({ error: 'Shop không tồn tại' });
    const shop = shopRows[0];

    // Restock lazy trước khi đọc/trừ stock
    await ensureShopItemsRestocked(db, shop.id);

    // 2. Lấy thông tin item trong shop
    const [itemRows] = await db.query(`
    SELECT i.*, si.custom_price, si.currency_type, si.stock_limit, si.max_stock, si.restock_interval
    FROM shop_items si
    JOIN items i ON si.item_id = i.id
    WHERE si.item_id = ? AND si.shop_id = ?
    `, [item_id, shop.id]);
    
    if (!itemRows.length) {
      return res.status(404).json({ error: 'Item không tồn tại trong shop' });
    }
    
    const itemRow = itemRows[0];

    // stock_limit NULL = không giới hạn; chỉ chặn khi có số và <= 0 hoặc không đủ số lượng mua
    const hasStockCap =
      itemRow.stock_limit !== null && itemRow.stock_limit !== undefined;
    if (hasStockCap) {
      if (itemRow.stock_limit <= 0) {
        return res.status(400).json({ error: 'Vật phẩm đã hết hàng' });
      }
      if (itemRow.stock_limit < quantity) {
        return res.status(400).json({ error: 'Không đủ số lượng trong kho shop' });
      }
    }

    const price = itemRow.custom_price ?? itemRow.buy_price;
    const currency = itemRow.currency_type || itemRow.price_currency || 'peta';
    
    if (!currency || !['peta', 'petagold'].includes(currency)) {
      return res.status(400).json({ error: 'Loại tiền không hợp lệ' });
    }

    // Túi đầy: chặn mua (không trừ tiền) — trừ khi chỉ cộng vào stack có sẵn
    const slotsNeeded = await estimateNewSlotsForGrant(db, user_id, item_id, quantity);
    if (slotsNeeded > 0) {
      const cap = await getInventoryCapacity(db, user_id);
      if (slotsNeeded > cap.freeSlots) {
        return res.status(400).json({
          error: 'Túi đồ đã đầy',
          message: `Túi đồ đã đầy (${cap.slotCount}/${cap.maxSlots}). Hãy dọn bớt vật phẩm rồi mua lại.`,
          slotCount: cap.slotCount,
          maxSlots: cap.maxSlots,
        });
      }
    }

    // 4. Lấy thông tin người dùng (mysql2: [rows, fields] — phải lấy rows[0])
    const [userRows] = await db.query(`SELECT peta, petagold FROM users WHERE id = ?`, [user_id]);
    const userRow = userRows[0];
    if (!userRow) return res.status(404).json({ error: 'Người dùng không tồn tại' });

    const totalPrice = price * quantity;
    const userBalance = currency === 'peta' ? userRow.peta : userRow.petagold;
    if (userBalance < totalPrice) return res.status(400).json({ error: 'Không đủ tiền' });

    // 5. Trừ tiền
    await db.query(`UPDATE users SET ${currency} = ${currency} - ? WHERE id = ?`, [totalPrice, user_id]);
    if (currency === 'peta') {
      try {
        await titleService.recordPetaSpent(db, user_id, totalPrice);
      } catch (e) {
        console.error('title spend (shop):', e);
      }
    }

    // 6. Thêm item vào inventory
    if (itemRow.type === 'equipment') {
      const [equipInfo] = await db.query(
        'SELECT durability_max FROM equipment_data WHERE item_id = ?',
        [item_id]
      );

      const durability = (equipInfo.length > 0) ? (equipInfo[0].durability_max ?? 1) : 1;

      // Equipment items can only be bought one at a time
      for (let i = 0; i < quantity; i++) {
        await db.query(`
          INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left)
          VALUES (?, ?, 1, 0, ?)
        `, [user_id, item_id, durability]);
      }
    } else {
      const [invRows] = await db.query(`
        SELECT id, quantity FROM inventory
        WHERE player_id = ? AND item_id = ? AND is_equipped = 0
      `, [user_id, item_id]);

      if (invRows.length > 0) {
        const inv = invRows[0];
        await db.query(`UPDATE inventory SET quantity = quantity + ? WHERE id = ?`, [quantity, inv.id]);
      } else {
        await db.query(`
          INSERT INTO inventory (player_id, item_id, quantity)
          VALUES (?, ?, ?)
        `, [user_id, item_id, quantity]);
      }
    }

    // 7. Trừ stock nếu shop có giới hạn (NULL = không trừ)
    if (hasStockCap) {
      const [upd] = await db.query(
        `
        UPDATE shop_items
        SET stock_limit = stock_limit - ?
        WHERE shop_id = ? AND item_id = ? AND stock_limit >= ?
      `,
        [quantity, shop.id, item_id, quantity]
      );

      if (!upd.affectedRows) {
        return res.status(400).json({ error: 'Không thể cập nhật stock (có thể đã hết hàng)' });
      }
    }

    res.json({ success: true, message: 'Mua thành công!' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ khi xử lý mua vật phẩm' });
  }
});


// Admin - Cập nhật item trong shop (Edit)
app.put('/api/admin/shop-items/:shop_id/:item_id', checkAdminRoleItems, async (req, res) => {
  const { shop_id, item_id } = req.params;
  let {
    custom_price,
    currency_type,
    stock_limit,
    restock_interval,
    available_from,
    available_until,
  } = req.body;

  try {
    await ensureShopRestockColumns(db);

    // Nếu có ngày giờ, thì mặc định restock = none
    if (available_from || available_until) {
      restock_interval = 'none';
    }

    const stockVal = normalizeShopStockLimit(stock_limit);
    // NULL = không giới hạn; số = cả stock hiện tại lẫn max để restock
    const sql = `
      UPDATE shop_items
      SET custom_price = ?,
          currency_type = COALESCE(?, currency_type),
          stock_limit = ?,
          max_stock = ?,
          restock_interval = ?,
          available_from = ?,
          available_until = ?,
          last_restock_period_key = NULL
      WHERE shop_id = ? AND item_id = ?
    `;

    await db.query(sql, [
      custom_price != null && custom_price !== '' ? Number(custom_price) : null,
      currency_type || null,
      stockVal,
      stockVal,
      restock_interval || 'none',
      available_from || null,
      available_until || null,
      shop_id,
      item_id,
    ]);

    res.json({ success: true, message: 'Item updated successfully' });
  } catch (err) {
    console.error('Lỗi khi cập nhật shop item:', err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật item trong shop' });
  }
});

//Admin - Delete items trong shop 
app.delete('/api/admin/shop-items/:shop_id/:item_id', async (req, res) => {
  const { shop_id, item_id } = req.params;

  try {
    const result = await db.query(`
      DELETE FROM shop_items
      WHERE shop_id = ? AND item_id = ?
    `, [shop_id, item_id]);

    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy item để xóa' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi khi xóa item khỏi shop:', err);
    res.status(500).json({ error: 'Lỗi server khi xóa item khỏi shop' });
  }
});


// User - Lấy thông tin items từ Inventory

app.get('/api/users/:userId/inventory', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await db.query(`
        SELECT i.*, it.name, it.description, it.image_url, it.type, it.category AS item_category,
               it.subtype AS item_subtype, it.rarity, it.item_code,
               it.sell_price, it.buy_price, it.price_currency,
               it.magic_value AS items_magic_value,
               p.name AS pet_name, p.level AS pet_level,
               ed.equipment_type, ed.magic_value AS power, ed.durability_max AS max_durability, ed.durability_mode
        FROM inventory i
        JOIN items it ON i.item_id = it.id
        LEFT JOIN pets p ON i.equipped_pet_id = p.id
        LEFT JOIN equipment_data ed ON it.id = ed.item_id
        WHERE i.player_id = ?
    `, [userId]);

    const slotCount = rows.length;
    res.json({
      items: rows,
      slotCount,
      maxSlots: INVENTORY_MAX_SLOTS,
      freeSlots: Math.max(0, INVENTORY_MAX_SLOTS - slotCount),
    });
  } catch (err) {
    console.error('Lỗi khi lấy inventory:', err);
    res.status(500).json({ error: 'Không thể lấy dữ liệu inventory' });
  }
});

app.get('/api/users/:userId/exhibition', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { userId } = req.params;
  const targetUserId = Number(userId);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ message: 'User ID không hợp lệ' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const [rows] = await db.query(
      `SELECT
          ei.id AS exhibition_id,
          ei.user_id,
          ei.item_id,
          ei.display_order,
          ei.created_at,
          it.name,
          it.image_url,
          it.type,
          it.rarity,
          it.description
       FROM user_exhibition_items ei
       JOIN items it ON ei.item_id = it.id
       WHERE ei.user_id = ?
       ORDER BY ei.display_order ASC, ei.id ASC`,
      [targetUserId]
    );
    return res.json({
      items: rows,
      maxItems: 10,
    });
  } catch (err) {
    console.error('Lỗi khi lấy phòng triển lãm:', err);
    return res.status(500).json({ message: 'Không thể tải phòng triển lãm' });
  }
});

app.post('/api/inventory/:id/exhibition', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { id } = req.params;
  const inventoryId = Number(id);

  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
    return res.status(400).json({ message: 'Inventory ID không hợp lệ' });
  }

  let conn;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [inventoryRows] = await conn.query(
      `SELECT i.id, i.item_id, i.quantity, i.is_equipped, it.name
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.player_id = ?
       LIMIT 1`,
      [inventoryId, userId]
    );

    if (!inventoryRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy vật phẩm trong kho' });
    }

    const inventoryItem = inventoryRows[0];
    if (Number(inventoryItem.is_equipped) === 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'Không thể đem vật phẩm đang trang bị vào triển lãm' });
    }

    const [existingRows] = await conn.query(
      'SELECT id FROM user_exhibition_items WHERE user_id = ? AND item_id = ? LIMIT 1',
      [userId, inventoryItem.item_id]
    );
    if (existingRows.length > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Đã trưng bày item này.' });
    }

    const [countRows] = await conn.query(
      'SELECT COUNT(*) AS total FROM user_exhibition_items WHERE user_id = ?',
      [userId]
    );
    const currentTotal = Number(countRows[0]?.total || 0);
    if (currentTotal >= 10) {
      await conn.rollback();
      return res.status(400).json({ message: 'Phòng triển lãm đã đầy (tối đa 10 vật phẩm).' });
    }

    const [orderRows] = await conn.query(
      'SELECT COALESCE(MAX(display_order), 0) AS max_order FROM user_exhibition_items WHERE user_id = ?',
      [userId]
    );
    const nextOrder = Number(orderRows[0]?.max_order || 0) + 1;

    await conn.query(
      'INSERT INTO user_exhibition_items (user_id, item_id, display_order) VALUES (?, ?, ?)',
      [userId, inventoryItem.item_id, nextOrder]
    );

    const quantity = Number(inventoryItem.quantity || 0);
    const remainingQuantity = quantity - 1;
    if (remainingQuantity <= 0) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [inventoryId]);
    } else {
      await conn.query('UPDATE inventory SET quantity = ? WHERE id = ?', [remainingQuantity, inventoryId]);
    }

    await conn.commit();
    return res.json({
      success: true,
      message: `Đã mang ${inventoryItem.name || 'vật phẩm'} vào phòng triển lãm.`,
      remaining_quantity: Math.max(0, remainingQuantity),
      removed: remainingQuantity <= 0,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Lỗi khi thêm item vào phòng triển lãm:', err);
    return res.status(500).json({ message: 'Không thể thêm item vào phòng triển lãm' });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/exhibition/reorder', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const exhibitionItemId = Number(req.body?.exhibitionItemId);
  const direction = String(req.body?.direction || '').trim().toLowerCase();

  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  if (!Number.isInteger(exhibitionItemId) || exhibitionItemId <= 0) {
    return res.status(400).json({ message: 'Vật phẩm triển lãm không hợp lệ' });
  }
  if (!['left', 'right'].includes(direction)) {
    return res.status(400).json({ message: 'Hướng sắp xếp không hợp lệ' });
  }

  let conn;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, display_order
       FROM user_exhibition_items
       WHERE user_id = ?
       ORDER BY display_order ASC, id ASC`,
      [userId]
    );

    const currentIndex = rows.findIndex((row) => Number(row.id) === exhibitionItemId);
    if (currentIndex === -1) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy vật phẩm trong phòng triển lãm' });
    }

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'Không thể di chuyển theo hướng đã chọn' });
    }

    const currentItem = rows[currentIndex];
    const targetItem = rows[targetIndex];

    await conn.query(
      'UPDATE user_exhibition_items SET display_order = ? WHERE id = ? AND user_id = ?',
      [targetItem.display_order, currentItem.id, userId]
    );
    await conn.query(
      'UPDATE user_exhibition_items SET display_order = ? WHERE id = ? AND user_id = ?',
      [currentItem.display_order, targetItem.id, userId]
    );

    await conn.commit();
    return res.json({ success: true, message: 'Đã cập nhật vị trí vật phẩm trưng bày.' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Lỗi khi sắp xếp phòng triển lãm:', err);
    return res.status(500).json({ message: 'Không thể sắp xếp vật phẩm triển lãm' });
  } finally {
    if (conn) conn.release();
  }
});

app.delete('/api/exhibition/:exhibitionItemId', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const exhibitionItemId = Number(req.params.exhibitionItemId);

  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  if (!Number.isInteger(exhibitionItemId) || exhibitionItemId <= 0) {
    return res.status(400).json({ message: 'Vật phẩm triển lãm không hợp lệ' });
  }

  let conn;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT ei.id, ei.item_id, it.name
       FROM user_exhibition_items ei
       JOIN items it ON it.id = ei.item_id
       WHERE ei.id = ? AND ei.user_id = ?
       LIMIT 1`,
      [exhibitionItemId, userId]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy vật phẩm trong phòng triển lãm' });
    }

    const exhibitionItem = rows[0];

    await conn.query(
      'DELETE FROM user_exhibition_items WHERE id = ? AND user_id = ?',
      [exhibitionItemId, userId]
    );

    const [inventoryRows] = await conn.query(
      `SELECT id, quantity
       FROM inventory
       WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL)
       LIMIT 1`,
      [userId, exhibitionItem.item_id]
    );

    if (inventoryRows.length > 0) {
      await conn.query(
        'UPDATE inventory SET quantity = quantity + 1 WHERE id = ?',
        [inventoryRows[0].id]
      );
    } else {
      await conn.query(
        'INSERT INTO inventory (player_id, item_id, quantity, is_equipped) VALUES (?, ?, 1, 0)',
        [userId, exhibitionItem.item_id]
      );
    }

    await conn.commit();
    return res.json({
      success: true,
      message: `Đã gỡ ${exhibitionItem.name || 'vật phẩm'} khỏi phòng triển lãm.`,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Lỗi khi gỡ item khỏi phòng triển lãm:', err);
    return res.status(500).json({ message: 'Không thể gỡ item khỏi phòng triển lãm' });
  } finally {
    if (conn) conn.release();
  }
});

// User - Bán ve chai item trong inventory (nhận theo items.price_currency + sell_price)
app.post('/api/inventory/:id/sell', async (req, res) => {
  const { id } = req.params;
  const quantityRaw = req.body?.quantity;
  const quantity = parseInt(quantityRaw, 10);
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: 'Số lượng bán không hợp lệ' });
  }

  let conn;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [invRows] = await conn.query(
      `SELECT i.id, i.player_id, i.quantity, i.is_equipped, it.sell_price, it.price_currency, it.name
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.player_id = ?
       LIMIT 1`,
      [id, userId]
    );

    if (!invRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy vật phẩm trong kho' });
    }

    const inv = invRows[0];
    if (Number(inv.is_equipped) === 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'Không thể bán vật phẩm đang trang bị' });
    }
    if (quantity > Number(inv.quantity)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Số lượng bán vượt quá số lượng hiện có' });
    }

    const sellPrice = Number(inv.sell_price) || 0;
    const sellCurrency = String(inv.price_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    const currencyGained = sellPrice * quantity;
    const remain = Number(inv.quantity) - quantity;

    if (remain <= 0) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [id]);
    } else {
      await conn.query('UPDATE inventory SET quantity = ? WHERE id = ?', [remain, id]);
    }

    if (currencyGained > 0) {
      await conn.query(`UPDATE users SET ${sellCurrency} = ${sellCurrency} + ? WHERE id = ?`, [currencyGained, userId]);
      if (sellCurrency === 'peta') {
        try {
          await titleService.recordPetaEarned(db, userId, currencyGained);
        } catch (e) {
          console.error('title earn (sell):', e);
        }
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: `Đã bán ${quantity} ${inv.name || 'vật phẩm'} thành công`,
      currency_type: sellCurrency,
      currency_gained: currencyGained,
      peta_gained: sellCurrency === 'peta' ? currencyGained : 0,
      remaining_quantity: remain < 0 ? 0 : remain,
      removed: remain <= 0,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Lỗi khi bán vật phẩm:', err);
    res.status(500).json({ message: 'Lỗi server khi bán vật phẩm' });
  } finally {
    if (conn) conn.release();
  }
});

// ======================================================== EQUIP ITEMS ========================================================
//Equip item cho pet
/* Điều kiện:
 Item phải thuộc user
 Item phải là equipment
 Item chưa được trang bị (is_equipped = 0)
 Pet là của user
 Pet chưa đủ 4 item đang gắn
*/ 
app.post('/api/pets/:petId/equip-item', async (req, res) => {
  const { petId } = req.params;
  const { inventory_id } = req.body;
  const maxItemsCanEquip = 4 ;

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1. Kiểm tra inventory item (phải chưa trang bị, không hỏng, còn bền)
    const [invRows] = await conn.query(
      `SELECT i.*, it.type, i.player_id FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.is_equipped = 0`,
      [inventory_id]
    );

    if (invRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Item không tồn tại hoặc đã được trang bị' });
    }

    const item = invRows[0];
    if (item.type !== 'equipment') {
      await conn.rollback();
      return res.status(400).json({ message: 'Chỉ có thể trang bị item loại equipment' });
    }
    if (item.is_broken === 1 || item.is_broken === true) {
      await conn.rollback();
      return res.status(400).json({ message: 'Vật phẩm đã hỏng, không thể trang bị. Hãy sửa chữa trước.' });
    }
    const dur = item.durability_left != null ? parseInt(item.durability_left, 10) : 1;
    if (dur <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Vật phẩm đã hết độ bền, không thể trang bị. Hãy sửa chữa trước.' });
    }

    // 2. Kiểm tra pet tồn tại và thuộc cùng user
    const [petRows] = await conn.query(
      'SELECT * FROM pets WHERE id = ? AND owner_id = ?',
      [petId, item.player_id]
    );

    if (petRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Pet không tồn tại hoặc không thuộc user' });
    }

    // Pet hết máu thì không cho trang bị (tránh các ràng buộc/trigger liên quan current_hp)
    if ((petRows[0].current_hp ?? 0) <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Thú cưng quá mệt mỏi (HP = 0). Hãy cho ăn/nghỉ ngơi để hồi phục trước khi trang bị.' });
    }

    // 3. Kiểm tra số item đã được gắn (kể cả broken — broken vẫn chiếm slot đến khi gỡ)
    const [equippedCount] = await conn.query(
      'SELECT COUNT(*) AS count FROM inventory WHERE equipped_pet_id = ? AND is_equipped = 1',
      [petId]
    );

    if (equippedCount[0].count >= maxItemsCanEquip) {
      await conn.rollback();
      return res.status(400).json({ message: 'Pet đã trang bị tối đa 4 item' });
    }

    // 3.5. Chuẩn hóa current_hp trước khi trang bị (giảm rủi ro vi phạm constraint)
    // Lưu HP hiện tại để restore sau khi trigger/recalc chạy.
    const prevHp = Math.max(0, Number(petRows[0].current_hp ?? 0) || 0);
    await normalizePetCurrentHp(conn, petId);

    // CHECK trong DB dùng final_stats->hp. Nếu final_stats.hp đang NULL/missing, mọi current_hp != NULL sẽ fail.
    // Set current_hp = NULL trước khi UPDATE inventory để bypass CHECK trong giai đoạn trigger chạy.
    await conn.query('UPDATE pets SET current_hp = NULL WHERE id = ?', [petId]);

    // 4. Cập nhật inventory
    await conn.query(
      'UPDATE inventory SET is_equipped = 1, equipped_pet_id = ? WHERE id = ?',
      [petId, inventory_id]
    );

    // 5. Recalculate stats theo equipment rồi clamp current_hp theo max mới
    try {
      await conn.query('CALL recalculate_pet_stats(?)', [petId]);
    } catch (e) {
      // Nếu DB chưa có procedure thì vẫn tiếp tục (equip không nên chết toàn bộ).
      // Nhưng nếu có và fail thì rollback để tránh trạng thái dở dang.
      await conn.rollback();
      return res.status(500).json({ message: 'Không thể cập nhật chỉ số pet sau khi trang bị' });
    }
    // Restore HP hợp lệ theo trần mới sau recalc (ưu tiên CHECK theo final_stats.hp)
    const fsHpAfter = await getFinalStatsHp(conn, petId);
    if (fsHpAfter == null) {
      // Nếu final_stats.hp vẫn NULL => CHECK bắt current_hp phải NULL
      await conn.query('UPDATE pets SET current_hp = NULL WHERE id = ?', [petId]);
    } else {
      const restored = Math.max(0, Math.min(prevHp, fsHpAfter));
      await conn.query('UPDATE pets SET current_hp = ? WHERE id = ?', [restored, petId]);
    }
    await normalizePetCurrentHp(conn, petId);

    await conn.commit();
    res.json({ message: 'Trang bị thành công' });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Lỗi khi trang bị item:', err);
    res.status(500).json({ message: 'Lỗi server khi trang bị item' });
  } finally {
    if (conn) conn.release();
  }
});

// API: Lấy danh sách item đã được trang bị cho pet với power và durability từ equipment_data
app.get('/api/pets/:petId/equipment', async (req, res) => {
  const { petId } = req.params;
  try {
    const [rows] = await pool.promise().query(
      `SELECT i.id, i.item_id, it.name AS item_name, it.image_url, it.description, it.type, it.rarity,
              i.durability_left,
              ed.equipment_type, ed.magic_value AS power, ed.power_min, ed.power_max,
              ed.durability_max AS max_durability, ed.durability_mode, i.is_broken
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.equipped_pet_id = ? AND i.is_equipped = 1`,
      [petId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching equipped items for pet:', err);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách item đã trang bị' });
  }
});

// API: Gỡ tất cả item broken/hết bền khỏi pet (sau trận Arena)
app.post('/api/pets/:petId/unequip-broken', async (req, res) => {
  // Repair/broken system removed: items are destroyed at durability 0.
  res.status(410).json({ message: 'Repair system removed. Broken equipment is destroyed automatically.' });
});

// API: Gỡ item khỏi pet (unequip)
app.post('/api/inventory/:id/unequip', async (req, res) => {
  const { id } = req.params;

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Kiểm tra item tồn tại và đang được trang bị
    const [rows] = await conn.query(
      'SELECT * FROM inventory WHERE id = ? AND is_equipped = 1',
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Item không tồn tại hoặc chưa được trang bị' });
    }

    const petId = rows[0].equipped_pet_id;

    // Cập nhật trạng thái: tháo khỏi pet
    await conn.query(
      'UPDATE inventory SET is_equipped = 0, equipped_pet_id = NULL WHERE id = ?',
      [id]
    );

    // Cập nhật lại stats pet (nếu có) và clamp current_hp theo max mới
    if (petId != null) {
      await normalizePetCurrentHp(conn, petId);
      try {
        await conn.query('CALL recalculate_pet_stats(?)', [petId]);
      } catch (e) {
        await conn.rollback();
        return res.status(500).json({ message: 'Không thể cập nhật chỉ số pet sau khi gỡ trang bị' });
      }
      await normalizePetCurrentHp(conn, petId);
    }

    await conn.commit();
    res.json({ message: 'Đã gỡ item khỏi pet thành công' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Lỗi khi gỡ item:', err);
    res.status(500).json({ message: 'Lỗi server khi gỡ item' });
  } finally {
    if (conn) conn.release();
  }
});

// API: Cập nhật durability của equipment khi sử dụng trong battle
app.post('/api/inventory/:id/use-durability', async (req, res) => {
  const { id } = req.params;
  const { amount = 1 } = req.body;

  try {
    const durabilityResult = await consumeEquipmentDurability(id, amount);
    if (durabilityResult.not_found) {
      return res.status(404).json({ message: 'Item không tồn tại' });
    }

    if (durabilityResult.item_destroyed) {
      return res.json({
        message: durabilityResult.break_reason === 'random' ? 'Equipment gãy ngẫu nhiên và bị tiêu hủy' : 'Equipment đã hỏng và bị tiêu hủy',
        durability_left: 0,
        item_destroyed: true,
        is_permanent_durability: false,
        is_random_durability: durabilityResult.is_random_durability,
      });
    }

    return res.json({
      message: durabilityResult.is_permanent_durability
        ? 'Equipment có độ bền vĩnh viễn'
        : (durabilityResult.is_random_durability ? 'Độ bền ngẫu nhiên: item chưa gãy' : 'Durability đã được cập nhật'),
      durability_left: Number(durabilityResult.durability_left),
      item_destroyed: false,
      is_permanent_durability: durabilityResult.is_permanent_durability,
      is_random_durability: durabilityResult.is_random_durability,
    });

  } catch (err) {
    console.error('Error updating durability:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật durability' });
  }
});

/*==================================================== ARENA =========================================================================*/
// API: Admin tạo pet NPC từ species để dùng trong arena
app.post('/api/admin/arena-pet', async (req, res) => {
  let { pet_species_id, level, custom_name } = req.body;
  const adminId = req.user?.id || 6; // giả định admin là user id 1

  try {
    const [speciesRows] = await db.query(
      'SELECT * FROM pet_species WHERE id = ?',
      [pet_species_id]
    );
    if (!speciesRows.length) return res.status(404).json({ message: 'Pet species không tồn tại' });
    const species = speciesRows[0];

    // IV full 31
    const iv = { iv_hp: parseInt(31), iv_mp: parseInt(31), iv_str: parseInt(31), iv_def: parseInt(31), iv_intelligence: parseInt(31), iv_spd: parseInt(31) };

    const base = {
      hp: parseInt(species.base_hp),
      mp: parseInt(species.base_mp),
      str: parseInt(species.base_str),
      def: parseInt(species.base_def),
      intelligence: parseInt(species.base_intelligence),
      spd: parseInt(species.base_spd),
    };
    level = parseInt(level);
    console.log('BASE STATS:', base, 'IV:', iv, 'LEVEL:', level);
    const stats = calculateFinalStats(base, iv, level);
    console.log('FINAL STATS:', stats);
    const uuid = require('uuid').v4();
    const now = new Date();
    const expToNext = 100; // default hoặc dùng bảng exp

    await db.query(`
      INSERT INTO pets (uuid, name, owner_id, pet_species_id, level, created_date, 
        hp, max_hp, mp, max_mp, str, def, intelligence, spd,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd, 
        current_exp, exp_to_next_level, final_stats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuid,
      custom_name || species.name,
      adminId,
      species.id,
      level,
      now,
      stats.hp, stats.hp,
      stats.mp, stats.mp,
      stats.str, stats.def, stats.intelligence, stats.spd,
      iv.iv_hp, iv.iv_mp, iv.iv_str, iv.iv_def, iv.iv_intelligence, iv.iv_spd,
      0, expToNext,
      JSON.stringify(stats),
    ]);

    res.json({ message: 'Đã tạo NPC thành công!' });
  } catch (err) {
    console.error('Lỗi tạo arena pet:', err);
    res.status(500).json({ message: 'Lỗi khi tạo pet đấu trường' });
  }
});


// API: Lấy danh sách Boss Arena (location_id = 0 = Arena; NULL = legacy hiển thị Arena)
app.get('/api/arena/enemies', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, name, level, image_url AS image
      FROM boss_templates
      WHERE location_id = 0 OR location_id IS NULL
      ORDER BY level ASC
    `);
    const list = (rows || []).map((r) => ({ ...r, isBoss: true }));
    res.json(list);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách Boss Arena:', err);
    res.status(500).json({ message: 'Lỗi server khi tải danh sách đối thủ' });
  }
});

// API: Chi tiết Boss
// - Không có ?level= → Arena / mặc định: base_* dùng trực tiếp (không công thức)
// - Có ?level=N → map săn: tính stat theo công thức (base L1 × level)
app.get('/api/bosses/:id', async (req, res) => {
  try {
    const bossId = parseInt(req.params.id, 10);
    if (!bossId) return res.status(400).json({ message: 'ID Boss không hợp lệ' });

    const [bossRows] = await db.query(
      'SELECT * FROM boss_templates WHERE id = ?',
      [bossId]
    );
    if (!bossRows || bossRows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy Boss' });
    }
    const row = bossRows[0];

    const templateLevel = parseInt(row.level, 10) || 1;
    const qLevel = parseInt(req.query.level, 10);
    const useFormula = Number.isFinite(qLevel) && qLevel > 0;
    const level = useFormula ? qLevel : templateLevel;
    const finalStats = useFormula
      ? calculateBossFinalStats(row, level)
      : rawBossFinalStats(row);

    const [skillRows] = await db.query(
      `SELECT s.id, s.name, s.description, s.type, s.power_min, s.power_max, s.accuracy, s.mana_cost, bs.sort_order
       FROM boss_skills bs
       JOIN skills s ON bs.skill_id = s.id
       WHERE bs.boss_template_id = ?
       ORDER BY bs.sort_order ASC, s.id ASC`,
      [bossId]
    );
    const skills = (skillRows || []).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type || 'attack',
      power_min: s.power_min != null ? parseInt(s.power_min, 10) : 80,
      power_max: s.power_max != null ? parseInt(s.power_max, 10) : 100,
      accuracy: s.accuracy != null ? parseInt(s.accuracy, 10) : 100,
      mana_cost: s.mana_cost != null ? parseInt(s.mana_cost, 10) : 0,
    }));

    const action_pattern = row.action_pattern
      ? (typeof row.action_pattern === 'string' ? JSON.parse(row.action_pattern) : row.action_pattern)
      : null;

    const boss = {
      id: row.id,
      name: row.name,
      level,
      image: row.image_url,
      image_url: row.image_url,
      final_stats: finalStats,
      current_hp: finalStats.hp,
      location_id: row.location_id,
      drop_table: row.drop_table ? (typeof row.drop_table === 'string' ? JSON.parse(row.drop_table) : row.drop_table) : null,
      respawn_minutes: row.respawn_minutes,
      skills,
      action_pattern: Array.isArray(action_pattern) ? action_pattern : null,
      isBoss: true,
      statsScaled: useFormula,
    };
    res.json(boss);
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết Boss:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ---------- Admin NPC/Boss: skills, boss_templates, boss_skills (CRUD + CSV) ----------
const checkAdminRoleNpc = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [decoded.userId]);
    if (!rows.length || rows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = { userId: decoded.userId };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ---------- Admin: hunting_maps (CRUD) ----------
function parseHuntingMapBody(body, opts = {}) {
  const id =
    opts.existingId != null
      ? String(opts.existingId).toLowerCase().trim()
      : String(body.id || '')
          .toLowerCase()
          .trim();
  if (!id || !/^[_a-z0-9]+$/.test(id)) {
    return { error: 'map id chỉ gồm chữ thường, số, gạch dưới' };
  }
  if (id === 'forest') return { error: 'Không được dùng id forest (built-in)' };
  const name = String(body.name || id);
  const entryFee = Math.max(0, parseInt(body.entryFee ?? body.entry_fee ?? 0, 10) || 0);
  const currency = body.currency === 'petagold' ? 'petagold' : 'peta';
  const maxRaw = body.maxSteps ?? body.max_steps;
  const maxSteps =
    maxRaw == null || maxRaw === '' ? null : Math.max(0, parseInt(maxRaw, 10) || 0);
  const thumb = body.thumb != null ? String(body.thumb) : '';
  const width = parseInt(body.width, 10);
  const height = parseInt(body.height, 10);
  const tileSize = Math.max(1, parseInt(body.tileSize ?? body.tile_size ?? 16, 10) || 16);
  const startX = Math.max(0, parseInt(body.start?.x ?? body.start_x ?? 0, 10) || 0);
  const startY = Math.max(0, parseInt(body.start?.y ?? body.start_y ?? 0, 10) || 0);
  const assets = body.assets || {};
  const background = String(assets.background ?? body.background_url ?? '').trim();
  if (!background) return { error: 'Thiếu assets.background' };
  const fgRaw = assets.foreground != null ? String(assets.foreground).trim() : body.foreground_url;
  const foreground = fgRaw && String(fgRaw).trim() ? String(fgRaw).trim() : null;
  const tiles = body.tiles;
  if (!Array.isArray(tiles)) return { error: 'tiles phải là mảng' };
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { error: 'width/height không hợp lệ' };
  }
  if (tiles.length !== width * height) {
    return { error: `tiles.length phải bằng width×height (${width * height})` };
  }
  const encounterPool = Array.isArray(body.encounterPool ?? body.encounter_pool)
    ? body.encounterPool ?? body.encounter_pool
    : [];
  const sortOrder = parseInt(body.sort_order ?? body.sortOrder ?? 0, 10) || 0;
  const hiddenRaw = body.is_hidden ?? body.isHidden;
  const is_hidden =
    hiddenRaw === true ||
    hiddenRaw === 1 ||
    hiddenRaw === '1' ||
    String(hiddenRaw || '').toLowerCase() === 'true'
      ? 1
      : 0;
  const require_min_level = Math.max(
    0,
    parseInt(body.requireMinLevel ?? body.require_min_level ?? 0, 10) || 0
  );
  let encounter_level_min = Math.max(
    1,
    parseInt(body.encounterLevelMin ?? body.encounter_level_min ?? 1, 10) || 1
  );
  let encounter_level_max = Math.max(
    1,
    parseInt(body.encounterLevelMax ?? body.encounter_level_max ?? 1, 10) || 1
  );
  if (encounter_level_max < encounter_level_min) {
    const t = encounter_level_min;
    encounter_level_min = encounter_level_max;
    encounter_level_max = t;
  }
  return {
    value: {
      id,
      name,
      entry_fee: entryFee,
      currency,
      max_steps: maxSteps,
      thumb: thumb || null,
      width,
      height,
      tile_size: tileSize,
      start_x: startX,
      start_y: startY,
      background_url: background,
      foreground_url: foreground,
      tiles_json: JSON.stringify(tiles),
      encounter_pool_json: JSON.stringify(encounterPool),
      sort_order: sortOrder,
      is_hidden,
      require_min_level,
      encounter_level_min,
      encounter_level_max,
    },
  };
}

app.get('/api/admin/hunting-maps', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hunting_maps ORDER BY sort_order ASC, id ASC');
    res.json(rows.map(huntingMapRowToFullClient));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.get('/api/admin/hunting-maps/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = String(req.params.id || '').toLowerCase();
    const [rows] = await db.query('SELECT * FROM hunting_maps WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json(huntingMapRowToFullClient(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.post('/api/admin/hunting-maps', checkAdminRoleNpc, async (req, res) => {
  try {
    const parsed = parseHuntingMapBody(req.body, {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const v = parsed.value;
    const [exists] = await db.query('SELECT id FROM hunting_maps WHERE id = ?', [v.id]);
    if (exists.length) return res.status(409).json({ message: 'Map id đã tồn tại' });
    await db.query(
      `INSERT INTO hunting_maps (
        id, name, entry_fee, currency, max_steps, thumb, width, height, tile_size,
        start_x, start_y, background_url, foreground_url, tiles_json, encounter_pool_json, sort_order, is_hidden,
        require_min_level, encounter_level_min, encounter_level_max
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        v.id,
        v.name,
        v.entry_fee,
        v.currency,
        v.max_steps,
        v.thumb,
        v.width,
        v.height,
        v.tile_size,
        v.start_x,
        v.start_y,
        v.background_url,
        v.foreground_url,
        v.tiles_json,
        v.encounter_pool_json,
        v.sort_order,
        v.is_hidden,
        v.require_min_level,
        v.encounter_level_min,
        v.encounter_level_max,
      ]
    );
    const [rows] = await db.query('SELECT * FROM hunting_maps WHERE id = ?', [v.id]);
    res.status(201).json(huntingMapRowToFullClient(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.put('/api/admin/hunting-maps/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const paramId = String(req.params.id || '').toLowerCase();
    if (paramId === 'forest') return res.status(400).json({ message: 'forest không lưu DB' });
    const [existing] = await db.query('SELECT id FROM hunting_maps WHERE id = ?', [paramId]);
    if (!existing.length) return res.status(404).json({ message: 'Không tìm thấy' });
    const parsed = parseHuntingMapBody(req.body, { existingId: paramId });
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const v = parsed.value;
    if (v.id !== paramId) return res.status(400).json({ message: 'Không đổi id map' });
    await db.query(
      `UPDATE hunting_maps SET
        name=?, entry_fee=?, currency=?, max_steps=?, thumb=?, width=?, height=?, tile_size=?,
        start_x=?, start_y=?, background_url=?, foreground_url=?, tiles_json=?, encounter_pool_json=?, sort_order=?,
        is_hidden=?, require_min_level=?, encounter_level_min=?, encounter_level_max=?
      WHERE id=?`,
      [
        v.name,
        v.entry_fee,
        v.currency,
        v.max_steps,
        v.thumb,
        v.width,
        v.height,
        v.tile_size,
        v.start_x,
        v.start_y,
        v.background_url,
        v.foreground_url,
        v.tiles_json,
        v.encounter_pool_json,
        v.sort_order,
        v.is_hidden,
        v.require_min_level,
        v.encounter_level_min,
        v.encounter_level_max,
        paramId,
      ]
    );
    const [rows] = await db.query('SELECT * FROM hunting_maps WHERE id = ?', [paramId]);
    res.json(huntingMapRowToFullClient(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.delete('/api/admin/hunting-maps/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = String(req.params.id || '').toLowerCase();
    if (id === 'forest') return res.status(400).json({ message: 'Không xóa forest' });
    const [r] = await db.query('DELETE FROM hunting_maps WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ---------- Admin: hunting catch rates config ----------
app.get('/api/admin/hunting-catch-config', checkAdminRoleNpc, async (req, res) => {
  try {
    const cfg = await huntingCatch.loadCatchConfig(db);
    res.json(cfg);
  } catch (err) {
    console.error('GET /api/admin/hunting-catch-config', err);
    res.status(500).json({ message: 'Lỗi tải cấu hình bắt pet' });
  }
});

app.put('/api/admin/hunting-catch-config', checkAdminRoleNpc, async (req, res) => {
  try {
    const cfg = await huntingCatch.saveCatchConfig(db, req.body || {});
    res.json(cfg);
  } catch (err) {
    console.error('PUT /api/admin/hunting-catch-config', err);
    res.status(500).json({ message: 'Lỗi lưu cấu hình bắt pet' });
  }
});

app.post('/api/admin/hunting-catch-config/reset', checkAdminRoleNpc, async (req, res) => {
  try {
    const cfg = await huntingCatch.saveCatchConfig(db, huntingCatch.DEFAULT_CONFIG);
    res.json(cfg);
  } catch (err) {
    console.error('POST /api/admin/hunting-catch-config/reset', err);
    res.status(500).json({ message: 'Lỗi reset cấu hình' });
  }
});

// Helper: parse CSV text (first line = headers)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = [];
    let cur = '', inQuoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuoted = !inQuoted; continue; }
      if (!inQuoted && c === ',') { values.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    values.push(cur.trim());
    return values;
  });
  return { headers, rows };
}

// Helper: escape CSV cell
function escapeCSV(val) {
  if (val == null) return '';
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function parseCsvIntOrNull(rawValue) {
  if (rawValue == null) return null;
  const text = String(rawValue).trim();
  if (!text) return null;
  const n = parseInt(text, 10);
  return Number.isNaN(n) ? null : n;
}

async function resolveItemIdFromCsvRow(csvRowObject) {
  const itemCode = parseCsvIntOrNull(csvRowObject.item_code);
  if (itemCode != null) {
    const [rows] = await db.query('SELECT id FROM items WHERE item_code = ? LIMIT 1', [itemCode]);
    if (rows && rows.length > 0) return rows[0].id;
  }
  const itemId = parseCsvIntOrNull(csvRowObject.item_id);
  return itemId;
}

// Skills - list
app.get('/api/admin/skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM skills ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - create (type, power_min, power_max, accuracy cho Boss skill)
app.post('/api/admin/skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const { name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy } = req.body;
    const skillType = (type === 'defend' ? 'defend' : 'attack');
    const pMin = power_min != null ? parseInt(power_min, 10) : 80;
    const pMax = power_max != null ? parseInt(power_max, 10) : 100;
    const acc = accuracy != null ? Math.min(100, Math.max(0, parseInt(accuracy, 10))) : 100;
    await db.query(
      'INSERT INTO skills (name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name || '', description || null, power_multiplier != null ? Number(power_multiplier) : 1, effect_type || null, mana_cost != null ? parseInt(mana_cost, 10) : 0, skillType, pMin, pMax, acc]
    );
    const [inserted] = await db.query('SELECT * FROM skills ORDER BY id DESC LIMIT 1');
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - update
app.put('/api/admin/skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy } = req.body;
    const skillType = (type === 'defend' ? 'defend' : 'attack');
    const pMin = power_min != null ? parseInt(power_min, 10) : 80;
    const pMax = power_max != null ? parseInt(power_max, 10) : 100;
    const acc = accuracy != null ? Math.min(100, Math.max(0, parseInt(accuracy, 10))) : 100;
    await db.query(
      'UPDATE skills SET name=?, description=?, power_multiplier=?, effect_type=?, mana_cost=?, type=?, power_min=?, power_max=?, accuracy=? WHERE id=?',
      [name ?? '', description ?? null, power_multiplier != null ? Number(power_multiplier) : 1, effect_type ?? null, mana_cost != null ? parseInt(mana_cost, 10) : 0, skillType, pMin, pMax, acc, id]
    );
    const [rows] = await db.query('SELECT * FROM skills WHERE id=?', [id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - delete
app.delete('/api/admin/skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM skills WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - download CSV
app.get('/api/admin/skills/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM skills ORDER BY id');
    const headers = ['id', 'name', 'description', 'type', 'power_min', 'power_max', 'accuracy', 'power_multiplier', 'effect_type', 'mana_cost', 'created_at'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=skills.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Skills - upload CSV: chỉ UPDATE khi id có trong DB; id trống hoặc id không tồn tại → INSERT
app.post('/api/admin/skills/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name'];
    const h = headers.map(x => x.toLowerCase().trim());
    if (!required.every(k => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột bắt buộc: ' + required.join(', ') });
    let updated = 0, inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM skills WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      const skillType = (o.type === 'defend' ? 'defend' : 'attack');
      const pMin = o.power_min != null && o.power_min !== '' ? parseInt(o.power_min, 10) : 80;
      const pMax = o.power_max != null && o.power_max !== '' ? parseInt(o.power_max, 10) : 100;
      const acc = o.accuracy != null && o.accuracy !== '' ? Math.min(100, Math.max(0, parseInt(o.accuracy, 10))) : 100;
      if (doUpdate) {
        await db.query('UPDATE skills SET name=?, description=?, power_multiplier=?, effect_type=?, mana_cost=?, type=?, power_min=?, power_max=?, accuracy=? WHERE id=?', [
          o.name ?? '', o.description ?? null, o.power_multiplier != null ? Number(o.power_multiplier) : 1, o.effect_type ?? null, o.mana_cost != null ? parseInt(o.mana_cost, 10) : 0, skillType, pMin, pMax, acc, id
        ]);
        updated++;
      } else {
        await db.query('INSERT INTO skills (name, description, power_multiplier, effect_type, mana_cost, type, power_min, power_max, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
          o.name ?? '', o.description ?? null, o.power_multiplier != null ? Number(o.power_multiplier) : 1, o.effect_type ?? null, o.mana_cost != null ? parseInt(o.mana_cost, 10) : 0, skillType, pMin, pMax, acc
        ]);
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - list
app.get('/api/admin/boss-templates', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_templates ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Helper: parse int hoặc trả về null nếu rỗng/NaN
const parseIntOrNull = (v, defaultValue) => {
  if (v === '' || v === undefined || v === null) return defaultValue ?? null;
  const n = parseInt(v, 10);
  return isNaN(n) ? (defaultValue ?? null) : n;
};

// Boss templates - create
app.post('/api/admin/boss-templates', checkAdminRoleNpc, async (req, res) => {
  try {
    const { name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern } = req.body;
    const dt = drop_table != null ? (typeof drop_table === 'string' ? drop_table : JSON.stringify(drop_table)) : null;
    const ap = action_pattern != null ? (typeof action_pattern === 'string' ? action_pattern : JSON.stringify(action_pattern)) : null;
    const locId = parseIntOrNull(location_id);
    const respawnVal = parseIntOrNull(respawn_minutes);
    await db.query(
      `INSERT INTO boss_templates (name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name ?? '', image_url ?? '', parseIntOrNull(level, 1), parseIntOrNull(base_hp, 10), parseIntOrNull(base_mp, 10), parseIntOrNull(base_str, 10), parseIntOrNull(base_def, 10), parseIntOrNull(base_intelligence, 10), parseIntOrNull(base_spd, 10), parseIntOrNull(accuracy, 100), locId, dt, respawnVal, ap]
    );
    const [inserted] = await db.query('SELECT * FROM boss_templates ORDER BY id DESC LIMIT 1');
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - update
app.put('/api/admin/boss-templates/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern } = req.body;
    const dt = drop_table != null ? (typeof drop_table === 'string' ? drop_table : JSON.stringify(drop_table)) : undefined;
    const ap = action_pattern !== undefined ? (action_pattern == null ? null : (typeof action_pattern === 'string' ? action_pattern : JSON.stringify(action_pattern))) : undefined;
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name=?'); values.push(name); }
    if (image_url !== undefined) { updates.push('image_url=?'); values.push(image_url); }
    if (level !== undefined) { const v = parseIntOrNull(level, 1); if (v != null) { updates.push('level=?'); values.push(v); } }
    if (base_hp !== undefined) { const v = parseIntOrNull(base_hp, 10); if (v != null) { updates.push('base_hp=?'); values.push(v); } }
    if (base_mp !== undefined) { const v = parseIntOrNull(base_mp, 10); if (v != null) { updates.push('base_mp=?'); values.push(v); } }
    if (base_str !== undefined) { const v = parseIntOrNull(base_str, 10); if (v != null) { updates.push('base_str=?'); values.push(v); } }
    if (base_def !== undefined) { const v = parseIntOrNull(base_def, 10); if (v != null) { updates.push('base_def=?'); values.push(v); } }
    if (base_intelligence !== undefined) { const v = parseIntOrNull(base_intelligence, 10); if (v != null) { updates.push('base_intelligence=?'); values.push(v); } }
    if (base_spd !== undefined) { const v = parseIntOrNull(base_spd, 10); if (v != null) { updates.push('base_spd=?'); values.push(v); } }
    if (accuracy !== undefined) { const v = parseIntOrNull(accuracy, 100); if (v != null) { updates.push('accuracy=?'); values.push(v); } }
    if (location_id !== undefined) { updates.push('location_id=?'); values.push(parseIntOrNull(location_id)); }
    if (dt !== undefined) { updates.push('drop_table=?'); values.push(dt); }
    if (respawn_minutes !== undefined) { updates.push('respawn_minutes=?'); values.push(parseIntOrNull(respawn_minutes)); }
    if (ap !== undefined) { updates.push('action_pattern=?'); values.push(ap); }
    if (updates.length === 0) return res.json({});
    values.push(id);
    await db.query('UPDATE boss_templates SET ' + updates.join(', ') + ' WHERE id=?', values);
    const [rows] = await db.query('SELECT * FROM boss_templates WHERE id=?', [id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - delete
app.delete('/api/admin/boss-templates/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM boss_templates WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - download CSV
app.get('/api/admin/boss-templates/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_templates ORDER BY id');
    const headers = ['id', 'name', 'image_url', 'level', 'base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd', 'accuracy', 'location_id', 'drop_table', 'respawn_minutes', 'created_at'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escapeCSV(r[h] != null && typeof r[h] === 'object' ? JSON.stringify(r[h]) : r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=boss_templates.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss templates - upload CSV: chỉ UPDATE khi id có trong DB; id trống hoặc id không tồn tại → INSERT
app.post('/api/admin/boss-templates/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name', 'image_url'];
    const h = headers.map(x => x.toLowerCase().trim());
    if (!required.every(k => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0, inserted = 0;
    const num = (v) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : null);
    const numDef = (v, d) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : d);
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
      const dt = (o.drop_table && o.drop_table.trim()) ? o.drop_table.trim() : null;
      const ap = (o.action_pattern != null && String(o.action_pattern).trim() !== '') ? String(o.action_pattern).trim() : null;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM boss_templates WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (doUpdate) {
        await db.query(
          'UPDATE boss_templates SET name=?, image_url=?, level=?, base_hp=?, base_mp=?, base_str=?, base_def=?, base_intelligence=?, base_spd=?, accuracy=?, location_id=?, drop_table=?, respawn_minutes=?, action_pattern=? WHERE id=?',
          [o.name ?? '', o.image_url ?? '', numDef(o.level, 1), numDef(o.base_hp, 10), numDef(o.base_mp, 10), numDef(o.base_str, 10), numDef(o.base_def, 10), numDef(o.base_intelligence, 10), numDef(o.base_spd, 10), numDef(o.accuracy, 100), num(o.location_id), dt, num(o.respawn_minutes), ap, id]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO boss_templates (name, image_url, level, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd, accuracy, location_id, drop_table, respawn_minutes, action_pattern) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.name ?? '', o.image_url ?? '', numDef(o.level, 1), numDef(o.base_hp, 10), numDef(o.base_mp, 10), numDef(o.base_str, 10), numDef(o.base_def, 10), numDef(o.base_intelligence, 10), numDef(o.base_spd, 10), numDef(o.accuracy, 100), num(o.location_id), dt, num(o.respawn_minutes), ap]
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - list
app.get('/api/admin/boss-skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_skills ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - create
app.post('/api/admin/boss-skills', checkAdminRoleNpc, async (req, res) => {
  try {
    const { boss_template_id, skill_id, sort_order } = req.body;
    await db.query(
      'INSERT INTO boss_skills (boss_template_id, skill_id, sort_order) VALUES (?, ?, ?)',
      [parseInt(boss_template_id, 10), parseInt(skill_id, 10), sort_order != null ? parseInt(sort_order, 10) : 0]
    );
    const [inserted] = await db.query('SELECT * FROM boss_skills ORDER BY id DESC LIMIT 1');
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - update
app.put('/api/admin/boss-skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { boss_template_id, skill_id, sort_order } = req.body;
    await db.query(
      'UPDATE boss_skills SET boss_template_id=?, skill_id=?, sort_order=? WHERE id=?',
      [parseInt(boss_template_id, 10), parseInt(skill_id, 10), sort_order != null ? parseInt(sort_order, 10) : 0, id]
    );
    const [rows] = await db.query('SELECT * FROM boss_skills WHERE id=?', [id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - delete
app.delete('/api/admin/boss-skills/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM boss_skills WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - download CSV
app.get('/api/admin/boss-skills/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM boss_skills ORDER BY id');
    const headers = ['id', 'boss_template_id', 'skill_id', 'sort_order'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=boss_skills.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Boss skills - upload CSV: chỉ UPDATE khi id có trong DB; id trống hoặc id không tồn tại → INSERT
app.post('/api/admin/boss-skills/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['boss_template_id', 'skill_id'];
    const h = headers.map(x => x.toLowerCase().trim());
    if (!required.every(k => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0, inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = (idRaw != null && !isNaN(idRaw)) ? idRaw : null;
      const btId = parseInt(o.boss_template_id, 10);
      const skId = parseInt(o.skill_id, 10);
      const so = o.sort_order != null && o.sort_order !== '' ? parseInt(o.sort_order, 10) : 0;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM boss_skills WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (doUpdate) {
        await db.query('UPDATE boss_skills SET boss_template_id=?, skill_id=?, sort_order=? WHERE id=?', [btId, skId, so, id]);
        updated++;
      } else {
        await db.query('INSERT INTO boss_skills (boss_template_id, skill_id, sort_order) VALUES (?, ?, ?)', [btId, skId, so]);
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ---------- Admin Item Management (items, equipment_data, item_effects) CSV ----------
app.get('/api/admin/items/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT item_code, name, description, type, category, subtype, rarity, image_url, buy_price, sell_price, price_currency,
              magic_value, stackable, max_stack, consume_policy, pet_scope
       FROM items ORDER BY item_code ASC, id ASC`
    );
    const headers = [
      'item_code', 'name', 'description', 'type', 'category', 'subtype', 'rarity', 'image_url',
      'buy_price', 'sell_price', 'price_currency', 'magic_value', 'stackable', 'max_stack', 'consume_policy', 'pet_scope',
    ];
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=items.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.post('/api/admin/items/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name', 'type', 'rarity', 'image_url'];
    const h = headers.map((x) => x.toLowerCase().trim());
    if (!required.every((k) => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0;
    let inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const id = parseIntOrNull(o.id);
      const itemCodeRaw = o.item_code != null && String(o.item_code).trim() !== '' ? parseInt(o.item_code, 10) : null;
      const itemCode = itemCodeRaw != null && !isNaN(itemCodeRaw) ? itemCodeRaw : null;
      const buyPrice = o.buy_price != null && o.buy_price !== '' ? Number(o.buy_price) : 0;
      const sellPrice = o.sell_price != null && o.sell_price !== '' ? Number(o.sell_price) : 0;
      const priceCurrency = String(o.price_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
      const rarityNorm = normalizeItemRarity(o.rarity);
      const magicVal = o.magic_value != null && String(o.magic_value).trim() !== '' ? Number(o.magic_value) : null;
      const stackRaw = String(o.stackable ?? '1').trim().toLowerCase();
      const stackVal = ['0', 'false', 'no', 'off'].includes(stackRaw) ? 0 : 1;
      const maxStackVal = o.max_stack != null && String(o.max_stack).trim() !== '' ? parseInt(o.max_stack, 10) : 999;
      const consumePol = String(o.consume_policy || 'single_use').slice(0, 30) || 'single_use';
      const petSc = String(o.pet_scope || 'all').slice(0, 30) || 'all';
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM items WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (!doUpdate && itemCode != null) {
        const [exByCode] = await db.query('SELECT id FROM items WHERE item_code = ? LIMIT 1', [itemCode]);
        if (exByCode && exByCode.length > 0) {
          doUpdate = true;
          o.__resolved_id = exByCode[0].id;
        }
      }
      if (doUpdate) {
        const targetId = id != null ? id : o.__resolved_id;
        await db.query(
          `UPDATE items SET item_code=?, name=?, description=?, type=?, category=?, subtype=?, rarity=?, image_url=?, buy_price=?, sell_price=?, price_currency=?,
           magic_value=?, stackable=?, max_stack=?, consume_policy=?, pet_scope=? WHERE id=?`,
          [
            itemCode,
            o.name ?? '',
            o.description ?? '',
            o.type ?? 'misc',
            o.category ?? 'misc',
            o.subtype ?? null,
            rarityNorm,
            o.image_url ?? '',
            buyPrice,
            sellPrice,
            priceCurrency,
            Number.isFinite(magicVal) ? magicVal : null,
            stackVal,
            Number.isFinite(maxStackVal) && maxStackVal > 0 ? maxStackVal : 999,
            consumePol,
            petSc,
            targetId,
          ]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO items (item_code, name, description, type, category, subtype, rarity, image_url, buy_price, sell_price, price_currency, magic_value, stackable, max_stack, consume_policy, pet_scope)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemCode,
            o.name ?? '',
            o.description ?? '',
            o.type ?? 'misc',
            o.category ?? 'misc',
            o.subtype ?? null,
            rarityNorm,
            o.image_url ?? '',
            buyPrice,
            sellPrice,
            priceCurrency,
            Number.isFinite(magicVal) ? magicVal : null,
            stackVal,
            Number.isFinite(maxStackVal) && maxStackVal > 0 ? maxStackVal : 999,
            consumePol,
            petSc,
          ]
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.get('/api/admin/equipment-stats/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ed.id, it.item_code, ed.equipment_type, ed.slot_type, ed.power_min, ed.power_max, ed.durability_max, ed.durability_mode, ed.random_break_chance, ed.magic_value, ed.crit_rate, ed.block_rate, ed.element, ed.effect_id
       FROM equipment_data ed
       LEFT JOIN items it ON ed.item_id = it.id
       ORDER BY COALESCE(it.item_code, 999999999), ed.id`
    );
    const headers = ['id', 'item_code', 'equipment_type', 'slot_type', 'power_min', 'power_max', 'durability_max', 'durability_mode', 'random_break_chance', 'magic_value', 'crit_rate', 'block_rate', 'element', 'effect_id'];
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=equipment_data.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.post('/api/admin/equipment-stats/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const h = headers.map((x) => x.toLowerCase().trim());
    const hasItemCode = h.includes('item_code');
    const hasItemId = h.includes('item_id');
    if (!hasItemCode && !hasItemId) return res.status(400).json({ message: 'CSV thiếu cột: item_code hoặc item_id' });
    let updated = 0;
    let inserted = 0;
    const toNum = (v) => (v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null);
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = idRaw != null && !isNaN(idRaw) ? idRaw : null;
      const itemId = await resolveItemIdFromCsvRow(o);
      if (itemId == null || Number.isNaN(Number(itemId))) continue;
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM equipment_data WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      const values = [
        itemId,
        normalizeEquipmentType(o.equipment_type || 'weapon'),
        normalizeSlotType(o.slot_type, normalizeEquipmentType(o.equipment_type || 'weapon')),
        toNum(o.power_min),
        toNum(o.power_max),
        normalizeDurabilityMode(o.durability_mode),
        toNum(o.durability_max),
        toNum(o.random_break_chance),
        toNum(o.magic_value),
        toNum(o.crit_rate),
        toNum(o.block_rate),
        o.element || null,
        toNum(o.effect_id),
      ];
      if (values[5] === 'unknown') {
        values[6] = null;
        values[7] = values[7] == null ? 3 : values[7];
      }
      if (doUpdate) {
        await db.query(
          'UPDATE equipment_data SET item_id=?, equipment_type=?, slot_type=?, power_min=?, power_max=?, durability_mode=?, durability_max=?, random_break_chance=?, magic_value=?, crit_rate=?, block_rate=?, element=?, effect_id=? WHERE id=?',
          [...values, id]
        );
        updated++;
      } else {
        await db.query(
          'INSERT INTO equipment_data (item_id, equipment_type, slot_type, power_min, power_max, durability_mode, durability_max, random_break_chance, magic_value, crit_rate, block_rate, element, effect_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          values
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.delete('/api/admin/equipment-stats/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM equipment_data WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.get('/api/admin/item-effects/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [rowsRaw] = await db.query(
      `SELECT ie.id, it.item_code, ie.effect_target, ie.effect_type, ie.value_min, ie.value_max, ie.is_permanent, ie.duration_turns, ie.magic_value
       FROM item_effects ie
       LEFT JOIN items it ON ie.item_id = it.id
       ORDER BY COALESCE(it.item_code, 999999999), ie.id`
    );
    const rows = (rowsRaw || []).map((row) => normalizeEffectRow(row));
    const headers = ['id', 'item_code', 'effect_target', 'effect_type', 'value_min', 'value_max', 'is_permanent', 'duration_turns', 'magic_value'];
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=item_effects.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.post('/api/admin/item-effects/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['effect_target', 'effect_type'];
    const h = headers.map((x) => x.toLowerCase().trim());
    if (!required.every((k) => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    const hasItemCode = h.includes('item_code');
    const hasItemId = h.includes('item_id');
    if (!hasItemCode && !hasItemId) return res.status(400).json({ message: 'CSV thiếu cột: item_code hoặc item_id' });
    let updated = 0;
    let inserted = 0;
    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = idRaw != null && !isNaN(idRaw) ? idRaw : null;
      const itemId = await resolveItemIdFromCsvRow(o);
      if (itemId == null || Number.isNaN(Number(itemId))) continue;
      const valueMin = o.value_min != null && o.value_min !== '' ? Number(o.value_min) : 0;
      const valueMax = o.value_max != null && o.value_max !== '' ? Number(o.value_max) : 0;
      const isPermanent = o.is_permanent === '1' || String(o.is_permanent).toLowerCase() === 'true';
      const durationTurns = o.duration_turns != null && o.duration_turns !== '' ? parseInt(o.duration_turns, 10) : 0;
      const magicValue = o.magic_value != null && o.magic_value !== '' ? Number(o.magic_value) : null;
      const normalizedTarget = normalizeEffectTarget(o.effect_target ?? 'hp');
      const normalizedType = normalizeEffectType(o.effect_type ?? 'flat');
      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM item_effects WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }
      if (doUpdate) {
        await db.query(
          'UPDATE item_effects SET item_id=?, effect_target=?, effect_type=?, value_min=?, value_max=?, is_permanent=?, duration_turns=?, magic_value=? WHERE id=?',
          [itemId, normalizedTarget, normalizedType, valueMin, valueMax, isPermanent, durationTurns, magicValue, id]
        );
        updated++;
      } else {
        await db.query(
          'INSERT INTO item_effects (item_id, effect_target, effect_type, value_min, value_max, is_permanent, duration_turns, magic_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [itemId, normalizedTarget, normalizedType, valueMin, valueMax, isPermanent, durationTurns, magicValue]
        );
        inserted++;
      }
    }
    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

app.delete('/api/admin/item-effects/:id', checkAdminRoleNpc, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM item_effects WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});


// API ARENA: Mô phỏng 1 lượt tấn công
// Công thức Dmg_out chung; defender_current_def_dmg (nếu > 0) áp dụng counter_dmg / phản đòn.
// Khi isEnemyAttack và attacker có action_pattern + skills: Boss dùng skill (turnNumber bắt buộc).
// body: attacker, defender, movePower, moveName, isEnemyAttack, power_min, power_max, turnNumber, defender_current_def_dmg
app.post('/api/arena/simulate-turn', (req, res) => {
  const { attacker, defender, movePower, moveName, isEnemyAttack, power_min, power_max, turnNumber, defender_current_def_dmg } = req.body;

  try {
    if (isEnemyAttack && Array.isArray(attacker.skills) && attacker.skills.length > 0) {
      const turn = Math.max(1, parseInt(turnNumber, 10) || 1);
      const skill = getBossAction(attacker, turn, attacker.skills);
      if (skill) {
        const defDmg = defender_current_def_dmg != null ? Number(defender_current_def_dmg) : (defender.current_def_dmg != null ? Number(defender.current_def_dmg) : 0);
        if (defender && typeof defender === 'object') defender.current_def_dmg = defDmg;
        const result = simulateBossTurn(attacker, defender, skill);
        return res.json(result);
      }
    }

    const options = {
      power_min: power_min != null ? Number(power_min) : undefined,
      power_max: power_max != null ? Number(power_max) : undefined,
      defender_current_def_dmg: defender_current_def_dmg != null ? Number(defender_current_def_dmg) : 0,
    };
    const result = simulateTurn(attacker, defender, movePower, moveName, options);
    res.json(result);
  } catch (err) {
    console.error('Error during turn simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng lượt đánh' });
  }
});

// POST /api/arena/simulate-defend – Pet (hoặc đơn vị phòng thủ) dùng khiên: chỉ thiết lập def_dmg, không gây sát thương
// body: defenderUnit (người dùng khiên), enemy (đối thủ), shield_power_min, shield_power_max
app.post('/api/arena/simulate-defend', (req, res) => {
  const { defenderUnit, enemy, shield_power_min, shield_power_max } = req.body;
  try {
    const result = simulateDefendTurn(
      defenderUnit ?? req.body.pet,
      enemy ?? req.body.boss,
      shield_power_min != null ? Number(shield_power_min) : 0,
      shield_power_max != null ? Number(shield_power_max) : 0
    );
    res.json(result);
  } catch (err) {
    console.error('Error during defend simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng lượt phòng thủ' });
  }
});

/**
 * Tính loot từ drop_table JSON của Boss.
 * Mỗi item roll độc lập (0..100), nếu roll <= rate thì nhận, số lượng random [min_qty, max_qty].
 * @param {Array|string} dropTable - Mảng JSON hoặc chuỗi JSON từ boss_templates.drop_table
 * @returns {Array<{item_id: number, quantity: number, name: string}>}
 */
function calculateLoot(dropTable) {
  const drops = Array.isArray(dropTable)
    ? dropTable
    : (typeof dropTable === 'string' ? JSON.parse(dropTable) : []);
  const lootResult = [];
  for (const item of drops) {
    const rate = Number(item.rate);
    if (rate <= 0) continue;
    const roll = Math.random() * 100;
    if (roll <= rate) {
      const minQty = Math.max(0, parseInt(item.min_qty, 10) || 0);
      const maxQty = Math.max(minQty, parseInt(item.max_qty, 10) || minQty);
      const quantity = minQty === maxQty ? minQty : Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;
      if (quantity > 0) {
        lootResult.push({
          item_id: item.item_id != null ? parseInt(item.item_id, 10) : 0,
          quantity,
          name: item.name || (item.item_id === 0 ? 'Peta' : 'Item'),
        });
      }
    }
  }
  return lootResult;
}

/**
 * POST /api/arena/claim-loot
 * Khi thắng Boss, gọi API này để tính loot từ drop_table của Boss và cộng vào user (peta + inventory).
 * body: { bossId: number, petId: number }
 * Header: Authorization: Bearer <token>
 */
app.post('/api/arena/claim-loot', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const tokenUserId = decoded.userId;

    const { bossId, petId } = req.body;
    if (!bossId || !petId) return res.status(400).json({ message: 'Thiếu bossId hoặc petId' });

    const [petRows] = await db.query('SELECT id, owner_id FROM pets WHERE id = ?', [petId]);
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found' });
    if (petRows[0].owner_id !== tokenUserId) return res.status(403).json({ message: 'Chỉ chủ pet mới được nhận loot' });

    const [bossRows] = await db.query('SELECT drop_table FROM boss_templates WHERE id = ?', [bossId]);
    if (!bossRows.length) return res.status(404).json({ message: 'Boss not found' });
    const dropTableRaw = bossRows[0].drop_table;
    const dropTable = dropTableRaw
      ? (typeof dropTableRaw === 'string' ? JSON.parse(dropTableRaw) : dropTableRaw)
      : [];
    if (!Array.isArray(dropTable) || dropTable.length === 0) {
      return res.json({ success: true, loot: [], message: 'Boss không có bảng rơi đồ' });
    }

    const loot = calculateLoot(dropTable);
    const responseLoot = [];
    const userId = tokenUserId;

    for (const entry of loot) {
      if (entry.item_id === 0) {
        await db.query('UPDATE users SET peta = peta + ? WHERE id = ?', [entry.quantity, userId]);
        try {
          await titleService.recordPetaEarned(db, userId, entry.quantity);
        } catch (e) {
          console.error('title earn (loot):', e);
        }
        responseLoot.push({
          ...entry,
          image_url: null,
        });
        continue;
      }
      const itemId = entry.item_id;
      const quantity = entry.quantity;
      const [itemRows] = await db.query('SELECT id, type, image_url, name FROM items WHERE id = ?', [itemId]);
      if (!itemRows.length) continue;
      const itemRow = itemRows[0];
      if (itemRow.type === 'equipment') {
        const [equipInfo] = await db.query('SELECT durability_max FROM equipment_data WHERE item_id = ?', [itemId]);
        const durability = (equipInfo.length > 0) ? (equipInfo[0].durability_max ?? 1) : 1;
        for (let i = 0; i < quantity; i++) {
          await db.query(
            `INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left) VALUES (?, ?, 1, 0, ?)`,
            [userId, itemId, durability]
          );
        }
      } else {
        const [invRows] = await db.query(
          'SELECT id, quantity FROM inventory WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL)',
          [userId, itemId]
        );
        if (invRows.length > 0) {
          await db.query('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [quantity, invRows[0].id]);
        } else {
          await db.query('INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)', [userId, itemId, quantity]);
        }
      }
      responseLoot.push({
        ...entry,
        name: itemRow.name || entry.name || 'Item',
        image_url: itemRow.image_url || null,
      });
    }

    res.json({ success: true, loot: responseLoot });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token' });
    console.error('Error claiming arena loot:', err);
    res.status(500).json({ message: 'Lỗi khi nhận thưởng Boss' });
  }
});

// ---------- Arena Match State (Redis) ----------
function getUserIdFromToken(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded.userId;
  } catch (_) {
    return null;
  }
}

async function finalizeMatchInMySQL(matchState, winner) {
  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const petId = matchState.pet_id;
    const playerHp = Math.max(0, matchState.player?.current_hp ?? 0);
    if (winner === 'enemy') {
      await conn.query(
        'UPDATE pets SET current_hp = 0, battles_lost = COALESCE(battles_lost, 0) + 1 WHERE id = ?',
        [petId]
      );
    } else {
      await conn.query(
        'UPDATE pets SET current_hp = ?, battles_won = COALESCE(battles_won, 0) + 1 WHERE id = ?',
        [playerHp, petId]
      );
      const uid = matchState.userId;
      if (uid) {
        try {
          await titleService.recordHuntWin(db, uid, 1);
        } catch (e) {
          console.error('titleService.recordHuntWin:', e);
        }
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

const formationSystem = require('../src/data/formationSystem');

// GET /api/formations/me — levels đội hình của user
app.get('/api/formations/me', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const [rows] = await db.query(
      'SELECT levels_json FROM user_formations WHERE user_id = ? LIMIT 1',
      [userId]
    );
    let raw = rows[0]?.levels_json;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    const levels = formationSystem.normalizeLevelsMap(raw);
    return res.json({ levels, maxLevel: formationSystem.FORMATION_MAX_LEVEL });
  } catch (err) {
    console.error('GET /api/formations/me', err);
    return res.status(500).json({ message: 'Không tải được đội hình.' });
  }
});

// POST /api/formations/enhance — nâng cấp formation bằng Peta
app.post('/api/formations/enhance', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const formationId = formationSystem.normalizeFormationId(req.body?.formationId);
  const targetLevel = formationSystem.clampLevel(req.body?.targetLevel);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [levelRows] = await conn.query(
      'SELECT levels_json FROM user_formations WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    let raw = levelRows[0]?.levels_json;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    const levels = formationSystem.normalizeLevelsMap(raw);
    const current = levels[formationId] || formationSystem.FORMATION_MIN_LEVEL;
    if (targetLevel <= current) {
      await conn.rollback();
      return res.status(400).json({ message: 'Cấp đích phải cao hơn cấp hiện tại.', levels });
    }
    if (current >= formationSystem.FORMATION_MAX_LEVEL) {
      await conn.rollback();
      return res.status(400).json({ message: 'Đội hình đã đạt cấp tối đa.', levels });
    }

    const cost = formationSystem.costEnhanceRange(current, targetLevel);
    const [userRows] = await conn.query('SELECT peta FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found' });
    }
    const petaBal = Number(userRows[0].peta) || 0;
    if (petaBal < cost) {
      await conn.rollback();
      return res.status(402).json({
        message: 'Không đủ Peta',
        cost,
        petaRemaining: petaBal,
        levels,
      });
    }

    levels[formationId] = targetLevel;
    await conn.query('UPDATE users SET peta = peta - ? WHERE id = ?', [cost, userId]);
    await conn.query(
      `INSERT INTO user_formations (user_id, levels_json)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE levels_json = VALUES(levels_json)`,
      [userId, JSON.stringify(levels)]
    );
    await conn.commit();
    const [[after]] = await db.query('SELECT peta FROM users WHERE id = ? LIMIT 1', [userId]);
    return res.json({
      levels,
      formationId,
      level: targetLevel,
      cost,
      petaRemaining: Number(after?.peta) || 0,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    console.error('POST /api/formations/enhance', err);
    return res.status(500).json({ message: 'Không nâng cấp được đội hình.' });
  } finally {
    conn.release();
  }
});

// POST /api/arena/match/start — Check HP, check active match, init Redis
app.post('/api/arena/match/start', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  const { petId, bossId, bossLevel, battleSource, returnPath, huntingMapId } = req.body;
  if (!petId || !bossId) return res.status(400).json({ message: 'Thiếu petId hoặc bossId' });

  try {
    const [petRows] = await db.query(
      'SELECT p.*, ps.name AS species_name, ps.image AS species_image FROM pets p JOIN pet_species ps ON p.pet_species_id = ps.id WHERE p.id = ? AND p.owner_id = ?',
      [petId, userId]
    );
    if (!petRows.length) return res.status(404).json({ message: 'Pet not found' });
    const petRow = petRows[0];
    const petFresh = await petVitals.refreshPetVitalsById(db, petRow.id);
    if (!petFresh) return res.status(404).json({ message: 'Pet not found' });
    /** Vitals chỉ trả một subset cột — merge vào SELECT p.* để giữ final_stats, level, stats, species_image… */
    const pet = { ...petRow, ...petFresh };
    const hungerLevel = petVitals.clampHunger(pet.hunger_status);
    if (!petVitals.canEnterArenaByHunger(hungerLevel)) {
      const msg =
        hungerLevel <= 0
          ? 'Thú cưng ở mức Tử Vong (hunger 0), không thể vào đấu trường.'
          : 'Thú cưng quá đói (Sắp chết đói / Kiệt sức — hunger 1–2), không thể vào đấu trường.';
      return res.status(400).json({ message: msg });
    }
    const currentHp = pet.current_hp != null ? parseInt(pet.current_hp, 10) : (pet.hp != null ? parseInt(pet.hp, 10) : 0);
    if (currentHp <= 0) {
      return res.status(400).json({ message: 'Thú cưng quá mệt mỏi, hãy cho ăn/nghỉ ngơi để hồi phục.' });
    }

    const key = REDIS_MATCH_PREFIX + userId;
    const existing = await redis.get(key);
    if (existing) {
      const matchData = JSON.parse(existing);
      return res.status(400).json({
        code: 'ACTIVE_MATCH',
        message: 'Bạn đang có trận đấu dang dở. Hãy quay lại tiếp tục.',
        match: matchData,
      });
    }

    const [bossRows] = await db.query('SELECT * FROM boss_templates WHERE id = ?', [bossId]);
    if (!bossRows.length) return res.status(404).json({ message: 'Boss not found' });
    const row = bossRows[0];
    const templateLevel = parseInt(row.level, 10) || 1;
    const overrideLevel = parseInt(bossLevel, 10);
    // Hunting truyền bossLevel → công thức; Arena không truyền → base_* thô
    const useFormula = Number.isFinite(overrideLevel) && overrideLevel > 0;
    const combatLevel = useFormula ? overrideLevel : templateLevel;
    const bossFinalStats = useFormula
      ? calculateBossFinalStats(row, combatLevel)
      : rawBossFinalStats(row);
    const [skillRows] = await db.query(
      `SELECT s.id, s.name, s.type, s.power_min, s.power_max, s.accuracy, s.mana_cost FROM boss_skills bs JOIN skills s ON bs.skill_id = s.id WHERE bs.boss_template_id = ? ORDER BY bs.sort_order ASC`,
      [bossId]
    );
    const skills = (skillRows || []).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type || 'attack',
      power_min: s.power_min != null ? parseInt(s.power_min, 10) : 80,
      power_max: s.power_max != null ? parseInt(s.power_max, 10) : 100,
      accuracy: s.accuracy != null ? parseInt(s.accuracy, 10) : 100,
      mana_cost: s.mana_cost != null ? parseInt(s.mana_cost, 10) : 0,
    }));
    const action_pattern = row.action_pattern ? (typeof row.action_pattern === 'string' ? JSON.parse(row.action_pattern) : row.action_pattern) : null;
    const enemy = {
      id: row.id,
      name: row.name,
      level: combatLevel,
      image: row.image_url,
      final_stats: bossFinalStats,
      current_hp: bossFinalStats.hp,
      current_mp: bossFinalStats.mp,
      current_def_dmg: 0,
      skills,
      action_pattern: Array.isArray(action_pattern) ? action_pattern : null,
      isBoss: true,
      statsScaled: useFormula,
      location_id: row.location_id,
    };

    let finalStats = pet.final_stats;
    if (typeof finalStats === 'string') finalStats = JSON.parse(finalStats || '{}');
    if (!finalStats || typeof finalStats !== 'object') finalStats = { hp: pet.hp, mp: pet.mp, str: pet.str, def: pet.def, intelligence: pet.intelligence, spd: pet.spd };
    const player = {
      id: pet.id,
      name: pet.name,
      level: parseInt(pet.level, 10) || 1,
      image: pet.species_image || pet.image,
      final_stats: finalStats,
      current_hp: currentHp,
      current_mp: pet.mp != null ? parseInt(pet.mp, 10) : finalStats.mp,
      current_def_dmg: 0,
      current_exp: pet.current_exp,
    };

    const [equipRows] = await db.query(
      `SELECT i.id, i.item_id, it.name AS item_name, it.image_url, i.durability_left, ed.power_min, ed.power_max, ed.equipment_type, ed.magic_value, ed.durability_max, ed.durability_mode
       FROM inventory i JOIN items it ON i.item_id = it.id LEFT JOIN equipment_data ed ON it.id = ed.item_id
       WHERE i.equipped_pet_id = ? AND i.is_equipped = 1`,
      [petId]
    );
    const equipment = (equipRows || []).map((e) => ({
      id: e.id,
      item_id: e.item_id,
      item_name: e.item_name,
      image_url: e.image_url || '',
      durability_left: e.durability_left != null ? parseInt(e.durability_left, 10) : 1,
      max_durability: e.durability_max != null ? parseInt(e.durability_max, 10) : 1,
      power_min: e.power_min != null ? parseInt(e.power_min, 10) : 0,
      power_max: e.power_max != null ? parseInt(e.power_max, 10) : 0,
      equipment_type: e.equipment_type || 'weapon',
      magic_value: e.magic_value != null ? parseInt(e.magic_value, 10) : 0,
      durability_mode: e.durability_mode || 'fixed',
      is_permanent_durability: (e.durability_mode || '').toLowerCase() === 'unbreakable' || (e.durability_max != null && parseInt(e.durability_max, 10) >= 999999),
    }));

    const source =
      battleSource === 'hunting' || (useFormula && battleSource !== 'arena')
        ? 'hunting'
        : 'arena';
    const mapIdStr =
      huntingMapId != null && String(huntingMapId).trim() !== ''
        ? String(huntingMapId).trim()
        : null;
    let resolvedReturn =
      returnPath != null && String(returnPath).trim() !== ''
        ? String(returnPath).trim()
        : null;
    if (!resolvedReturn) {
      resolvedReturn =
        source === 'hunting' && mapIdStr
          ? `/hunting-world/map/${encodeURIComponent(mapIdStr)}`
          : '/battle/arena';
    }

    const matchState = {
      userId,
      pet_id: parseInt(petId, 10),
      boss_id: parseInt(bossId, 10),
      boss_level: combatLevel,
      stats_scaled: useFormula,
      battleSource: source,
      huntingMapId: mapIdStr,
      returnPath: resolvedReturn,
      player,
      enemy,
      equipment,
      turn_count: 0,
      history: [],
      finished: false,
      result: null,
    };
    await redis.set(key, JSON.stringify(matchState), { EX: REDIS_MATCH_TTL });
    res.json(matchState);
  } catch (err) {
    console.error('Error arena match start:', err);
    res.status(500).json({ message: 'Lỗi khởi tạo trận đấu' });
  }
});

// GET /api/arena/match/status — Reconnect: trả về trận đấu đang dang dở (200 + active:false nếu không có)
app.get('/api/arena/match/status', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  try {
    const key = REDIS_MATCH_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return res.json({ active: false });
    const match = JSON.parse(data);
    res.json({ active: true, ...match });
  } catch (err) {
    console.error('Error arena match status:', err);
    res.status(500).json({ message: 'Lỗi kiểm tra trận đấu' });
  }
});

// POST /api/arena/match/terminate — User rời đi: force loss, lưu HP pet, xóa Redis
app.post('/api/arena/match/terminate', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  let conn;
  try {
    const key = REDIS_MATCH_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return res.status(404).json({ message: 'No active match' });
    const matchState = JSON.parse(data);
    const playerHp = Math.max(0, matchState.player?.current_hp ?? 0);
    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      'UPDATE pets SET current_hp = ?, battles_lost = COALESCE(battles_lost, 0) + 1 WHERE id = ?',
      [playerHp, matchState.pet_id]
    );
    await normalizePetCurrentHp(conn, matchState.pet_id);

    await conn.commit();
    await redis.del(key);
    res.json({ forceLoss: true, message: 'Trận đấu đã kết thúc (rời đi).' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Error arena match terminate:', err);
    res.status(500).json({ message: 'Lỗi kết thúc trận đấu' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/arena/match/turn — Xử lý 1 lượt (player action + enemy action), chỉ dùng Redis rồi finalize khi hết trận
app.post('/api/arena/match/turn', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const redis = getRedis();
  if (!redis) return res.status(503).json({ message: 'Match service temporarily unavailable' });

  const key = REDIS_MATCH_PREFIX + userId;
  const { action, itemId, power_min, power_max, moveName } = req.body || {};

  try {
    const data = await redis.get(key);
    if (!data) return res.status(404).json({ message: 'Match not found' });
    const state = JSON.parse(data);
    const player = state.player;
    const enemy = state.enemy;
    const NORMAL_POWER_MIN = 7;
    const NORMAL_POWER_MAX = 10;

    // Thứ tự đánh theo speed: SPD cao hơn đánh trước
    const playerSpd = player.final_stats?.spd ?? player.spd ?? 0;
    const enemySpd = enemy.final_stats?.spd ?? enemy.spd ?? 0;
    const playerGoesFirst = playerSpd >= enemySpd;

    const runEnemyTurn = async () => {
      const turnNum = state.turn_count || 1;
      const skill = getBossAction(enemy, turnNum, enemy.skills);
      if (skill) {
        const defDmg = player.current_def_dmg ?? 0;
        if (typeof player === 'object') player.current_def_dmg = defDmg;
        const bossResult = simulateBossTurn(enemy, player, skill);
        const logMsg = bossResult.isBossDefend
          ? `${enemy.name} dùng ${skill.name} (Phòng thủ).`
          : (bossResult.miss ? `${enemy.name} dùng ${skill.name} nhưng trượt!` : `${enemy.name} dùng ${bossResult.moveUsed}, gây ${bossResult.damage || 0} sát thương.`);
        state.history.push({ text: logMsg, type: 'enemy_attack' });
        if (bossResult.defender_hp_after != null) player.current_hp = bossResult.defender_hp_after;
        if (bossResult.attacker_hp_after != null) enemy.current_hp = bossResult.attacker_hp_after;
        if (bossResult.bossDefDmg != null) enemy.current_def_dmg = bossResult.bossDefDmg;
        if (bossResult.defender_current_def_dmg === 0 && typeof player.current_def_dmg === 'number') player.current_def_dmg = 0;
      }
    };

    const runPlayerAction = async () => {
      let result;
      if (action === 'defend_shield' || action === 'defend_basic') {
        const powerMin = action === 'defend_shield' && power_min != null ? Number(power_min) : NORMAL_POWER_MIN;
        const powerMax = action === 'defend_shield' && power_max != null ? Number(power_max) : NORMAL_POWER_MAX;
        result = simulateDefendTurn(player, enemy, powerMin, powerMax);
        state.history.push({ text: result.logMessage || `${player.name} sử dụng Phòng thủ.`, type: 'defense' });
        player.current_def_dmg = result.defDmg ?? 0;
        if (action === 'defend_shield' && itemId) {
          const inv = state.equipment.find((e) => e.id === itemId);
          if (inv) {
            const durabilityResult = await consumeEquipmentDurability(itemId, 1);
            if (durabilityResult.item_destroyed) {
              state.equipment = (state.equipment || []).filter((e) => e.id !== itemId);
              state.history.push({
                text: durabilityResult.break_reason === 'random'
                  ? `${inv.item_name || 'Equipment'} đã gãy ngẫu nhiên và bị tiêu hủy.`
                  : `${inv.item_name || 'Equipment'} đã hỏng và bị tiêu hủy.`,
                type: 'default',
              });
            } else {
              inv.durability_left = durabilityResult.durability_left;
            }
          }
        }
      } else {
        const isAttackItem = action === 'attack_item' && itemId != null;
        let powerMin = NORMAL_POWER_MIN;
        let powerMax = NORMAL_POWER_MAX;
        let move = 'Normal Attack';
        if (isAttackItem) {
          const inv = state.equipment.find((e) => e.id === itemId);
          if (!inv || inv.durability_left <= 0) return res.status(400).json({ message: 'Item không khả dụng' });
          powerMin = inv.power_min != null ? inv.power_min : 0;
          powerMax = inv.power_max != null ? inv.power_max : 0;
          move = inv.item_name || 'Weapon';
        } else {
          move = 'Normal Attack';
        }
        result = simulateTurn(
          player,
          enemy,
          isAttackItem ? 10 : 10,
          move,
          { power_min: powerMin, power_max: powerMax, defender_current_def_dmg: enemy.current_def_dmg ?? 0 }
        );
        if (result.reflectedDamage > 0) {
          state.history.push({ text: `${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, type: 'enemy_attack' });
        } else {
          state.history.push({ text: `${result.attacker} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`, type: 'player_attack' });
        }
        enemy.current_hp = result.defender_hp_after ?? Math.max(0, (enemy.current_hp ?? enemy.final_stats?.hp) - (result.damage || 0));
        enemy.current_def_dmg = 0;
        if (result.attacker_hp_after != null) player.current_hp = result.attacker_hp_after;
        if (isAttackItem && itemId) {
          const inv = state.equipment.find((e) => e.id === itemId);
          if (inv) {
            const durabilityResult = await consumeEquipmentDurability(itemId, 1);
            if (durabilityResult.item_destroyed) {
              state.equipment = (state.equipment || []).filter((e) => e.id !== itemId);
              state.history.push({
                text: durabilityResult.break_reason === 'random'
                  ? `${inv.item_name || 'Equipment'} đã gãy ngẫu nhiên và bị tiêu hủy.`
                  : `${inv.item_name || 'Equipment'} đã hỏng và bị tiêu hủy.`,
                type: 'default',
              });
            } else {
              inv.durability_left = durabilityResult.durability_left;
            }
          }
        }
      }
    };

    state.turn_count = (state.turn_count || 0) + 1;

    if (playerGoesFirst) {
      await runPlayerAction();
      if ((enemy.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'win';
        await finalizeMatchInMySQL(state, 'player');
        await redis.del(key);
        return res.json(state);
      }
      if ((player.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'lose';
        await finalizeMatchInMySQL(state, 'enemy');
        await redis.del(key);
        return res.json(state);
      }
      await runEnemyTurn();
    } else {
      await runEnemyTurn();
      if ((player.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'lose';
        await finalizeMatchInMySQL(state, 'enemy');
        await redis.del(key);
        return res.json(state);
      }
      await runPlayerAction();
      if ((enemy.current_hp ?? 0) <= 0) {
        state.finished = true;
        state.result = 'win';
        await finalizeMatchInMySQL(state, 'player');
        await redis.del(key);
        return res.json(state);
      }
    }

    if ((player.current_hp ?? 0) <= 0) {
      state.finished = true;
      state.result = 'lose';
      await finalizeMatchInMySQL(state, 'enemy');
      await redis.del(key);
      return res.json(state);
    }

    await redis.set(key, JSON.stringify(state), { EX: REDIS_MATCH_TTL });
    res.json(state);
  } catch (err) {
    console.error('Error arena match turn:', err);
    res.status(500).json({ message: 'Lỗi xử lý lượt đấu' });
  }
});

// API ARENA: Mô phỏng toàn bộ trận đấu (PvE). Cả hai bên dùng Dmg_out với power_min/power_max.
// body: playerPet, enemyPet, playerMovePower, playerMoveName, enemyMovePower, enemyMoveName, playerPowerMin, playerPowerMax, enemyPowerMin, enemyPowerMax
app.post('/api/arena/simulate-full', (req, res) => {
  const {
    playerPet, enemyPet,
    playerMovePower = 10, playerMoveName = 'Tackle',
    enemyMovePower = 10, enemyMoveName = 'Bite',
    playerPowerMin, playerPowerMax,
    enemyPowerMin, enemyPowerMax,
  } = req.body;

  try {
    const options = {
      playerPowerMin: playerPowerMin != null ? Number(playerPowerMin) : undefined,
      playerPowerMax: playerPowerMax != null ? Number(playerPowerMax) : undefined,
      enemyPowerMin: enemyPowerMin != null ? Number(enemyPowerMin) : undefined,
      enemyPowerMax: enemyPowerMax != null ? Number(enemyPowerMax) : undefined,
    };
    const result = simulateFullBattle(
      playerPet, enemyPet,
      playerMovePower, playerMoveName,
      enemyMovePower, enemyMoveName,
      options
    );
    res.json(result);
  } catch (err) {
    console.error('Error during full battle simulation:', err);
    res.status(500).json({ message: 'Lỗi khi mô phỏng trận đấu' });
  }
});


function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// EXP battle mới:
// - Boss / quái: Exp = Level enemy * R, với R random 300..500
function calculateBattleExpGain(enemyLevel) {
  const lvl = Math.max(1, parseInt(enemyLevel, 10) || 1);
  const r = randomIntInclusive(300, 500);
  return lvl * r;
}

// ✅ API cộng EXP khi thắng trận
app.post('/api/pets/:id/gain-exp', async (req, res) => {
  const petId = req.params.id;
  const { source, enemy_level, custom_amount } = req.body;

  try {
    const [rows] = await pool.promise().query('SELECT * FROM pets WHERE id = ?', [petId]);
    if (!rows.length) return res.status(404).json({ message: 'Pet not found' });

    const pet = rows[0];

    if (pet.owner_id == null) {
      return res.status(403).json({ message: 'Pet không có chủ không được cộng EXP' });
    }

    const gain = custom_amount !== null ? custom_amount : calculateBattleExpGain(enemy_level);
    let newExp = pet.current_exp + gain;
    let newLevel = pet.level;

    while (expTable[newLevel + 1] && newExp >= expTable[newLevel + 1]) {
      newLevel++;
    }

    // ✅ Recalculate stats khi level up — gộp IV formula + booster_stats + *_added
    let updatedStats = null;
    if (newLevel > pet.level) {
      await pool.promise().query(
        'UPDATE pets SET current_exp = ?, level = ? WHERE id = ?',
        [newExp, newLevel, petId]
      );
      const refreshed = await refreshPetIntrinsicStats(db, petId);
      updatedStats = refreshed ? refreshed.merged : null;
    } else {
      await pool.promise().query(
        'UPDATE pets SET current_exp = ? WHERE id = ?',
        [newExp, petId]
      );
    }

    if (String(source) === 'hunt' && pet.owner_id) {
      try {
        await titleService.recordHuntWin(db, pet.owner_id, 1);
      } catch (e) {
        console.error('title hunt (gain-exp):', e);
      }
    }

    res.json({ 
      id: petId, 
      level: newLevel, 
      current_exp: newExp, 
      gained: gain, 
      source,
      stats_updated: !!updatedStats,
      new_stats: updatedStats,
      old_stats: updatedStats ? {
        hp: pet.hp,
        mp: pet.mp,
        str: pet.str,
        def: pet.def,
        intelligence: pet.intelligence,
        spd: pet.spd
      } : null
    });
  } catch (err) {
    console.error('Lỗi cộng EXP:', err);
    res.status(500).json({ message: 'Server error cộng EXP' });
  }
});

// API: Sửa chữa equipment bị hỏng bằng Repair Kit
app.post('/api/inventory/:id/repair-with-kit', async (req, res) => {
  res.status(410).json({ message: 'Repair system removed. Equipment is destroyed at 0 durability.' });
});

// Hàm tính hiệu quả repair dựa trên rarity
function getRepairEffectiveness(repairKitRarity, equipmentRarity) {
  const effectivenessMap = {
    common: {
      common: 100,
      uncommon: 50,
      rare: 10,
      epic: 0,
      legendary: 0
    },
    rare: {
      common: 100,
      uncommon: 75,
      rare: 50,
      epic: 10,
      legendary: 0
    },
    epic: {
      common: 100,
      uncommon: 85,
      rare: 70,
      epic: 50,
      legendary: 10
    },
    legendary: {
      common: 100,
      uncommon: 100,
      rare: 100,
      epic: 100,
      legendary: 100
    }
  };

  return effectivenessMap[repairKitRarity]?.[equipmentRarity] || 0;
}

// API: Sửa chữa equipment bằng Blacksmith (trả tiền)
app.post('/api/inventory/:id/repair-with-blacksmith', async (req, res) => {
  res.status(410).json({ message: 'Repair system removed. Equipment is destroyed at 0 durability.' });
});

// API: Lấy danh sách equipment bị hỏng của user
app.get('/api/users/:userId/broken-equipment', async (req, res) => {
  res.status(410).json({ message: 'Repair system removed. Equipment is destroyed at 0 durability.' });
});

// ==================== ĐÓI & TÂM TRẠNG (hunger 0–9, mood 0–4, decay theo thời gian) ====================

function petHpAlive(pet) {
  const cur = Number(pet.current_hp ?? pet.hp ?? 0);
  return cur > 0;
}

// API: Lấy thông tin hunger + mood của pet (áp dụng decay trước khi trả về)
app.get('/api/pets/:petId/hunger-status', async (req, res) => {
  const { petId } = req.params;

  try {
    const pet = await petVitals.refreshPetVitalsById(db, petId);
    if (!pet) {
      return res.status(404).json({ message: 'Pet không tồn tại' });
    }

    const statusText = petVitals.getHungerStatusText(pet.hunger_status);
    const canBattle = petVitals.canEnterArenaByHunger(pet.hunger_status) && petHpAlive(pet);

    res.json({
      pet_id: pet.id,
      pet_name: pet.name,
      hunger_status: pet.hunger_status,
      hunger_status_text: statusText,
      hunger_color: petVitals.vitalsColorFromHungerLevel(pet.hunger_status),
      hunger_battles: pet.hunger_battles,
      mood: pet.mood,
      mood_text: petVitals.getMoodStatusText(pet.mood),
      mood_color: petVitals.vitalsColorFromMoodLevel(pet.mood),
      can_battle: canBattle,
      hp: pet.hp,
    });
  } catch (err) {
    console.error('Error fetching pet hunger status:', err);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin hunger status' });
  }
});

// API: Kiểm tra pet có thể đấu không
app.get('/api/pets/:petId/battle-ready', async (req, res) => {
  const { petId } = req.params;

  try {
    const pet = await petVitals.refreshPetVitalsById(db, petId);
    if (!pet) {
      return res.status(404).json({ message: 'Pet không tồn tại' });
    }

    const canBattle = petVitals.canEnterArenaByHunger(pet.hunger_status) && petHpAlive(pet);
    const reasons = [];

    if (pet.hunger_status === 0) {
      reasons.push('Pet ở mức Tử Vong (hunger 0)');
    } else if (!petVitals.canEnterArenaByHunger(pet.hunger_status)) {
      reasons.push('Pet quá đói (Sắp chết đói / Kiệt sức — hunger 1–2), không thể đấu');
    }
    if (!petHpAlive(pet)) reasons.push('Pet đã hết máu');

    res.json({
      can_battle: canBattle,
      reasons,
      hunger_status: pet.hunger_status,
      hunger_status_text: petVitals.getHungerStatusText(pet.hunger_status),
      hunger_battles: pet.hunger_battles,
      mood: pet.mood,
      mood_text: petVitals.getMoodStatusText(pet.mood),
      hp: pet.hp,
    });
  } catch (err) {
    console.error('Error checking pet battle readiness:', err);
    res.status(500).json({ message: 'Lỗi khi kiểm tra pet' });
  }
});

// API: Sử dụng food item để hồi phục hunger status
app.post('/api/pets/:petId/feed', async (req, res) => {
  const { petId } = req.params;
  const { itemId, userId } = req.body;

  try {
    const [inventoryRows] = await pool.promise().query(
      'SELECT * FROM inventory WHERE item_id = ? AND player_id = ? AND quantity > 0',
      [itemId, userId]
    );

    if (inventoryRows.length === 0) {
      return res.status(400).json({ message: 'Food item không có trong inventory' });
    }

    const [foodRows] = await pool.promise().query(
      'SELECT * FROM food_recovery_items WHERE item_id = ?',
      [itemId]
    );

    if (foodRows.length === 0) {
      return res.status(400).json({ message: 'Item không phải food item' });
    }

    const [petRows] = await pool.promise().query(
      'SELECT * FROM pets WHERE id = ? AND owner_id = ?',
      [petId, userId]
    );

    if (petRows.length === 0) {
      return res.status(404).json({ message: 'Pet không tồn tại hoặc không thuộc sở hữu' });
    }

    await petVitals.refreshPetVitalsById(db, petId);

    const [petFresh] = await pool.promise().query('SELECT * FROM pets WHERE id = ? AND owner_id = ?', [petId, userId]);
    const pet = petFresh[0];
    const food = foodRows[0];

    const oldStatus = petVitals.clampHunger(pet.hunger_status);
    const oldMood = petVitals.clampMood(pet.mood);
    const gain = Number(food.recovery_amount) || 0;
    const newStatus = Math.min(petVitals.HUNGER_MAX, oldStatus + gain);
    const newMood = Math.min(petVitals.MOOD_MAX, oldMood + 1);
    const oldBattles = pet.hunger_battles;
    const newBattles = 0;

    await pool.promise().query(
      `UPDATE pets SET hunger_status = ?, hunger_battles = ?, mood = ?,
         hunger_vitals_at = NOW(), mood_vitals_at = NOW() WHERE id = ?`,
      [newStatus, newBattles, newMood, petId]
    );

    await pool.promise().query(
      'INSERT INTO hunger_status_history (pet_id, old_status, new_status, old_battles, new_battles, change_reason, food_item_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [petId, oldStatus, newStatus, oldBattles, newBattles, 'feeding', itemId]
    );

    await pool.promise().query(
      'UPDATE inventory SET quantity = quantity - 1 WHERE item_id = ? AND player_id = ?',
      [itemId, userId]
    );

    await pool.promise().query(
      'DELETE FROM inventory WHERE item_id = ? AND player_id = ? AND quantity <= 0',
      [itemId, userId]
    );

    res.json({
      message: 'Cho pet ăn thành công',
      old_status: oldStatus,
      new_status: newStatus,
      old_status_text: petVitals.getHungerStatusText(oldStatus),
      new_status_text: petVitals.getHungerStatusText(newStatus),
      recovery_amount: food.recovery_amount,
      battles_reset: true,
    });
  } catch (err) {
    console.error('Error feeding pet:', err);
    res.status(500).json({ message: 'Lỗi khi cho pet ăn' });
  }
});

// API: Sau trận đấu — decay thời gian; +1 hunger_battles; cứ 50 trận trừ 1 hunger
app.post('/api/pets/:petId/update-hunger-after-battle', async (req, res) => {
  const { petId } = req.params;

  try {
    const pet = await petVitals.refreshPetVitalsById(db, petId);
    if (!pet) {
      return res.status(404).json({ message: 'Pet không tồn tại' });
    }

    const hungerBefore = petVitals.clampHunger(pet.hunger_status);
    const priorBattles = Number(pet.hunger_battles) || 0;

    const { hunger: newHunger, hunger_battles: newBattles } = petVitals.applyBattlesIncrementToHunger(
      hungerBefore,
      priorBattles
    );

    await pool.promise().query(
      'UPDATE pets SET hunger_status = ?, hunger_battles = ? WHERE id = ?',
      [newHunger, newBattles, petId]
    );

    if (newHunger === 0) {
      await pool.promise().query(
        'UPDATE pets SET current_hp = 0, hp = 0 WHERE id = ?',
        [petId]
      );
    }

    if (newHunger !== hungerBefore) {
      await pool.promise().query(
        'INSERT INTO hunger_status_history (pet_id, old_status, new_status, old_battles, new_battles, change_reason) VALUES (?, ?, ?, ?, ?, ?)',
        [petId, hungerBefore, newHunger, priorBattles, newBattles, 'battle_wear']
      );
    }

    res.json({
      message: 'Cập nhật đói sau trận (đếm trận / mòn đói)',
      old_status: hungerBefore,
      new_status: newHunger,
      old_status_text: petVitals.getHungerStatusText(hungerBefore),
      new_status_text: petVitals.getHungerStatusText(newHunger),
      old_battles: priorBattles,
      new_battles: newBattles,
      status_changed: newHunger !== hungerBefore,
    });
  } catch (err) {
    console.error('Error updating pet hunger status after battle:', err);
    res.status(500).json({ message: 'Lỗi khi cập nhật hunger status' });
  }
});

// ======================================================== MAIL SYSTEM ========================================================

// GET /api/mails/:userId - Lấy danh sách mail của user
app.get('/api/mails/:userId', async (req, res) => {
  const { userId } = req.params;
  const { filter = 'all' } = req.query; // all, unread, claimed, unclaimed, system, admin, user

  try {
    let whereClause = 'WHERE m.user_id = ?';
    const params = [userId];

    switch (filter) {
      case 'unread':
        whereClause += ' AND m.is_read = FALSE';
        break;
      case 'claimed':
        whereClause += ' AND m.is_claimed = TRUE';
        break;
      case 'unclaimed':
        whereClause += ' AND m.is_claimed = FALSE';
        break;
      case 'system':
        whereClause += ' AND m.sender_type = "system"';
        break;
      case 'admin':
        whereClause += ' AND m.sender_type = "admin"';
        break;
      case 'user':
        whereClause += ' AND m.sender_type = "user"';
        break;
    }

    const [mails] = await db.query(`
      SELECT 
        m.*,
        u.username as sender_username
      FROM mails m
      LEFT JOIN users u ON m.sender_id = u.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT 100
    `, params);

    res.json(mails);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách mail:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách mail' });
  }
});

/** Ảnh xem trước pet/spirit trong thư (đấu giá + tặng quà). Chỉ chủ thư. */
app.get('/api/mails/:mailId/preview-assets', async (req, res) => {
  const mailId = parseInt(req.params.mailId, 10);
  const userId = parseInt(req.query.userId, 10);
  if (!Number.isFinite(mailId) || !Number.isFinite(userId)) {
    return res.status(400).json({ error: 'Tham số không hợp lệ' });
  }
  try {
    const [rows] = await db.query(
      'SELECT attached_rewards FROM mails WHERE id = ? AND user_id = ? LIMIT 1',
      [mailId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy thư' });
    }
    let rewards = {};
    try {
      const raw = rows[0].attached_rewards;
      rewards =
        typeof raw === 'object' && raw !== null && !Buffer.isBuffer(raw)
          ? raw
          : JSON.parse(raw ? String(raw) : '{}');
    } catch (_) {
      rewards = {};
    }
    const fromAuctionPets = Array.isArray(rewards.auction_transfer_pet_ids)
      ? rewards.auction_transfer_pet_ids.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const fromGiftPets = Array.isArray(rewards.pets)
      ? rewards.pets.map((x) => parseInt(x.pet_id, 10)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const petIds = [...new Set([...fromAuctionPets, ...fromGiftPets])];

    const fromAuctionSpirits = Array.isArray(rewards.auction_transfer_spirit_ids)
      ? rewards.auction_transfer_spirit_ids.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const fromGiftSpirits = Array.isArray(rewards.spirits)
      ? rewards.spirits
          .map((x) => parseInt(x.user_spirit_id, 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];
    const spiritIds = [...new Set([...fromAuctionSpirits, ...fromGiftSpirits])];

    const out = { pets: [], spirits: [] };
    if (petIds.length) {
      const ph = petIds.map(() => '?').join(',');
      const [pets] = await db.query(
        `SELECT p.id, p.name, ps.image AS species_image
         FROM pets p
         LEFT JOIN pet_species ps ON ps.id = p.pet_species_id
         WHERE p.id IN (${ph})`,
        petIds
      );
      out.pets = pets || [];
    }
    if (spiritIds.length) {
      const sh = spiritIds.map(() => '?').join(',');
      const [spirits] = await db.query(
        `SELECT us.id AS user_spirit_id, COALESCE(s.name, '') AS name, s.image_url AS spirit_image
         FROM user_spirits us
         LEFT JOIN spirits s ON s.id = us.spirit_id
         WHERE us.id IN (${sh})`,
        spiritIds
      );
      out.spirits = spirits || [];
    }
    res.json(out);
  } catch (err) {
    console.error('GET /api/mails/:mailId/preview-assets', err);
    res.status(500).json({ error: 'Không tải được ảnh xem trước' });
  }
});

async function countInventorySlots(dbConn, playerId) {
  const [rows] = await dbConn.query(
    'SELECT COUNT(*) AS c FROM inventory WHERE player_id = ?',
    [playerId]
  );
  return Number(rows[0]?.c) || 0;
}

async function getInventoryCapacity(dbConn, playerId) {
  const slotCount = await countInventorySlots(dbConn, playerId);
  return {
    slotCount,
    maxSlots: INVENTORY_MAX_SLOTS,
    freeSlots: Math.max(0, INVENTORY_MAX_SLOTS - slotCount),
    isFull: slotCount >= INVENTORY_MAX_SLOTS,
  };
}

function makeInventoryFullError(slotCount, maxSlots = INVENTORY_MAX_SLOTS) {
  const err = new Error('INVENTORY_FULL');
  err.code = 'INVENTORY_FULL';
  err.slotCount = slotCount;
  err.maxSlots = maxSlots;
  return err;
}

async function countOwnedPets(dbConn, userId) {
  const [rows] = await dbConn.query('SELECT COUNT(*) AS c FROM pets WHERE owner_id = ?', [userId]);
  return Number(rows[0]?.c) || 0;
}

async function getPetCapacity(dbConn, userId) {
  const slotCount = await countOwnedPets(dbConn, userId);
  return {
    slotCount,
    maxSlots: PET_MAX_SLOTS,
    freeSlots: Math.max(0, PET_MAX_SLOTS - slotCount),
    isFull: slotCount >= PET_MAX_SLOTS,
  };
}

function makePetFullError(slotCount, maxSlots = PET_MAX_SLOTS) {
  const err = new Error('PET_FULL');
  err.code = 'PET_FULL';
  err.slotCount = slotCount;
  err.maxSlots = maxSlots;
  return err;
}

async function countOwnedSpirits(dbConn, userId) {
  const [rows] = await dbConn.query('SELECT COUNT(*) AS c FROM user_spirits WHERE user_id = ?', [
    userId,
  ]);
  return Number(rows[0]?.c) || 0;
}

async function getSpiritCapacity(dbConn, userId) {
  const slotCount = await countOwnedSpirits(dbConn, userId);
  return {
    slotCount,
    maxSlots: SPIRIT_MAX_SLOTS,
    freeSlots: Math.max(0, SPIRIT_MAX_SLOTS - slotCount),
    isFull: slotCount >= SPIRIT_MAX_SLOTS,
  };
}

function makeSpiritFullError(slotCount, maxSlots = SPIRIT_MAX_SLOTS) {
  const err = new Error('SPIRIT_FULL');
  err.code = 'SPIRIT_FULL';
  err.slotCount = slotCount;
  err.maxSlots = maxSlots;
  return err;
}

/** Gửi thư hệ thống với attached_rewards tùy ý (items / pets / spirits / transfer ids). */
async function sendSystemRewardMail(dbConn, playerId, attachedRewards, meta = {}) {
  if (!attachedRewards || typeof attachedRewards !== 'object') return null;
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + 30);
  const [result] = await dbConn.query(
    `INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
     VALUES (?, 'admin', ?, ?, ?, ?, ?)`,
    [
      playerId,
      meta.senderName || 'Hệ thống',
      meta.subject || 'Kho đã đầy — phần thưởng gửi vào thư',
      meta.message ||
        'Kho của bạn đã đạt giới hạn. Phần thưởng được đính kèm trong thư này. Hãy dọn bớt rồi nhận.',
      JSON.stringify(attachedRewards),
      expireAt,
    ]
  );
  return result?.insertId ?? null;
}

/** Số ô mới cần tạo khi thêm item (stack có sẵn = 0). */
async function estimateNewSlotsForGrant(dbConn, playerId, itemId, quantity) {
  const qty = Math.max(0, parseInt(quantity, 10) || 0);
  if (!qty || !itemId) return 0;
  const [itemRows] = await dbConn.query('SELECT id, type, stackable FROM items WHERE id = ?', [itemId]);
  if (!itemRows.length) return 0;
  const itemRow = itemRows[0];
  const isEquipment = String(itemRow.type || '').toLowerCase() === 'equipment';
  if (isEquipment) return qty;
  const stackable = itemRow.stackable === 1 || itemRow.stackable === true;
  if (stackable) {
    const [invRows] = await dbConn.query(
      `SELECT id FROM inventory WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL) LIMIT 1`,
      [playerId, itemId]
    );
    return invRows.length > 0 ? 0 : 1;
  }
  return qty;
}

/** Ước lượng tổng ô mới cho danh sách item (có tính stack trong cùng batch). */
async function estimateNewSlotsForItemList(dbConn, playerId, items) {
  const pendingNewStacks = new Set();
  let needed = 0;
  for (const raw of items || []) {
    const itemId = Number(raw.item_id ?? raw.itemId);
    const qty = Math.max(0, parseInt(raw.quantity ?? raw.qty, 10) || 0);
    if (!itemId || !qty) continue;
    const [itemRows] = await dbConn.query('SELECT id, type, stackable FROM items WHERE id = ?', [itemId]);
    if (!itemRows.length) continue;
    const itemRow = itemRows[0];
    const isEquipment = String(itemRow.type || '').toLowerCase() === 'equipment';
    if (isEquipment) {
      needed += qty;
      continue;
    }
    const stackable = itemRow.stackable === 1 || itemRow.stackable === true;
    if (stackable) {
      if (pendingNewStacks.has(itemId)) continue;
      const [invRows] = await dbConn.query(
        `SELECT id FROM inventory WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL) LIMIT 1`,
        [playerId, itemId]
      );
      if (invRows.length > 0) continue;
      pendingNewStacks.add(itemId);
      needed += 1;
      continue;
    }
    needed += qty;
  }
  return needed;
}

async function sendInventoryOverflowMail(dbConn, playerId, items, meta = {}) {
  const list = (items || [])
    .map((it) => ({
      item_id: Number(it.item_id ?? it.itemId),
      quantity: Math.max(1, parseInt(it.quantity ?? it.qty, 10) || 1),
    }))
    .filter((it) => it.item_id > 0);
  if (!list.length) return null;
  return sendSystemRewardMail(
    dbConn,
    playerId,
    { items: list },
    {
      senderName: meta.senderName || 'Hệ thống',
      subject: meta.subject || 'Túi đồ đã đầy — vật phẩm gửi vào thư',
      message:
        meta.message ||
        `Túi đồ của bạn đã đạt giới hạn (${INVENTORY_MAX_SLOTS} ô). Vật phẩm được đính kèm trong thư này. Hãy dọn bớt túi rồi nhấn nhận phần thưởng.`,
    }
  );
}

/**
 * Thêm vật phẩm vào inventory (stack / equipment).
 * @param {{ overflowToMail?: boolean, mailMeta?: object }} opts
 *   - overflowToMail: nếu không đủ ô → gửi phần không nhận được vào thư hệ thống
 *   - không bật: ném INVENTORY_FULL nếu không đủ chỗ (dùng khi claim mail)
 * @returns {Promise<{ granted: number, mailed: number, destination: string }>}
 */
async function grantMailItemsToInventory(dbConn, playerId, itemId, quantity, opts = {}) {
  const qty = Math.max(0, parseInt(quantity, 10) || 0);
  if (!qty || !itemId) return { granted: 0, mailed: 0, destination: 'none' };

  const overflowToMail = opts.overflowToMail === true;
  const [itemRows] = await dbConn.query('SELECT id, type, stackable FROM items WHERE id = ?', [itemId]);
  if (!itemRows.length) return { granted: 0, mailed: 0, destination: 'none' };
  const itemRow = itemRows[0];
  const isEquipment = String(itemRow.type || '').toLowerCase() === 'equipment';
  const stackable = itemRow.stackable === 1 || itemRow.stackable === true;

  const cap = await getInventoryCapacity(dbConn, playerId);
  const needed = await estimateNewSlotsForGrant(dbConn, playerId, itemId, qty);

  let grantQty = qty;
  let mailQty = 0;

  if (needed > cap.freeSlots) {
    if (!overflowToMail) {
      throw makeInventoryFullError(cap.slotCount, cap.maxSlots);
    }
    if (isEquipment || !stackable) {
      grantQty = Math.max(0, cap.freeSlots);
      mailQty = qty - grantQty;
    } else if (needed > 0 && cap.freeSlots <= 0) {
      grantQty = 0;
      mailQty = qty;
    } else {
      // stackable cần 1 ô mới nhưng không còn chỗ
      grantQty = 0;
      mailQty = qty;
    }
  }

  if (grantQty > 0) {
    if (isEquipment) {
      const [equipInfo] = await dbConn.query('SELECT durability_max FROM equipment_data WHERE item_id = ?', [
        itemId,
      ]);
      const durability = equipInfo.length > 0 ? (equipInfo[0].durability_max ?? 1) : 1;
      for (let i = 0; i < grantQty; i++) {
        await dbConn.query(
          `INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left) VALUES (?, ?, 1, 0, ?)`,
          [playerId, itemId, durability]
        );
      }
    } else if (stackable) {
      const [invRows] = await dbConn.query(
        `SELECT id, quantity FROM inventory WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL)`,
        [playerId, itemId]
      );
      if (invRows.length > 0) {
        await dbConn.query(`UPDATE inventory SET quantity = quantity + ? WHERE id = ?`, [
          grantQty,
          invRows[0].id,
        ]);
      } else {
        await dbConn.query(`INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, ?)`, [
          playerId,
          itemId,
          grantQty,
        ]);
      }
    } else {
      for (let i = 0; i < grantQty; i++) {
        await dbConn.query(`INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, 1)`, [
          playerId,
          itemId,
        ]);
      }
    }
  }

  if (mailQty > 0) {
    await sendInventoryOverflowMail(
      dbConn,
      playerId,
      [{ item_id: itemId, quantity: mailQty }],
      opts.mailMeta || {}
    );
  }

  const destination =
    mailQty > 0 && grantQty > 0 ? 'split' : mailQty > 0 ? 'mail' : grantQty > 0 ? 'inventory' : 'none';
  return { granted: grantQty, mailed: mailQty, destination };
}

/** @deprecated alias — giữ tên cũ cho chỗ gọi overflow */
async function grantItemsToInventoryOrMail(dbConn, playerId, itemId, quantity, mailMeta) {
  return grantMailItemsToInventory(dbConn, playerId, itemId, quantity, {
    overflowToMail: true,
    mailMeta,
  });
}

async function petHasActiveArenaMatch(userId, petId) {
  try {
    const redis = getRedis();
    if (!redis) return false;
    const key = REDIS_MATCH_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return false;
    const state = JSON.parse(data);
    return Number(state.pet_id) === Number(petId);
  } catch (_) {
    return false;
  }
}

/** Gỡ toàn bộ vật phẩm / linh thú đang gắn pet (trước khi tặng pet hoặc sau khi chuẩn bị gửi thư). */
async function stripAllGearFromPet(conn, petId, ownerPlayerId) {
  const pid = parseInt(petId, 10);
  const uid = parseInt(ownerPlayerId, 10);
  if (!Number.isFinite(pid) || !Number.isFinite(uid)) return;
  await conn.query(
    `UPDATE inventory SET is_equipped = 0, equipped_pet_id = NULL WHERE equipped_pet_id = ? AND player_id = ?`,
    [pid, uid]
  );
  await conn.query(
    `UPDATE user_spirits SET is_equipped = 0, equipped_pet_id = NULL WHERE equipped_pet_id = ? AND user_id = ?`,
    [pid, uid]
  );
}

/** Áp dụng attached_rewards cho người nhận. Thư user: chuyển pet/spirit; không cộng peta/petagold. */
async function applyMailAttachedRewards(mailRow, recipientUserId) {
  let rewards;
  try {
    if (typeof mailRow.attached_rewards === 'object' && mailRow.attached_rewards !== null) {
      rewards = mailRow.attached_rewards;
    } else {
      rewards = JSON.parse(mailRow.attached_rewards || '{}');
    }
  } catch (e) {
    rewards = {};
  }
  const isUserMail =
    String(mailRow.sender_type || '').toLowerCase() === 'user' &&
    mailRow.sender_id != null &&
    Number(mailRow.sender_id) > 0;
  const senderId = Number(mailRow.sender_id);

  if (rewards.peta && !isUserMail) {
    await db.query(`UPDATE users SET peta = peta + ? WHERE id = ?`, [rewards.peta, recipientUserId]);
    try {
      await titleService.recordPetaEarned(db, recipientUserId, rewards.peta);
    } catch (e) {
      console.error('title earn (mail peta):', e);
    }
  }
  if (rewards.peta_gold && !isUserMail) {
    await db.query(`UPDATE users SET petagold = petagold + ? WHERE id = ?`, [rewards.peta_gold, recipientUserId]);
  }

  if (rewards.items && rewards.items.length > 0) {
    const needed = await estimateNewSlotsForItemList(db, recipientUserId, rewards.items);
    const cap = await getInventoryCapacity(db, recipientUserId);
    if (needed > cap.freeSlots) {
      throw makeInventoryFullError(cap.slotCount, cap.maxSlots);
    }
    for (const item of rewards.items) {
      await grantMailItemsToInventory(db, recipientUserId, item.item_id, item.quantity);
    }
  }

  if (rewards.spirits && rewards.spirits.length > 0) {
    let spiritNeeded = 0;
    for (const spirit of rewards.spirits) {
      if (isUserMail && spirit.user_spirit_id) {
        spiritNeeded += 1;
      } else {
        spiritNeeded += Math.max(1, parseInt(spirit.quantity, 10) || 1);
      }
    }
    const spiritCap = await getSpiritCapacity(db, recipientUserId);
    if (spiritNeeded > spiritCap.freeSlots) {
      throw makeSpiritFullError(spiritCap.slotCount, spiritCap.maxSlots);
    }
    for (const spirit of rewards.spirits) {
      const qty = Math.max(1, parseInt(spirit.quantity, 10) || 1);
      if (isUserMail && spirit.user_spirit_id) {
        await db.query(
          `UPDATE user_spirits SET user_id = ?, is_equipped = 0, equipped_pet_id = NULL, is_listed = 0
           WHERE id = ?`,
          [recipientUserId, spirit.user_spirit_id]
        );
      } else {
        for (let i = 0; i < qty; i++) {
          await db.query(
            `INSERT INTO user_spirits (user_id, spirit_id, is_equipped, equipped_pet_id)
             VALUES (?, ?, FALSE, NULL)`,
            [recipientUserId, spirit.spirit_id]
          );
        }
      }
    }
  }

  if (rewards.pets && rewards.pets.length > 0) {
    let petNeeded = 0;
    for (const pet of rewards.pets) {
      if (isUserMail && pet.pet_id) petNeeded += 1;
      else petNeeded += Math.max(1, parseInt(pet.quantity, 10) || 1);
    }
    const petCap = await getPetCapacity(db, recipientUserId);
    if (petNeeded > petCap.freeSlots) {
      throw makePetFullError(petCap.slotCount, petCap.maxSlots);
    }
    for (const pet of rewards.pets) {
      const qty = Math.max(1, parseInt(pet.quantity, 10) || 1);
      if (isUserMail && pet.pet_id) {
        await db.query(`UPDATE pets SET owner_id = ?, is_listed = 0 WHERE id = ?`, [
          recipientUserId,
          pet.pet_id,
        ]);
      } else {
        for (let i = 0; i < qty; i++) {
          const [petRows] = await db.query('SELECT * FROM pets WHERE id = ?', [pet.pet_id]);
          if (!petRows.length) continue;
          const o = petRows[0];
          const speciesId = o.pet_species_id ?? o.species_id;
          if (speciesId == null) continue;
          const finalStats =
            typeof o.final_stats === 'string'
              ? o.final_stats
              : JSON.stringify(
                  o.final_stats || {
                    hp: o.hp,
                    mp: o.mp,
                    str: o.str,
                    def: o.def,
                    intelligence: o.intelligence,
                    spd: o.spd,
                  }
                );
          await db.query(
            `INSERT INTO pets (
              uuid, name, hp, str, def, intelligence, spd, mp,
              owner_id, pet_species_id, level, max_hp, max_mp,
              created_date, final_stats,
              iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd,
              current_exp, exp_to_next_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              o.name,
              o.hp,
              o.str,
              o.def,
              o.intelligence,
              o.spd,
              o.mp,
              recipientUserId,
              speciesId,
              o.level,
              o.max_hp ?? o.hp,
              o.max_mp ?? o.mp,
              new Date(),
              finalStats,
              o.iv_hp ?? 0,
              o.iv_mp ?? 0,
              o.iv_str ?? 0,
              o.iv_def ?? 0,
              o.iv_intelligence ?? 0,
              o.iv_spd ?? 0,
              o.current_exp ?? 0,
              o.exp_to_next_level ?? 100,
            ]
          );
          try {
            await titleService.recordPetCatch(db, recipientUserId, 1);
          } catch (e) {
            console.error('title catch (mail pet):', e);
          }
        }
      }
    }
  }

  /** Đấu giá / overflow: chuyển pet/spirit đã tạo sẵn về người nhận. */
  if (
    Array.isArray(rewards.auction_transfer_pet_ids) &&
    rewards.auction_transfer_pet_ids.length > 0 &&
    !isUserMail
  ) {
    let transferPetNeeded = 0;
    for (const rawId of rewards.auction_transfer_pet_ids) {
      const pid = parseInt(rawId, 10);
      if (!Number.isFinite(pid)) continue;
      const [prows] = await db.query('SELECT owner_id FROM pets WHERE id = ?', [pid]);
      if (!prows.length) continue;
      if (Number(prows[0].owner_id) === Number(recipientUserId)) continue;
      transferPetNeeded += 1;
    }
    if (transferPetNeeded > 0) {
      const petCap = await getPetCapacity(db, recipientUserId);
      if (transferPetNeeded > petCap.freeSlots) {
        throw makePetFullError(petCap.slotCount, petCap.maxSlots);
      }
    }
    for (const rawId of rewards.auction_transfer_pet_ids) {
      const pid = parseInt(rawId, 10);
      if (!Number.isFinite(pid)) continue;
      await db.query(
        `UPDATE pets SET owner_id = ?, is_listed = 0 WHERE id = ?`,
        [recipientUserId, pid]
      );
    }
  }
  if (
    Array.isArray(rewards.auction_transfer_spirit_ids) &&
    rewards.auction_transfer_spirit_ids.length > 0 &&
    !isUserMail
  ) {
    let transferSpiritNeeded = 0;
    for (const rawId of rewards.auction_transfer_spirit_ids) {
      const sid = parseInt(rawId, 10);
      if (!Number.isFinite(sid)) continue;
      const [srows] = await db.query('SELECT user_id FROM user_spirits WHERE id = ?', [sid]);
      if (!srows.length) continue;
      if (Number(srows[0].user_id) === Number(recipientUserId)) continue;
      transferSpiritNeeded += 1;
    }
    if (transferSpiritNeeded > 0) {
      const spiritCap = await getSpiritCapacity(db, recipientUserId);
      if (transferSpiritNeeded > spiritCap.freeSlots) {
        throw makeSpiritFullError(spiritCap.slotCount, spiritCap.maxSlots);
      }
    }
    for (const rawId of rewards.auction_transfer_spirit_ids) {
      const sid = parseInt(rawId, 10);
      if (!Number.isFinite(sid)) continue;
      await db.query(
        `UPDATE user_spirits
         SET user_id = ?, is_equipped = 0, equipped_pet_id = NULL, is_listed = 0
         WHERE id = ?`,
        [recipientUserId, sid]
      );
    }
  }
}

// POST /api/mails/gift — User gửi quà cho bạn bè (một loại: items | pet | spirit; không peta)
app.post('/api/mails/gift', async (req, res) => {
  const senderId = getUserIdFromToken(req);
  if (!senderId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    recipient_user_id,
    subject,
    message,
    gift_kind,
    items,
    pet_id,
    user_spirit_id,
    expire_days = 14,
  } = req.body;

  const rid = parseInt(recipient_user_id, 10);
  if (!Number.isFinite(rid) || rid <= 0 || rid === senderId) {
    return res.status(400).json({ error: 'Người nhận không hợp lệ' });
  }
  const subj = String(subject || '').trim();
  const msg = String(message || '').trim();
  if (!subj || !msg) return res.status(400).json({ error: 'Tiêu đề và nội dung không được để trống' });
  if (!['items', 'pet', 'spirit'].includes(String(gift_kind || ''))) {
    return res.status(400).json({ error: 'gift_kind phải là items, pet hoặc spirit' });
  }

  let conn;
  try {
    const [fr] = await db.query(
      `SELECT 1 FROM user_friendships WHERE user_id = ? AND friend_id = ? LIMIT 1`,
      [senderId, rid]
    );
    if (!fr.length) return res.status(403).json({ error: 'Chỉ có thể gửi quà cho bạn bè trong danh sách' });

    const [recv] = await db.query('SELECT id FROM users WHERE id = ? LIMIT 1', [rid]);
    if (!recv.length) return res.status(404).json({ error: 'Người nhận không tồn tại' });

    const [snd] = await db.query('SELECT username FROM users WHERE id = ? LIMIT 1', [senderId]);
    const senderName = snd[0]?.username || `User#${senderId}`;

    let attached = null;

    conn = await db.getConnection();
    await conn.beginTransaction();

    if (gift_kind === 'items') {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'Chọn ít nhất một vật phẩm từ kho' });
      }
      const outItems = [];
      for (const row of list) {
        const invId = parseInt(row.inventory_id, 10);
        const qty = Math.max(1, parseInt(row.quantity, 10) || 1);
        if (!Number.isFinite(invId)) {
          await conn.rollback();
          return res.status(400).json({ error: 'inventory_id không hợp lệ' });
        }
        const [invRows] = await conn.query(
          `SELECT i.id, i.quantity, i.is_equipped, it.id AS catalogue_item_id, it.type AS it_type, it.category AS it_cat
           FROM inventory i JOIN items it ON i.item_id = it.id
           WHERE i.id = ? AND i.player_id = ? FOR UPDATE`,
          [invId, senderId]
        );
        if (!invRows.length) {
          await conn.rollback();
          return res.status(400).json({ error: `Không tìm thấy vật phẩm trong kho (id ${invId})` });
        }
        const inv = invRows[0];
        if (Number(inv.is_equipped) === 1) {
          await conn.rollback();
          return res.status(400).json({ error: 'Không thể tặng vật phẩm đang trang bị' });
        }
        const cat = String(inv.it_cat || '').toLowerCase();
        const typ = String(inv.it_type || '').toLowerCase();
        if (typ === 'misc' || cat === 'misc') {
          await conn.rollback();
          return res.status(400).json({ error: 'Không thể tặng vật phẩm loại misc' });
        }
        if (inv.quantity < qty) {
          await conn.rollback();
          return res.status(400).json({ error: 'Số lượng vượt quá kho' });
        }
        if (inv.quantity === qty) {
          await conn.query(`DELETE FROM inventory WHERE id = ?`, [invId]);
        } else {
          await conn.query(`UPDATE inventory SET quantity = quantity - ? WHERE id = ?`, [qty, invId]);
        }
        outItems.push({ item_id: inv.catalogue_item_id, quantity: qty });
      }
      attached = { items: outItems };
    } else if (gift_kind === 'pet') {
      const pid = parseInt(pet_id, 10);
      if (!Number.isFinite(pid)) {
        await conn.rollback();
        return res.status(400).json({ error: 'pet_id không hợp lệ' });
      }
      const [pRows] = await conn.query(`SELECT id, owner_id, level FROM pets WHERE id = ? FOR UPDATE`, [pid]);
      if (!pRows.length || Number(pRows[0].owner_id) !== senderId) {
        await conn.rollback();
        return res.status(400).json({ error: 'Pet không thuộc về bạn' });
      }
      if (Number(pRows[0].level) < 20) {
        await conn.rollback();
        return res.status(400).json({ error: 'Chỉ có thể tặng thú cưng từ cấp 20 trở lên' });
      }
      await stripAllGearFromPet(conn, pid, senderId);
      const inArena = await petHasActiveArenaMatch(senderId, pid);
      if (inArena) {
        await conn.rollback();
        return res.status(400).json({ error: 'Pet đang trong trận đấu, không thể tặng' });
      }
      const [moved] = await conn.query(
        `UPDATE pets SET owner_id = ?, is_listed = 0 WHERE id = ? AND owner_id = ?`,
        [rid, pid, senderId]
      );
      if (!moved.affectedRows) {
        await conn.rollback();
        return res.status(400).json({ error: 'Không thể chuyển pet — thử lại sau' });
      }
      attached = { pets: [{ pet_id: pid, quantity: 1 }] };
    } else if (gift_kind === 'spirit') {
      const sid = parseInt(user_spirit_id, 10);
      if (!Number.isFinite(sid)) {
        await conn.rollback();
        return res.status(400).json({ error: 'user_spirit_id không hợp lệ' });
      }
      const [usRows] = await conn.query(
        `SELECT us.id, us.user_id, us.spirit_id, us.is_equipped, us.equipped_pet_id
         FROM user_spirits us WHERE us.id = ? FOR UPDATE`,
        [sid]
      );
      if (!usRows.length || Number(usRows[0].user_id) !== senderId) {
        await conn.rollback();
        return res.status(400).json({ error: 'Linh thú không thuộc về bạn' });
      }
      await conn.query(
        `UPDATE user_spirits SET is_equipped = 0, equipped_pet_id = NULL WHERE id = ? AND user_id = ?`,
        [sid, senderId]
      );
      const [movedSp] = await conn.query(
        `UPDATE user_spirits SET user_id = ?, is_equipped = 0, equipped_pet_id = NULL, is_listed = 0
         WHERE id = ? AND user_id = ?`,
        [rid, sid, senderId]
      );
      if (!movedSp.affectedRows) {
        await conn.rollback();
        return res.status(400).json({ error: 'Không thể chuyển linh thú — thử lại sau' });
      }
      attached = {
        spirits: [{ user_spirit_id: sid, spirit_id: usRows[0].spirit_id, quantity: 1 }],
      };
    }

    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + Math.min(90, Math.max(1, parseInt(expire_days, 10) || 14)));

    const rewardsJson = attached ? JSON.stringify(attached) : null;
    await conn.query(
      `INSERT INTO mails (user_id, sender_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
       VALUES (?, ?, 'user', ?, ?, ?, ?, ?)`,
      [rid, senderId, senderName, subj, msg, rewardsJson, expireAt]
    );

    await conn.commit();
    res.json({ success: true, message: 'Đã gửi thư tặng quà!' });
  } catch (err) {
    try {
      if (conn) await conn.rollback();
    } catch (_) {}
    console.error('POST /api/mails/gift:', err);
    res.status(500).json({ error: 'Không thể gửi thư', details: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/mails/claim/:mailId - Claim 1 mail
app.post('/api/mails/claim/:mailId', async (req, res) => {
  const { mailId } = req.params;
  const { userId } = req.body;

  try {
    // 1. Lấy thông tin mail
    const [mailRows] = await db.query(`
      SELECT * FROM mails WHERE id = ? AND user_id = ? AND is_claimed = FALSE
    `, [mailId, userId]);

    if (!mailRows.length) {
      return res.status(404).json({ error: 'Mail không tồn tại hoặc đã claim' });
    }

    const mail = mailRows[0];
    let rewards;
    try {
      if (typeof mail.attached_rewards === 'object') {
        rewards = mail.attached_rewards;
      } else {
        rewards = JSON.parse(mail.attached_rewards || '{}');
      }
    } catch (error) {
      console.error('Error parsing rewards for mail:', mail.id, error);
      rewards = {};
    }

    await applyMailAttachedRewards(mail, userId);

    await db.query(`
      UPDATE mails SET is_claimed = TRUE WHERE id = ?
    `, [mailId]);

    res.json({
      success: true,
      message: 'Claim thành công!',
      rewards: rewards,
    });

  } catch (err) {
    console.error('Lỗi khi claim mail:', err);
    if (err.code === 'INVENTORY_FULL') {
      return res.status(400).json({
        error: 'Túi đồ đã đầy',
        message: `Túi đồ đã đầy (${err.slotCount}/${err.maxSlots}). Hãy dọn bớt vật phẩm rồi nhận thư.`,
        slotCount: err.slotCount,
        maxSlots: err.maxSlots,
      });
    }
    if (err.code === 'PET_FULL') {
      return res.status(400).json({
        error: 'Kho pet đã đầy',
        message: `Kho pet đã đầy (${err.slotCount}/${err.maxSlots}). Hãy dọn bớt pet rồi nhận thư.`,
        slotCount: err.slotCount,
        maxSlots: err.maxSlots,
      });
    }
    if (err.code === 'SPIRIT_FULL') {
      return res.status(400).json({
        error: 'Kho linh thú đã đầy',
        message: `Kho linh thú đã đầy (${err.slotCount}/${err.maxSlots}). Hãy dọn bớt linh thú rồi nhận thư.`,
        slotCount: err.slotCount,
        maxSlots: err.maxSlots,
      });
    }
    res.status(500).json({ error: 'Lỗi khi claim mail' });
  }
});

// POST /api/mails/claim-all/:userId - Claim tất cả mail chưa claim
app.post('/api/mails/claim-all/:userId', async (req, res) => {
  const { userId } = req.params;
  const { userId: bodyUserId } = req.body;
  
  // Sử dụng userId từ body nếu có, không thì dùng params
  const targetUserId = bodyUserId || userId;

  try {
    // 1. Lấy tất cả mail chưa claim
    const [mails] = await db.query(`
      SELECT * FROM mails WHERE user_id = ? AND is_claimed = FALSE
    `, [targetUserId]);

    let totalPeta = 0;
    let totalPetaGold = 0;
    let itemGrantCount = 0;
    let spiritGrantCount = 0;
    let petGrantCount = 0;

    for (const mail of mails) {
      let rewards;
      try {
        if (typeof mail.attached_rewards === 'object') {
          rewards = mail.attached_rewards;
        } else {
          rewards = JSON.parse(mail.attached_rewards || '{}');
        }
      } catch (error) {
        console.error('Error parsing rewards for mail:', mail.id, error);
        rewards = {};
      }
      const isUserMail =
        String(mail.sender_type || '').toLowerCase() === 'user' &&
        mail.sender_id != null &&
        Number(mail.sender_id) > 0;
      if (rewards.peta && !isUserMail) totalPeta += rewards.peta;
      if (rewards.peta_gold && !isUserMail) totalPetaGold += rewards.peta_gold;
      if (rewards.items?.length) itemGrantCount += rewards.items.length;
      if (rewards.spirits?.length) spiritGrantCount += rewards.spirits.length;
      if (rewards.pets?.length) petGrantCount += rewards.pets.length;
      if (rewards.auction_transfer_pet_ids?.length) petGrantCount += rewards.auction_transfer_pet_ids.length;
      if (rewards.auction_transfer_spirit_ids?.length) spiritGrantCount += rewards.auction_transfer_spirit_ids.length;

      await applyMailAttachedRewards(mail, targetUserId);
      await db.query(`UPDATE mails SET is_claimed = TRUE WHERE id = ?`, [mail.id]);
    }

    res.json({
      success: true,
      message: `Claim thành công ${mails.length} mail!`,
      totalPeta,
      totalPetaGold,
      totalItems: itemGrantCount,
      totalSpirits: spiritGrantCount,
      totalPets: petGrantCount,
    });

  } catch (err) {
    console.error('Lỗi khi claim all mail:', err);
    if (err.code === 'INVENTORY_FULL') {
      return res.status(400).json({
        error: 'Túi đồ đã đầy',
        message: `Túi đồ đã đầy (${err.slotCount}/${err.maxSlots}). Hãy dọn bớt vật phẩm rồi nhận thư.`,
        slotCount: err.slotCount,
        maxSlots: err.maxSlots,
      });
    }
    if (err.code === 'PET_FULL') {
      return res.status(400).json({
        error: 'Kho pet đã đầy',
        message: `Kho pet đã đầy (${err.slotCount}/${err.maxSlots}). Hãy dọn bớt pet rồi nhận thư.`,
        slotCount: err.slotCount,
        maxSlots: err.maxSlots,
      });
    }
    if (err.code === 'SPIRIT_FULL') {
      return res.status(400).json({
        error: 'Kho linh thú đã đầy',
        message: `Kho linh thú đã đầy (${err.slotCount}/${err.maxSlots}). Hãy dọn bớt linh thú rồi nhận thư.`,
        slotCount: err.slotCount,
        maxSlots: err.maxSlots,
      });
    }
    res.status(500).json({ error: 'Lỗi khi claim tất cả mail' });
  }
});

// PUT /api/mails/:mailId/read - Đánh dấu đã đọc
app.put('/api/mails/:mailId/read', async (req, res) => {
  const { mailId } = req.params;
  const { userId } = req.body;

  try {
    const result = await db.query(`
      UPDATE mails SET is_read = TRUE 
      WHERE id = ? AND user_id = ?
    `, [mailId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mail không tồn tại' });
    }

    res.json({ success: true, message: 'Đã đánh dấu đọc' });
  } catch (err) {
    console.error('Lỗi khi đánh dấu đọc:', err);
    res.status(500).json({ error: 'Lỗi khi đánh dấu đọc' });
  }
});

// DELETE /api/mails/:mailId - Xóa mail
app.delete('/api/mails/:mailId', async (req, res) => {
  const { mailId } = req.params;
  const { userId } = req.body;

  try {
    const result = await db.query(`
      DELETE FROM mails WHERE id = ? AND user_id = ?
    `, [mailId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mail không tồn tại' });
    }

    res.json({ success: true, message: 'Đã xóa mail' });
  } catch (err) {
    console.error('Lỗi khi xóa mail:', err);
    res.status(500).json({ error: 'Lỗi khi xóa mail' });
  }
});

// GET /api/mails/:userId/unread-count - Đếm mail chưa đọc
app.get('/api/mails/:userId/unread-count', async (req, res) => {
  const { userId } = req.params;

  try {
    const [result] = await db.query(`
      SELECT 
        COUNT(*) as total_unread,
        COUNT(CASE WHEN is_claimed = FALSE THEN 1 END) as unclaimed_count
      FROM mails 
      WHERE user_id = ? AND is_read = FALSE
    `, [userId]);

    res.json({
      unread_count: result[0].total_unread,
      unclaimed_count: result[0].unclaimed_count
    });
  } catch (err) {
    console.error('Lỗi khi đếm mail:', err);
    res.status(500).json({ error: 'Lỗi khi đếm mail' });
  }
});

// ======================================================== ADMIN MAIL APIs ========================================================

// POST /api/admin/mails/send - Admin gửi mail
app.post('/api/admin/mails/send', async (req, res) => {
  const { 
    user_id, 
    sender_name, 
    subject, 
    message, 
    attached_rewards,
    expire_days = 30 
  } = req.body;

  try {
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expire_days);

    const rewardsJson = attached_rewards ? JSON.stringify(attached_rewards) : null;
    
    await db.query(`
      INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
      VALUES (?, 'admin', ?, ?, ?, ?, ?)
    `, [user_id, sender_name, subject, message, rewardsJson, expireAt]);

    res.json({ success: true, message: 'Gửi mail thành công!' });
  } catch (err) {
    console.error('Lỗi khi gửi mail:', err);
    res.status(500).json({ error: 'Lỗi khi gửi mail' });
  }
});

// ======================================================== MAIL CLEANUP ========================================================

// Auto cleanup expired mails (có thể chạy bằng cron job)
app.post('/api/admin/mails/cleanup', async (req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM mails 
      WHERE expire_at < NOW() 
      OR (is_read = TRUE AND is_claimed = TRUE AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
    `);

    res.json({ 
      success: true, 
      message: `Đã xóa ${result.affectedRows} mail`,
      deleted_count: result.affectedRows
    });
  } catch (err) {
    console.error('Lỗi khi cleanup mail:', err);
    res.status(500).json({ error: 'Lỗi khi cleanup mail' });
  }
});

// ======================================================== ADMIN PETS API ========================================================

// GET /api/admin/pets - Lấy danh sách tất cả pets cho admin
app.get('/api/admin/pets', async (req, res) => {
  try {
    const [pets] = await db.query(`
      SELECT p.*, ps.name as species_name
      FROM pets p
      LEFT JOIN pet_species ps ON p.species_id = ps.id
      ORDER BY p.level DESC, p.name ASC
    `);

    res.json(pets);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách pets:', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách pets' });
  }
});

// ======================================================== SPIRIT SYSTEM APIs ========================================================

// GET /api/spirits - Lấy danh sách tất cả Linh Thú
app.get('/api/spirits', async (req, res) => {
  try {
    const [spirits] = await db.query(`
      SELECT s.*, 
             COUNT(ss.id) as stats_count
      FROM spirits s
      LEFT JOIN spirit_stats ss ON s.id = ss.spirit_id
      GROUP BY s.id
      ORDER BY s.rarity DESC, s.name ASC
    `);

    // Lấy stats cho từng spirit
    for (let spirit of spirits) {
      const [stats] = await db.query(`
        SELECT stat_type, stat_value, stat_modifier
        FROM spirit_stats 
        WHERE spirit_id = ?
        ORDER BY stat_type
      `, [spirit.id]);
      spirit.stats = stats;
    }

    res.json(spirits);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách spirits:', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách spirits' });
  }
});

// GET /api/users/:userId/spirits - Lấy Linh Thú của user
app.get('/api/users/:userId/spirits', async (req, res) => {
  const { userId } = req.params;
  /** Luôn ẩn linh thú đang treo đấu giá. */
  const hideListedSql = ` AND COALESCE(us.is_listed, 0) = 0`;
  const auctionEligible = String(req.query.auction_eligible || '') === '1';
  const auctionEligibleExtraSql = auctionEligible
    ? ` AND us.equipped_pet_id IS NULL
        AND (us.is_equipped = 0 OR us.is_equipped IS NULL)`
    : '';

  try {
    const [userSpirits] = await db.query(`
      SELECT us.*, s.name, s.description, s.image_url, s.rarity, s.max_stats_count,
             p.name as equipped_pet_name
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      LEFT JOIN pets p ON us.equipped_pet_id = p.id
      WHERE us.user_id = ?
      ${hideListedSql}
      ${auctionEligibleExtraSql}
      ORDER BY us.is_equipped DESC, s.rarity DESC, s.name ASC
    `, [userId]);

    // Lấy stats cho từng spirit
    for (let userSpirit of userSpirits) {
      const [stats] = await db.query(`
        SELECT stat_type, stat_value, stat_modifier
        FROM spirit_stats 
        WHERE spirit_id = ?
        ORDER BY stat_type
      `, [userSpirit.spirit_id]);
      userSpirit.stats = stats;
    }

    const [cntRows] = await db.query(
      'SELECT COUNT(*) AS c FROM user_spirits WHERE user_id = ?',
      [userId]
    );
    const slotCount = Number(cntRows[0]?.c) || userSpirits.length;

    res.json({
      spirits: userSpirits,
      slotCount,
      maxSlots: SPIRIT_MAX_SLOTS,
      freeSlots: Math.max(0, SPIRIT_MAX_SLOTS - slotCount),
    });
  } catch (err) {
    console.error('Lỗi khi lấy spirits của user:', err);
    res.status(500).json({ error: 'Lỗi khi lấy spirits của user' });
  }
});

// GET /api/pets/:petId/spirits - Lấy Linh Thú đang trang bị của pet
app.get('/api/pets/:petId/spirits', async (req, res) => {
  const { petId } = req.params;
  
  try {
    const [equippedSpirits] = await db.query(`
      SELECT us.*, s.name, s.description, s.image_url, s.rarity, s.max_stats_count
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      WHERE us.equipped_pet_id = ? AND us.is_equipped = 1
      ORDER BY s.rarity DESC, s.name ASC
    `, [petId]);

    // Lấy stats cho từng spirit
    for (let spirit of equippedSpirits) {
      const [stats] = await db.query(`
        SELECT stat_type, stat_value, stat_modifier
        FROM spirit_stats 
        WHERE spirit_id = ?
        ORDER BY stat_type
      `, [spirit.spirit_id]);
      spirit.stats = stats;
    }

    res.json(equippedSpirits);
  } catch (err) {
    console.error('Lỗi khi lấy spirits của pet:', err);
    res.status(500).json({ error: 'Lỗi khi lấy spirits của pet' });
  }
});

// POST /api/spirits/equip - Trang bị Linh Thú cho pet
app.post('/api/spirits/equip', async (req, res) => {
  const { userSpiritId, petId } = req.body;
  
  try {
    // Kiểm tra xem pet có phải của user không
    const [petCheck] = await db.query(`
      SELECT owner_id FROM pets WHERE id = ?
    `, [petId]);
    
    if (petCheck.length === 0) {
      return res.status(404).json({ error: 'Pet không tồn tại' });
    }

    // Kiểm tra xem user spirit có tồn tại và thuộc về user không
    const [userSpiritCheck] = await db.query(`
      SELECT us.*, s.max_stats_count,
             (SELECT COUNT(*) FROM user_spirits WHERE equipped_pet_id = ? AND is_equipped = 1) as current_spirits_count
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      WHERE us.id = ? AND us.user_id = ?
    `, [petId, userSpiritId, petCheck[0].owner_id]);

    if (userSpiritCheck.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại hoặc không thuộc về bạn' });
    }

    const spirit = userSpiritCheck[0];
    
    // Kiểm tra giới hạn số lượng spirits (tối đa 4)
    if (spirit.current_spirits_count >= 4) {
      return res.status(400).json({ error: 'Pet đã trang bị tối đa 4 Linh Thú' });
    }

    // Kiểm tra xem spirit đã được trang bị chưa
    if (spirit.is_equipped) {
      return res.status(400).json({ error: 'Linh Thú này đã được trang bị' });
    }

    // Trang bị spirit
    await db.query(`
      UPDATE user_spirits 
      SET equipped_pet_id = ?, is_equipped = 1
      WHERE id = ?
    `, [petId, userSpiritId]);

    // ✅ Cập nhật pet stats sau khi equip spirit
    await db.query('CALL recalculate_pet_stats(?)', [petId]);

    res.json({ 
      success: true, 
      message: 'Trang bị Linh Thú thành công!',
      spirit_id: spirit.spirit_id
    });
  } catch (err) {
    console.error('Lỗi khi trang bị spirit:', err);
    res.status(500).json({ error: 'Lỗi khi trang bị spirit' });
  }
});

// POST /api/spirits/unequip - Tháo Linh Thú khỏi pet
app.post('/api/spirits/unequip', async (req, res) => {
  const { userSpiritId } = req.body;
  
  try {
    // Kiểm tra xem user spirit có tồn tại và đang được trang bị không
    const [userSpiritCheck] = await db.query(`
      SELECT * FROM user_spirits WHERE id = ? AND is_equipped = 1
    `, [userSpiritId]);

    if (userSpiritCheck.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại hoặc chưa được trang bị' });
    }

    const petId = userSpiritCheck[0].equipped_pet_id;

    if (petId != null) {
      const c = await db.getConnection();
      try {
        await normalizePetCurrentHp(c, petId);
      } finally {
        c.release();
      }
    }

    // Tháo spirit
    await db.query(`
      UPDATE user_spirits 
      SET equipped_pet_id = NULL, is_equipped = 0
      WHERE id = ?
    `, [userSpiritId]);

    // ✅ Cập nhật pet stats sau khi unequip spirit
    await db.query('CALL recalculate_pet_stats(?)', [petId]);

    if (petId != null) {
      const c2 = await db.getConnection();
      try {
        await normalizePetCurrentHp(c2, petId);
      } finally {
        c2.release();
      }
    }

    res.json({ 
      success: true, 
      message: 'Tháo Linh Thú thành công!',
      spirit_id: userSpiritCheck[0].spirit_id
    });
  } catch (err) {
    console.error('Lỗi khi tháo spirit:', err);
    res.status(500).json({ error: 'Lỗi khi tháo spirit' });
  }
});

// POST /api/spirits/claim - Nhận Linh Thú (từ shop, mail, etc.)
app.post('/api/spirits/claim', async (req, res) => {
  const { userId, spiritId } = req.body;
  
  try {
    // Kiểm tra xem spirit có tồn tại không
    const [spiritCheck] = await db.query(`
      SELECT * FROM spirits WHERE id = ?
    `, [spiritId]);

    if (spiritCheck.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại' });
    }

    // Kiểm tra xem user đã có spirit này chưa
    const [existingSpirit] = await db.query(`
      SELECT * FROM user_spirits WHERE user_id = ? AND spirit_id = ?
    `, [userId, spiritId]);

    if (existingSpirit.length > 0) {
      return res.status(400).json({ error: 'Bạn đã sở hữu Linh Thú này rồi' });
    }

    const spiritCap = await getSpiritCapacity(db, userId);
    if (spiritCap.freeSlots < 1) {
      return res.status(400).json({
        error: 'Kho linh thú đã đầy',
        message: `Kho linh thú đã đầy (${spiritCap.slotCount}/${spiritCap.maxSlots}).`,
        slotCount: spiritCap.slotCount,
        maxSlots: spiritCap.maxSlots,
      });
    }

    // Thêm spirit cho user
    await db.query(`
      INSERT INTO user_spirits (user_id, spirit_id, is_equipped, equipped_pet_id)
      VALUES (?, ?, 0, NULL)
    `, [userId, spiritId]);

    res.json({ 
      success: true, 
      message: 'Nhận Linh Thú thành công!',
      spirit_id: spiritId
    });
  } catch (err) {
    console.error('Lỗi khi nhận spirit:', err);
    res.status(500).json({ error: 'Lỗi khi nhận spirit' });
  }
});

// ======================================================== ADMIN SPIRIT APIs ========================================================

// GET /api/admin/spirits - Danh sách Linh Thú cho admin (kèm stats)
app.get('/api/admin/spirits', checkAdminRoleNpc, async (req, res) => {
  try {
    const [spirits] = await db.query(`
      SELECT s.*, COUNT(ss.id) AS stats_count
      FROM spirits s
      LEFT JOIN spirit_stats ss ON s.id = ss.spirit_id
      GROUP BY s.id
      ORDER BY s.id
    `);
    for (const spirit of spirits) {
      const [stats] = await db.query(
        'SELECT stat_type, stat_value, stat_modifier FROM spirit_stats WHERE spirit_id = ? ORDER BY stat_type',
        [spirit.id]
      );
      spirit.stats = stats;
    }
    res.json(spirits);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách spirits (admin):', err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách spirits' });
  }
});

// POST /api/admin/spirits - Tạo Linh Thú mới
app.post('/api/admin/spirits', checkAdminRoleNpc, async (req, res) => {
  const { name, description, image_url, rarity, max_stats_count, stats } = req.body;
  
  try {
    // Tạo spirit mới
    const [result] = await db.query(`
      INSERT INTO spirits (name, description, image_url, rarity, max_stats_count)
      VALUES (?, ?, ?, ?, ?)
    `, [name, description, image_url, rarity, max_stats_count]);

    const spiritId = result.insertId;

    // Thêm stats cho spirit
    if (stats && Array.isArray(stats)) {
      for (let stat of stats) {
        await db.query(`
          INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier)
          VALUES (?, ?, ?, ?)
        `, [spiritId, stat.stat_type, stat.stat_value, stat.stat_modifier || 'flat']);
      }
    }

    res.json({ 
      success: true, 
      message: 'Tạo Linh Thú thành công!',
      spirit_id: spiritId
    });
  } catch (err) {
    console.error('Lỗi khi tạo spirit:', err);
    res.status(500).json({ error: 'Lỗi khi tạo spirit' });
  }
});

// PUT /api/admin/spirits/:id - Cập nhật Linh Thú
app.put('/api/admin/spirits/:id', checkAdminRoleNpc, async (req, res) => {
  const { id } = req.params;
  const { name, description, image_url, rarity, max_stats_count, stats } = req.body;
  
  try {
    // Cập nhật thông tin cơ bản
    await db.query(`
      UPDATE spirits 
      SET name = ?, description = ?, image_url = ?, rarity = ?, max_stats_count = ?
      WHERE id = ?
    `, [name, description, image_url, rarity, max_stats_count, id]);

    // Xóa stats cũ và thêm stats mới
    await db.query(`DELETE FROM spirit_stats WHERE spirit_id = ?`, [id]);

    if (stats && Array.isArray(stats)) {
      for (let stat of stats) {
        await db.query(`
          INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier)
          VALUES (?, ?, ?, ?)
        `, [id, stat.stat_type, stat.stat_value, stat.stat_modifier || 'flat']);
      }
    }

    res.json({ 
      success: true, 
      message: 'Cập nhật Linh Thú thành công!',
      spirit_id: id
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật spirit:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật spirit' });
  }
});

// DELETE /api/admin/spirits/:id - Xóa Linh Thú
app.delete('/api/admin/spirits/:id', checkAdminRoleNpc, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Kiểm tra xem có user nào đang sở hữu spirit này không
    const [userSpirits] = await db.query(`
      SELECT COUNT(*) as count FROM user_spirits WHERE spirit_id = ?
    `, [id]);

    if (userSpirits[0].count > 0) {
      return res.status(400).json({ 
        error: 'Không thể xóa Linh Thú này vì có người chơi đang sở hữu' 
      });
    }

    // Xóa stats trước
    await db.query(`DELETE FROM spirit_stats WHERE spirit_id = ?`, [id]);
    
    // Xóa spirit
    await db.query(`DELETE FROM spirits WHERE id = ?`, [id]);

    res.json({ 
      success: true, 
      message: 'Xóa Linh Thú thành công!'
    });
  } catch (err) {
    console.error('Lỗi khi xóa spirit:', err);
    res.status(500).json({ error: 'Lỗi khi xóa spirit' });
  }
});

// GET /api/admin/spirits/:id - Lấy chi tiết Linh Thú cho admin
app.get('/api/admin/spirits/:id', checkAdminRoleNpc, async (req, res) => {
  const { id } = req.params;
  
  try {
    const [spirits] = await db.query(`
      SELECT * FROM spirits WHERE id = ?
    `, [id]);

    if (spirits.length === 0) {
      return res.status(404).json({ error: 'Linh Thú không tồn tại' });
    }

    const spirit = spirits[0];

    // Lấy stats
    const [stats] = await db.query(`
      SELECT stat_type, stat_value, stat_modifier
      FROM spirit_stats 
      WHERE spirit_id = ?
      ORDER BY stat_type
    `, [id]);

    spirit.stats = stats;

    res.json(spirit);
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết spirit:', err);
    res.status(500).json({ error: 'Lỗi khi lấy chi tiết spirit' });
  }
});

// GET /api/admin/spirits/csv - Tải CSV spirits
app.get('/api/admin/spirits/csv', checkAdminRoleNpc, async (req, res) => {
  try {
    const [spirits] = await db.query('SELECT * FROM spirits ORDER BY id');
    const headers = ['id', 'name', 'description', 'image_url', 'rarity', 'max_stats_count', 'stats_json'];
    const lines = [headers.join(',')];
    for (const spirit of spirits) {
      const [stats] = await db.query(
        'SELECT stat_type, stat_value, stat_modifier FROM spirit_stats WHERE spirit_id = ? ORDER BY stat_type',
        [spirit.id]
      );
      const row = {
        ...spirit,
        stats_json: JSON.stringify(stats || []),
      };
      lines.push(headers.map((h) => escapeCSV(row[h])).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=spirits.csv');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// POST /api/admin/spirits/csv - Upload CSV spirits
app.post('/api/admin/spirits/csv', checkAdminRoleNpc, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: 'Thiếu file CSV' });
    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);
    const required = ['name', 'image_url'];
    const h = headers.map((x) => x.toLowerCase().trim());
    if (!required.every((k) => h.includes(k))) return res.status(400).json({ message: 'CSV thiếu cột: ' + required.join(', ') });
    let updated = 0;
    let inserted = 0;

    for (const row of rows) {
      const o = {};
      headers.forEach((col, i) => { o[col.toLowerCase().trim()] = row[i]; });
      const idRaw = o.id != null && String(o.id).trim() !== '' ? parseInt(o.id, 10) : null;
      const id = idRaw != null && !isNaN(idRaw) ? idRaw : null;
      const maxStatsCount = o.max_stats_count != null && o.max_stats_count !== '' ? parseInt(o.max_stats_count, 10) : 2;
      let stats = [];
      if (o.stats_json && String(o.stats_json).trim()) {
        try {
          const parsed = JSON.parse(o.stats_json);
          if (Array.isArray(parsed)) stats = parsed;
        } catch (_) {}
      }

      let doUpdate = false;
      if (id != null) {
        const [ex] = await db.query('SELECT 1 FROM spirits WHERE id = ? LIMIT 1', [id]);
        doUpdate = ex && ex.length > 0;
      }

      let spiritId = id;
      if (doUpdate) {
        await db.query(
          'UPDATE spirits SET name=?, description=?, image_url=?, rarity=?, max_stats_count=? WHERE id=?',
          [o.name ?? '', o.description ?? '', o.image_url ?? '', o.rarity ?? 'common', isNaN(maxStatsCount) ? 2 : maxStatsCount, id]
        );
        await db.query('DELETE FROM spirit_stats WHERE spirit_id = ?', [id]);
        updated++;
      } else {
        const [ins] = await db.query(
          'INSERT INTO spirits (name, description, image_url, rarity, max_stats_count) VALUES (?, ?, ?, ?, ?)',
          [o.name ?? '', o.description ?? '', o.image_url ?? '', o.rarity ?? 'common', isNaN(maxStatsCount) ? 2 : maxStatsCount]
        );
        spiritId = ins.insertId;
        inserted++;
      }

      if (Array.isArray(stats)) {
        for (const stat of stats) {
          await db.query(
            'INSERT INTO spirit_stats (spirit_id, stat_type, stat_value, stat_modifier) VALUES (?, ?, ?, ?)',
            [
              spiritId,
              stat.stat_type ?? 'hp',
              stat.stat_value != null && !isNaN(Number(stat.stat_value)) ? Number(stat.stat_value) : 0,
              stat.stat_modifier === 'percentage' ? 'percentage' : 'flat',
            ]
          );
        }
      }
    }

    res.json({ success: true, updated, inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// ======================================================== SPIRIT STATS CALCULATION ========================================================

// Hàm tính toán stats từ spirits cho pet
async function calculateSpiritStats(petId) {
  try {
    const [equippedSpirits] = await db.query(`
      SELECT us.spirit_id, ss.stat_type, ss.stat_value, ss.stat_modifier
      FROM user_spirits us
      JOIN spirit_stats ss ON us.spirit_id = ss.spirit_id
      WHERE us.equipped_pet_id = ? AND us.is_equipped = 1
    `, [petId]);

    const spiritStats = {
      hp: 0,
      mp: 0,
      str: 0,
      def: 0,
      spd: 0,
      intelligence: 0
    };

    for (let spiritStat of equippedSpirits) {
      const statType = spiritStat.stat_type;
      const value = spiritStat.stat_value;
      const modifier = spiritStat.stat_modifier;

      if (modifier === 'percentage') {
        // Percentage modifier sẽ được tính sau khi có base stats
        spiritStats[`${statType}_percent`] = (spiritStats[`${statType}_percent`] || 0) + value;
      } else {
        // Flat modifier
        spiritStats[statType] += value;
      }
    }

    return spiritStats;
  } catch (err) {
    console.error('Lỗi khi tính toán spirit stats:', err);
    return {
      hp: 0, mp: 0, str: 0, def: 0, spd: 0, intelligence: 0
    };
  }
}

// Export function để sử dụng trong battle engine
module.exports = {
  calculateSpiritStats
};


// Trong server.js - Thêm API mới để lấy battle stats
app.get('/api/pets/:petId/battle-stats', async (req, res) => {
  const { petId } = req.params;
  
  try {
    // Lấy pet data với stats đã được tính toán (cached)
    const [petRows] = await db.query(`
      SELECT p.*, ps.name as species_name, ps.image
      FROM pets p
      JOIN pet_species ps ON p.pet_species_id = ps.id
      WHERE p.id = ?
    `, [petId]);
    
    if (!petRows.length) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    const pet = petRows[0];
    
    // Lấy equipment (chỉ để hiển thị, không tính vào stats)
    const [equipmentRows] = await db.query(`
      SELECT i.id, i.item_id, it.name AS item_name, it.image_url, i.durability_left,
             ed.equipment_type, ed.magic_value AS power, ed.durability_max AS max_durability, ed.durability_mode, i.is_broken
      FROM inventory i
      JOIN items it ON i.item_id = it.id
      LEFT JOIN equipment_data ed ON it.id = ed.item_id
      WHERE i.equipped_pet_id = ? AND i.is_equipped = 1 AND i.is_broken = 0
    `, [petId]);
    
    // Lấy spirits
    const [spiritRows] = await db.query(`
      SELECT us.*, s.name, s.description, s.image_url, s.rarity
      FROM user_spirits us
      JOIN spirits s ON us.spirit_id = s.id
      WHERE us.equipped_pet_id = ? AND us.is_equipped = 1
    `, [petId]);
    
    // Base stats: ưu tiên final_stats (JSON) trong DB, fallback sang cột hp/str/def...
    let baseStats = { hp: pet.hp, mp: pet.mp, str: pet.str, def: pet.def, spd: pet.spd, intelligence: pet.intelligence };
    if (pet.final_stats) {
      try {
        const parsed = typeof pet.final_stats === 'string' ? JSON.parse(pet.final_stats) : pet.final_stats;
        if (parsed && typeof parsed === 'object') {
          baseStats = {
            hp: parsed.hp ?? baseStats.hp,
            mp: parsed.mp ?? baseStats.mp,
            str: parsed.str ?? baseStats.str,
            def: parsed.def ?? baseStats.def,
            spd: parsed.spd ?? baseStats.spd,
            intelligence: parsed.intelligence ?? baseStats.intelligence,
          };
        }
      } catch (_) {}
    }
    // Cộng bonus từ linh thú (spirit) để ra battle stats dùng trong trận đấu
    const spiritBonus = await calculateSpiritStats(petId);
    const statKeys = ['hp', 'mp', 'str', 'def', 'spd', 'intelligence'];
    const battleStats = {};
    for (const key of statKeys) {
      const base = Number(baseStats[key]) || 0;
      const flat = Number(spiritBonus[key]) || 0;
      const pct = Number(spiritBonus[`${key}_percent`]) || 0;
      battleStats[key] = Math.max(0, Math.floor(base + flat + (base * pct / 100)));
    }
    
    res.json({
      pet: { ...pet, final_stats: battleStats },
      equipment: equipmentRows,
      spirits: spiritRows,
      battle_stats: battleStats
    });
    
  } catch (err) {
    console.error('Error getting battle stats:', err);
    res.status(500).json({ message: 'Error getting battle stats' });
  }
});


async function handleEvolveItemUse(dbConn, petId, userId, targetSpeciesId) {
  const tid = parseInt(targetSpeciesId, 10);
  if (!tid || Number.isNaN(tid)) {
    const err = new Error('ID loài đích không hợp lệ');
    err.code = 'EVOLVE_INVALID';
    throw err;
  }

  const [pRows] = await dbConn.query('SELECT * FROM pets WHERE id = ? AND owner_id = ?', [petId, userId]);
  if (!pRows.length) {
    const err = new Error('Không tìm thấy pet');
    err.code = 'EVOLVE_INVALID';
    throw err;
  }
  const pet = pRows[0];

  const [sRows] = await dbConn.query('SELECT id, evolve_to FROM pet_species WHERE id = ?', [pet.pet_species_id]);
  if (!sRows.length) {
    const err = new Error('Loài hiện tại không hợp lệ');
    err.code = 'EVOLVE_INVALID';
    throw err;
  }

  const ev = sRows[0].evolve_to;
  let allowed = true;
  if (ev != null && String(ev).trim() !== '') {
    try {
      const arr = typeof ev === 'string' ? JSON.parse(ev) : ev;
      if (Array.isArray(arr) && arr.length) {
        const ids = arr.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n));
        allowed = ids.includes(tid);
      }
    } catch (_) {
      allowed = true;
    }
  }
  if (!allowed) {
    const err = new Error('Loài đích không nằm trong chuỗi tiến hóa của pet');
    err.code = 'EVOLVE_INVALID';
    throw err;
  }

  const [tRows] = await dbConn.query('SELECT id FROM pet_species WHERE id = ?', [tid]);
  if (!tRows.length) {
    const err = new Error('Loài đích không tồn tại');
    err.code = 'EVOLVE_INVALID';
    throw err;
  }

  await dbConn.query('UPDATE pets SET pet_species_id = ?, evolution_stage = 1 WHERE id = ?', [tid, petId]);
  await refreshPetIntrinsicStats(dbConn, petId);
  await titleService.recordPetEvolution(dbConn, userId, 1);
}

// Sử dụng vật phẩm
app.post('/api/pets/:petId/use-item', async (req, res) => {
  const { petId } = req.params;
  const { item_id, quantity = 1, userId } = req.body;

  try {
    // 1. Kiểm tra pet thuộc về user
    const [petRows] = await db.query('SELECT * FROM pets WHERE id = ? AND owner_id = ?', [petId, userId]);
    if (!petRows.length) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // 2. Kiểm tra inventory có item không
    const [inventoryRows] = await db.query('SELECT * FROM inventory WHERE player_id = ? AND item_id = ? AND quantity >= ?', 
      [userId, item_id, quantity]);
    if (!inventoryRows.length) {
      return res.status(400).json({ message: 'Not enough items' });
    }

    // 3. Lấy thông tin item và effect
    const [itemRows] = await db.query('SELECT * FROM items WHERE id = ?', [item_id]);
    const [effectRows] = await db.query('SELECT * FROM item_effects WHERE item_id = ?', [item_id]);

    if (!itemRows.length) {
      return res.status(400).json({ message: 'Invalid item' });
    }

    const itemRow = itemRows[0];
    let normalizedEffect = null;
    let levelUpResult = null;

    if (itemRow.type === 'evolve') {
      const rawMv = itemRow.magic_value;
      let target =
        rawMv != null && rawMv !== ''
          ? parseInt(rawMv, 10)
          : NaN;
      if (Number.isNaN(target) && effectRows.length) {
        target = parseInt(effectRows[0].value_min, 10);
      }
      if (!target || Number.isNaN(target)) {
        return res.status(400).json({
          message: 'Vật phẩm tiến hóa cần magic_value hoặc item_effects.value_min = id loài đích.',
        });
      }
      try {
        await handleEvolveItemUse(db, petId, userId, target);
      } catch (e) {
        const code = e.code === 'EVOLVE_INVALID' ? 400 : 500;
        return res.status(code).json({ message: e.message || 'Không thể tiến hóa' });
      }
    } else {
      if (effectRows.length) {
        normalizedEffect = normalizeEffectRow(effectRows[0]);
      } else {
        const synthetic = buildSyntheticMedicineEffectFromItemRow(itemRows[0]);
        if (!synthetic) {
          return res.status(400).json({ message: 'Invalid item' });
        }
        normalizedEffect = synthetic;
      }

      if (itemRow.type === 'booster') {
        levelUpResult = await handleBoosterItem(petId, item_id, itemRow, normalizedEffect, quantity, userId);
      } else if (itemActsAsFoodForPetUse(itemRow) || itemActsAsToyForPetUse(itemRow)) {
        levelUpResult = await handleFoodItem(petId, item_id, itemRow, normalizedEffect, quantity, userId);
      } else if (itemRow.type === 'consumable' || itemRow.type === 'medicine') {
        levelUpResult = await handleConsumableItem(petId, item_id, itemRow, normalizedEffect, quantity, userId);
      }
    }

    // 5. Trừ item khỏi inventory
    await db.query('UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?', 
      [quantity, userId, item_id]);

    // 6. Xóa item nếu quantity <= 0
    const [checkResult] = await db.query('SELECT quantity FROM inventory WHERE player_id = ? AND item_id = ?', 
      [userId, item_id]);
    if (checkResult.length > 0 && checkResult[0].quantity <= 0) {
      await db.query('DELETE FROM inventory WHERE player_id = ? AND item_id = ? AND quantity <= 0', 
        [userId, item_id]);
    }

    if (itemRow.type === 'booster') {
      await refreshPetIntrinsicStats(db, petId);
    }

    res.json({ 
      message: itemRow.type === 'evolve' ? 'Tiến hóa thành công!' : 'Item used successfully',
      exp_gained: levelUpResult ? levelUpResult.exp_gained : (normalizedEffect && normalizedEffect.effect_target === 'exp' ? normalizedEffect.value_min * quantity : 0),
      level_up: levelUpResult ? levelUpResult.level_up : false,
      old_level: levelUpResult ? levelUpResult.old_level : null,
      new_level: levelUpResult ? levelUpResult.new_level : null,
      stats_updated: levelUpResult ? levelUpResult.stats_updated : false,
      new_stats: levelUpResult ? levelUpResult.new_stats : null
    });
  } catch (error) {
    console.error('Error using item:', error);
    const code = error && error.code;
    const msg = error && error.message;
    if (msg === 'Usage limit reached') {
      return res.status(400).json({ message: 'Usage limit reached' });
    }
    const boosterLimitMsgs = {
      BOOSTER_MEAN_LIMIT:
        'Một trong các chỉ số Tấn công / Phòng thủ / Trí tuệ / Tốc độ đã đạt giới hạn (không vượt quá 20% so với trung bình bốn chỉ số). Không thể dùng thêm vật phẩm tăng chỉ số này.',
      BOOSTER_ABS_CAP_CORE:
        'Chỉ số Sức mạnh / Phòng thủ / Tốc độ / Trí tuệ đã đạt giới hạn theo đẳng cấp thú cưng. Không thể dùng thêm.',
      BOOSTER_ABS_CAP_HP: 'Sinh mệnh đã đạt giới hạn theo đẳng cấp thú cưng. Không thể dùng thêm.',
      BOOSTER_ABS_CAP_MP: 'Năng lượng đã đạt giới hạn theo đẳng cấp thú cưng. Không thể dùng thêm.',
    };
    if (code && boosterLimitMsgs[code]) {
      return res.status(400).json({ message: boosterLimitMsgs[code] });
    }
    res.status(500).json({ message: 'Error using item' });
  }
});

// Helper functions
async function handleConsumableItem(petId, itemId, itemRow, effect, quantity, userId) {
  const normalizedTarget = normalizeEffectTarget(effect.effect_target);
  if (normalizedTarget === 'exp') {
    // Sử dụng logic level up có sẵn
    return await handleExpGainWithLevelUp(petId, effect.value_min * quantity);
  } else if (normalizedTarget === 'hp') {
    const [petHpRows] = await pool.promise().query(
      'SELECT max_hp, current_hp, hp FROM pets WHERE id = ? LIMIT 1',
      [petId]
    );
    const petHp = petHpRows[0] || { max_hp: 1 };
    const maxHp = Number(petHp.max_hp) || 1;
    const recoverHp =
      normalizeEffectType(effect.effect_type) === 'percent'
        ? resolveMedicineHpMpPercentRecovery(effect, quantity, maxHp, itemRow)
        : resolveEffectAmount(effect, quantity, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      `UPDATE pets SET current_hp = LEAST(COALESCE(max_hp, hp, 0), GREATEST(0, COALESCE(current_hp, hp, 0) + ?)) WHERE id = ?`,
      [recoverHp, petId]
    );
    return null;
  } else if (normalizedTarget === 'mp') {
    const [petMpRows] = await pool.promise().query('SELECT max_mp, mp FROM pets WHERE id = ? LIMIT 1', [petId]);
    const maxMp = Number(petMpRows[0]?.max_mp) || 1;
    const recoverMp =
      normalizeEffectType(effect.effect_type) === 'percent'
        ? resolveMedicineHpMpPercentRecovery(effect, quantity, maxMp, itemRow)
        : resolveEffectAmount(effect, quantity, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      'UPDATE pets SET mp = LEAST(COALESCE(max_mp, mp, 0), GREATEST(0, COALESCE(mp, 0) + ?)) WHERE id = ?',
      [recoverMp, petId]
    );
    return null;
  } else if (normalizedTarget === 'hunger') {
    const hungerAdd =
      effect.effect_type === 'percent'
        ? resolveVitalsStepsFromPercent(effect, quantity, itemRow, petVitals.HUNGER_MAX)
        : resolveEffectAmount(effect, quantity, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      `UPDATE pets SET hunger_status = LEAST(?, GREATEST(0, COALESCE(hunger_status, 0) + ?)),
         hunger_vitals_at = NOW() WHERE id = ?`,
      [petVitals.HUNGER_MAX, hungerAdd, petId]
    );
    return null;
  } else if (normalizedTarget === 'mood') {
    const moodAdd =
      effect.effect_type === 'percent'
        ? resolveVitalsStepsFromPercent(effect, quantity, itemRow, petVitals.MOOD_MAX)
        : resolveEffectAmount(effect, quantity, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      `UPDATE pets SET mood = LEAST(?, GREATEST(0, COALESCE(mood, 2) + ?)),
         mood_vitals_at = NOW() WHERE id = ?`,
      [petVitals.MOOD_MAX, moodAdd, petId]
    );
    return null;
  } else if (normalizedTarget === 'str' || normalizedTarget === 'def' || 
             normalizedTarget === 'spd' || normalizedTarget === 'intelligence') {
    if (!effect.is_permanent) return null;
    // Tăng stat tạm thời hoặc vĩnh viễn
    const statField = normalizedTarget;
    if (effect.effect_type === 'percent') {
      const pts = resolveTierPointsFromPercentEffect(effect, quantity);
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`, 
        [pts, petId]);
    } else if (effect.effect_type === 'flat') {
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`, 
        [effect.value_min, petId]);
    }
    await refreshPetIntrinsicStats(db, petId);
    return null;
  }
  return null;
}

/**
 * Giới hạn dùng cho pet (vd. tiến hóa). null / không hợp lệ = không giới hạn — chỉ bị giới hạn bởi số lượng túi đồ.
 * Lưu ý: so sánh `used_count >= null` trong JS coi null như 0 → lỗi chặn sai từ lần 2 nếu max_usage NULL trong DB.
 */
function resolveEffectMaxUsageCap(effect) {
  const raw = effect?.max_usage;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

async function handleBoosterItem(petId, itemId, itemRow, effect, quantity, userId) {
  const normalizedTarget = normalizeEffectTarget(effect.effect_target);
  const qty = Math.max(1, Number(quantity) || 1);
  const usageCap = resolveEffectMaxUsageCap(effect);

  const [usage] = await pool.promise().query('SELECT * FROM pet_item_usage WHERE pet_id = ? AND item_id = ?', [petId, itemId]);

  if (!usage.length) {
    await pool.promise().query(
      'INSERT INTO pet_item_usage (pet_id, item_id, used_count, max_usage) VALUES (?, ?, ?, ?)',
      [petId, itemId, qty, usageCap]
    );
  } else {
    const cap = resolveEffectMaxUsageCap({ max_usage: usage[0].max_usage });
    const prev = Number(usage[0].used_count) || 0;
    if (cap != null && prev + qty > cap) {
      throw new Error('Usage limit reached');
    }
    await pool.promise().query(
      'UPDATE pet_item_usage SET used_count = used_count + ?, last_used = NOW() WHERE id = ?',
      [qty, usage[0].id]
    );
  }

  if (normalizedTarget === 'exp') {
    const effType = normalizeEffectType(effect.effect_type);
    if (effType === 'percent') {
      const [expRows] = await pool.promise().query('SELECT current_exp FROM pets WHERE id = ?', [petId]);
      const cur = Number(expRows[0]?.current_exp) || 0;
      const expGain = resolveExpBoostPercentOfCurrent(effect, qty, cur, itemRow);
      return await handleExpGainWithLevelUp(petId, expGain);
    }
    return await handleExpGainWithLevelUp(petId, resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true }));
  }

  if (!effect.is_permanent) return null;

  if (effect.effect_type === 'percent' && ['hp', 'mp', 'str', 'def', 'spd', 'intelligence'].includes(normalizedTarget)) {
    const magic = resolveEffectMagicValue(effect, itemRow);
    await applyBoosterCompoundPercent(db, petId, normalizedTarget, magic, qty);
    return;
  }

  if (['hp', 'mp', 'str', 'def', 'spd', 'intelligence'].includes(normalizedTarget) && effect.effect_type === 'flat') {
    const flatAmt = resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true });
    await applyBoosterFlat(db, petId, normalizedTarget, flatAmt);
  }
  return null;
}

async function handleFoodItem(petId, itemId, itemRow, effect, quantity, userId) {
  const normalizedTarget = normalizeEffectTarget(effect.effect_target);
  const qty = Math.max(1, Number(quantity) || 1);
  const magic = resolveEffectMagicValue(effect, itemRow);
  const tierMul = Math.max(1, Number(effect.value_min) || 1);

  // Thức ăn + hunger: Tình trạng (0–9) — percent / flat / mặc định theo ma thuật × value_min (tier)
  if (itemActsAsFoodForPetUse(itemRow) && normalizedTarget === 'hunger') {
    let gain;
    if (effect.effect_type === 'percent') {
      gain = resolveVitalsStepsFromPercent(effect, qty, itemRow, petVitals.HUNGER_MAX);
    } else if (effect.effect_type === 'flat') {
      const raw = resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true });
      gain = Math.min(petVitals.HUNGER_MAX * qty, Math.max(0, Math.floor(raw)));
    } else {
      const perUse = petVitals.hungerRecoveryStepsFromMagic(magic);
      gain = Math.min(
        petVitals.HUNGER_MAX,
        Math.floor(perUse * tierMul * qty)
      );
    }
    await pool.promise().query(
      `UPDATE pets SET hunger_status = LEAST(?, GREATEST(0, COALESCE(hunger_status, 0) + ?)),
         hunger_battles = 0, hunger_vitals_at = NOW() WHERE id = ?`,
      [petVitals.HUNGER_MAX, gain, petId]
    );
    return null;
  }

  // Đồ chơi + mood: Tâm trạng (0–4) — percent / flat / mặc định theo ma thuật (tương tự food)
  if (itemActsAsToyForPetUse(itemRow) && normalizedTarget === 'mood') {
    let gain;
    if (effect.effect_type === 'percent') {
      gain = resolveVitalsStepsFromPercent(effect, qty, itemRow, petVitals.MOOD_MAX);
    } else if (effect.effect_type === 'flat') {
      const raw = resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true });
      gain = Math.min(petVitals.MOOD_MAX * qty, Math.max(0, Math.floor(raw)));
    } else {
      const perUse = petVitals.moodRecoveryStepsFromMagic(magic);
      gain = Math.min(
        petVitals.MOOD_MAX,
        Math.floor(perUse * tierMul * qty)
      );
    }
    await pool.promise().query(
      `UPDATE pets SET mood = LEAST(?, GREATEST(0, COALESCE(mood, 2) + ?)),
         mood_vitals_at = NOW() WHERE id = ?`,
      [petVitals.MOOD_MAX, gain, petId]
    );
    return null;
  }

  if (normalizedTarget === 'exp') {
    return await handleExpGainWithLevelUp(petId, effect.value_min * qty);
  } else if (normalizedTarget === 'hp') {
    const [petHpRows] = await pool.promise().query(
      'SELECT max_hp, current_hp, hp FROM pets WHERE id = ? LIMIT 1',
      [petId]
    );
    const maxHp = Number(petHpRows[0]?.max_hp) || 1;
    const recoverHp =
      normalizeEffectType(effect.effect_type) === 'percent'
        ? resolveMedicineHpMpPercentRecovery(effect, qty, maxHp, itemRow)
        : resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      `UPDATE pets SET current_hp = LEAST(COALESCE(max_hp, hp, 0), GREATEST(0, COALESCE(current_hp, hp, 0) + ?)) WHERE id = ?`,
      [recoverHp, petId]
    );
    return null;
  } else if (normalizedTarget === 'mp') {
    const [petMpRows] = await pool.promise().query('SELECT max_mp, mp FROM pets WHERE id = ? LIMIT 1', [petId]);
    const maxMp = Number(petMpRows[0]?.max_mp) || 1;
    const recoverMp =
      normalizeEffectType(effect.effect_type) === 'percent'
        ? resolveMedicineHpMpPercentRecovery(effect, qty, maxMp, itemRow)
        : resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      'UPDATE pets SET mp = LEAST(COALESCE(max_mp, mp, 0), GREATEST(0, COALESCE(mp, 0) + ?)) WHERE id = ?',
      [recoverMp, petId]
    );
    return null;
  } else if (normalizedTarget === 'hunger') {
    const recoverHunger =
      effect.effect_type === 'percent'
        ? resolveVitalsStepsFromPercent(effect, qty, itemRow, petVitals.HUNGER_MAX)
        : resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      `UPDATE pets SET hunger_status = LEAST(?, GREATEST(0, COALESCE(hunger_status, 0) + ?)),
         hunger_vitals_at = NOW() WHERE id = ?`,
      [petVitals.HUNGER_MAX, recoverHunger, petId]
    );
    return null;
  } else if (normalizedTarget === 'mood') {
    const recoverMood =
      effect.effect_type === 'percent'
        ? resolveVitalsStepsFromPercent(effect, qty, itemRow, petVitals.MOOD_MAX)
        : resolveEffectAmount(effect, qty, itemRow, { scaleByMagic: true });
    await pool.promise().query(
      `UPDATE pets SET mood = LEAST(?, GREATEST(0, COALESCE(mood, 2) + ?)),
         mood_vitals_at = NOW() WHERE id = ?`,
      [petVitals.MOOD_MAX, recoverMood, petId]
    );
    return null;
  } else if (normalizedTarget === 'str' || normalizedTarget === 'def' ||
             normalizedTarget === 'spd' || normalizedTarget === 'intelligence') {
    if (!effect.is_permanent) return null;
    const statField = normalizedTarget;
    if (effect.effect_type === 'percent') {
      const pts = resolveTierPointsFromPercentEffect(effect, qty);
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`,
        [pts, petId]);
    } else if (effect.effect_type === 'flat') {
      await pool.promise().query(`UPDATE pets SET ${statField}_added = ${statField}_added + ? WHERE id = ?`,
        [effect.value_min, petId]);
    }
    return null;
  }
  return null;
}

// Helper function để xử lý EXP với logic level up
async function handleExpGainWithLevelUp(petId, expGain) {
  try {
    // Lấy thông tin pet hiện tại
    const [petRows] = await pool.promise().query('SELECT * FROM pets WHERE id = ?', [petId]);
    if (!petRows.length) {
      throw new Error('Pet not found');
    }

    const pet = petRows[0];
    let newExp = pet.current_exp + expGain;
    let newLevel = pet.level;

    // Kiểm tra level up
    while (expTable[newLevel + 1] && newExp >= expTable[newLevel + 1]) {
      newLevel++;
    }

    // Recalculate stats nếu level up — gộp IV formula + booster_stats + *_added
    let updatedStats = null;
    if (newLevel > pet.level) {
      await pool.promise().query(
        'UPDATE pets SET current_exp = ?, level = ? WHERE id = ?',
        [newExp, newLevel, petId]
      );
      const refreshed = await refreshPetIntrinsicStats(db, petId);
      updatedStats = refreshed ? refreshed.merged : null;
    } else {
      await pool.promise().query(
        'UPDATE pets SET current_exp = ? WHERE id = ?',
        [newExp, petId]
      );
    }

    console.log(`Pet ${petId} gained ${expGain} EXP. Level: ${pet.level} -> ${newLevel}`);
    if (updatedStats) {
      console.log(`Stats updated for level up:`, updatedStats);
    }
    
    return {
      level_up: newLevel > pet.level,
      old_level: pet.level,
      new_level: newLevel,
      exp_gained: expGain,
      stats_updated: !!updatedStats,
      new_stats: updatedStats
    };
  } catch (error) {
    console.error('Error in handleExpGainWithLevelUp:', error);
    throw error;
  }
}

// Admin API endpoints

// Middleware để check admin role
const checkAdminRole = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [decoded.userId]);
    
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Pet sự kiện chưa gán chủ (tạo từ admin/create-pet) — dùng chọn thưởng mail
app.get('/api/admin/pets/unowned-mail', checkAdminRole, async (req, res) => {
  try {
    const [pets] = await db.query(`
      SELECT p.id, p.uuid, p.name, p.level, p.pet_species_id,
             ps.name AS species_name, ps.image AS species_image
      FROM pets p
      LEFT JOIN pet_species ps ON ps.id = p.pet_species_id
      WHERE p.owner_id IS NULL
      ORDER BY p.id DESC
    `);
    res.json(Array.isArray(pets) ? pets : []);
  } catch (err) {
    console.error('GET /api/admin/pets/unowned-mail:', err);
    res.status(500).json({ error: 'Không thể tải danh sách pet chưa có chủ' });
  }
});

// POST /api/admin/mails/system-send - System auto send mail (single user)
app.post('/api/admin/mails/system-send', checkAdminRole, async (req, res) => {
  const { 
    user_id, 
    subject, 
    message, 
    attached_rewards,
    expire_days = 7 
  } = req.body;

  try {
    // Check if user exists
    const [userCheck] = await db.query('SELECT id FROM users WHERE id = ?', [user_id]);
    
    if (userCheck.length === 0) {
      return res.status(404).json({ error: `User ID ${user_id} không tồn tại` });
    }

    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expire_days);

    const rewardsJson = attached_rewards ? JSON.stringify(attached_rewards) : null;
    
    await db.query(`
      INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
      VALUES (?, 'system', 'Hệ thống', ?, ?, ?, ?)
    `, [user_id, subject, message, rewardsJson, expireAt]);

    res.json({ success: true, message: 'Gửi system mail thành công!' });
  } catch (err) {
    console.error('Lỗi khi gửi system mail:', err);
    res.status(500).json({ error: 'Lỗi khi gửi system mail', details: err.message });
  }
});

// POST /api/admin/mails/broadcast - Send mail to all users
app.post('/api/admin/mails/broadcast', checkAdminRole, async (req, res) => {
  const { 
    subject, 
    message, 
    attached_rewards,
    expire_days = 7 
  } = req.body;

  try {
    // Get all users
    const [allUsers] = await db.query('SELECT id FROM users');
    
    if (allUsers.length === 0) {
      return res.status(404).json({ error: 'Không có user nào trong hệ thống' });
    }

    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expire_days);

    const rewardsJson = attached_rewards ? JSON.stringify(attached_rewards) : null;
    
    let sentCount = 0;
    let errorCount = 0;

    // Send mail to each user
    for (const user of allUsers) {
      try {
        await db.query(`
          INSERT INTO mails (user_id, sender_type, sender_name, subject, message, attached_rewards, expire_at)
          VALUES (?, 'system', 'Hệ thống', ?, ?, ?, ?)
        `, [user.id, subject, message, rewardsJson, expireAt]);
        sentCount++;
      } catch (err) {
        console.error(`Error sending mail to user ${user.id}:`, err);
        errorCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Gửi mail thành công đến ${sentCount}/${allUsers.length} users`,
      sent_count: sentCount,
      error_count: errorCount,
      total_users: allUsers.length
    });
  } catch (err) {
    console.error('Lỗi khi broadcast mail:', err);
    res.status(500).json({ error: 'Lỗi khi broadcast mail', details: err.message });
  }
});

const createAuctionLogAdminRouter = require('./routes/auctionLogsAdmin');
app.use('/api/admin/auction-logs', createAuctionLogAdminRouter(checkAdminRole));

const siteAuctionMailAdmin = require('./routes/siteAuctionMailAdmin');
app.use('/api/admin/site/auction-mail-templates', checkAdminRole, siteAuctionMailAdmin);

// GET /api/admin/bank/interest-rates - Lấy lãi suất hiện tại
app.get('/api/admin/bank/interest-rates', checkAdminRole, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT currency_type, interest_rate, is_active
      FROM bank_interest_rates
      ORDER BY currency_type, is_active DESC
    `);

    const rates = {
      peta: { normal: 5.00, vip: 8.00 },
      petagold: { normal: 0.00, vip: 5.00 }
    };

    rows.forEach(row => {
      if (row.currency_type === 'peta') {
        if (row.is_active) rates.peta.normal = row.interest_rate;
        else rates.peta.vip = row.interest_rate;
      } else if (row.currency_type === 'petagold') {
        if (row.is_active) rates.petagold.normal = row.interest_rate;
        else rates.petagold.vip = row.interest_rate;
      }
    });

    res.json(rates);
  } catch (err) {
    console.error('Error fetching interest rates:', err);
    res.status(500).json({ error: 'Failed to fetch interest rates' });
  }
});

// PUT /api/admin/bank/interest-rates - Cập nhật lãi suất
app.put('/api/admin/bank/interest-rates', checkAdminRole, async (req, res) => {
  const { currency_type, user_type, interest_rate } = req.body;

  try {
    const isActive = user_type === 'normal';
    
    await db.query(`
      UPDATE bank_interest_rates 
      SET interest_rate = ?, updated_at = NOW()
      WHERE currency_type = ? AND is_active = ?
    `, [interest_rate, currency_type, isActive]);

    res.json({ message: 'Interest rate updated successfully' });
  } catch (err) {
    console.error('Error updating interest rate:', err);
    res.status(500).json({ error: 'Failed to update interest rate' });
  }
});

// GET /api/admin/users - Lấy danh sách users với pagination
app.get('/api/admin/users', checkAdminRole, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const [countRows] = await db.query(`
      SELECT COUNT(*) as total FROM users
    `);
    const totalUsers = countRows[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    // Get users with pagination
    const [rows] = await db.query(`
      SELECT
        u.id,
        u.username,
        u.role,
        u.is_vip,
        u.registration_date as created_at,
        up.display_name
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      ORDER BY registration_date DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      users: rows,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: totalUsers,
      usersPerPage: limit
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:userId/role - Cập nhật role user
app.put('/api/admin/users/:userId/role', checkAdminRole, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  try {
    await db.query(`
      UPDATE users 
      SET role = ?
      WHERE id = ?
    `, [role, userId]);

    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('Error updating user role:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PUT /api/admin/users/:userId/vip - Toggle VIP status
app.put('/api/admin/users/:userId/vip', checkAdminRole, async (req, res) => {
  const { userId } = req.params;
  const { is_vip } = req.body;

  try {
    await db.query(`
      UPDATE users 
      SET is_vip = ?
      WHERE id = ?
    `, [is_vip, userId]);

    res.json({ message: 'VIP status updated successfully' });
  } catch (err) {
    console.error('Error updating VIP status:', err);
    res.status(500).json({ error: 'Failed to update VIP status' });
  }
});

// ================================ ADMIN SHOP MANAGEMENT ================================

// GET /api/admin/shops - Lấy danh sách shops cho admin
app.get('/api/admin/shops', checkAdminRole, async (req, res) => {
  try {
    await ensureGeneralShopsSeeded(db);
    const [shops] = await db.query(`
      SELECT * FROM shop_definitions
      WHERE COALESCE(is_active, 1) = 1
      ORDER BY parent_category, sort_order
    `);
    res.json(shops);
  } catch (error) {
    console.error('Error fetching shops:', error);
    try {
      const [shops] = await db.query('SELECT * FROM shop_definitions');
      res.json(shops);
    } catch (e2) {
      res.status(500).json({ error: 'Failed to fetch shops' });
    }
  }
});

// POST /api/admin/shops/add - Thêm shop mới
app.post('/api/admin/shops/add', checkAdminRole, async (req, res) => {
  const {
    name,
    code,
    description,
    type_filter,
    currency_type,
    parent_category,
    sort_order,
    image_url,
  } = req.body;

  try {
    await ensureGeneralShopsSeeded(db);

    const shopCode = String(code || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!name || !shopCode) {
      return res.status(400).json({ error: 'Thiếu name hoặc code' });
    }

    const [existing] = await db.query(
      'SELECT id, is_active FROM shop_definitions WHERE code = ? LIMIT 1',
      [shopCode]
    );
    if (existing.length > 0) {
      if (Number(existing[0].is_active) !== 0) {
        return res.status(400).json({ error: 'Shop code already exists' });
      }
      // Khôi phục shop đã xóa mềm với cùng code
      await db.query(
        `
        UPDATE shop_definitions
        SET name = ?, description = ?, type_filter = ?, currency_type = ?, parent_category = ?,
            sort_order = ?, image_url = ?, is_active = 1
        WHERE id = ?
      `,
        [
          name,
          description || null,
          type_filter || 'all',
          currency_type || 'peta',
          parent_category || 'general',
          sort_order ?? 100,
          image_url ? String(image_url).trim() : null,
          existing[0].id,
        ]
      );
      return res.json({ message: 'Shop restored successfully', code: shopCode, id: existing[0].id });
    }

    await db.query(
      `
      INSERT INTO shop_definitions (name, code, description, type_filter, currency_type, parent_category, sort_order, image_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
      [
        name,
        shopCode,
        description || null,
        type_filter || 'all',
        currency_type || 'peta',
        parent_category || 'general',
        sort_order ?? 100,
        image_url ? String(image_url).trim() : null,
      ]
    );

    res.json({ message: 'Shop added successfully', code: shopCode });
  } catch (error) {
    console.error('Error adding shop:', error);
    res.status(500).json({ error: 'Failed to add shop' });
  }
});

// PUT /api/admin/shops/:shop_id - Cập nhật shop (ảnh, mô tả, …)
app.put('/api/admin/shops/:shop_id', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;
  const { name, description, type_filter, currency_type, sort_order, image_url, parent_category } =
    req.body;

  try {
    await ensureGeneralShopsSeeded(db);

    const [rows] = await db.query('SELECT id FROM shop_definitions WHERE id = ? LIMIT 1', [shop_id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    await db.query(
      `
      UPDATE shop_definitions
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          type_filter = COALESCE(?, type_filter),
          currency_type = COALESCE(?, currency_type),
          sort_order = COALESCE(?, sort_order),
          image_url = ?,
          parent_category = COALESCE(?, parent_category)
      WHERE id = ?
    `,
      [
        name ?? null,
        description ?? null,
        type_filter ?? null,
        currency_type ?? null,
        sort_order ?? null,
        image_url === undefined || image_url === null ? null : String(image_url).trim() || null,
        parent_category ?? null,
        shop_id,
      ]
    );

    res.json({ message: 'Shop updated successfully' });
  } catch (error) {
    console.error('Error updating shop:', error);
    res.status(500).json({ error: 'Failed to update shop' });
  }
});

// DELETE /api/admin/shops/:shop_id - Xóa cửa hàng (mềm) + xóa shop_items
app.delete('/api/admin/shops/:shop_id', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;

  try {
    await ensureGeneralShopsSeeded(db);

    const [rows] = await db.query(
      'SELECT id, code, parent_category, is_active FROM shop_definitions WHERE id = ? LIMIT 1',
      [shop_id]
    );
    if (!rows.length || Number(rows[0].is_active) === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const shop = rows[0];
    const cat = String(shop.parent_category || '').toLowerCase();
    if (!['general', 'exchange', 'premium'].includes(cat)) {
      return res.status(400).json({
        error: 'Chỉ được xóa cửa hàng thuộc Chung / Đổi thưởng / Cao cấp',
      });
    }

    await db.query('DELETE FROM shop_items WHERE shop_id = ?', [shop_id]);
    await db.query('UPDATE shop_definitions SET is_active = 0 WHERE id = ?', [shop_id]);

    res.json({ message: 'Shop deleted successfully', code: shop.code, parent_category: cat });
  } catch (error) {
    console.error('Error deleting shop:', error);
    res.status(500).json({ error: 'Failed to delete shop' });
  }
});

// GET /api/admin/shop/:shop_code - Lấy items của shop cho admin
app.get('/api/admin/shop/:shop_code', checkAdminRole, async (req, res) => {
  const { shop_code } = req.params;

  try {
    const [shopRows] = await db.query(
      'SELECT id FROM shop_definitions WHERE code = ?',
      [shop_code]
    );

    if (!shopRows.length) {
      return res.status(404).json({ error: 'Shop không tồn tại' });
    }

    const shop = shopRows[0];
    await ensureShopItemsRestocked(db, shop.id);

    const [items] = await db.query(`
      SELECT 
        si.*,
        i.name,
        i.image_url,
        i.sell_price,
        i.type,
        sd.code as shop_code,
        sd.name as shop_name,
        sd.currency_type as shop_currency
      FROM shop_items si
      JOIN items i ON si.item_id = i.id
      JOIN shop_definitions sd ON si.shop_id = sd.id
      WHERE si.shop_id = ?
      ORDER BY si.id DESC
    `, [shop.id]);

    res.json(items);
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

// POST /api/admin/shop-items/add - Thêm item vào shop
app.post('/api/admin/shop-items/add', checkAdminRole, async (req, res) => {
  const { shop_code, item_id, custom_price, currency_type, stock_limit, restock_interval, available_from, available_until } = req.body;

  try {
    await ensureShopRestockColumns(db);

    // Get shop ID
    const [shopRows] = await db.query('SELECT id FROM shop_definitions WHERE code = ?', [shop_code]);
    if (!shopRows.length) {
      return res.status(404).json({ error: 'Shop không tồn tại' });
    }
    const shopId = shopRows[0].id;

    // Check if item already exists in shop
    const [existing] = await db.query('SELECT id FROM shop_items WHERE shop_id = ? AND item_id = ?', [shopId, item_id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Item already exists in this shop' });
    }

    const stockVal = normalizeShopStockLimit(stock_limit);

    await db.query(`
      INSERT INTO shop_items (shop_id, item_id, custom_price, currency_type, stock_limit, max_stock, restock_interval, available_from, available_until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shopId,
      item_id,
      custom_price != null && custom_price !== '' ? Number(custom_price) : null,
      currency_type || 'peta',
      stockVal,
      stockVal,
      restock_interval || 'none',
      available_from || null,
      available_until || null,
    ]);

    res.json({ message: 'Item added to shop successfully' });
  } catch (error) {
    console.error('Error adding item to shop:', error);
    res.status(500).json({ error: 'Failed to add item to shop' });
  }
});

// PUT /api/admin/shop-items/:shop_id/:item_id — đã đăng ký ở khối SHOP phía trên (có checkAdminRole + max_stock)

// DELETE /api/admin/shop-items/:shop_id/:item_id - Xóa item khỏi shop
app.delete('/api/admin/shop-items/:shop_id/:item_id', checkAdminRole, async (req, res) => {
  const { shop_id, item_id } = req.params;

  console.log('🗑️ Admin deleting item:', {
    shop_id,
    item_id
  });

  try {
    const [result] = await db.query('DELETE FROM shop_items WHERE shop_id = ? AND item_id = ?', [shop_id, item_id]);
    
    console.log('📊 Delete result:', {
      affectedRows: result.affectedRows,
      shop_id,
      item_id
    });
    
    if (result.affectedRows === 0) {
      console.log('❌ No rows affected - item not found');
      return res.status(404).json({ error: 'Item not found in shop' });
    }

    res.json({ message: 'Item removed from shop successfully' });
  } catch (error) {
    console.error('Error removing item from shop:', error);
    res.status(500).json({ error: 'Failed to remove item from shop' });
  }
});

// PUT /api/admin/shops/:shop_id/restock-interval - Cập nhật restock interval cho shop
app.put('/api/admin/shops/:shop_id/restock-interval', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;
  const { shop_restock_interval } = req.body;

  try {
    await db.query(`
      UPDATE shop_definitions 
      SET shop_restock_interval = ?
      WHERE id = ?
    `, [shop_restock_interval, shop_id]);

    res.json({ message: 'Shop restock interval updated successfully' });
  } catch (error) {
    console.error('Error updating shop restock interval:', error);
    res.status(500).json({ error: 'Failed to update shop restock interval' });
  }
});

// GET /api/admin/shops/:shop_id/restock-interval - Lấy restock interval của shop
app.get('/api/admin/shops/:shop_id/restock-interval', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT shop_restock_interval 
      FROM shop_definitions 
      WHERE id = ?
    `, [shop_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({ shop_restock_interval: rows[0].shop_restock_interval });
  } catch (error) {
    console.error('Error fetching shop restock interval:', error);
    res.status(500).json({ error: 'Failed to fetch shop restock interval' });
  }
});

// GET /api/shop/:shop_code/last-restock - Lấy thời gian restock cuối cùng của shop
app.get('/api/shop/:shop_code/last-restock', async (req, res) => {
  const { shop_code } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT last_restock_time 
      FROM shop_definitions 
      WHERE code = ?
    `, [shop_code]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json({ 
      last_restock_time: rows[0].last_restock_time,
      shop_code: shop_code 
    });
  } catch (error) {
    console.error('Error fetching last restock time:', error);
    res.status(500).json({ error: 'Failed to fetch last restock time' });
  }
});

// PUT /api/admin/shops/:shop_id/last-restock - Cập nhật thời gian restock cuối cùng (admin only)
app.put('/api/admin/shops/:shop_id/last-restock', checkAdminRole, async (req, res) => {
  const { shop_id } = req.params;
  const { last_restock_time } = req.body;

  try {
    await db.query(`
      UPDATE shop_definitions 
      SET last_restock_time = ?
      WHERE id = ?
    `, [last_restock_time, shop_id]);

    res.json({ message: 'Last restock time updated successfully' });
  } catch (error) {
    console.error('Error updating last restock time:', error);
    res.status(500).json({ error: 'Failed to update last restock time' });
  }
});

// ================================ GLOBAL CONFIG MANAGEMENT ================================

// GET /api/admin/global-config - Lấy tất cả global config
app.get('/api/admin/global-config', checkAdminRole, async (req, res) => {
  try {
    const [configs] = await db.query(`
      SELECT config_key, config_value, description, updated_at
      FROM global_config 
      ORDER BY config_key
    `);
    
    // Convert array to object for easier access
    const configObject = {};
    configs.forEach(config => {
      configObject[config.config_key] = {
        value: config.config_value,
        description: config.description,
        updated_at: config.updated_at
      };
    });
    
    res.json(configObject);
  } catch (error) {
    console.error('Error fetching global config:', error);
    res.status(500).json({ error: 'Failed to fetch global config' });
  }
});

// PUT /api/admin/global-config/:config_key - Cập nhật global config
app.put('/api/admin/global-config/:config_key', checkAdminRole, async (req, res) => {
  const { config_key } = req.params;
  const { config_value } = req.body;

  try {
    await db.query(`
      UPDATE global_config 
      SET config_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE config_key = ?
    `, [config_value, config_key]);

    res.json({ message: 'Global config updated successfully' });
  } catch (error) {
    console.error('Error updating global config:', error);
    res.status(500).json({ error: 'Failed to update global config' });
  }
});

// GET /api/global-reset-time - Lấy global reset time (public endpoint)
app.get('/api/global-reset-time', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT config_value 
      FROM global_config 
      WHERE config_key = 'global_reset_time'
    `);

    if (rows.length === 0) {
      return res.json({ global_reset_time: '06:00' }); // Default fallback
    }

    res.json({ global_reset_time: rows[0].config_value });
  } catch (error) {
    console.error('Error fetching global reset time:', error);
    res.status(500).json({ error: 'Failed to fetch global reset time' });
  }
});

// ========================================
// PERSISTENT HP SYSTEM API ENDPOINTS
// ========================================

// POST /api/pets/:petId/update-hp - Update pet's current HP
app.post('/api/pets/:petId/update-hp', async (req, res) => {
  const { petId } = req.params;
  const { current_hp } = req.body;

  try {
    // Validate current_hp
    if (current_hp === undefined || current_hp < 0) {
      return res.status(400).json({ error: 'Invalid current_hp value' });
    }

    // Get pet's max_hp to validate
    const [petRows] = await db.query(
      'SELECT final_stats FROM pets WHERE id = ?',
      [petId]
    );

    if (petRows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    const pet = petRows[0];
    const maxHp = JSON.parse(pet.final_stats).hp;
    
    // Ensure current_hp doesn't exceed max_hp
    const validCurrentHp = Math.min(current_hp, maxHp);

    // Update current_hp
    await db.query(
      'UPDATE pets SET current_hp = ? WHERE id = ?',
      [validCurrentHp, petId]
    );

    res.json({ 
      message: 'HP updated successfully',
      pet_id: petId,
      current_hp: validCurrentHp,
      max_hp: maxHp
    });
  } catch (error) {
    console.error('Error updating pet HP:', error);
    res.status(500).json({ error: 'Failed to update pet HP' });
  }
});

// GET /api/pets/:petId/current-hp - Get pet's current HP
app.get('/api/pets/:petId/current-hp', async (req, res) => {
  const { petId } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT id, name, current_hp, final_stats FROM pets WHERE id = ?',
      [petId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    const pet = rows[0];
    const finalStats = JSON.parse(pet.final_stats);
    const maxHp = finalStats.hp;

    res.json({
      pet_id: pet.id,
      name: pet.name,
      current_hp: pet.current_hp || maxHp,
      max_hp: maxHp,
      hp_percentage: Math.round(((pet.current_hp || maxHp) / maxHp) * 100)
    });
  } catch (error) {
    console.error('Error fetching pet HP:', error);
    res.status(500).json({ error: 'Failed to fetch pet HP' });
  }
});

// ========================================
// HEALIA RIVER API ENDPOINTS
// ========================================

// GET /api/healia-river/status - Check if user can use Healia River
app.get('/api/healia-river/status', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    // Check if user is in battle
    const [battleRows] = await db.query(
      'SELECT id FROM one_player_battles2 WHERE userid = ?',
      [userId]
    );

    if (battleRows.length > 0) {
      return res.json({
        canUse: false,
        reason: 'battle',
        message: 'You cannot use this while you\'re in a battle.'
      });
    }

    // Check if user is VIP
    const [userRows] = await db.query(
      'SELECT is_vip FROM users WHERE id = ?',
      [userId]
    );
    const isVip = userRows.length > 0 && userRows[0].is_vip;

    // Check cooldown (15 min for VIP, 30 min for normal)
    const [cooldownRows] = await db.query(
      'SELECT last_used FROM user_cooldowns WHERE user_id = ? AND action_type = ?',
      [userId, 'healia_river']
    );

    if (cooldownRows.length === 0) {
      return res.json({
        canUse: true,
        timeLeft: 0,
        nextAvailable: null
      });
    }

    const lastUsed = new Date(cooldownRows[0].last_used);
    const now = new Date();
    const cooldownMs = isVip ? 15 * 60 * 1000 : 30 * 60 * 1000; // 15 min VIP, 30 min normal
    const timeLeft = Math.max(0, cooldownMs - (now - lastUsed));

    if (timeLeft === 0) {
      return res.json({
        canUse: true,
        timeLeft: 0,
        nextAvailable: null
      });
    }

    const nextAvailable = new Date(now.getTime() + timeLeft);
    const cooldownMinutes = isVip ? 15 : 30;

    return res.json({
      canUse: false,
      reason: 'cooldown',
      timeLeft: Math.ceil(timeLeft / 1000), // seconds
      nextAvailable: nextAvailable.toISOString(),
      message: `You can only drink the water from the fountain every ${cooldownMinutes} minutes. Please come back after`
    });
  } catch (error) {
    console.error('Error checking Healia River status:', error);
    res.status(500).json({ error: 'Failed to check Healia River status' });
  }
});

// POST /api/healia-river/heal - Use Healia River to heal pets
app.post('/api/healia-river/heal', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    // Check if user is in battle
    const [battleRows] = await db.query(
      'SELECT id FROM one_player_battles2 WHERE userid = ?',
      [userId]
    );

    if (battleRows.length > 0) {
      return res.status(400).json({ 
        error: 'You cannot use this while you\'re in a battle.' 
      });
    }

    // Check if user is VIP
    const [userRows] = await db.query(
      'SELECT is_vip FROM users WHERE id = ?',
      [userId]
    );
    const isVip = userRows.length > 0 && userRows[0].is_vip;

    // Check cooldown (15 min for VIP, 30 min for normal)
    const [cooldownRows] = await db.query(
      'SELECT last_used FROM user_cooldowns WHERE user_id = ? AND action_type = ?',
      [userId, 'healia_river']
    );

    if (cooldownRows.length > 0) {
      const lastUsed = new Date(cooldownRows[0].last_used);
      const now = new Date();
      const cooldownMs = isVip ? 15 * 60 * 1000 : 30 * 60 * 1000; // 15 min VIP, 30 min normal
      const timeLeft = Math.max(0, cooldownMs - (now - lastUsed));

      if (timeLeft > 0) {
        const cooldownMinutes = isVip ? 15 : 30;
        return res.status(400).json({ 
          error: `You can only drink the water from the fountain every ${cooldownMinutes} minutes. Please come back later.` 
        });
      }
    }

    // Get user's pets (có owner_id = user)
    console.log('Getting pets for user:', userId);
    const [petRows] = await db.query(
      'SELECT id, name, current_hp, final_stats FROM pets WHERE owner_id = ?',
      [userId]
    );
    console.log('Found pets:', petRows.length);

    if (petRows.length === 0) {
      return res.status(400).json({ 
        error: 'You don\'t have any pets to heal.' 
      });
    }

    // Random heal logic (80% chance: heal 85% maxHP, 20% chance: full heal)
    const randHeal = Math.floor(Math.random() * 5) + 1;
    let isFullHeal = false;

    if (randHeal <= 4) {
      // 80% chance: heal 85% of maxHP
      for (const pet of petRows) {
        // Handle both JSON string and object
        let finalStats;
        if (typeof pet.final_stats === 'string') {
          finalStats = JSON.parse(pet.final_stats);
        } else {
          finalStats = pet.final_stats;
        }
        
        const maxHp = finalStats.hp;
        const currentHp = pet.current_hp || maxHp;
        const healAmount = Math.floor(maxHp * 0.85); // 85% of maxHP
        const newHp = Math.min(currentHp + healAmount, maxHp);
        
        await db.query(
          'UPDATE pets SET current_hp = ? WHERE id = ?',
          [newHp, pet.id]
        );
      }
    } else {
      // 20% chance: full heal
      isFullHeal = true;
      
      for (const pet of petRows) {
        // Handle both JSON string and object
        let finalStats;
        if (typeof pet.final_stats === 'string') {
          finalStats = JSON.parse(pet.final_stats);
        } else {
          finalStats = pet.final_stats;
        }
        
        const maxHp = finalStats.hp;
        
        await db.query(
          'UPDATE pets SET current_hp = ? WHERE id = ?',
          [maxHp, pet.id]
        );
      }
    }

    // Update cooldown
    const now = new Date();
    if (cooldownRows.length > 0) {
      await db.query(
        'UPDATE user_cooldowns SET last_used = ? WHERE user_id = ? AND action_type = ?',
        [now, userId, 'healia_river']
      );
    } else {
      await db.query(
        'INSERT INTO user_cooldowns (user_id, action_type, last_used) VALUES (?, ?, ?)',
        [userId, 'healia_river', now]
      );
    }

    res.json({
      success: true,
      isFullHeal,
      message: isFullHeal 
        ? 'All of your pets have been fully healed!'
        : 'All of your pets have been healed a part!',
      nextAvailable: new Date(now.getTime() + (isVip ? 15 * 60 * 1000 : 30 * 60 * 1000)).toISOString()
    });
  } catch (error) {
    console.error('Error using Healia River:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Failed to use Healia River',
      details: error.message,
      code: error.code
    });
  }
});

// ========================================
// RESTAURANT API (Nhà hàng - cho thú cưng ăn, hồi hunger_status)
// ========================================
// POST /api/restaurant/feed - Tốn 1 Peta, hồi đói tối đa + tâm trạng
app.post('/api/restaurant/feed', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Cần đăng nhập để sử dụng Nhà hàng.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    const [userRows] = await db.query('SELECT id, peta FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Người dùng không tồn tại.' });
    }
    const user = userRows[0];
    const petaBalance = Number(user.peta) || 0;
    if (petaBalance < 1) {
      return res.status(400).json({ error: 'Bạn không đủ Peta. Cần 1 Peta để dùng menu.' });
    }

    const [petRows] = await db.query(
      'SELECT id FROM pets WHERE owner_id = ?',
      [userId]
    );
    if (petRows.length === 0) {
      return res.status(400).json({ error: 'Bạn chưa có thú cưng nào để cho ăn.' });
    }

    const HUNGER_BATTLES_RESET = 0;
    for (const pet of petRows) {
      await petVitals.refreshPetVitalsById(db, pet.id);
      await db.query(
        `UPDATE pets SET hunger_status = ?, hunger_battles = ?,
           mood = LEAST(?, GREATEST(0, COALESCE(mood, 2) + 1)),
           hunger_vitals_at = NOW(), mood_vitals_at = NOW() WHERE id = ?`,
        [petVitals.HUNGER_MAX, HUNGER_BATTLES_RESET, petVitals.MOOD_MAX, pet.id]
      );
    }

    await db.query('UPDATE users SET peta = peta - 1 WHERE id = ?', [userId]);

    try {
      await titleService.recordPetaSpent(db, userId, 1);
    } catch (e) {
      console.error('title spend (restaurant):', e);
    }

    res.json({
      success: true,
      message: 'Tất cả thú cưng đã được cho ăn no và tinh thần phấn chấn hơn!',
      petaRemaining: petaBalance - 1,
      petsFed: petRows.length
    });
  } catch (err) {
    console.error('Restaurant feed error:', err);
    res.status(500).json({ error: 'Lỗi server khi sử dụng Nhà hàng.' });
  }
});

(async () => {
  await resetOnlineStatusOnStartup();
  await initRedis();
  await ensureHuntingMapsHiddenColumn(db);
  try {
    await huntingCatch.loadCatchConfig(db);
    console.log('[db] hunting_catch_config loaded');
  } catch (e) {
    console.error('loadCatchConfig on startup:', e);
  }
  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
})();