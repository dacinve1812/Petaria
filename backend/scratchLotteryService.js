/**
 * Logic vé cào server — khớp `ScratchLotteryGame.js` (pool symbol theo rewards, ép trùng 2 ô / 3 ô).
 */

function clampInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function pickWeighted(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const norm = list
    .map((r) => ({
      symbolId: String(r?.symbolId || ''),
      rewardPeta: Number(r?.rewardPeta ?? 0),
      weight: Number(r?.weight ?? 0),
    }))
    .filter((r) => r.symbolId && Number.isFinite(r.weight) && r.weight > 0);

  const total = norm.reduce((s, r) => s + r.weight, 0);
  if (!total) return null;

  let x = Math.random() * total;
  for (const r of norm) {
    x -= r.weight;
    if (x <= 0) return r;
  }
  return norm[norm.length - 1] || null;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function symbolIdsFromRewards(rewards) {
  const list = Array.isArray(rewards) ? rewards : [];
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const id = String(r?.symbolId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function generateForcedWinningIds({ count, requiredMatch, winSymbolId, poolIds }) {
  const safePool = poolIds?.length ? poolIds : ['fallback'];
  const winId = winSymbolId || safePool[0];

  const ids = Array(count).fill(null);
  const positions = shuffle(Array.from({ length: count }, (_, i) => i)).slice(
    0,
    Math.min(requiredMatch, count),
  );
  positions.forEach((p) => {
    ids[p] = winId;
  });

  for (let i = 0; i < count; i += 1) {
    if (ids[i]) continue;
    const candidates = safePool.filter((id) => id !== winId);
    const pickFrom = candidates.length ? candidates : safePool;
    ids[i] = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  }

  return { ids, winId };
}

/** @returns {{ mode:number, ids:string[], winSymbolId:string, rewardPeta:number, requiredMatch:number } | null } */
function buildScratchTicketFromConfig(scratchLottery, globalSymbols, mode) {
  if (!scratchLottery || typeof scratchLottery !== 'object') return null;
  const t = mode === 3 ? scratchLottery.ticket3 : scratchLottery.ticket5;
  if (!t || typeof t !== 'object') return null;
  const rewards = t.rewards;
  const ticketPoolIds = symbolIdsFromRewards(rewards);
  const poolIdsFallback = (globalSymbols || [])
    .map((s) => s.id)
    .filter(Boolean);
  const poolIds = ticketPoolIds.length ? ticketPoolIds : poolIdsFallback.length ? poolIdsFallback : ['fallback'];

  const requiredMatch = mode === 3 ? 2 : 3;
  const pick = pickWeighted(rewards);
  const pickFallback = pick || {
    symbolId: poolIds[0],
    rewardPeta: 0,
    weight: 1,
  };

  const gen = generateForcedWinningIds({
    count: mode === 3 ? 3 : 5,
    requiredMatch,
    winSymbolId: pickFallback.symbolId,
    poolIds,
  });

  return {
    mode,
    ids: gen.ids,
    winSymbolId: gen.winId,
    rewardPeta: Math.max(0, clampInt(pickFallback.rewardPeta, 0)),
    requiredMatch,
  };
}

function parsePending(raw) {
  if (raw == null || raw === '') return null;
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!o || typeof o !== 'object') return null;
    return o;
  } catch {
    return null;
  }
}

module.exports = {
  pickWeighted,
  symbolIdsFromRewards,
  generateForcedWinningIds,
  buildScratchTicketFromConfig,
  parsePending,
};
