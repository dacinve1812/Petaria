/**
 * Champion Challenge.
 * 3v3: Gym / Elite, Lv.22 → Lv.330.
 * 5v5: nhà vô địch, Lv.200 → Lv.1000. Mỗi đội đúng 5 pet.
 *
 * Stat: IV 31. STR/DEF lấy chỉ số tấn công hoặc phòng thủ cao hơn
 * (vật lý hoặc đặc biệt). Medicham STR 120 (Pure Power).
 * Pikachu STR 110 (Light Ball). Aegislash lấy STR dạng kiếm và DEF dạng khiên.
 * Mega Gardevoir / Mega Garchomp dùng chỉ số mega.
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
function gymNpc(npcId, name, element, elementLabel, level, pets) {
  return {
    npcId,
    name,
    portrait: `/images/character/${name}.png`,
    level,
    element,
    elementLabel,
    description: npcId === 'drake' || npcId === 'caitlin' ? 'Hạng Elite' : 'Hạng Gym',
    modes: ['3v3'],
    formationIds: { '3v3': '2-1', '5v5': '3-2' },
    formations: {
      '3v3': pets,
      '5v5': [],
    },
  };
}

function championNpc(npcId, name, element, elementLabel, level, pets) {
  return {
    npcId,
    name,
    portrait: `/images/character/${name}.png`,
    level,
    element,
    elementLabel,
    description: 'Hạng Champion',
    modes: ['5v5'],
    formationIds: { '3v3': '2-1', '5v5': '3-2' },
    formations: {
      '3v3': [],
      '5v5': pets,
    },
  };
}

export const CHAMPION_NPCS = [
  gymNpc('erika', 'Erika', 'grass', 'Cỏ', 22, [
    unit('e1', 'Vileplume', 'Vileplume.png', 24, 385, 65, 55, 36),
    unit('e2', 'Victreebel', 'Victreebel.png', 22, 370, 58, 42, 42),
    unit('e3', 'Tangela', 'Tangela.png', 20, 310, 51, 57, 35),
  ]),
  gymNpc('sabrina', 'Sabrina', 'psychic', 'Siêu năng', 40, [
    unit('e1', 'Alakazam', 'Alakazam.png', 42, 555, 131, 97, 118),
    unit('e2', 'Mr. Mime', 'MrMime.png', 40, 470, 97, 113, 89),
    unit('e3', 'Espeon', 'Espeon.png', 38, 545, 115, 88, 100),
  ]),
  gymNpc('blaine', 'Blaine', 'fire', 'Lửa', 58, [
    unit('e1', 'Arcanine', 'Arcanine.png', 60, 980, 155, 119, 137),
    unit('e2', 'Rapidash', 'Rapidash.png', 58, 805, 138, 115, 144),
    unit('e3', 'Magmar', 'Magmar.png', 56, 780, 134, 117, 126),
  ]),
  gymNpc('bugsy', 'Bugsy', 'bug', 'Bọ', 78, [
    unit('e1', 'Scizor', 'Scizor.png', 80, 1130, 237, 189, 133),
    unit('e2', 'Heracross', 'Heracross.png', 78, 1180, 224, 177, 161),
    unit('e3', 'Ariados', 'Ariados.png', 76, 1075, 165, 134, 89),
  ]),
  gymNpc('jasmine', 'Jasmine', 'steel', 'Thép', 100, [
    unit('e1', 'Steelix', 'Steelix.png', 102, 1480, 210, 444, 97),
    unit('e2', 'Magneton', 'Magneton.png', 100, 1205, 276, 226, 176),
    unit('e3', 'Skarmory', 'Skarmory.png', 98, 1325, 192, 309, 172),
  ]),
  gymNpc('brawly', 'Brawly', 'fighting', 'Giác đấu', 125, [
    unit('e1', 'Hariyama', 'Hariyama.png', 128, 2730, 351, 198, 172),
    unit('e2', 'Machamp', 'Machamp.png', 125, 1990, 368, 256, 181),
    unit('e3', 'Medicham', 'Medicham.png', 122, 1580, 335, 225, 238),
  ]),
  gymNpc('winona', 'Winona', 'flying', 'Bay', 152, [
    unit('e1', 'Altaria', 'Altaria.png', 155, 2225, 270, 378, 301),
    unit('e2', 'Skarmory', 'Skarmory.png', 152, 2030, 295, 477, 264),
    unit('e3', 'Pelipper', 'Pelipper.png', 148, 1905, 332, 346, 243),
  ]),
  gymNpc('drake', 'Drake', 'dragon', 'Rồng', 185, [
    unit('e1', 'Salamence', 'Salamance.png', 190, 3095, 576, 367, 443),
    unit('e2', 'Flygon', 'Flygon.png', 185, 2740, 432, 358, 432),
    unit('e3', 'Kingdra', 'Kingdra.png', 180, 2575, 402, 402, 366),
  ]),
  gymNpc('byron', 'Byron', 'steel', 'Thép', 215, [
    unit('e1', 'Bastiodon', 'Bastiodon.png', 218, 2785, 299, 805, 203),
    unit('e2', 'Steelix', 'Steelix.png', 215, 3070, 437, 931, 200),
    unit('e3', 'Aggron', 'Aggron.png', 210, 2895, 532, 826, 280),
  ]),
  gymNpc('volkner', 'Volkner', 'electric', 'Điện', 248, [
    unit('e1', 'Luxray', 'Luxray.png', 252, 3715, 687, 481, 435),
    unit('e2', 'Electivire', 'Electivire.png', 248, 3530, 691, 503, 553),
    unit('e3', 'Raichu', 'Raichu.png', 244, 3110, 519, 471, 617),
  ]),
  gymNpc('drayden', 'Drayden', 'dragon', 'Rồng', 285, [
    unit('e1', 'Haxorus', 'Haxorus.png', 290, 4150, 947, 616, 657),
    unit('e2', 'Druddigon', 'Druddigon.png', 285, 4110, 777, 606, 366),
    unit('e3', 'Hydreigon', 'Hydreigon.png', 280, 4460, 791, 595, 640),
  ]),
  gymNpc('caitlin', 'Caitlin', 'psychic', 'Siêu năng', 330, [
    unit('e1', 'Gothitelle', 'Gothitelle.png', 338, 4625, 751, 853, 549),
    unit('e2', 'Reuniclus', 'Reuniclus.png', 330, 5840, 932, 668, 305),
    unit('e3', 'Musharna', 'Musharna.png', 322, 5890, 793, 716, 291),
  ]),
  championNpc('blue', 'Blue', 'flying', 'Bay', 200, [
    unit('e1', 'Pidgeot', 'Pidgeot.png', 208, 3135, 402, 381, 489),
    unit('e2', 'Gyarados', 'Gyarados.png', 204, 3320, 578, 476, 398),
    unit('e3', 'Exeggutor', 'Exeggutor.png', 200, 3260, 567, 407, 287),
    unit('e4', 'Rhydon', 'Rhydon.png', 196, 3390, 575, 536, 222),
    unit('e5', 'Alakazam', 'Alakazam.png', 192, 2360, 582, 429, 525),
  ]),
  championNpc('iris', 'Iris', 'dragon', 'Rồng', 300, [
    unit('e1', 'Haxorus', 'Haxorus.png', 312, 4460, 1019, 663, 707),
    unit('e2', 'Hydreigon', 'Hydreigon.png', 306, 4865, 864, 650, 699),
    unit('e3', 'Druddigon', 'Druddigon.png', 300, 4325, 818, 638, 386),
    unit('e4', 'Archeops', 'Archeops.png', 294, 4180, 919, 478, 742),
    unit('e5', 'Aggron', 'Aggron.png', 288, 3950, 727, 1131, 382),
  ]),
  championNpc('alder', 'Alder', 'bug', 'Bọ', 400, [
    unit('e1', 'Volcarona', 'Volcarona.png', 416, 6310, 1257, 1007, 965),
    unit('e2', 'Bouffalant', 'Bouffalant.png', 408, 6595, 1029, 906, 580),
    unit('e3', 'Druddigon', 'Druddigon.png', 400, 5750, 1089, 849, 513),
    unit('e4', 'Vanilluxe', 'Vanilluxe.png', 392, 5400, 988, 871, 745),
    unit('e5', 'Escavalier', 'Escavalier.png', 384, 5250, 1160, 930, 277),
  ]),
  championNpc('lance', 'Lance', 'dragon', 'Rồng', 500, [
    unit('e1', 'Dragonite', 'Dragonite.png', 520, 8185, 1559, 1206, 998),
    unit('e2', 'Dragonite', 'Dragonite.png', 510, 8030, 1529, 1183, 979),
    unit('e3', 'Charizard', 'Charizard.png', 500, 7225, 1250, 1010, 1160),
    unit('e4', 'Aerodactyl', 'Aerodactyl.png', 490, 7175, 1185, 891, 1430),
    unit('e5', 'Gyarados', 'Gyarados.png', 480, 7750, 1353, 1113, 931),
  ]),
  championNpc('diantha', 'Diantha', 'fairy', 'Tiên', 600, [
    unit('e1', 'Mega Gardevoir', 'Gardevoir_Mega.png', 624, 8380, 2257, 1883, 1446),
    unit('e2', 'Hawlucha', 'Hawlucha.png', 612, 8830, 1320, 1112, 1639),
    unit('e3', 'Tyrantrum', 'Tyrantrum.png', 600, 8900, 1643, 1619, 1043),
    unit('e4', 'Goodra', 'Goodra.png', 588, 9190, 1480, 1951, 1128),
    unit('e5', 'Gourgeist', 'Gourgeist.png', 576, 7565, 1220, 1589, 1151),
  ]),
  championNpc('steven', 'Steven', 'steel', 'Thép', 700, [
    unit('e1', 'Metagross', 'Metagross.png', 728, 10640, 2196, 2123, 1249),
    unit('e2', 'Skarmory', 'Skarmory.png', 714, 9365, 1368, 2225, 1225),
    unit('e3', 'Aggron', 'Aggron.png', 700, 9535, 1762, 2742, 922),
    unit('e4', 'Claydol', 'Claydol.png', 686, 8655, 1178, 1864, 1246),
    unit('e5', 'Cradily', 'Cradily.png', 672, 10230, 1301, 1651, 791),
  ]),
  championNpc('cynthia', 'Cynthia', 'dragon', 'Rồng', 800, [
    unit('e1', 'Mega Garchomp', 'Garchomp_MegaEvolution.png', 832, 14485, 3091, 2176, 1793),
    unit('e2', 'Milotic', 'Milotic.png', 816, 13145, 1889, 2297, 1579),
    unit('e3', 'Lucario', 'Lucario.png', 800, 10890, 2093, 1373, 1693),
    unit('e4', 'Roserade', 'Roserade.png', 784, 9885, 2208, 1894, 1659),
    unit('e5', 'Spiritomb', 'Spiritomb.png', 768, 8920, 1656, 1901, 780),
  ]),
  championNpc('leon', 'Leon', 'fire', 'Lửa', 900, [
    unit('e1', 'Charizard', 'Charizard.png', 936, 13480, 2335, 1886, 2167),
    unit('e2', 'Aegislash', 'Aegislash.png', 918, 11570, 3043, 2859, 1391),
    unit('e3', 'Dragapult', 'Dragapult.png', 900, 13865, 2444, 1634, 2840),
    unit('e4', 'Haxorus', 'Haxorus.png', 882, 12530, 2871, 1866, 1989),
    unit('e5', 'Seismitoad', 'Seismitoad.png', 864, 14780, 1914, 1568, 1551),
  ]),
  championNpc('red', 'Red', 'electric', 'Điện', 1000, [
    unit('e1', 'Pikachu', 'Pikachu.png', 1040, 10500, 2615, 1367, 2199),
    unit('e2', 'Charizard', 'Charizard.png', 1020, 14685, 2544, 2055, 2361),
    unit('e3', 'Venusaur', 'Venusaur.png', 1000, 14600, 2315, 2315, 1915),
    unit('e4', 'Blastoise', 'Blastoise.png', 980, 14210, 1974, 2366, 1837),
    unit('e5', 'Snorlax', 'Snorlax.png', 960, 21695, 2414, 2414, 878),
  ]),
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
