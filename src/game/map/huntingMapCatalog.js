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
};

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
  }));
  return [BUILTIN_FOREST_ENTRY, ...fromRemote, ...localEntries];
}

/**
 * Chỉ localStorage + forest (offline).
 * @returns {Array<{id:string,name:string,entryFee:number,currency:string,maxSteps:number|null,thumb:string,builtIn:boolean}>}
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
