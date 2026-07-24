/** Refresh badge game-center (sau quay / nhận / mua vé…). */
export const GAME_CENTER_ALERTS_REFRESH_EVENT = 'petaria:game-center-alerts-refresh';

export function dispatchGameCenterAlertsRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(GAME_CENTER_ALERTS_REFRESH_EVENT));
}

const MYSTERY_BOX_VISIT_PREFIX = 'petaria:gc-mystery-box-seen:';

export function mysteryBoxVisitStorageKey(userId, periodKey) {
  return `${MYSTERY_BOX_VISIT_PREFIX}${userId}:${periodKey}`;
}

export function hasSeenMysteryBoxThisPeriod(userId, periodKey) {
  if (userId == null || periodKey == null || periodKey === '') return false;
  try {
    return localStorage.getItem(mysteryBoxVisitStorageKey(userId, periodKey)) === '1';
  } catch {
    return false;
  }
}

export function markMysteryBoxSeenThisPeriod(userId, periodKey) {
  if (userId == null || periodKey == null || periodKey === '') return;
  try {
    localStorage.setItem(mysteryBoxVisitStorageKey(userId, periodKey), '1');
  } catch {
    /* ignore quota / private mode */
  }
  dispatchGameCenterAlertsRefresh();
}
