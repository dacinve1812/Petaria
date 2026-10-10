const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(
  __dirname,
  '../../src/components/story/Core Lore/Petaria_Chapter0_ContentPack/content'
);

const CAPITAL_PATHS = new Set(['/', '/home-ver2']);

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, name), 'utf8'));
}

let contentCache = null;
function content() {
  if (!contentCache) {
    const scenes = readJson('scenes.vi.json');
    const characters = readJson('characters.vi.json');
    const transitions = readJson('transitions.config.json');
    const byId = {};
    characters.forEach((character) => {
      byId[character.id] = character;
    });
    contentCache = { scenes, characters: byId, transitions };
  }
  return contentCache;
}

function blankState() {
  return {
    enrolled: true,
    legacyExempt: false,
    completed: false,
    flags: {},
    seen: {},
    dismissed: {},
    choices: {},
    arenaResult: null,
    arenaLossId: 0,
    arenaLossAck: 0,
    portArmed: false,
    letterHeld: false,
  };
}

function legacyState() {
  return {
    ...blankState(),
    enrolled: false,
    legacyExempt: true,
    flags: { STARTER_ADOPTED: true },
  };
}

function dupColumn(err) {
  const code = err && err.code;
  const msg = String((err && err.message) || '');
  return code === 'ER_DUP_FIELDNAME' || msg.includes('Duplicate column');
}

async function ensureSchema(db) {
  try {
    await db.query('ALTER TABLE users ADD COLUMN chapter0_json LONGTEXT NULL');
  } catch (err) {
    if (!dupColumn(err)) throw err;
  }
}

function parseState(raw) {
  if (!raw) return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...blankState(), ...value, flags: value.flags || {}, seen: value.seen || {}, dismissed: value.dismissed || {}, choices: value.choices || {} };
  } catch {
    return null;
  }
}

async function petCount(db, userId) {
  const [rows] = await db.query('SELECT COUNT(*) AS c FROM pets WHERE owner_id = ?', [userId]);
  return Number(rows?.[0]?.c) || 0;
}

async function loadState(db, userId) {
  await ensureSchema(db);
  const [rows] = await db.query('SELECT chapter0_json FROM users WHERE id = ?', [userId]);
  if (!rows.length) return null;
  const parsed = parseState(rows[0].chapter0_json);
  if (parsed) return parsed;
  const pets = await petCount(db, userId);
  const initial = pets > 0 ? legacyState() : blankState();
  await saveState(db, userId, initial);
  return initial;
}

async function saveState(db, userId, state) {
  await db.query('UPDATE users SET chapter0_json = ? WHERE id = ?', [JSON.stringify(state), userId]);
  return state;
}

function isCapital(pathname) {
  return CAPITAL_PATHS.has(pathname);
}

function isBattleMenu(pathname) {
  return pathname === '/battle' || pathname === '/battle/arena';
}

