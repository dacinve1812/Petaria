const STORAGE_KEY = 'petaria-hunting-session';
const ACTIVE_MAP_KEY = 'petaria-hunting-active-map';
const VERSION = 1;

/** Xóa session nếu đang lưu map khác (vào map mới không dùng dữ liệu map cũ). */
export function clearHuntingSessionIfOtherMap(mapId) {
  if (mapId == null) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.v === VERSION && String(data.mapId) !== String(mapId)) {
      localStorage.removeItem(STORAGE_KEY);
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
    const raw = localStorage.getItem(STORAGE_KEY);
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
    // Chống "tăng lượt" do nhiều tab ghi đè lẫn nhau:
    // luôn giữ giá trị bước còn lại nhỏ nhất đã biết.
    let finalSteps = Number(stepsRemaining);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const prev = JSON.parse(raw);
        const sameMap = String(prev.mapId) === String(mapId);
        const sameMax = Number(prev.maxSteps) === Number(maxSteps);
        if (sameMap && sameMax && Number.isFinite(Number(prev.stepsRemaining))) {
          finalSteps = Math.min(finalSteps, Number(prev.stepsRemaining));
        }
      } catch {
        /* ignore corrupted old value */
      }
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: VERSION,
        mapId: String(mapId),
        maxSteps,
        stepsRemaining: finalSteps,
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
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Đánh dấu map săn đang hoạt động để vẫn nhận diện được khi đóng/mở lại tab.
 * Dùng localStorage thay vì sessionStorage để không mất trạng thái khi tab đóng.
 */
export function setActiveHuntingMap(mapId) {
  if (mapId == null) return;
  try {
    localStorage.setItem(
      ACTIVE_MAP_KEY,
      JSON.stringify({
        v: VERSION,
        mapId: String(mapId),
        updatedAt: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

/** @returns {{ mapId: string, updatedAt: number } | null} */
export function getActiveHuntingMap() {
  try {
    const raw = localStorage.getItem(ACTIVE_MAP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== VERSION || !data.mapId) return null;
    return {
      mapId: String(data.mapId),
      updatedAt: Number(data.updatedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function clearActiveHuntingMap() {
  try {
    localStorage.removeItem(ACTIVE_MAP_KEY);
  } catch {
    /* ignore */
  }
}
