/**
 * Giải Vương — NPC test đội hình 3v3 / 5v5.
 * Cả user và NPC: không mang pet trùng species trong cùng formation.
 *
 * Mốc test: Erika ~Lv.10, Sabrina >30, Lance >50.
 * Sprite lửa (Arcanine, Rapidash, Magmar, Ninetales, Charizard) chưa có trong public/images/pets.
 */

import formationSystem from '../../data/formationSystem';

/** Skill tấn công thường — dùng để test dmg + turn log */
export const CHAMPION_NORMAL_ATTACK = {
  id: 'atk-normal',
  name: 'Tấn công thường',
  type: 'attack',
  power_min: 80,
  power_max: 100,
  accuracy: 100,
};

/** @typedef {{
 *   slotKey: string,
 *   name: string,
 *   image: string,
 *   level: number,
 *   hp?: number,
 *   str?: number,
 *   def?: number,
 *   spd?: number,
 *   final_stats?: { hp: number, str: number, def: number, spd: number },
 *   skills?: Array<typeof CHAMPION_NORMAL_ATTACK>,
 *   action_pattern?: Array<string|number>
 * }} ChampionFormationPet */

function withStats(pet, stats) {
  return {
    ...pet,
    hp: stats.hp,
    str: stats.str,
    def: stats.def,
    spd: stats.spd,
    final_stats: { ...stats },
    skills: [CHAMPION_NORMAL_ATTACK],
    action_pattern: [CHAMPION_NORMAL_ATTACK.id],
  };
}

function unit(slotKey, name, image, level, hp, str, def, spd) {
  return withStats({ slotKey, name, image, level }, { hp, str, def, spd });
}

/** @type {Array<{
 *   npcId: string,
 *   name: string,
 *   portrait: string,
 *   level: number,
 *   element: string,
 *   elementLabel: string,
 *   description: string,
 *   formations: { '3v3': ChampionFormationPet[], '5v5': ChampionFormationPet[] }
 * }>} */
export const CHAMPION_NPCS = [
  {
    npcId: 'erika',
    name: 'Erika',
    portrait: '/images/character/Erika.png',
    level: 12,
    element: 'grass',
    elementLabel: 'Cỏ',
    description: 'Mốc test khoảng Lv.10.',
    formations: {
      '3v3': [
        unit('e1', 'Vileplume', 'Vileplume.png', 12, 168, 26, 22, 20),
        unit('e2', 'Victreebel', 'Victreebel.png', 11, 150, 28, 16, 34),
        unit('e3', 'Tangela', 'Tangela.png', 10, 176, 20, 26, 12),
      ],
      '5v5': [
        unit('e1', 'Vileplume', 'Vileplume.png', 12, 168, 26, 22, 20),
        unit('e2', 'Victreebel', 'Victreebel.png', 11, 150, 28, 16, 34),
        unit('e3', 'Tangela', 'Tangela.png', 10, 176, 20, 26, 12),
        unit('e4', 'Exeggutor', 'Exeggutor.png', 12, 190, 30, 24, 16),
        unit('e5', 'Venusaur', 'Venusaur.png', 13, 210, 28, 26, 24),
      ],
    },
  },
  {
    npcId: 'sabrina',
    name: 'Sabrina',
    portrait: '/images/character/Sabrina.png',
    level: 35,
    element: 'psychic',
    elementLabel: 'Siêu năng',
    description: 'Mốc test trên Lv.30.',
    formations: {
      '3v3': [
        unit('e1', 'Alakazam', 'Alakazam.png', 36, 340, 72, 38, 52),
        unit('e2', 'Mr. Mime', 'MrMime.png', 34, 360, 58, 52, 30),
        unit('e3', 'Espeon', 'Espeon.png', 33, 320, 64, 40, 44),
      ],
      '5v5': [
        unit('e1', 'Alakazam', 'Alakazam.png', 36, 340, 72, 38, 52),
        unit('e2', 'Mr. Mime', 'MrMime.png', 34, 360, 58, 52, 30),
        unit('e3', 'Espeon', 'Espeon.png', 33, 320, 64, 40, 44),
        unit('e4', 'Slowbro', 'Slowbro.png', 32, 480, 52, 62, 16),
        unit('e5', 'Mega Alakazam', 'Alakazam_Mega.png', 38, 380, 88, 42, 60),
      ],
    },
  },
  {
    npcId: 'lance',
    name: 'Lance',
    portrait: '/images/character/Lance.jpg',
    level: 55,
    element: 'dragon',
    elementLabel: 'Rồng',
    description: 'Mốc test trên Lv.50.',
    formations: {
      '3v3': [
        unit('e1', 'Arcanine', 'Arcanine.png', 55, 640, 100, 72, 44),
        unit('e2', 'Rapidash', 'Rapidash.png', 52, 560, 92, 64, 64),
        unit('e3', 'Magmar', 'Magmar.png', 50, 580, 98, 60, 28),
      ],
      '5v5': [
        unit('e1', 'Arcanine', 'Arcanine.png', 55, 640, 100, 72, 44),
        unit('e2', 'Rapidash', 'Rapidash.png', 52, 560, 92, 64, 64),
        unit('e3', 'Magmar', 'Magmar.png', 50, 580, 98, 60, 28),
        unit('e4', 'Ninetales', 'Ninetales.png', 54, 540, 94, 66, 52),
        unit('e5', 'Charizard', 'Charizard.png', 58, 720, 112, 76, 36),
      ],
    },
  },
];

export function getChampionNpc(npcId) {
  return readChampionRoster().find((n) => n.npcId === npcId) || null;
}