function selectScene(state, pathname) {
  if (!state || !state.enrolled || state.completed) return null;
  if (Array.isArray(state.pendingRewards) && state.pendingRewards.length) return null;
  const seen = state.seen || {};
  const flags = state.flags || {};
  const path = pathname || '/';
  const adopted = Boolean(flags.STARTER_ADOPTED);

  if (isCapital(path) && !adopted && !seen.CH0_OPENING) return 'CH0_OPENING';
  if (isCapital(path) && !adopted && !seen.CH0_ARI_WELCOME) return 'CH0_ARI_WELCOME';
  if (path.startsWith('/orphanage') && !adopted && !seen.CH0_ELINA_INTRO) return 'CH0_ELINA_INTRO';
  if (path.startsWith('/orphanage') && adopted && flags.ADOPT_ACKED && !seen.CH0_ELINA_CONFIRM) return 'CH0_ELINA_CONFIRM';
  if (path.startsWith('/myhome') && adopted && flags.HOME_RETURNED && !flags.PET_PROFILE_VIEWED && !seen.CH0_HOME) return 'CH0_HOME';
  if (path.startsWith('/pet/') && flags.PET_PROFILE_VIEWED && !seen.CH0_PET_STATS) return 'CH0_PET_STATS';
  if (path.startsWith('/pet/') && seen.CH0_PET_STATS && flags.PET_STATUS_OPENED && !seen.CH0_PET_RESTAURANT) return 'CH0_PET_RESTAURANT';
  if (path.startsWith('/restaurant') && seen.CH0_PET_RESTAURANT && !flags.RESTAURANT_FED && !seen.CH0_RESTAURANT) return 'CH0_RESTAURANT';
  if (path.startsWith('/restaurant') && flags.RESTAURANT_FED && !seen.CH0_RESTAURANT_DONE) return 'CH0_RESTAURANT_DONE';
  if (isCapital(path) && flags.LOGO_HOME && !seen.CH0_GO_SHOP && !flags.STARTER_SUPPLIES_CLAIMED) return 'CH0_GO_SHOP';
  if (path.startsWith('/shop') && flags.LOGO_HOME && !flags.STARTER_SUPPLIES_CLAIMED && !seen.CH0_SHOP) return 'CH0_SHOP';
  if (path.startsWith('/shop') && flags.STARTER_SUPPLIES_CLAIMED && !seen.CH0_SHOP_DONE) return 'CH0_SHOP_DONE';
  if (path.startsWith('/inventory') && flags.STARTER_SUPPLIES_CLAIMED && !seen.CH0_INVENTORY) return 'CH0_INVENTORY';
  if (path.startsWith('/inventory') && flags.EQUIP_TAB_OPENED && !flags.GEAR_EQUIPPED && !seen.CH0_INVENTORY_EQUIP) return 'CH0_INVENTORY_EQUIP';
  if (flags.GEAR_EQUIPPED && !seen.CH0_GEAR_READY && !flags.ARENA_FIRST_WIN && !path.startsWith('/battle')) return 'CH0_GEAR_READY';
  if (isBattleMenu(path) && flags.GEAR_EQUIPPED && !flags.ARENA_FIRST_WIN && !seen.CH0_ARENA_INTRO) return 'CH0_ARENA_INTRO';
  if (path.startsWith('/battle/arena/select') && seen.CH0_ARENA_INTRO && !flags.ARENA_FIRST_WIN) {
    if (flags.ARENA_PET_PICKED && !seen.CH0_ARENA_SPEED) return 'CH0_ARENA_SPEED';
    if (seen.CH0_ARENA_SPEED && !seen.CH0_ARENA_HOLD) return 'CH0_ARENA_HOLD';
    if (flags.ARENA_HOLD_DONE && !seen.CH0_ARENA_UNSLOT) return 'CH0_ARENA_UNSLOT';
  }
  if (path.startsWith('/battle/match') && flags.GEAR_EQUIPPED && !flags.ARENA_FIRST_WIN) {
    if (!seen.CH0_BATTLE_ACTION) return 'CH0_BATTLE_ACTION';
    if (flags.BATTLE_ACTION_PICKED && !seen.CH0_BATTLE_GO) return 'CH0_BATTLE_GO';
    if (flags.BATTLE_GO_DONE && !flags.BATTLE_WEAPON_CLICKED && !seen.CH0_BATTLE_HOLD) return 'CH0_BATTLE_HOLD';
  }
  if (
    isBattleMenu(path)
    && adopted
    && !flags.ARENA_FIRST_WIN
    && state.arenaResult === 'lose'
    && seen.CH0_ARENA_INTRO
    && state.arenaLossAck !== state.arenaLossId
  ) return 'CH0_ARENA_LOSE';
  if (isBattleMenu(path) && flags.ARENA_FIRST_WIN && !seen.CH0_ARENA_WIN) return 'CH0_ARENA_WIN';
  if (path.startsWith('/healia') && (seen.CH0_ARENA_WIN || seen.CH0_ARENA_LOSE) && !flags.HEAL_SERVICE_USED && !seen.CH0_HEALIA) return 'CH0_HEALIA';
  if (path.startsWith('/healia') && flags.HEAL_SERVICE_USED && (seen.CH0_ARENA_WIN || seen.CH0_ARENA_LOSE) && !seen.CH0_HEALIA_DONE) return 'CH0_HEALIA_DONE';
  if (isCapital(path) && flags.HEAL_SERVICE_USED && !flags.LETTER_QUEST_ACCEPTED && !flags.LETTER_DECLINED && !seen.CH0_ROWAN_INTRO) return 'CH0_ROWAN_INTRO';
  if (path.startsWith('/mail') && flags.LETTER_DECLINED && !flags.LETTER_QUEST_ACCEPTED) return 'CH0_ROWAN_RETRY';
  if ((isCapital(path) || path.startsWith('/mail')) && flags.LETTER_QUEST_ACCEPTED && !seen.CH0_ROWAN_ACCEPTED) return 'CH0_ROWAN_ACCEPTED';
  if (isCapital(path) && flags.LETTER_QUEST_ACCEPTED && state.portArmed && !seen.CH0_PORT) return 'CH0_PORT';
  if (path.startsWith('/region/3-1') && flags.FLOWER_REGION_ENTERED && !seen.CH0_DEPART) return 'CH0_DEPART';
  return null;
}

