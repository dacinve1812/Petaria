/**
 * Champion Challenge — NPC / ải test đội hình.
 * Cả user và NPC: không mang pet trùng species trong cùng formation.
 */

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

/** @type {Array<{
 *   npcId: string,
 *   name: string,
 *   portrait: string,
 *   level: number,
 *   description: string,
 *   formations: { '3v3': ChampionFormationPet[], '5v5': ChampionFormationPet[] }
 * }>} */
export const CHAMPION_NPCS = [
  {
    npcId: 'guardian-triad',
    name: 'Tam Hộ Vệ',
    portrait: 'charizard.png',
    level: 25,
    description:
      'NPC test đội hình. Mỗi pet có skill Tấn công thường — win khi hạ hết đội, không cộng EXP.',
    formations: {
      // SPD giảm dần: 48 → 36 → 28 — team total SPD cao để test xen kẽ
      '3v3': [
        withStats(
          { slotKey: 'e1', name: 'Bulbasaur', image: 'Bulbasaur.png', level: 24 },
          { hp: 320, str: 42, def: 38, spd: 36 }
        ),
        withStats(
          { slotKey: 'e2', name: 'Charmander', image: 'charmander.png', level: 25 },
          { hp: 280, str: 48, def: 30, spd: 48 }
        ),
        withStats(
          { slotKey: 'e3', name: 'Cyndaquil', image: 'cyndaquil.png', level: 23 },
          { hp: 260, str: 40, def: 32, spd: 28 }
        ),
      ],
      // SPD: 55, 44, 38, 30, 22 — dễ nhìn thứ tự xen kẽ trên speedbar
      '5v5': [
        withStats(
          { slotKey: 'e1', name: 'Bulbasaur', image: 'Bulbasaur.png', level: 22 },
          { hp: 300, str: 38, def: 40, spd: 30 }
        ),
        withStats(
          { slotKey: 'e2', name: 'Charmander', image: 'charmander.png', level: 24 },
          { hp: 270, str: 46, def: 28, spd: 44 }
        ),
        withStats(
          { slotKey: 'e3', name: 'Cyndaquil', image: 'cyndaquil.png', level: 23 },
          { hp: 250, str: 40, def: 30, spd: 38 }
        ),
        withStats(
          { slotKey: 'e4', name: 'Eevee', image: 'eevee.png', level: 25 },
          { hp: 290, str: 36, def: 34, spd: 55 }
        ),
        withStats(
          { slotKey: 'e5', name: 'Charizard', image: 'charizard.png', level: 30 },
          { hp: 420, str: 58, def: 42, spd: 22 }
        ),
      ],
    },
  },
];

export function getChampionNpc(npcId) {
  return CHAMPION_NPCS.find((n) => n.npcId === npcId) || null;
}

export function getChampionFormation(npc, mode) {
  if (!npc?.formations) return [];
  const key = mode === '5v5' ? '5v5' : '3v3';
  return Array.isArray(npc.formations[key]) ? npc.formations[key] : [];
}
