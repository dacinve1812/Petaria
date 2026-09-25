/**
 * Local-fetch helpers for admin pet_species drafts.
 * Scans image folders, dedupes by basename (smallest file wins),
 * and fills stats from Petaria Pokémon reference xlsx.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const DEFAULT_PETS_DIR = path.join(PUBLIC_DIR, 'images', 'pets');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif']);
const SKIP_EXTENSIONS = new Set([
  '.xlsx', '.xls', '.csv', '.doc', '.docx', '.txt', '.pdf', '.md', '.json', '.ds_store',
]);

const PREFERRED_EXCEL = [
  'Petaria_All_Gens_1-9_1025_Referenceq1.xlsx',
  'Petaria_All_Gens_1-9_1025_Reference.xlsx',
  'Petaria_Gen1_151_Base_Stats_MP_Rebalanced.xlsx',
];

const JUNK_TOKENS = new Set([
  'cover', 'bdsp', 'ranger', 'celebration', 'legendary', 'pokemon', 'pokémon', 'pokmon',
  'generated', 'image', 'untitled', 'design', 'gemini', 'pngegg', 'clear', 'quaivat',
  'family', 'of', 'four', 'two', 'the', 'and',
]);

const MYTHICAL = new Set([
  'mew', 'celebi', 'jirachi', 'deoxys', 'phione', 'manaphy', 'darkrai', 'shaymin', 'arceus',
  'victini', 'keldeo', 'meloetta', 'genesect', 'diancie', 'hoopa', 'volcanion', 'magearna',
  'marshadow', 'zeraora', 'meltan', 'melmetal', 'zarude', 'pecharunt',
]);

const LEGENDARY = new Set([
  'articuno', 'zapdos', 'moltres', 'mewtwo',
  'raikou', 'entei', 'suicune', 'lugia', 'hooh',
  'regirock', 'regice', 'registeel', 'latias', 'latios', 'kyogre', 'groudon', 'rayquaza',
  'uxie', 'mesprit', 'azelf', 'dialga', 'palkia', 'heatran', 'regigigas', 'giratina', 'cresselia',
  'cobalion', 'terrakion', 'virizion', 'tornadus', 'thundurus', 'reshiram', 'zekrom', 'landorus', 'kyurem',
  'xerneas', 'yveltal', 'zygarde',
  'typenull', 'silvally', 'tapukoko', 'tapulele', 'tapubulu', 'tapufini',
  'cosmog', 'cosmoem', 'solgaleo', 'lunala', 'necrozma',
  'zacian', 'zamazenta', 'eternatus', 'kubfu', 'urshifu', 'glastrier', 'spectrier', 'calyrex', 'enamorus',
  'regieleki', 'regidrago',
  'wochien', 'chienpao', 'tinglu', 'chiyu', 'koraidon', 'miraidon',
  'walkingwake', 'ironleaves', 'okidogi', 'munkidori', 'fezandipiti', 'ogerpon',
  'gougingfire', 'ragingbolt', 'ironboulder', 'ironcrown', 'terapagos',
]);

const DEFAULT_STATS = {
  base_hp: 10,
  base_mp: 10,
  base_str: 10,
  base_def: 10,
  base_intelligence: 10,
  base_spd: 10,
};

let referenceCache = { file: '', mtimeMs: 0, refs: [], index: null };

function isInsideDir(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveScanDir(requested) {
  if (!requested || String(requested).trim() === '') return DEFAULT_PETS_DIR;
  const raw = String(requested).trim();
  const target = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(PUBLIC_DIR, raw);
  if (!isInsideDir(PUBLIC_DIR, target)) {
    const err = new Error('Folder phải nằm trong public/');
    err.status = 400;
    throw err;
  }
  return target;
}

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function decodeMaybe(s) {
  const str = String(s || '');
  try {
    return decodeURIComponent(str);
  } catch (_) {
    return str.replace(/%3F/gi, '?');
  }
}

function compactName(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[^a-z0-9]+/g, '');
}

function titleFromStem(stem) {
  const cleaned = String(stem || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return stem || '';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const al = a.length;
  const bl = b.length;
  const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i += 1) dp[i][0] = i;
  for (let j = 0; j <= bl; j += 1) dp[0][j] = j;
  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[al][bl];
}

function stripTrailingIndex(s) {
  return String(s || '').replace(/[\s_-]*\d+$/g, '').trim();
}

function buildQueryCandidates(raw) {
  const decoded = decodeMaybe(raw);
  const spaced = decoded.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = spaced.toLowerCase().split(' ').filter(Boolean);
  const kept = tokens.filter((t) => {
    if (/^\d+$/.test(t)) return false;
    if (/^[a-f0-9]{16,}$/i.test(t)) return false;
    const c = compactName(t);
    if (JUNK_TOKENS.has(t) || JUNK_TOKENS.has(c)) return false;
    return true;
  });
  const keptStr = kept.join(' ');
  const noIndex = stripTrailingIndex(keptStr);
  const noMega = noIndex.replace(/^mega\s+/i, '').trim();
  const out = [];
  const push = (v) => {
    const t = String(v || '').trim();
    if (t && !out.includes(t)) out.push(t);
  };
  push(decoded);
  push(spaced);
  push(stripTrailingIndex(spaced));
  push(keptStr);
  push(noIndex);
  push(noMega);
  kept.forEach(push);
  if (kept.length >= 2) push(`${kept[0]} ${kept[1]}`);
  return out;
}

function inferRarity(ref) {
  const keys = [];
  const compact = compactName(ref.name);
  keys.push(compact);
  String(ref.name || '')
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .forEach((part, i, arr) => {
      keys.push(compactName(part));
      if (i === 0 && arr[1]) keys.push(compactName(part + arr[1]));
    });
  if (keys.some((k) => MYTHICAL.has(k))) return 'mythic';
  if (keys.some((k) => LEGENDARY.has(k))) return 'legend';
  const total = Number(ref.coreTotal) || 0;
  if (total >= 520) return 'legend';
  if (total >= 450) return 'epic';
  if (total >= 360) return 'rare';
  if (total >= 280) return 'uncommon';
  return 'common';
}

function primaryType(typeRaw) {
  const s = String(typeRaw || '').trim();
  if (!s) return '';
  return s.split('/')[0].trim().toLowerCase();
}

function parseHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i += 1) {
    const row = rows[i] || [];
    const lowered = row.map((c) => String(c || '').trim().toLowerCase());
    const pokemonIdx = lowered.findIndex((c) => c === 'pokemon' || c === 'name' || c === 'pet');
    const hpIdx = lowered.findIndex((c) => c === 'hp' || c === 'base_hp');
    if (pokemonIdx >= 0 && hpIdx >= 0) {
      return {
        headerIndex: i,
        col: {
          name: pokemonIdx,
          type: lowered.findIndex((c) => c === 'type'),
          hp: hpIdx,
          mp: lowered.findIndex((c) => c === 'mp' || c === 'base_mp'),
          str: lowered.findIndex((c) => c === 'str' || c === 'base_str'),
          def: lowered.findIndex((c) => c === 'def' || c === 'dev' || c === 'base_def'),
          int: lowered.findIndex((c) => c === 'int' || c === 'ing' || c === 'intelligence' || c === 'base_intelligence'),
          spd: lowered.findIndex((c) => c === 'spd' || c === 'speed' || c === 'base_spd'),
          total: lowered.findIndex((c) => c === 'core total' || c === 'total'),
          note: lowered.findIndex((c) => c === 'design note' || c === 'note' || c === 'description'),
        },
      };
    }
  }
  return null;
}

function numCell(row, idx, fallback = 10) {
  if (idx < 0) return fallback;
  const n = Number(row[idx]);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function loadPetariaReference(dir = DEFAULT_PETS_DIR) {
  if (!fs.existsSync(dir)) {
    return { file: null, refs: [], index: emptyIndex() };
  }
  const names = fs.readdirSync(dir);
  const excelName =
    PREFERRED_EXCEL.find((n) => names.includes(n)) ||
    names.find((n) => /\.xlsx$/i.test(n) && !n.startsWith('~$'));
  if (!excelName) return { file: null, refs: [], index: emptyIndex() };

  const filePath = path.join(dir, excelName);
  const stat = fs.statSync(filePath);
  if (referenceCache.file === filePath && referenceCache.mtimeMs === stat.mtimeMs) {
    return { file: excelName, refs: referenceCache.refs, index: referenceCache.index };
  }

  const wb = XLSX.readFile(filePath);
  const sheetName =
    wb.SheetNames.find((n) => /all pokemon|petaria|gen/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  const parsed = parseHeaderRow(rows);
  const refs = [];
  if (parsed) {
    for (let i = parsed.headerIndex + 1; i < rows.length; i += 1) {
      const row = rows[i] || [];
      const name = String(row[parsed.col.name] || '').trim();
      if (!name || /^pokemon$/i.test(name) || name === '#') continue;
      refs.push({
        name,
        type: parsed.col.type >= 0 ? String(row[parsed.col.type] || '').trim() : '',
        base_hp: numCell(row, parsed.col.hp),
        base_mp: numCell(row, parsed.col.mp),
        base_str: numCell(row, parsed.col.str),
        base_def: numCell(row, parsed.col.def),
        base_intelligence: numCell(row, parsed.col.int),
        base_spd: numCell(row, parsed.col.spd),
        coreTotal: numCell(row, parsed.col.total, 0),
        description: parsed.col.note >= 0 ? String(row[parsed.col.note] || '').trim() : '',
      });
    }
  }

  const index = buildIndex(refs);
  referenceCache = { file: filePath, mtimeMs: stat.mtimeMs, refs, index };
  return { file: excelName, refs, index };
}

function emptyIndex() {
  return { byCompact: new Map(), list: [] };
}

function buildIndex(refs) {
  const byCompact = new Map();
  refs.forEach((ref) => {
    const keys = new Set([compactName(ref.name)]);
    String(ref.name)
      .split(/[\s\-_]+/)
      .filter(Boolean)
      .forEach((part) => {
        const ck = compactName(part);
        if (ck.length >= 4) keys.add(ck);
      });
    keys.forEach((k) => {
      if (!k) return;
      if (!byCompact.has(k)) byCompact.set(k, []);
      byCompact.get(k).push(ref);
    });
  });
  return { byCompact, list: refs };
}

function pickBestRef(matches, queryCompact) {
  if (!matches || !matches.length) return null;
  const unique = [];
  const seen = new Set();
  matches.forEach((m) => {
    if (seen.has(m.name)) return;
    seen.add(m.name);
    unique.push(m);
  });
  const exact = unique.find((m) => compactName(m.name) === queryCompact);
  if (exact) return exact;
  unique.sort((a, b) => compactName(a.name).length - compactName(b.name).length);
  return unique[0];
}

function matchReference(query, index) {
  if (!query || !index) return null;
  const candidates = buildQueryCandidates(query);
  for (const cand of candidates) {
    const c = compactName(cand);
    if (!c || c.length < 2) continue;
    const hits = index.byCompact.get(c);
    if (hits && hits.length) return pickBestRef(hits, c);
  }

  for (const cand of candidates) {
    const c = compactName(cand);
    if (c.length < 4) continue;
    const prefixed = index.list.filter((ref) => compactName(ref.name).startsWith(c));
    const uniqueNames = [...new Set(prefixed.map((ref) => ref.name))];
    if (uniqueNames.length === 1) return prefixed[0];
  }

  // Fuzzy: unique close compact match (typos like hoho ≈ hooh)
  const fuzzyQuery = compactName(candidates.find((c) => compactName(c).length >= 4) || query);
  if (fuzzyQuery.length >= 4 && !/^[a-f0-9]{16,}$/i.test(fuzzyQuery)) {
    let best = null;
    let bestDist = 3;
    let ties = 0;
    for (const ref of index.list) {
      const rc = compactName(ref.name);
      if (Math.abs(rc.length - fuzzyQuery.length) > 2) continue;
      const d = levenshtein(fuzzyQuery, rc);
      if (d < bestDist) {
        best = ref;
        bestDist = d;
        ties = 1;
      } else if (d === bestDist && best && compactName(best.name) !== rc) {
        ties += 1;
      }
    }
    if (best && bestDist <= 1 && ties === 1) return best;
  }
  return null;
}

const STAT_KEYS = ['base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd'];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

function randInt(min, max) {
  const lo = Math.round(Number(min));
  const hi = Math.round(Number(max));
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) return 10;
  if (!Number.isFinite(hi) || hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function summarizeRefs(refs) {
  const byStat = {};
  STAT_KEYS.forEach((k) => { byStat[k] = []; });
  const totals = [];
  (refs || []).forEach((ref) => {
    let total = 0;
    STAT_KEYS.forEach((k) => {
      const n = Number(ref[k]);
      if (!Number.isFinite(n)) return;
      byStat[k].push(n);
      total += n;
    });
    totals.push(total);
  });
  STAT_KEYS.forEach((k) => byStat[k].sort((a, b) => a - b));
  totals.sort((a, b) => a - b);
  return { byStat, totals };
}

/**
 * Random base stats bounded by Excel min/max (and rarity band) so the
 * total stays near the typical Core Total instead of going off-curve.
 */