function guidanceFor(state, pathname) {
  if (!state || !state.enrolled || state.completed) return {};
  const flags = state.flags || {};
  const seen = state.seen || {};
  const path = pathname || '/';
  const guide = {};
  const lock = (id, submenu) => {
    guide.lock = id;
    if (submenu) guide.submenu = submenu;
  };

  if (!flags.STARTER_ADOPTED && seen.CH0_ARI_WELCOME) guide.capital = 'ORPHANAGE';
  if (!flags.STARTER_ADOPTED && path.startsWith('/orphanage') && !seen.CH0_ELINA_INTRO) lock('adopt');
  else if (flags.STARTER_ADOPTED && seen.CH0_ELINA_CONFIRM && !flags.HOME_RETURNED) {
    if (isCapital(path)) {
      guide.capital = 'MY_HOME';
      lock('capital-home');
    } else {
      lock('nav-features', '/myhome/mypet');
    }
  }
  else if (flags.HOME_RETURNED && seen.CH0_HOME && !flags.PET_PROFILE_VIEWED && path.startsWith('/myhome')) lock('mypet-card');
  else if (seen.CH0_PET_STATS && !flags.PET_STATUS_OPENED && path.startsWith('/pet/')) lock('pet-status');
  else if (seen.CH0_PET_RESTAURANT && !path.startsWith('/restaurant') && path.startsWith('/pet/')) lock('pet-restaurant');
  else if (seen.CH0_RESTAURANT && !flags.RESTAURANT_FED && path.startsWith('/restaurant')) lock('restaurant-normal');
  else if (seen.CH0_RESTAURANT_DONE && !flags.LOGO_HOME) lock('logo');
  else if (flags.LOGO_HOME && seen.CH0_GO_SHOP && !flags.STARTER_SUPPLIES_CLAIMED && isCapital(path)) {
    guide.capital = 'OFFICIAL_SHOP';
    lock('capital-shop');
  }
  else if (seen.CH0_SHOP_DONE && !path.startsWith('/inventory') && flags.STARTER_SUPPLIES_CLAIMED && !flags.GEAR_EQUIPPED) lock('nav-features', '/inventory');
  else if (seen.CH0_INVENTORY && !flags.EQUIP_TAB_OPENED && path.startsWith('/inventory')) lock('inventory-equipment');
  else if (seen.CH0_INVENTORY_EQUIP && !flags.GEAR_EQUIPPED && path.startsWith('/inventory')) lock('inventory-item');
  else if (flags.GEAR_EQUIPPED && seen.CH0_GEAR_READY && !flags.ARENA_FIRST_WIN && !state.arenaResult && !path.startsWith('/battle')) lock('nav-features', '/battle');
  else if (flags.GEAR_EQUIPPED && !flags.ARENA_FIRST_WIN && !state.arenaResult && path === '/battle' && seen.CH0_ARENA_INTRO) lock('arena-mode');
  else if (flags.GEAR_EQUIPPED && !flags.ARENA_FIRST_WIN && !state.arenaResult && path === '/battle/arena' && seen.CH0_ARENA_INTRO) lock('arena-npc');
  else if (path.startsWith('/battle/arena/select') && seen.CH0_ARENA_INTRO && !flags.ARENA_PET_PICKED) lock('bps-pet');
  else if (path.startsWith('/battle/arena/select') && seen.CH0_ARENA_HOLD && !flags.ARENA_HOLD_DONE) lock('bps-hold');
  else if (path.startsWith('/battle/arena/select') && seen.CH0_ARENA_UNSLOT && !flags.ARENA_FIRST_WIN) lock('bps-start');
  else if (path.startsWith('/battle/match') && seen.CH0_BATTLE_ACTION && !flags.BATTLE_ACTION_PICKED) lock('battle-action');
  else if (path.startsWith('/battle/match') && seen.CH0_BATTLE_GO && !flags.BATTLE_GO_DONE) lock('battle-go');
  else if (path.startsWith('/battle/match') && seen.CH0_BATTLE_HOLD && !flags.BATTLE_WEAPON_CLICKED) lock('battle-click');

  if (path.startsWith('/battle/arena/select') && flags.ARENA_PET_PICKED && !seen.CH0_ARENA_SPEED) {
    guide.marks = ['bps-speed'];
  }
  if (path.startsWith('/battle/match') && !seen.CH0_BATTLE_ACTION && !flags.ARENA_FIRST_WIN) {
    guide.marks = ['battle-action'];
  }
  if (path.startsWith('/battle/match') && flags.BATTLE_ACTION_PICKED && !seen.CH0_BATTLE_GO) {
    guide.marks = ['battle-go'];
  }
  if (path.startsWith('/battle/match') && flags.BATTLE_GO_DONE && !seen.CH0_BATTLE_HOLD) {
    guide.marks = ['battle-click'];
  }

  const battleTalkDone = Boolean(seen.CH0_ARENA_WIN || seen.CH0_ARENA_LOSE);
  if (battleTalkDone && !flags.HEAL_SERVICE_USED) {
    if (isCapital(path)) {
      guide.capital = 'HEALIA';
      lock('capital-healia');
    } else if (!path.startsWith('/healia')) {
      lock('logo');
    }
  }
  if (flags.LETTER_DECLINED && !flags.LETTER_QUEST_ACCEPTED && isCapital(path)) {
    guide.capital = 'POST_OFFICE';
  }
  if (flags.LETTER_QUEST_ACCEPTED && seen.CH0_ROWAN_ACCEPTED && !seen.CH0_PORT) guide.capital = 'CAPITAL_PORT';
  if (flags.LETTER_QUEST_ACCEPTED && seen.CH0_PORT && !flags.FLOWER_REGION_ENTERED) guide.worldRegion = '3-1';
  return guide;
}

