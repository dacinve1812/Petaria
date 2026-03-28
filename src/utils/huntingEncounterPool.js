/**
 * Bảng gặp gỡ trên ô encounter (*) — lưu trong từng hunting map (localStorage).
 * kind: species = pet_species DB; item = vật phẩm (rơi / nhặt).
 */

/**
 * @param {unknown} raw
 * @returns {Array<{ kind: 'species'|'item', species_id?: number, item_id?: number, name: string, image?: string, image_url?: string, rarity?: string, description?: string, rate: number, min_qty?: number, max_qty?: number }>}
 */
export function normalizeEncounterPool(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeEncounterRow).filter(Boolean);
}

function normalizeEncounterRow(e) {
  if (!e || typeof e !== 'object') return null;
  const kind = e.kind === 'item' ? 'item' : 'species';
  const rate = Math.max(0, Number(e.rate) || 0);

  if (kind === 'item') {
    const item_id = Number(e.item_id ?? e.id);
    if (!Number.isFinite(item_id)) return null;
    const min_qty = Math.max(1, parseInt(e.min_qty, 10) || 1);
    const max_qty = Math.max(min_qty, parseInt(e.max_qty, 10) || min_qty);
    return {
      kind: 'item',
      item_id,
      name: String(e.name || `Item ${item_id}`),
      image_url: String(e.image_url || ''),
      rate,
      min_qty,
      max_qty,
    };
  }

  const species_id = Number(e.species_id ?? e.id);
  if (!Number.isFinite(species_id)) return null;
  return {
    kind: 'species',
    species_id,
    name: String(e.name || `Species ${species_id}`),
    image: String(e.image || ''),
    rarity: String(e.rarity || 'common'),
    description: String(e.description || ''),
    rate,
  };
}

export function encounterPoolToJson(pool) {
  return JSON.stringify(pool, null, 2);
}

/**
 * @param {ReturnType<normalizeEncounterPool>} pool
 */
export function weightedPickEncounterRow(pool) {
  if (!pool.length) return null;
  const total = pool.reduce((s, r) => s + Math.max(0, Number(r.rate) || 0), 0);
  if (total <= 0) return pool[0];
  let t = Math.random() * total;
  for (const row of pool) {
    const w = Math.max(0, Number(row.rate) || 0);
    t -= w;
    if (t <= 0) return row;
  }
  return pool[pool.length - 1];
}

export function randomQty(minQty, maxQty) {
  const lo = Math.min(minQty, maxQty);
  const hi = Math.max(minQty, maxQty);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
