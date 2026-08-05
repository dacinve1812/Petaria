/**
 * Battle skill/item FX catalog — sprite-sheet animations.
 * Defaults in repo; admin overrides persist in localStorage.
 * Battle / skills chọn animation theo `numId` (không theo slug).
 */

export const BATTLE_FX_STORAGE_KEY = 'petaria-battle-fx-catalog';
export const BATTLE_FX_ADMIN_PATH = '/admin/battle-fx';
export const BATTLE_FX_IDB_NAME = 'petaria-battle-fx';
export const BATTLE_FX_IDB_STORE = 'images';
/** One-time: xóa built-in lightning-strike bị merge đè lại từ default cũ */
export const BATTLE_FX_PURGE_LIGHTNING_KEY = 'petaria-battle-fx-purged-lightning-v1';

/** Default animation numId for skills / attack when unset. Battle maps: attack=#1, defend=#7. */
export const DEFAULT_SKILL_ANIMATION_ID = 1;

/** Battle: normal attack + *weapon items → catalog entry with this numId */
export const BATTLE_FX_ATTACK_ANIM_ID = 1;
/** Battle: shield item + basic / boss defend → catalog entry with this numId */
export const BATTLE_FX_DEFEND_ANIM_ID = 7;

/** Max chars for a URL kept in localStorage (path/http). Data URLs go to IndexedDB. */
const MAX_INLINE_IMAGE_URL = 2048;

/** Curated name ideas by vibe — used as "AI-style" suggestions in admin */
export const FX_NAME_SUGGESTIONS = {
  electric: [
    { id: 'lightning-strike', name: 'Lightning Strike', nameVi: 'Sét đánh' },
    { id: 'thunder-bolt', name: 'Thunder Bolt', nameVi: 'Sấm sét' },
    { id: 'spark-burst', name: 'Spark Burst', nameVi: 'Tia điện nổ' },
    { id: 'volt-crash', name: 'Volt Crash', nameVi: 'Va chạm điện' },
  ],
  fire: [
    { id: 'fireball-hit', name: 'Fireball Hit', nameVi: 'Cầu lửa' },
    { id: 'flame-slash', name: 'Flame Slash', nameVi: 'Chém lửa' },
    { id: 'ember-burst', name: 'Ember Burst', nameVi: 'Tàn lửa' },
    { id: 'inferno-impact', name: 'Inferno Impact', nameVi: 'Địa ngục' },
  ],
  water: [
    { id: 'water-splash', name: 'Water Splash', nameVi: 'Bắn nước' },
    { id: 'hydro-pulse', name: 'Hydro Pulse', nameVi: 'Sóng nước' },
    { id: 'bubble-burst', name: 'Bubble Burst', nameVi: 'Bong bóng nổ' },
  ],
  ice: [
    { id: 'ice-shard', name: 'Ice Shard', nameVi: 'Mảnh băng' },
    { id: 'frost-bite', name: 'Frost Bite', nameVi: 'Đóng băng' },
    { id: 'blizzard-hit', name: 'Blizzard Hit', nameVi: 'Bão tuyết' },
  ],
  slash: [
    { id: 'slash-arc', name: 'Slash Arc', nameVi: 'Đường chém' },
    { id: 'blade-flash', name: 'Blade Flash', nameVi: 'Lóe kiếm' },
    { id: 'crit-cut', name: 'Critical Cut', nameVi: 'Chém chí mạng' },
  ],
  impact: [
    { id: 'impact-burst', name: 'Impact Burst', nameVi: 'Va chạm' },
    { id: 'smash-hit', name: 'Smash Hit', nameVi: 'Đập mạnh' },
    { id: 'shockwave', name: 'Shockwave', nameVi: 'Sóng xung kích' },
  ],
  heal: [
    { id: 'heal-glow', name: 'Heal Glow', nameVi: 'Hào quang hồi máu' },
    { id: 'holy-light', name: 'Holy Light', nameVi: 'Ánh sáng thánh' },
  ],
  poison: [
    { id: 'poison-cloud', name: 'Poison Cloud', nameVi: 'Mây độc' },
    { id: 'toxic-splash', name: 'Toxic Splash', nameVi: 'Bắn độc' },
  ],
  dark: [
    { id: 'shadow-slash', name: 'Shadow Slash', nameVi: 'Chém bóng' },
    { id: 'void-burst', name: 'Void Burst', nameVi: 'Hư không' },
  ],
};

