/**
 * Arena battlefield slot positions per formation.
 * Source of truth in repo — no localStorage.
 * Preview editor: /battle/arena/field-config
 */

import formationSystem from './formationSystem';

const { getLineIndices, normalizeFormationId, formationsForMode } = formationSystem;

export const ARENA_FIELD_CONFIG_PATH = '/battle/arena/field-config';

/** Layouts — player side %; enemy mirrors 100 - left */
export const ARENA_FIELD_CONFIG = {
  version: 1,
  formations: {
    '3-2': {
      back: [
        { left: 24.923080053084938, top: 26.19565880816916 },
        { left: 14.871794871794872, top: 54.0217457646909 },
        { left: 6.358979053986379, top: 84.63043876316236 },
      ],
      front: [
        { left: 32.51282520783253, top: 47.413044805112094 },
        { left: 24.2051266401242, top: 76.10869697902514 },
      ],
    },
    '2-3': {
      back: [
        { left: 19.1794918744992, top: 38.89130302097487 },
        { left: 11.384613819611378, top: 60.108702286430024 },
      ],
      front: [
        { left: 35.38461538461539, top: 35.065221371858016 },
        { left: 26.97436210436699, top: 59.41304745881454 },
        { left: 16.923076923076923, top: 88.45652041227922 },
      ],
    },
    '4-1': {
      back: [
        { left: 27.692307692307693, top: 26.7173899774966 },
        { left: 21.84615697616186, top: 44.45652837338655 },
        { left: 14.256411821414265, top: 65.15218320100203 },
        { left: 6.666666666666667, top: 88.97826485011888 },
      ],
      front: [{ left: 31.28205128205128, top: 60.804357114045516 }],
    },
    '1-4': {
      back: [{ left: 11.589746719751602, top: 49.326085629670516 }],
      front: [
        { left: 34.564107259114586, top: 28.10869963272758 },
        { left: 28.410261105268432, top: 47.065210757048234 },
        { left: 21.333336463341347, top: 67.4130448051121 },
        { left: 13.333333333333334, top: 89.49999601944633 },
      ],
    },
    '2-1': {
      back: [
        { left: 19.282054412059292, top: 40.804357114045516 },
        { left: 10.256410256410255, top: 66.7173899774966 },
      ],
      front: [{ left: 26.97436210436699, top: 59.23912380052649 }],
    },
    '1-2': {
      back: [{ left: 13.846153846153847, top: 52.804346499235734 }],
      front: [
        { left: 28.820511255508812, top: 44.45651510487432 },
        { left: 21.84615697616186, top: 74.54347693401834 },
      ],
    },
  },
};

/** @deprecated use ARENA_FIELD_CONFIG */
export const DEFAULT_ARENA_FIELD_CONFIG = ARENA_FIELD_CONFIG;

function cloneConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

export function loadArenaFieldConfig() {
  // Drop legacy browser override if present
  try {
    localStorage.removeItem('petaria-arena-field-config');
  } catch {
    /* ignore */
  }
  return cloneConfig(ARENA_FIELD_CONFIG);
}

export function scaleFromTop(topPct, is3v3) {
  const t = Math.max(0, Math.min(1, (Number(topPct) - 30) / 58));
  const base = 0.85 + t * 0.4;
  return is3v3 ? base * 1.12 : base;
}

/**
 * Resolve pose for a unit on the battlefield.
 * @param {'player'|'enemy'} side
 * @param {string} formationId
 * @param {number} slotIndex
 * @param {string} battleMode
 * @param {object} [config]
 */
export function getArenaPose(side, formationId, slotIndex, battleMode, config) {
  const is3v3 = battleMode === '3v3';
  const fid = normalizeFormationId(formationId, battleMode);
  const cfg = config || ARENA_FIELD_CONFIG;
  const table = cfg.formations[fid] || ARENA_FIELD_CONFIG.formations[fid];
  const { back, front } = getLineIndices(fid);
  const backIdx = back.indexOf(slotIndex);
  const frontIdx = front.indexOf(slotIndex);

  let pos = { left: 22, top: 55 };
  if (backIdx >= 0 && table?.back?.[backIdx]) pos = table.back[backIdx];
  else if (frontIdx >= 0 && table?.front?.[frontIdx]) pos = table.front[frontIdx];

  const left = side === 'player' ? pos.left : 100 - pos.left;
  const top = pos.top;
  return {
    left: `${left}%`,
    top: `${top}%`,
    leftNum: left,
    topNum: top,
    scale: scaleFromTop(top, is3v3),
    zIndex: Math.round(top * 10) + (side === 'enemy' ? 1 : 0),
    line: backIdx >= 0 ? 'back' : 'front',
    lineIndex: backIdx >= 0 ? backIdx : frontIdx,
  };
}

export function listFormationsForConfigMode(mode) {
  return formationsForMode(mode);
}