function autoGenerateStats({ rarity } = {}) {
  const { refs } = loadPetariaReference();
  const tagged = (refs || []).map((r) => ({ ...r, _rarity: inferRarity(r) }));
  let pool = rarity ? tagged.filter((r) => r._rarity === rarity) : tagged;
  if (pool.length < 8) pool = tagged;
  const { byStat, totals } = summarizeRefs(pool.length ? pool : [DEFAULT_STATS]);

  const fallbackTotal = { common: 260, uncommon: 320, rare: 390, epic: 460, legend: 520, mythic: 560 };
  const targetLo = totals.length ? percentile(totals, 0.35) : (fallbackTotal[rarity] || 280) - 20;
  const targetHi = totals.length ? percentile(totals, 0.65) : (fallbackTotal[rarity] || 280) + 20;
  const target = randInt(targetLo, targetHi);

  const raw = {};
  STAT_KEYS.forEach((k) => {
    const arr = byStat[k];
    const absMin = arr[0] ?? 15;
    const absMax = arr[arr.length - 1] ?? 140;
    const lo = arr.length ? percentile(arr, 0.15) : absMin;
    const hi = arr.length ? percentile(arr, 0.85) : absMax;
    raw[k] = randInt(Math.max(absMin, lo), Math.min(absMax, hi));
  });

  const sum = STAT_KEYS.reduce((s, k) => s + raw[k], 0) || 1;
  const stats = {};
  STAT_KEYS.forEach((k) => {
    const arr = byStat[k];
    const min = arr[0] ?? 15;
    const max = arr[arr.length - 1] ?? 160;
    stats[k] = Math.max(min, Math.min(max, Math.round((raw[k] * target) / sum)));
  });

  let cur = STAT_KEYS.reduce((s, k) => s + stats[k], 0);
  let guard = 0;
  while (cur !== target && guard < 100) {
    const k = STAT_KEYS[guard % STAT_KEYS.length];
    const arr = byStat[k];
    const min = arr[0] ?? 15;
    const max = arr[arr.length - 1] ?? 160;
    if (cur < target && stats[k] < max) {
      stats[k] += 1;
      cur += 1;
    } else if (cur > target && stats[k] > min) {
      stats[k] -= 1;
      cur -= 1;
    }
    guard += 1;
  }

  return {
    ...stats,
    rarity: rarity || 'common',
    statSource: 'auto',
    targetTotal: target,
  };
}