function presentScene(sceneId) {
  if (!sceneId) return null;
  const pack = content();
  const scene = pack.scenes.find((item) => item.id === sceneId);
  if (!scene) return null;
  const steps = [];
  let lastSpeaker = 'NARRATOR';
  (scene.steps || []).forEach((step) => {
    if (step.kind === 'line') {
      lastSpeaker = step.speaker_id || lastSpeaker;
      const character = pack.characters[lastSpeaker];
      steps.push({
        type: 'line',
        speakerId: lastSpeaker,
        speaker: character ? character.name_vi : lastSpeaker,
        text: step.text_vi,
      });
      return;
    }
    if (step.kind === 'panel') {
      const character = pack.characters[step.speaker_id] || pack.characters.NARRATOR;
      steps.push({
        type: 'line',
        speakerId: step.speaker_id || 'NARRATOR',
        speaker: character ? character.name_vi : 'Người kể chuyện',
        text: step.text_vi,
        artKey: step.art_key || null,
      });
      return;
    }
    if (step.kind === 'choice') {
      steps.push({
        type: 'choice',
        prompt: step.prompt_vi,
        speakerId: lastSpeaker,
        options: (step.options || []).map((option) => ({
          id: option.id,
          text: option.text_vi,
          response: option.response_vi,
        })),
      });
      return;
    }
    if (step.kind === 'chapter_card' || (step.kind === 'action' && step.action === 'SHOW_CHAPTER_TITLE')) {
      steps.push({
        type: 'card',
        title: step.title_vi || 'CHƯƠNG 0',
        subtitle: step.subtitle_vi || '',
        artKey: step.art_key || null,
      });
      return;
    }
    if (step.kind === 'action') {
      steps.push({
        type: 'action',
        action: step.action,
        locationId: step.location_id || null,
        path: step.path || null,
      });
    }
  });
  const optional = sceneId === 'CH0_HEALIA';
  return {
    id: scene.id,
    skippable: scene.id === 'CH0_OPENING',
    dismissible: optional,
    questId: optional
      ? (scene.id === 'CH0_HOME' ? 'CH0_Q03' : scene.id === 'CH0_HEALIA' ? 'CH0_Q04' : 'CH0_Q05')
      : null,
    presentation: scene.type === 'NARRATION' || scene.type === 'CHAPTER' ? 'cinematic' : 'dialogue',
    steps,
  };
}

