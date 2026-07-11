import { FOREST_MAP } from './forest/mapData.js';
import { getCustomMap } from '../../utils/huntingMapsStorage.js';
import { normalizeEncounterPool } from '../../utils/huntingEncounterPool.js';

const BUILTIN = {
  forest: FOREST_MAP,
};

/**
 * Chuẩn hóa map từ JSON/storage/API để Phaser dùng được.
 * @param {import('../../utils/huntingMapsStorage').HuntingMapRecord} rec
 */
export function normalizeHuntingMapRecord(rec) {
  const bg = rec.assets?.background || '';
  const rawFg = (rec.assets?.foreground || '').trim();
  // Không lặp ảnh nền làm foreground — lớp fg đè sprite (depth 2 > hero 1).
  const foreground = rawFg && rawFg !== bg ? rawFg : null;
  const rawMax = rec.maxSteps;
  const maxSteps =
    rawMax != null && rawMax !== '' && Number.isFinite(Number(rawMax)) && Number(rawMax) > 0
      ? Math.floor(Number(rawMax))
      : null;
  const requireMinLevel = Math.max(0, Math.floor(Number(rec.requireMinLevel)) || 0);
  let encounterLevelMin = Math.max(1, Math.floor(Number(rec.encounterLevelMin)) || 1);
  let encounterLevelMax = Math.max(1, Math.floor(Number(rec.encounterLevelMax)) || 1);
  if (encounterLevelMax < encounterLevelMin) {
    const t = encounterLevelMin;
    encounterLevelMin = encounterLevelMax;
    encounterLevelMax = t;
  }
  const sx = Number(rec.start?.x);
  const sy = Number(rec.start?.y);
  return {
    id: rec.id,
    width: Math.floor(Number(rec.width)) || 1,
    height: Math.floor(Number(rec.height)) || 1,
    tileSize: Math.floor(Number(rec.tileSize)) || 16,
    maxSteps,
    requireMinLevel,
    encounterLevelMin,
    encounterLevelMax,
    start: {
      x: Number.isFinite(sx) ? Math.floor(sx) : 0,
      y: Number.isFinite(sy) ? Math.floor(sy) : 0,
    },
    assets: {
      background: rec.assets.background,
      foreground,
    },
    tiles: rec.tiles instanceof Uint8Array ? rec.tiles : new Uint8Array(rec.tiles),
    encounterPool: normalizeEncounterPool(rec.encounterPool),
  };
}

/** Tên cũ khi refactor — cùng một hàm với `normalizeHuntingMapRecord` (tránh no-undef / import sót). */
export const normalizeStoredMap = normalizeHuntingMapRecord;

/**
 * @param {string | undefined} mapId route param từ /hunting-world/map/:id
 * @returns {typeof FOREST_MAP}
 */
export function getHuntingMap(mapId) {
  const id = String(mapId || 'forest').toLowerCase();
  const custom = getCustomMap(id);
  if (custom && custom.tiles && custom.width && custom.height) {
    try {
      return normalizeHuntingMapRecord(custom);
    } catch (e) {
      console.warn('[hunting] Map custom lỗi, fallback forest:', id, e);
    }
  }
  return BUILTIN[id] || FOREST_MAP;
}

export function getBuiltinMapIds() {
  return Object.keys(BUILTIN);
}
