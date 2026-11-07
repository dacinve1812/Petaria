const PAGE_BG_KEY = 'petaria.settings.pageBackground';

export function isPageBackgroundEnabled() {
  try {
    return localStorage.getItem(PAGE_BG_KEY) !== '0';
  } catch {
    return true;
  }
}

export function applyPageBackgroundSetting(enabled = isPageBackgroundEnabled()) {
  document.body.classList.toggle('hide-page-banner', !enabled);
}

export function setPageBackgroundEnabled(enabled) {
  try {
    localStorage.setItem(PAGE_BG_KEY, enabled ? '1' : '0');
  } catch {
    /* private mode: still apply for this visit */
  }
  applyPageBackgroundSetting(enabled);
}