export const FX_SEARCH_SOURCES = [
  {
    id: 'opengameart',
    label: 'OpenGameArt',
    buildUrl: (q) =>
      `https://opengameart.org/art-search-advanced?keys=${encodeURIComponent(q)}&field_art_type_tid%5B%5D=9`,
  },
  {
    id: 'kenney',
    label: 'Kenney.nl',
    buildUrl: (q) => `https://kenney.nl/assets?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'itch',
    label: 'itch.io',
    buildUrl: (q) =>
      `https://itch.io/game-assets/free/tag-sprites/tag-effects?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'google',
    label: 'Google Images',
    buildUrl: (q) =>
      `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${q} sprite sheet png transparent`)}`,
  },
  {
    id: 'giphy',
    label: 'Giphy',
    buildUrl: (q) => `https://giphy.com/search/${encodeURIComponent(q)}`,
  },
];

/** Empty fallback; production defaults live in public/.../catalog.json (shipped with deploy). */
export const DEFAULT_BATTLE_FX_CATALOG = {
  version: 1,
  animations: [],
};

export const BATTLE_FX_PUBLIC_DIR = '/images/skill-animation';

/** Shipped with the app — survives deploy / máy mới (không cần localStorage). */
export const BATTLE_FX_SHIPPED_CATALOG_URL = `${BATTLE_FX_PUBLIC_DIR}/catalog.json`;

/** Map built-in keys → webpack-bundled URLs (set at runtime from admin/page imports) */
let builtInAssetUrls = {};

export function registerBuiltInBattleFxAssets(map) {
  builtInAssetUrls = { ...builtInAssetUrls, ...map };
}

export function cssBackgroundUrl(url) {
  if (!url) return 'none';
  // JSON.stringify quotes & escapes — bắt buộc với data: URL dài
  return `url(${JSON.stringify(String(url))})`;
}

export function resolveBattleFxImageUrl(entry) {
  if (!entry) return '';
  if (entry.imageUrl) return entry.imageUrl;
  if (entry.builtInAssetKey && builtInAssetUrls[entry.builtInAssetKey]) {
    return builtInAssetUrls[entry.builtInAssetKey];
  }
  if (entry.builtInAssetKey === 'lightning-strike') {
    return '/images/battle-fx/lightning-strike.png';
  }
  return '';
}

export function isBattleFxPublicPath(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/') || /^https?:\/\//i.test(url);
}

/** Cache: sprite sheet đã xóa nền đen gần-#000 → alpha (screen trên sàn tối vẫn sạch). */
const keyedBlackUrlCache = new Map();

/**
 * Đưa pixel gần đen về trong suốt. `screen`/`lighten` không đủ trên arena tối
 * (đen blend ra vẫn ra nền tối = nhìn như còn nền đen).
 */
