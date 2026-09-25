/**
 * Battle arena background catalog — per context (1v1 / 3v3 / 5v5 / hunting).
 * Shipped defaults in public/images/background/catalog.json;
 * admin overrides in localStorage.
 */

export const BATTLE_BG_STORAGE_KEY = 'petaria-battle-bg-catalog';
export const BATTLE_BG_ADMIN_PATH = '/admin/battle-backgrounds';
export const BATTLE_BG_PUBLIC_DIR = '/images/background';
export const BATTLE_BG_SHIPPED_CATALOG_URL = `${BATTLE_BG_PUBLIC_DIR}/catalog.json`;

/** Fixed slots admin can edit */
export const BATTLE_BG_CONTEXTS = [
  {
    id: 'arena-1v1',
    label: 'Arena 1v1',
    labelVi: 'Đấu trường 1vs1',
    hint: 'Trận 1v1 arena / Redis match',
  },
  {
    id: 'arena-3v3',
    label: 'Battle 3v3',
    labelVi: 'Trận 3vs3',
    hint: 'Multi formation 3v3',
  },
  {
    id: 'arena-5v5',
    label: 'Battle 5v5',
    labelVi: 'Trận 5vs5',
    hint: 'Multi formation 5v5',
  },
  {
    id: 'hunting',
    label: 'Hunting map',
    labelVi: 'Săn bắt (hunting)',
    hint: 'Khi battleSource = hunting',
  },
];

const DEFAULT_BG_COLOR = '#0f172a';

const DEFAULT_ENTRIES = {
  'arena-1v1': {
    id: 'arena-1v1',
    desktopUrl: `${BATTLE_BG_PUBLIC_DIR}/arena-background-landscape-1.png`,
    mobileUrl: `${BATTLE_BG_PUBLIC_DIR}/arena-background.png`,
    desktopPosition: 'center bottom',
    mobilePosition: 'center 120%',
    backgroundColor: DEFAULT_BG_COLOR,
  },
  'arena-3v3': {
    id: 'arena-3v3',
    desktopUrl: `${BATTLE_BG_PUBLIC_DIR}/arena-background-landscape-1.png`,
    mobileUrl: `${BATTLE_BG_PUBLIC_DIR}/arena-background.png`,
    desktopPosition: 'center bottom',
    mobilePosition: 'center 120%',
    backgroundColor: DEFAULT_BG_COLOR,
  },
  'arena-5v5': {
    id: 'arena-5v5',
    desktopUrl: `${BATTLE_BG_PUBLIC_DIR}/arena-background-landscape-1.png`,
    mobileUrl: `${BATTLE_BG_PUBLIC_DIR}/arena-background.png`,
    desktopPosition: 'center bottom',
    mobilePosition: 'center 120%',
    backgroundColor: DEFAULT_BG_COLOR,
  },
  hunting: {
    id: 'hunting',
    desktopUrl: `${BATTLE_BG_PUBLIC_DIR}/battlefield1.png`,
    mobileUrl: `${BATTLE_BG_PUBLIC_DIR}/battlefield1.png`,
    desktopPosition: 'center bottom',
    mobilePosition: 'center bottom',
    backgroundColor: DEFAULT_BG_COLOR,
  },
};

/** Empty string or "none" = no background image */
export function isNoneBackgroundUrl(url) {
  const s = String(url ?? '').trim().toLowerCase();
  return !s || s === 'none';
}

/**
 * Parse a bg URL. Missing (undefined/null) → fallback.
 * Explicit "" or "none" → "" (no image).
 */
function parseBgUrl(value, fallbackWhenMissing) {
  if (value === undefined || value === null) {
    return String(fallbackWhenMissing ?? '').trim();
  }
  const s = String(value).trim();
  if (!s || s.toLowerCase() === 'none') return '';
  return s;
}

/** Accept #rgb / #rrggbb / #rrggbbaa, or fall back to default */
export function normalizeBackgroundColor(value, fallback = DEFAULT_BG_COLOR) {
  const s = String(value ?? '').trim();
  if (!s) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) {
    return s.toLowerCase();
  }
  // Allow common CSS color keywords / rgb() for power users
  if (/^[a-z]+$/i.test(s) || /^(rgb|rgba|hsl|hsla)\(/i.test(s)) {
    return s;
  }
  return fallback;
}

/** Hex for <input type="color"> (needs #rrggbb) */
export function toColorInputValue(color) {
  const c = normalizeBackgroundColor(color);
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    const [, r, g, b] = c;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULT_BG_COLOR;
}