export function getChampionFormation(npc, mode) {
  if (!npc?.formations) return [];
  const key = mode === '5v5' ? '5v5' : '3v3';
  return Array.isArray(npc.formations[key]) ? npc.formations[key] : [];
}

const CHAMPION_STORAGE_KEY = 'petaria-champion-pve-v1';

function normalizeChampionFormation(raw, mode) {
  return formationSystem.normalizeFormationId(raw, mode);
}

export function championFormationId(npc, mode) {
  const key = mode === '5v5' ? '5v5' : '3v3';
  return normalizeChampionFormation(npc?.formationIds?.[key], key);
}

function cloneRoster(list) {
  return JSON.parse(JSON.stringify(list));
}

function hydratePet(pet) {
  const hydrated = withStats(
    {
      slotKey: pet.slotKey,
      name: pet.name || '',
      image: pet.image || '',
      level: Number(pet.level) || 1,
    },
    {
      hp: Number(pet.hp) || 0,
      str: Number(pet.str) || 0,
      def: Number(pet.def) || 0,
      spd: Number(pet.spd) || 0,
    }
  );
  if (pet.autoStats) hydrated.autoStats = true;
  return hydrated;
}

function hydrateNpc(npc, fallback) {
  const base = fallback || npc;
  const formations = {};
  ['3v3', '5v5'].forEach((mode) => {
    const savedPets = npc?.formations?.[mode];
    const defaultPets = base?.formations?.[mode] || [];
    const source = Array.isArray(savedPets) ? savedPets : defaultPets;
    formations[mode] = source.map((pet, index) => {
      const byKey = defaultPets.find((item) => item.slotKey === pet.slotKey);
      return hydratePet({
        ...(byKey || {}),
        ...pet,
        slotKey: `e${index + 1}`,
      });
    });
  });
  return {
    npcId: base.npcId,
    name: npc?.name ?? base.name,
    portrait: npc?.portrait ?? base.portrait,
    level: Number(npc?.level ?? base.level) || 1,
    element: npc?.element ?? base.element,
    elementLabel: npc?.elementLabel ?? base.elementLabel,
    description: npc?.description ?? base.description,
    formationIds: {
      '3v3': normalizeChampionFormation(npc?.formationIds?.['3v3'] || base?.formationIds?.['3v3'], '3v3'),
      '5v5': normalizeChampionFormation(npc?.formationIds?.['5v5'] || base?.formationIds?.['5v5'], '5v5'),
    },
    modes: Array.isArray(npc?.modes)
      ? [...new Set(npc.modes.filter((mode) => mode === '3v3' || mode === '5v5'))]
      : ['3v3', '5v5'],
    formations,
  };
}

export function championNpcInMode(npc, mode) {
  const key = mode === '5v5' ? '5v5' : '3v3';
  const modes = Array.isArray(npc?.modes) ? npc.modes : ['3v3', '5v5'];
  return modes.includes(key);
}

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

let memoryRoster = null;
let loadPromise = null;
let loadGen = 0;

function hydrateSavedList(savedList) {
  const defaults = cloneRoster(CHAMPION_NPCS);
  return (Array.isArray(savedList) ? savedList : [])
    .filter((npc) => npc && npc.npcId)
    .map((npc) => hydrateNpc(npc, defaults.find((item) => item.npcId === npc.npcId) || npc));
}

function readStoredList() {
  try {
    const raw = localStorage.getItem(CHAMPION_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved?.npcs)) return null;
    return hydrateSavedList(saved.npcs);
  } catch {
    return null;
  }
}

function publishRoster(npcs) {
  memoryRoster = npcs;
  try {
    localStorage.setItem(CHAMPION_STORAGE_KEY, JSON.stringify({ npcs }));
  } catch {
    /* bộ nhớ trình duyệt đầy thì vẫn giữ bản trên server */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('petaria-champion-roster'));
  }
  return npcs;
}

/** Bản đang dùng: server nếu đã tải, không thì bản cache rồi mới tới mặc định trong mã. */
export function readChampionRoster() {
  if (memoryRoster) return memoryRoster;
  return readStoredList() || championRosterDefaults();
}

export function peekLocalChampionRoster() {
  return readStoredList();
}

export function fetchChampionRoster({ force = false } = {}) {
  if (force) loadPromise = null;
  if (loadPromise) return loadPromise;
  const gen = ++loadGen;
  loadPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/champion-pve`);
    if (!res.ok) throw new Error('Không tải được Champion PVE');
    const data = await res.json();
    if (gen !== loadGen) return { roster: readChampionRoster(), stored: true };
    if (!data?.stored || !Array.isArray(data.npcs)) {
      loadPromise = null;
      return { roster: readChampionRoster(), stored: false };
    }
    return { roster: publishRoster(hydrateSavedList(data.npcs)), stored: true };
  })().catch((err) => {
    if (gen === loadGen) loadPromise = null;
    throw err;
  });
  return loadPromise;
}

export async function writeChampionRoster(roster, token) {
  const npcs = (roster || []).map((npc) => {
    const fallback = CHAMPION_NPCS.find((n) => n.npcId === npc.npcId);
    return hydrateNpc(npc, fallback || npc);
  });
  loadGen += 1;
  const res = await fetch(`${API_BASE}/api/admin/champion-pve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ npcs }),
  });
  if (!res.ok) {
    let message = 'Không lưu được Champion PVE';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* giữ message mặc định */
    }
    throw new Error(message);
  }
  const published = publishRoster(npcs);
  loadPromise = Promise.resolve({ roster: published, stored: true });
  return published;
}

export function championRosterDefaults() {
  return cloneRoster(CHAMPION_NPCS).map((npc) => hydrateNpc(npc, npc));
}
