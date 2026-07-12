/**
 * Cấu hình region maps (spot path / huntingMapId) — defaults từ JSON + merge DB.
 */
const defaultRegionMaps = require('../src/config/region-maps.json');

function getDefaultRegionMapsConfig() {
  return JSON.parse(JSON.stringify(defaultRegionMaps));
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function mergeSpotList(defaults, stored) {
  const dList = Array.isArray(defaults) ? defaults : [];
  const sList = Array.isArray(stored) ? stored : [];
  if (!sList.length) return dList.map((d) => ({ ...d }));

  const sById = new Map(sList.map((s) => [String(s?.id), s]));
  return dList.map((d) => {
    const s = sById.get(String(d.id));
    if (!s || !isPlainObject(s)) return { ...d };
    const next = { ...d, ...s };
    // Giữ geometry mặc định nếu admin không gửi coords / x,y
    if (!Array.isArray(s.coords) && Array.isArray(d.coords)) next.coords = [...d.coords];
    if (s.x == null && d.x != null) next.x = d.x;
    if (s.y == null && d.y != null) next.y = d.y;
    if (s.path != null) next.path = String(s.path);
    if (s.huntingMapId != null) next.huntingMapId = String(s.huntingMapId);
    if (s.name != null) next.name = String(s.name);
    if (s.label != null) next.label = String(s.label);
    return next;
  });
}

function mergeRegion(defaultRegion, storedRegion) {
  if (!isPlainObject(storedRegion)) {
    return JSON.parse(JSON.stringify(defaultRegion));
  }
  const out = {
    ...defaultRegion,
    ...storedRegion,
    id: defaultRegion.id,
    naturalSize: isPlainObject(storedRegion.naturalSize)
      ? { ...defaultRegion.naturalSize, ...storedRegion.naturalSize }
      : { ...defaultRegion.naturalSize },
    originalCoordinates: mergeSpotList(
      defaultRegion.originalCoordinates,
      storedRegion.originalCoordinates,
    ),
    mapButtons: mergeSpotList(defaultRegion.mapButtons, storedRegion.mapButtons),
  };
  return out;
}

/**
 * Deep merge: defaults + stored (stored wins on spot path / huntingMapId / labels).
 */
function mergeRegionMapsConfig(stored) {
  const defaults = getDefaultRegionMapsConfig();
  if (!stored || typeof stored !== 'object') {
    return defaults;
  }

  const storedRegions = Array.isArray(stored.regions) ? stored.regions : [];
  const byId = new Map(storedRegions.map((r) => [String(r?.id), r]));

  const out = {
    version: typeof stored.version === 'number' ? stored.version : defaults.version,
    regions: (defaults.regions || []).map((dr) => {
      const sr = byId.get(String(dr.id));
      return sr ? mergeRegion(dr, sr) : { ...dr };
    }),
  };

  return out;
}

module.exports = {
  getDefaultRegionMapsConfig,
  mergeRegionMapsConfig,
};