function applySeenSideEffects(state, sceneId) {
  state.seen[sceneId] = true;
  if (sceneId === 'CH0_OPENING') state.flags.INTRO_ACKNOWLEDGED = true;
  if (sceneId === 'CH0_PORT') state.portArmed = false;
  if (sceneId === 'CH0_DEPART') state.completed = true;
  if (sceneId === 'CH0_ARENA_LOSE') state.arenaLossAck = state.arenaLossId;
}

async function applyEvent(db, userId, body) {
  const state = await loadState(db, userId);
  if (!state) {
    const error = new Error('Không tìm thấy người chơi.');
    error.status = 404;
    throw error;
  }
  const type = String(body?.type || '');
  const sceneId = String(body?.sceneId || '');

  if (type === 'ENROLL') {
    const next = blankState();
    await saveState(db, userId, next);
    return next;
  }

  if (!state.enrolled) {
    const error = new Error('Chương 0 không mở với tài khoản này.');
    error.status = 409;
    throw error;
  }

  if (type === 'SCENE_SEEN') {
    if (!sceneId.startsWith('CH0_')) {
      const error = new Error('Cảnh không hợp lệ.');
      error.status = 400;
      throw error;
    }
    applySeenSideEffects(state, sceneId);
    if (sceneId === 'CH0_ELINA_INTRO') {
      const pets = await petCount(db, userId);
      if (pets > 0) state.flags.STARTER_ADOPTED = true;
    }
  } else if (type === 'CHOICE') {
    if (sceneId && body.choiceId) state.choices[sceneId] = String(body.choiceId);
  } else if (type === 'DISMISS_QUEST') {
    const questId = String(body.questId || '');
    if (!['CH0_Q03', 'CH0_Q04', 'CH0_Q05'].includes(questId)) {
      const error = new Error('Nhiệm vụ không thể bỏ qua.');
      error.status = 400;
      throw error;
    }
    state.dismissed[questId] = true;
  } else if (type === 'ADOPT_ACK') {
    if (state.flags.STARTER_ADOPTED) state.flags.ADOPT_ACKED = true;
  } else if (type === 'HOME_RETURNED') {
    if (state.flags.STARTER_ADOPTED) state.flags.HOME_RETURNED = true;
  } else if (type === 'PET_PROFILE_VIEWED') {
    if (state.flags.STARTER_ADOPTED) state.flags.PET_PROFILE_VIEWED = true;
  } else if (type === 'PET_STATUS_OPENED') {
    if (state.flags.PET_PROFILE_VIEWED) state.flags.PET_STATUS_OPENED = true;
  } else if (type === 'RESTAURANT_FED') {
    if (state.flags.STARTER_ADOPTED) state.flags.RESTAURANT_FED = true;
  } else if (type === 'LOGO_HOME') {
    if (state.flags.RESTAURANT_FED) state.flags.LOGO_HOME = true;
  } else if (type === 'EQUIP_TAB_OPENED') {
    if (state.flags.STARTER_SUPPLIES_CLAIMED) state.flags.EQUIP_TAB_OPENED = true;
  } else if (type === 'GEAR_EQUIPPED') {
    if (state.flags.STARTER_SUPPLIES_CLAIMED) state.flags.GEAR_EQUIPPED = true;
  } else if (type === 'ARENA_PET_PICKED') {
    if (state.flags.GEAR_EQUIPPED) state.flags.ARENA_PET_PICKED = true;
  } else if (type === 'ARENA_HOLD_DONE') {
    if (state.seen.CH0_ARENA_HOLD) state.flags.ARENA_HOLD_DONE = true;
  } else if (type === 'BATTLE_ACTION_PICKED') {
    if (state.seen.CH0_BATTLE_ACTION) state.flags.BATTLE_ACTION_PICKED = true;
  } else if (type === 'BATTLE_GO_DONE') {
    if (state.seen.CH0_BATTLE_GO) state.flags.BATTLE_GO_DONE = true;
  } else if (type === 'BATTLE_WEAPON_HELD') {
    if (state.seen.CH0_BATTLE_HOLD) state.flags.BATTLE_WEAPON_HELD = true;
  } else if (type === 'BATTLE_WEAPON_CLICKED') {
    if (state.seen.CH0_BATTLE_HOLD || state.flags.BATTLE_GO_DONE) state.flags.BATTLE_WEAPON_CLICKED = true;
  } else if (type === 'STARTER_SUPPLIES_CLAIMED') {
    if (state.flags.STARTER_ADOPTED && !state.flags.STARTER_SUPPLIES_CLAIMED) {
      state.flags.STARTER_SUPPLIES_CLAIMED = true;
      try {
        state.pendingRewards = await grantStarterKit(db, userId);
      } catch (err) {
        console.error('chapter0 starter kit:', err.message || err);
      }
    } else if (state.flags.STARTER_ADOPTED) {
      state.flags.STARTER_SUPPLIES_CLAIMED = true;
    }
  } else if (type === 'LETTER_ACCEPT') {
    if (!state.flags.HEAL_SERVICE_USED) {
      const error = new Error('Hãy để Pet hồi phục ở Sông Healia trước khi nhận thư.');
      error.status = 409;
      throw error;
    }
    state.flags.LETTER_QUEST_ACCEPTED = true;
    state.flags.LETTER_DECLINED = false;
    state.letterHeld = true;
  } else if (type === 'LETTER_DECLINE') {
    state.flags.LETTER_DECLINED = true;
    state.flags.LETTER_QUEST_ACCEPTED = false;
    state.portArmed = false;
  } else if (type === 'REWARDS_ACK') {
    state.pendingRewards = null;
  } else if (type === 'PORT_ARM') {
    if (state.flags.LETTER_QUEST_ACCEPTED) state.portArmed = true;
  } else if (type === 'FLOWER_REGION_ENTERED') {
    if (body.regionId === '3-1' && state.flags.LETTER_QUEST_ACCEPTED) {
      state.flags.FLOWER_REGION_ENTERED = true;
    }
  } else {
    const error = new Error('Sự kiện không hợp lệ.');
    error.status = 400;
    throw error;
  }

  await saveState(db, userId, state);
  return state;
}