function normalizeEntry(raw, fallbackId) {
  const id = String(raw?.id || fallbackId || '').trim();
  const base = DEFAULT_ENTRIES[id] || DEFAULT_ENTRIES['arena-1v1'];
  const desktopUrl = parseBgUrl(raw?.desktopUrl, base.desktopUrl);
  const mobileUrl =
    raw?.mobileUrl !== undefined && raw?.mobileUrl !== null
      ? parseBgUrl(raw.mobileUrl, '')
      : desktopUrl;
  const colorRaw =
    raw?.backgroundColor !== undefined && raw?.backgroundColor !== null
      ? String(raw.backgroundColor).trim()
      : '';
  return {
    id,
    desktopUrl,
    mobileUrl,
    desktopPosition: String(raw?.desktopPosition || base.desktopPosition || 'center bottom').trim(),
    mobilePosition: String(raw?.mobilePosition || base.mobilePosition || 'center bottom').trim(),
    // Keep draft text as-typed; sanitize when applying CSS / exporting
    backgroundColor: colorRaw || base.backgroundColor || DEFAULT_BG_COLOR,
  };
}

function defaultCatalog() {
  return {
    version: 1,
    updatedAt: null,
    backgrounds: BATTLE_BG_CONTEXTS.map((c) => ({ ...DEFAULT_ENTRIES[c.id] })),
  };
}

function mergeCatalog(shipped, local) {
  const byId = {};
  BATTLE_BG_CONTEXTS.forEach((c) => {
    byId[c.id] = { ...DEFAULT_ENTRIES[c.id] };
  });
  const applyList = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((raw) => {
      const id = String(raw?.id || '').trim();
      if (!byId[id]) return;
      byId[id] = normalizeEntry({ ...byId[id], ...raw }, id);
    });
  };
  applyList(shipped?.backgrounds);
  applyList(local?.backgrounds);
  return {
    version: Math.max(1, Number(local?.version) || Number(shipped?.version) || 1),
    updatedAt: local?.updatedAt || shipped?.updatedAt || null,
    backgrounds: BATTLE_BG_CONTEXTS.map((c) => byId[c.id]),
  };
}

export function resolveBattleBackgroundKey({ battleSource, battleMode } = {}) {
  const src = String(battleSource || '').toLowerCase();
  if (src === 'hunting') return 'hunting';
  const mode = String(battleMode || '1v1').toLowerCase();
  if (mode === '3v3' || mode === '3vs3') return 'arena-3v3';
  if (mode === '5v5' || mode === '5vs5') return 'arena-5v5';
  return 'arena-1v1';
}

export function getBackgroundById(catalog, id) {
  const list = catalog?.backgrounds || [];
  const found = list.find((b) => b.id === id);
  if (found) return normalizeEntry(found, id);
  return normalizeEntry(DEFAULT_ENTRIES[id] || DEFAULT_ENTRIES['arena-1v1'], id || 'arena-1v1');
}

export function cssUrl(url) {
  if (isNoneBackgroundUrl(url)) return 'none';
  const u = String(url).trim();
  if (u.startsWith('url(')) return u;
  return `url(${JSON.stringify(u)})`;
}

export function sceneBackgroundStyle(entry) {
  const e = normalizeEntry(entry, entry?.id);
  return {
    '--arena-bg-image': cssUrl(e.desktopUrl),
    '--arena-bg-image-mobile': cssUrl(e.mobileUrl || e.desktopUrl),
    '--arena-bg-pos': e.desktopPosition || 'center bottom',
    '--arena-bg-pos-mobile': e.mobilePosition || 'center bottom',
    '--arena-bg-color': normalizeBackgroundColor(e.backgroundColor),
  };
}

export async function loadBattleBackgroundCatalogAsync() {
  let shipped = null;
  try {
    const res = await fetch(`${BATTLE_BG_SHIPPED_CATALOG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) shipped = await res.json();
  } catch {
    /* ignore */
  }
  let local = null;
  try {
    const raw = localStorage.getItem(BATTLE_BG_STORAGE_KEY);
    if (raw) local = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return mergeCatalog(shipped, local);
}

export function saveBattleBackgroundCatalog(catalog) {
  const next = {
    version: Math.max(1, Number(catalog?.version) || 1),
    updatedAt: new Date().toISOString(),
    backgrounds: BATTLE_BG_CONTEXTS.map((c) => {
      const entry = normalizeEntry(
        (catalog?.backgrounds || []).find((b) => b.id === c.id) || DEFAULT_ENTRIES[c.id],
        c.id
      );
      return {
        ...entry,
        backgroundColor: normalizeBackgroundColor(entry.backgroundColor),
      };
    }),
  };
  localStorage.setItem(BATTLE_BG_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resetBattleBackgroundCatalog() {
  localStorage.removeItem(BATTLE_BG_STORAGE_KEY);
  return defaultCatalog();
}

export function exportBattleBackgroundCatalogJson(catalog) {
  const payload = {
    version: Math.max(1, Number(catalog?.version) || 1),
    updatedAt: catalog?.updatedAt || new Date().toISOString(),
    backgrounds: BATTLE_BG_CONTEXTS.map((c) => {
      const entry = normalizeEntry(
        (catalog?.backgrounds || []).find((b) => b.id === c.id) || DEFAULT_ENTRIES[c.id],
        c.id
      );
      return {
        ...entry,
        backgroundColor: normalizeBackgroundColor(entry.backgroundColor),
      };
    }),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export { defaultCatalog, normalizeEntry, DEFAULT_ENTRIES, DEFAULT_BG_COLOR };
