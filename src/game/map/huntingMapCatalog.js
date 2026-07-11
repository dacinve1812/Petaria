import { loadAllCustomMaps } from '../../utils/huntingMapsStorage.js';

/** Built-in map: không nằm trong localStorage/DB admin. */
export const BUILTIN_FOREST_ENTRY = {
  id: 'forest',
  name: 'Rừng (built-in)',
  entryFee: 0,
  currency: 'peta',
  maxSteps: null,
  thumb: '/hunting/maps/forest-map.png',
  builtIn: true,
  requireMinLevel: 0,
  encounterLevelMin: 1,
  encounterLevelMax: 1,
};

function catalogLevelFields(m) {
  const requireMinLevel = Math.max(0, Number(m.requireMinLevel) || 0);
  let encounterLevelMin = Math.max(1, Number(m.encounterLevelMin) || 1);
  let encounterLevelMax = Math.max(1, Number(m.encounterLevelMax) || 1);
  if (encounterLevelMax < encounterLevelMin) {
    const t = encounterLevelMin;
    encounterLevelMin = encounterLevelMax;
    encounterLevelMax = t;
  }
  return { requireMinLevel, encounterLevelMin, encounterLevelMax };
}

/**
 * Gộp danh sách từ API (ưu tiên) với map chỉ có trong localStorage.
 * @param {Array<Record<string, unknown>>} remoteRows — từ GET /api/hunting/maps
 * @param {Record<string, import('../../utils/huntingMapsStorage').HuntingMapRecord>} [localOnly]
 */
export function mergeRemoteAndLocalHuntingCatalog(remoteRows, localOnly = {}) {
  const fromRemote = (Array.isArray(remoteRows) ? remoteRows : []).map((m) => ({
    id: m.id,
    name: m.name || m.id,
    entryFee: Number(m.entryFee) || 0,
    currency: m.currency || 'peta',
    maxSteps: m.maxSteps == null ? null : Number(m.maxSteps),
    thumb: m.thumb || '',
    builtIn: false,
    isHidden: Boolean(m.isHidden),
    ...catalogLevelFields(m),
  }));
  const remoteIds = new Set(fromRemote.map((r) => r.id));
  const fromLocal = Object.values(localOnly || {}).filter((m) => m && m.id && !remoteIds.has(m.id));
  const localEntries = fromLocal.map((m) => ({
    id: m.id,
    name: m.name || m.id,
    entryFee: Number(m.entryFee) || 0,
    currency: m.currency || 'peta',
    maxSteps: m.maxSteps == null ? null : Number(m.maxSteps),
    thumb: m.thumb || m.assets?.background || '',
    builtIn: false,
    _localOnly: true,
    isHidden: Boolean(m.isHidden),
    ...catalogLevelFields(m),
  }));
  return [BUILTIN_FOREST_ENTRY, ...fromRemote, ...localEntries];
}

/**
 * Chỉ localStorage + forest (offline).
 */
export function getHuntingMapCatalog() {
  const custom = loadAllCustomMaps();
  const list = Object.values(custom).map((m) => ({
    id: m.id,
    name: m.name || m.id,
    entryFee: Number(m.entryFee) || 0,
    currency: m.currency || 'peta',
    maxSteps: m.maxSteps == null ? null : Number(m.maxSteps),
    thumb: m.thumb || m.assets?.background || '',
    builtIn: false,
    isHidden: Boolean(m.isHidden),
    ...catalogLevelFields(m),
  }));
  return [BUILTIN_FOREST_ENTRY, ...list];
}

/** Kích thước pixel mong đợi của ảnh nền theo map. */
export function getExpectedMapPixelSize(mapLike) {
  const w = mapLike.width;
  const h = mapLike.height;
  const ts = mapLike.tileSize || 16;
  return { widthPx: w * ts, heightPx: h * ts };
}