function generateDraftStats(name, image, index) {
  const queries = [name, image && path.parse(String(image)).name].filter(Boolean);
  let ref = null;
  for (const q of queries) {
    ref = matchReference(q, index);
    if (ref) break;
  }
  if (!ref) {
    return {
      ...DEFAULT_STATS,
      type: '',
      rarity: 'common',
      description: '',
      matchedName: null,
      statSource: 'default',
    };
  }
  return {
    base_hp: ref.base_hp,
    base_mp: ref.base_mp,
    base_str: ref.base_str,
    base_def: ref.base_def,
    base_intelligence: ref.base_intelligence,
    base_spd: ref.base_spd,
    type: primaryType(ref.type),
    rarity: inferRarity(ref),
    description: ref.description || '',
    matchedName: ref.name,
    statSource: `excel:${ref.name}`,
  };
}

function listPetImages(dir = DEFAULT_PETS_DIR) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    const err = new Error('Không tìm thấy folder ảnh');
    err.status = 404;
    throw err;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const skippedNonImages = [];
  const images = [];
  entries.forEach((ent) => {
    if (!ent.isFile()) return;
    const ext = path.extname(ent.name).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext) || !isImageFile(ent.name)) {
      if (ext) skippedNonImages.push(ent.name);
      return;
    }
    const full = path.join(dir, ent.name);
    let size = 0;
    try {
      size = fs.statSync(full).size;
    } catch (_) {
      size = 0;
    }
    images.push({
      filename: ent.name,
      stem: path.parse(ent.name).name,
      stemKey: path.parse(ent.name).name.toLowerCase(),
      size,
    });
  });

  const groups = new Map();
  images.forEach((img) => {
    const prev = groups.get(img.stemKey);
    if (!prev) {
      groups.set(img.stemKey, { chosen: img, skipped: [] });
      return;
    }
    if (img.size < prev.chosen.size) {
      prev.skipped.push(prev.chosen);
      prev.chosen = img;
    } else {
      prev.skipped.push(img);
    }
  });

  const chosen = [];
  const deduped = [];
  groups.forEach((g) => {
    chosen.push(g.chosen);
    if (g.skipped.length) {
      deduped.push({
        stem: g.chosen.stem,
        chosen: g.chosen.filename,
        chosenSize: g.chosen.size,
        skipped: g.skipped.map((s) => ({ filename: s.filename, size: s.size })),
      });
    }
  });
  chosen.sort((a, b) => a.filename.localeCompare(b.filename, 'en', { sensitivity: 'base' }));
  return { chosen, deduped, skippedNonImages };
}

