const STORAGE_KEY = 'petaria-hunting-session';
const VERSION = 1;

/** Xóa session nếu đang lưu map khác (vào map mới không dùng dữ liệu map cũ). */
export function clearHuntingSessionIfOtherMap(mapId) {
  if (mapId == null) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.v === VERSION && String(data.mapId) !== String(mapId)) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {string|undefined} mapId
 * @param {number|null|undefined} registryMaxSteps — null = map không giới hạn bước
 * @returns {{ stepsRemaining: number, gridX: number, gridY: number } | null}
 */
export function loadHuntingSession(mapId, registryMaxSteps) {
  if (mapId == null || registryMaxSteps == null) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== VERSION || String(data.mapId) !== String(mapId)) return null;
    const savedMax = data.maxSteps == null ? null : Number(data.maxSteps);
    if (savedMax !== registryMaxSteps) return null;
    let sr = Number(data.stepsRemaining);
    if (!Number.isFinite(sr)) sr = registryMaxSteps;
    const stepsRemaining = Math.max(0, Math.min(registryMaxSteps, sr));
    const gridX = Number(data.gridX);
    const gridY = Number(data.gridY);
    const posOk = Number.isInteger(gridX) && Number.isInteger(gridY);
    return {
      stepsRemaining,
      gridX: posOk ? gridX : null,
      gridY: posOk ? gridY : null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string|undefined} mapId
 * @param {{ maxSteps: number|null, stepsRemaining: number|null, gridX: number, gridY: number }} payload
 */
export function saveHuntingSession(mapId, { maxSteps, stepsRemaining, gridX, gridY }) {
  if (mapId == null || maxSteps == null || stepsRemaining == null) {
    clearHuntingSession();
    return;
  }
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: VERSION,
        mapId: String(mapId),
        maxSteps,
        stepsRemaining,
        gridX,
        gridY,
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearHuntingSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