export function keyNearBlackToTransparent(srcUrl, threshold = 32) {
  if (!srcUrl || typeof document === 'undefined') return Promise.resolve(srcUrl || '');
  const key = `${srcUrl}::t${threshold}`;
  if (keyedBlackUrlCache.has(key)) return Promise.resolve(keyedBlackUrlCache.get(key));

  return new Promise((resolve) => {
    const img = new Image();
    if (!String(srcUrl).startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(srcUrl);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const t = Math.max(0, Math.min(80, Number(threshold) || 32));
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] <= t && d[i + 1] <= t && d[i + 2] <= t) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const out = canvas.toDataURL('image/png');
        keyedBlackUrlCache.set(key, out);
        resolve(out);
      } catch {
        resolve(srcUrl);
      }
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

/** true nếu blend mode kiểu “đen → hiện nền” (vẫn cần key alpha trên arena tối) */
export function blendModeNeedsBlackKey(blendMode) {
  const m = String(blendMode || 'normal').toLowerCase();
  return m === 'screen' || m === 'lighten' || m === 'plus-lighter';
}

function openFxImageDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(BATTLE_FX_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BATTLE_FX_IDB_STORE)) {
        db.createObjectStore(BATTLE_FX_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function idbPutFxImage(animId, dataUrl) {
  if (!animId || !dataUrl) return;
  const db = await openFxImageDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(BATTLE_FX_IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(BATTLE_FX_IDB_STORE).put(String(dataUrl), String(animId));
  });
  db.close();
}

export async function idbGetFxImage(animId) {
  if (!animId) return null;
  try {
    const db = await openFxImageDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(BATTLE_FX_IDB_STORE, 'readonly');
      const req = tx.objectStore(BATTLE_FX_IDB_STORE).get(String(animId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  } catch {
    return null;
  }
}

export async function idbDeleteFxImage(animId) {
  if (!animId) return;
  try {
    const db = await openFxImageDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BATTLE_FX_IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(BATTLE_FX_IDB_STORE).delete(String(animId));
    });
    db.close();
  } catch {
    /* ignore */
  }
}

function isDataUrl(url) {
  return typeof url === 'string' && url.startsWith('data:');
}

function stripHeavyImagesForStorage(catalog) {
  const copy = clone(catalog);
  copy.animations = (copy.animations || []).map((a) => {
    const next = { ...a };
    // Path public/http giữ nguyên trong localStorage
    if (isBattleFxPublicPath(next.imageUrl)) {
      next.hasIdbImage = false;
      return next;
    }
    if (isDataUrl(next.imageUrl) || (next.imageUrl && next.imageUrl.length > MAX_INLINE_IMAGE_URL)) {
      next.hasIdbImage = true;
      next.imageUrl = null;
    } else {
      next.hasIdbImage = Boolean(next.hasIdbImage);
    }
    return next;
  });
  return copy;
}

async function hydrateCatalogImages(catalog) {
  const copy = clone(catalog);
  await Promise.all(
    (copy.animations || []).map(async (a) => {
      if (a.imageUrl) return;
      if (!a.hasIdbImage && !a.id) return;
      const blob = await idbGetFxImage(a.id);
      if (blob) {
        a.imageUrl = blob;
        a.hasIdbImage = true;
      }
    })
  );
  return copy;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function sanitizeFxEntry(raw, fallbackId) {
  const cols = Math.max(1, Math.min(12, Number(raw?.cols) || 5));
  const rows = Math.max(1, Math.min(12, Number(raw?.rows) || 2));
  const maxFrames = cols * rows;
  let frameCount = Number(raw?.frameCount);
  if (!Number.isFinite(frameCount) || frameCount < 1) frameCount = maxFrames;
  frameCount = Math.max(1, Math.min(maxFrames, Math.round(frameCount)));

  const id = slugify(raw?.id || raw?.name || fallbackId || 'fx') || `fx-${Date.now()}`;
  const rawNum = Number(raw?.numId);
  const numId =
    Number.isFinite(rawNum) && rawNum >= 1 ? Math.round(rawNum) : null;
  return {
    numId,
    id,
    name: String(raw?.name || id).slice(0, 80),
    nameVi: String(raw?.nameVi || '').slice(0, 80),
    tags: Array.isArray(raw?.tags)
      ? raw.tags.map((t) => String(t).toLowerCase()).filter(Boolean).slice(0, 12)
      : [],
    imageUrl: raw?.imageUrl ? String(raw.imageUrl) : null,
    hasIdbImage: Boolean(raw?.hasIdbImage),
    builtInAssetKey: raw?.builtInAssetKey ? String(raw.builtInAssetKey) : null,
    cols,
    rows,
    frameCount,
    durationMs: Math.max(80, Math.min(5000, Number(raw?.durationMs) || 550)),
    delayMs: Math.max(0, Math.min(2000, Number(raw?.delayMs) || 0)),
    blendMode: ['normal', 'screen', 'plus-lighter', 'lighten'].includes(raw?.blendMode)
      ? raw.blendMode
      : 'normal',
    notes: String(raw?.notes || '').slice(0, 400),
    enabled: raw?.enabled !== false,
    updatedAt: raw?.updatedAt || null,
  };
}

/** Assign stable numeric numId (1, 2, …) used by skills.animation_id */
export function ensureBattleFxNumIds(animations) {
  const list = Array.isArray(animations) ? animations.map((a) => ({ ...a })) : [];
  const used = new Set();
  list.forEach((a) => {
    const n = Number(a.numId);
    if (Number.isFinite(n) && n >= 1 && !used.has(n)) {
      a.numId = Math.round(n);
      used.add(a.numId);
    } else {
      a.numId = null;
    }
  });
  let next = 1;
  list.forEach((a) => {
    if (a.numId != null) return;
    while (used.has(next)) next += 1;
    a.numId = next;
    used.add(next);
    next += 1;
  });
  return list.sort((a, b) => a.numId - b.numId || String(a.id).localeCompare(String(b.id)));
}

export function getNextBattleFxNumId(catalog) {
  const list = catalog?.animations || [];
  let max = 0;
  list.forEach((a) => {
    const n = Number(a.numId);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return Math.max(1, max + 1);
}

export function mergeBattleFxCatalog(raw) {
  // Catalog đã lưu / shipped là nguồn — KHÔNG inject lightning built-in cũ.
  if (!raw || typeof raw !== 'object') {
    return {
      version: 1,
      animations: ensureBattleFxNumIds(
        (DEFAULT_BATTLE_FX_CATALOG.animations || []).map((a) => sanitizeFxEntry(a, a.id))
      ),
    };
  }
  const list = Array.isArray(raw.animations) ? raw.animations : [];
  const byId = {};
  list.forEach((a) => {
    const cleaned = sanitizeFxEntry(a, a?.id);
    byId[cleaned.id] = cleaned;
  });
  return {
    version: Number(raw.version) || 1,
    animations: ensureBattleFxNumIds(Object.values(byId)),
  };
}

/** Shipped (repo) làm nền; localStorage đè theo `id` (máy dev). */
export function mergeBattleFxCatalogLayers(shipped, local) {
  const byId = {};
  const apply = (raw) => {
    if (!raw || !Array.isArray(raw.animations)) return;
    raw.animations.forEach((a) => {
      const cleaned = sanitizeFxEntry(a, a?.id);
      byId[cleaned.id] = cleaned;
    });
  };
  apply(shipped);
  apply(local);
  return {
    version: Number(local?.version || shipped?.version) || 1,
    animations: ensureBattleFxNumIds(Object.values(byId)),
  };
}

async function fetchShippedBattleFxCatalog() {
  try {
    const res = await fetch(BATTLE_FX_SHIPPED_CATALOG_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.animations)) return null;
    return json;
  } catch {
    return null;
  }
}

function stripLightningStrikeEntries(catalog) {
  const copy = clone(catalog);
  copy.animations = (copy.animations || []).filter(
    (a) => a.id !== 'lightning-strike' && a.builtInAssetKey !== 'lightning-strike'
  );
  return copy;
}

function persistCatalogMeta(catalog) {
  try {
    localStorage.setItem(BATTLE_FX_STORAGE_KEY, JSON.stringify(stripHeavyImagesForStorage(catalog)));
  } catch {
    try {
      localStorage.removeItem(BATTLE_FX_STORAGE_KEY);
      localStorage.setItem(BATTLE_FX_STORAGE_KEY, JSON.stringify(stripHeavyImagesForStorage(catalog)));
    } catch {
      /* ignore */
    }
  }
}

export function loadBattleFxCatalog() {
  try {
    const raw = localStorage.getItem(BATTLE_FX_STORAGE_KEY);
    if (!raw) return clone(DEFAULT_BATTLE_FX_CATALOG);
    // Bloated catalogs (data URLs) exceed quota on next save — strip on read
    const parsed = JSON.parse(raw);
    let merged = mergeBattleFxCatalog(parsed);

    // One-time: xóa lightning-strike còn sót (default cũ / #9). Sau đó có thể thêm lại bằng Upload.
    try {
      if (!localStorage.getItem(BATTLE_FX_PURGE_LIGHTNING_KEY)) {
        const purged = stripLightningStrikeEntries(merged);
        if ((purged.animations || []).length !== (merged.animations || []).length) {
          merged = purged;
          persistCatalogMeta(merged);
          idbDeleteFxImage('lightning-strike').catch(() => {});
        }
        localStorage.setItem(BATTLE_FX_PURGE_LIGHTNING_KEY, '1');
      }
    } catch {
      /* ignore */
    }

    const needsStrip = (merged.animations || []).some(
      (a) => isDataUrl(a.imageUrl) || (a.imageUrl && a.imageUrl.length > MAX_INLINE_IMAGE_URL)
    );
    if (needsStrip) {
      const light = stripHeavyImagesForStorage(merged);
      persistCatalogMeta(light);
      return light;
    }
    return merged;
  } catch {
    try {
      localStorage.removeItem(BATTLE_FX_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return clone(DEFAULT_BATTLE_FX_CATALOG);
  }
}

/** Sync metadata only — prefer loadBattleFxCatalogAsync for admin with images */
export function saveBattleFxCatalog(catalog) {
  const merged = mergeBattleFxCatalog(catalog);
  merged.animations = merged.animations.map((a) => ({
    ...a,
    updatedAt: a.updatedAt || new Date().toISOString(),
  }));
  const light = stripHeavyImagesForStorage(merged);
  try {
    localStorage.setItem(BATTLE_FX_STORAGE_KEY, JSON.stringify(light));
  } catch (err) {
    // Last resort: wipe old bloated key then retry metadata-only
    try {
      localStorage.removeItem(BATTLE_FX_STORAGE_KEY);
      localStorage.setItem(BATTLE_FX_STORAGE_KEY, JSON.stringify(light));
    } catch (err2) {
      const e = new Error(
        'localStorage đầy — ảnh sprite không lưu được vào Storage. Đã chuyển sang IndexedDB; hãy Save lại.'
      );
      e.cause = err2 || err;
      throw e;
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('petaria-battle-fx-catalog', { detail: merged }));
  } catch {
    /* ignore */
  }
  return merged;
}

/**
 * Save catalog: large data-URL images → IndexedDB; metadata → localStorage.
 * Returns hydrated catalog (with imageUrl restored for UI).
 */
export async function saveBattleFxCatalogAsync(catalog) {
  const merged = mergeBattleFxCatalog(catalog);
  merged.animations = merged.animations.map((a) => ({
    ...a,
    updatedAt: new Date().toISOString(),
  }));

  for (const anim of merged.animations) {
    if (isBattleFxPublicPath(anim.imageUrl)) {
      anim.hasIdbImage = false;
      continue;
    }
    if (isDataUrl(anim.imageUrl)) {
      await idbPutFxImage(anim.id, anim.imageUrl);
      anim.hasIdbImage = true;
    } else if (anim.imageUrl && anim.imageUrl.length > MAX_INLINE_IMAGE_URL) {
      await idbPutFxImage(anim.id, anim.imageUrl);
      anim.hasIdbImage = true;
    }
  }

  const light = stripHeavyImagesForStorage(merged);
  try {
    localStorage.setItem(BATTLE_FX_STORAGE_KEY, JSON.stringify(light));
  } catch {
    localStorage.removeItem(BATTLE_FX_STORAGE_KEY);
    localStorage.setItem(BATTLE_FX_STORAGE_KEY, JSON.stringify(light));
  }

  const hydrated = await hydrateCatalogImages(light);
  // keep in-memory data URLs from the save request if hydrate missed (same session)
  hydrated.animations = hydrated.animations.map((a) => {
    const src = merged.animations.find((m) => m.id === a.id);
    if (!a.imageUrl && src?.imageUrl) return { ...a, imageUrl: src.imageUrl, hasIdbImage: true };
    return a;
  });

  try {
    window.dispatchEvent(new CustomEvent('petaria-battle-fx-catalog', { detail: hydrated }));
  } catch {
    /* ignore */
  }
  return hydrated;
}

/** Catalog đã hydrate (có imageUrl) — dùng sync trong overlay sau preload */
let cachedHydratedCatalog = null;

export function getHydratedBattleFxCatalog() {
  return cachedHydratedCatalog;
}

export async function loadBattleFxCatalogAsync() {
  const shipped = await fetchShippedBattleFxCatalog();
  let local = null;
  try {
    const raw = localStorage.getItem(BATTLE_FX_STORAGE_KEY);
    if (raw) local = JSON.parse(raw);
  } catch {
    local = null;
  }
  const merged = mergeBattleFxCatalogLayers(shipped, local);
  // one-time purge lightning if still present in local overlay
  let next = stripLightningStrikeEntries(merged);
  try {
    if (!localStorage.getItem(BATTLE_FX_PURGE_LIGHTNING_KEY)) {
      if ((next.animations || []).length !== (merged.animations || []).length) {
        persistCatalogMeta(next);
        idbDeleteFxImage('lightning-strike').catch(() => {});
      }
      localStorage.setItem(BATTLE_FX_PURGE_LIGHTNING_KEY, '1');
    }
  } catch {
    /* ignore */
  }
  const hydrated = await hydrateCatalogImages(next);
  cachedHydratedCatalog = hydrated;
  return hydrated;
}

export function resetBattleFxCatalog() {
  localStorage.removeItem(BATTLE_FX_STORAGE_KEY);
  const fresh = clone(DEFAULT_BATTLE_FX_CATALOG);
  try {
    window.dispatchEvent(new CustomEvent('petaria-battle-fx-catalog', { detail: fresh }));
  } catch {
    /* ignore */
  }
  return fresh;
}

export async function resetBattleFxCatalogAsync() {
  const fresh = resetBattleFxCatalog();
  try {
    const db = await openFxImageDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BATTLE_FX_IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(BATTLE_FX_IDB_STORE).clear();
    });
    db.close();
  } catch {
    /* ignore */
  }
  return fresh;
}

export function getBattleFxById(id, catalog) {
  const cfg = catalog || loadBattleFxCatalog();
  return (cfg.animations || []).find((a) => a.id === String(id) && a.enabled) || null;
}

/** Lookup by numeric numId (skills.animation_id / battle defaults). */
export function getBattleFxByNumId(numId, catalog, options = {}) {
  const { fallback = false } = options;
  const cfg = catalog || loadBattleFxCatalog();
  const n = Number(numId);
  const target = Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
  if (target == null) {
    return fallback
      ? (cfg.animations || []).find((a) => Number(a.numId) === DEFAULT_SKILL_ANIMATION_ID) ||
          cfg.animations?.[0] ||
          null
      : null;
  }
  const found = (cfg.animations || []).find((a) => Number(a.numId) === target);
  if (found) return found;
  if (!fallback) return null;
  return (
    (cfg.animations || []).find((a) => Number(a.numId) === DEFAULT_SKILL_ANIMATION_ID) ||
    cfg.animations?.[0] ||
    null
  );
}

/** Options for skill animation <select> */
export function listBattleFxOptions(catalog) {
  const cfg = catalog || loadBattleFxCatalog();
  return ensureBattleFxNumIds([...(cfg.animations || [])]).map((a) => ({
    numId: a.numId,
    id: a.id,
    label: `#${a.numId} — ${a.nameVi || a.name || a.id}${a.enabled === false ? ' (tắt)' : ''}`,
    enabled: a.enabled !== false,
  }));
}

export function suggestFxNames(category, seed = '') {
  const cat = String(category || 'impact').toLowerCase();
  const pool = FX_NAME_SUGGESTIONS[cat] || FX_NAME_SUGGESTIONS.impact;
  const q = slugify(seed);
  if (!q) return pool.slice();
  const filtered = pool.filter(
    (p) => p.id.includes(q) || p.name.toLowerCase().includes(seed.toLowerCase())
  );
  if (filtered.length) return filtered;
  // synthesize from seed
  return [
    {
      id: q || `fx-${Date.now()}`,
      name: seed.trim() || 'New Effect',
      nameVi: seed.trim() || 'Hiệu ứng mới',
    },
    ...pool.slice(0, 3),
  ];
}

export function buildSearchLinks(query) {
  const q = String(query || 'game effect sprite sheet').trim() || 'sprite sheet vfx';
  return FX_SEARCH_SOURCES.map((s) => ({
    id: s.id,
    label: s.label,
    url: s.buildUrl(q),
  }));
}

export function createEmptyFxEntry(catalog) {
  return sanitizeFxEntry(
    {
      numId: getNextBattleFxNumId(catalog),
      id: `fx-${Date.now()}`,
      name: 'New Effect',
      nameVi: 'Hiệu ứng mới',
      tags: ['hit'],
      cols: 5,
      rows: 2,
      frameCount: 10,
      durationMs: 550,
      delayMs: 200,
      blendMode: 'normal',
      enabled: true,
    },
    `fx-${Date.now()}`
  );
}

export { slugify };