function existingLookup(existingSpecies = []) {
  const byImage = new Set();
  existingSpecies.forEach((s) => {
    if (s && s.image) byImage.add(String(s.image).trim().toLowerCase());
  });
  return { byImage };
}

function buildDraftsFromImages(images, index, existingSpecies = []) {
  const exist = existingLookup(existingSpecies);
  return images.map((img, i) => {
    const generated = generateDraftStats(img.stem, img.filename, index);
    const displayName = generated.matchedName || titleFromStem(img.stem);
    const alreadyAdded = exist.byImage.has(String(img.filename).toLowerCase());
    return {
      key: `${img.stemKey}:${img.filename}`,
      name: displayName,
      image: img.filename,
      imageUrl: `/images/pets/${encodeURIComponent(img.filename)}`,
      size: img.size,
      type: generated.type,
      description: generated.description,
      rarity: generated.rarity,
      base_hp: generated.base_hp,
      base_mp: generated.base_mp,
      base_str: generated.base_str,
      base_def: generated.base_def,
      base_intelligence: generated.base_intelligence,
      base_spd: generated.base_spd,
      evolve_to: '',
      matchedName: generated.matchedName,
      statSource: generated.statSource,
      alreadyAdded,
      order: i,
    };
  });
}

function draftsFromLocalFiles(files, index, existingSpecies = []) {
  const images = [];
  const skippedNonImages = [];
  (files || []).forEach((f) => {
    const filename = String(f.name || f.filename || '').trim();
    if (!filename) return;
    if (!isImageFile(filename)) {
      skippedNonImages.push(filename);
      return;
    }
    images.push({
      filename,
      stem: path.parse(filename).name,
      stemKey: path.parse(filename).name.toLowerCase(),
      size: Number(f.size) || 0,
    });
  });
  const groups = new Map();
  images.forEach((img) => {
    const prev = groups.get(img.stemKey);
    if (!prev) {
      groups.set(img.stemKey, { chosen: img, skipped: [] });
      return;
    }
    if (img.size < prev.chosen.size) {
      prev.skipped.push(prev.chosen);
      prev.chosen = img;
    } else {
      prev.skipped.push(img);
    }
  });
  const chosen = [];
  const deduped = [];
  groups.forEach((g) => {
    chosen.push(g.chosen);
    if (g.skipped.length) {
      deduped.push({
        stem: g.chosen.stem,
        chosen: g.chosen.filename,
        chosenSize: g.chosen.size,
        skipped: g.skipped.map((s) => ({ filename: s.filename, size: s.size })),
      });
    }
  });
  chosen.sort((a, b) => a.filename.localeCompare(b.filename, 'en', { sensitivity: 'base' }));
  return {
    drafts: buildDraftsFromImages(chosen, index, existingSpecies),
    deduped,
    skippedNonImages,
  };
}