async function markStarterAdopted(db, userId) {
  try {
    const state = await loadState(db, userId);
    if (!state || !state.enrolled || state.flags.STARTER_ADOPTED) return;
    state.flags.STARTER_ADOPTED = true;
    await saveState(db, userId, state);
  } catch (err) {
    console.error('chapter0 adopt:', err.message || err);
  }
}

async function markHealed(db, userId) {
  try {
    const state = await loadState(db, userId);
    if (!state || !state.enrolled || !state.flags.STARTER_ADOPTED || state.flags.HEAL_SERVICE_USED) return;
    state.flags.HEAL_SERVICE_USED = true;
    await saveState(db, userId, state);
  } catch (err) {
    console.error('chapter0 heal:', err.message || err);
  }
}

async function markArenaResult(db, userId, won, battleSource) {
  try {
    if (battleSource !== 'arena') return;
    const state = await loadState(db, userId);
    if (!state || !state.enrolled || !state.flags.STARTER_ADOPTED || state.flags.ARENA_FIRST_WIN) return;
    if (won) {
      state.flags.ARENA_FIRST_WIN = true;
      state.arenaResult = 'win';
    } else {
      state.arenaResult = 'lose';
      state.arenaLossId = Number(state.arenaLossId || 0) + 1;
    }
    await saveState(db, userId, state);
  } catch (err) {
    console.error('chapter0 arena:', err.message || err);
  }
}

