const STORAGE_KEY = 'petaria_hunting_maps_v1';

/**
 * @typedef {Object} HuntingMapRecord
 * @property {string} id
 * @property {string} name
 * @property {number} entryFee
 * @property {'peta'|'petagold'} currency
 * @property {number} maxSteps
 * @property {string} [thumb]
 * @property {number} width
 * @property {number} height
 * @property {number} tileSize
 * @property {{x:number,y:number}} start
 * @property {{background:string, foreground?:string}} assets
 * @property {number[]} tiles
 * @property {Array<{kind:'species'|'item', species_id?: number, item_id?: number, name?: string, image?: string, image_url?: string, rarity?: string, description?: string, rate: number, min_qty?: number, max_qty?: number}>} [encounterPool]
 */

/** @returns {Record<string, HuntingMapRecord>} */
export function loadAllCustomMaps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, HuntingMapRecord>} maps */
export function saveAllCustomMaps(maps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}

/** @param {string} id */
export function getCustomMap(id) {
  const key = String(id || '').toLowerCase();
  return loadAllCustomMaps()[key] || null;
}

/** @param {HuntingMapRecord} record */
export function upsertCustomMap(record) {
  const id = String(record.id || '').toLowerCase().trim();
  if (!id) throw new Error('Thiếu map id');
  const all = loadAllCustomMaps();
  all[id] = { ...record, id };
  saveAllCustomMaps(all);
  window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed', { detail: { id } }));
}

/** @param {string} id */
export function deleteCustomMap(id) {
  const key = String(id || '').toLowerCase();
  if (key === 'forest') return false;
  const all = loadAllCustomMaps();
  if (!all[key]) return false;
  delete all[key];
  saveAllCustomMaps(all);
  window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed', { detail: { id: key } }));
  return true;
}

export function exportCustomMapsJson() {
  return JSON.stringify(loadAllCustomMaps(), null, 2);
}

/** @param {string} json */
export function importCustomMapsJson(json) {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('JSON không hợp lệ');
  saveAllCustomMaps(data);
  window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed', {}));
}