function scanFolderToDrafts(dir, existingSpecies = []) {
  const { chosen, deduped, skippedNonImages } = listPetImages(dir);
  const excelDir = fs.existsSync(DEFAULT_PETS_DIR) ? DEFAULT_PETS_DIR : dir;
  const { file, index } = loadPetariaReference(excelDir);
  const drafts = buildDraftsFromImages(chosen, index, existingSpecies);
  return {
    folder: dir,
    excelFile: file,
    drafts,
    deduped,
    skippedNonImages,
    matched: drafts.filter((d) => d.matchedName).length,
  };
}

function normalizeSpeciesPayload(body) {
  const name = String(body.name || '').trim();
  const image = String(body.image || '').trim();
  if (!name || !image) {
    const err = new Error('Thiếu name hoặc image');
    err.status = 400;
    throw err;
  }
  let evolveTo = body.evolve_to;
  if (evolveTo !== undefined && evolveTo !== null && evolveTo !== '') {
    if (typeof evolveTo === 'string') {
      try {
        evolveTo = JSON.parse(evolveTo);
      } catch (_) {
        evolveTo = null;
      }
    }
  } else {
    evolveTo = null;
  }
  const eml =
    body.evolve_min_level != null && body.evolve_min_level !== ''
      ? Math.max(1, parseInt(body.evolve_min_level, 10) || 1)
      : 1;
  const eItem =
    body.evolve_item_id != null && body.evolve_item_id !== ''
      ? parseInt(body.evolve_item_id, 10)
      : null;
  return {
    name,
    image,
    type: body.type ?? '',
    description: body.description ?? '',
    rarity: body.rarity || 'common',
    base_hp: parseInt(body.base_hp, 10) || 0,
    base_mp: parseInt(body.base_mp, 10) || 0,
    base_str: parseInt(body.base_str, 10) || 0,
    base_def: parseInt(body.base_def, 10) || 0,
    base_intelligence: parseInt(body.base_intelligence, 10) || 0,
    base_spd: parseInt(body.base_spd, 10) || 0,
    evolve_to: evolveTo,
    evolve_min_level: eml,
    evolve_item_id: Number.isFinite(eItem) && eItem > 0 ? eItem : null,
  };
}

module.exports = {
  DEFAULT_PETS_DIR,
  PUBLIC_DIR,
  resolveScanDir,
  loadPetariaReference,
  generateDraftStats,
  autoGenerateStats,
  listPetImages,
  scanFolderToDrafts,
  draftsFromLocalFiles,
  normalizeSpeciesPayload,
  isImageFile,
};