function textOf(item) {
  return `${item.subtype || ''} ${item.category || ''} ${item.name || ''} ${item.type || ''}`.toLowerCase();
}

async function grantStarterKit(db, userId) {
  const [rows] = await db.query(
    'SELECT id, name, type, subtype, category, stackable, image_url FROM items WHERE magic_value = 1'
  );
  const list = rows || [];
  const foods = list.filter((item) => String(item.type || '').toLowerCase() === 'food');
  const food = foods[Math.floor(Math.random() * foods.length)];
  const sword = list.find((item) => /sword|kiếm|kiem/.test(textOf(item)));
  const shield = list.find((item) => /shield|khiên|khien/.test(textOf(item)));
  const granted = [];
  for (const item of [food, sword, shield]) {
    if (!item) continue;
    granted.push({
      name: item.name || 'Vật phẩm',
      image: item.image_url || '',
      type: item.type || '',
    });
    const isEquipment = String(item.type || '').toLowerCase() === 'equipment';
    if (isEquipment) {
      const [equipInfo] = await db.query('SELECT durability_max FROM equipment_data WHERE item_id = ?', [item.id]);
      const durability = equipInfo.length ? (equipInfo[0].durability_max ?? 1) : 1;
      await db.query(
        'INSERT INTO inventory (player_id, item_id, quantity, is_equipped, durability_left) VALUES (?, ?, 1, 0, ?)',
        [userId, item.id, durability]
      );
    } else {
      const [inv] = await db.query(
        'SELECT id FROM inventory WHERE player_id = ? AND item_id = ? AND (is_equipped = 0 OR is_equipped IS NULL) LIMIT 1',
        [userId, item.id]
      );
      if (inv.length) {
        await db.query('UPDATE inventory SET quantity = quantity + 1 WHERE id = ?', [inv[0].id]);
      } else {
        await db.query('INSERT INTO inventory (player_id, item_id, quantity) VALUES (?, ?, 1)', [userId, item.id]);
      }
    }
  }
  return granted;
}

function publicView(state, pathname) {
  const sceneId = selectScene(state, pathname);
  const guide = guidanceFor(state, pathname);
  const spots = content().transitions.locations || {};
  const spotlight = (key) => {
    const loc = spots[key];
    if (!loc?.spotlight) return null;
    return { ...loc.spotlight, route: loc.route || null };
  };
  return {
    enrolled: Boolean(state.enrolled),
    legacyExempt: Boolean(state.legacyExempt),
    completed: Boolean(state.completed),
    flags: state.flags || {},
    rewards: state.pendingRewards || [],
    guidance: guide,
    spotlights: {
      MY_HOME: spotlight('MY_HOME'),
      ORPHANAGE: spotlight('ORPHANAGE'),
      CAPITAL_PORT: spotlight('CAPITAL_PORT'),
      POST_OFFICE: spotlight('POST_OFFICE'),
      HEALIA: spotlight('HEALIA'),
      OFFICIAL_SHOP: spotlight('OFFICIAL_SHOP'),
      RESTAURANT: spotlight('RESTAURANT'),
      ENTERTAINMENT: spotlight('ENTERTAINMENT'),
    },
    postOfficeHotspotId: spots.POST_OFFICE?.castle_hotspot_id || 6,
    shopHotspotId: spots.OFFICIAL_SHOP?.castle_hotspot_id || 1,
    scene: presentScene(sceneId),
  };
}

module.exports = {
  loadState,
  saveState,
  applyEvent,
  markStarterAdopted,
  markHealed,
  markArenaResult,
  publicView,
  selectScene,
  guidanceFor,
  blankState,
};
