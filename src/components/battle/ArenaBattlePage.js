// ArenaBattlePage.js - Trang chiến đấu PvE (arena / champion / hunting)
import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import BattleFxOverlay from './BattleFxOverlay';
import {
  BATTLE_FX_ATTACK_ANIM_ID,
  BATTLE_FX_DEFEND_ANIM_ID,
  getBattleFxByNumId,
  loadBattleFxCatalogAsync,
} from '../../data/battleFxCatalog';
import {
  loadBattleBackgroundCatalogAsync,
  resolveBattleBackgroundKey,
  getBackgroundById,
  sceneBackgroundStyle,
} from '../../data/battleBackgroundCatalog';
import { getDisplayName } from '../../utils/userDisplay';
import { getActiveHuntingMap } from '../../utils/huntingSessionStorage';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';
import formationSystem from '../../data/formationSystem';
import { getArenaPose } from '../../data/arenaFieldConfig';
import '../css/BattlePage.css';
import '../css/ArenaBattlePage.css';
import './ClassicBattlePage.css';
import expTable from '../../data/exp_table_petaria.json';
import { BattleRewardStrip } from './BattleOverlays';

const { normalizeFormationId } = formationSystem;

const BATTLE_RETURN_KEY = 'petaria-arena-battle-return';
const CLASSIC_MATCH_KEY = 'petaria-classic-match';

function formatNum(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

const LOSE_FLAVOR_TEMPLATES = [
  (pet, enemy) =>
    `Tiếc quá, ${pet} của bạn đã bị ${enemy} đánh bại. Hãy trở lại sau nhé!`,
  (pet, enemy) => `${enemy} mạnh quá, ${pet} không có cơ hội nào.`,
  (pet, enemy) => `Chúng ta thua rồi, ${pet} làm tốt lắm, hãy nghỉ ngơi nhé.`,
  (pet, enemy) => `${pet} đã kiệt sức trước ${enemy}. Lần sau sẽ khác thôi!`,
  (pet, enemy) => `Trận đấu kết thúc — ${enemy} thắng thế. ${pet} cần thêm sức mạnh.`,
  (pet, enemy) => `Đừng nản lòng! ${pet} chưa đủ mạnh để hạ ${enemy} lần này.`,
];

function pickLoseFlavor(petName, enemyName) {
  const pet = petName || 'Pet của bạn';
  const enemy = enemyName || 'đối thủ';
  const fn = LOSE_FLAVOR_TEMPLATES[Math.floor(Math.random() * LOSE_FLAVOR_TEMPLATES.length)];
  return fn(pet, enemy);
}

const RESULT_POWER_TIPS = [
  {
    key: 'equipment',
    label: 'Nâng cấp vũ khí',
    hint: 'Equipment',
    to: '/shop/general/armory',
    icon: '/images/icons/sword.png',
  },
  {
    key: 'spirit',
    label: 'Nâng cấp linh thú',
    hint: 'Linh thú',
    to: '/myhome/myspirit',
    icon: '/images/icons/spirit.png',
  },
  {
    key: 'level',
    label: 'Tăng cấp Level',
    hint: 'Đấu trường',
    to: '/battle/arena',
    icon: '/images/icons/arena.png',
  },
];


function petImgSrc(value, folder = 'pets') {
  if (!value) return '';
  if (/^(https?:|\/)/.test(value)) return value;
  return `/images/${folder}/${value}`;
}

function normalizeBattleMode(raw) {
  const m = String(raw || '1v1').toLowerCase();
  if (m === '3v3' || m === '3vs3') return '3v3';
  if (m === '5v5' || m === '5vs5') return '5v5';
  return '1v1';
}

function battlePetImg(image) {
  if (!image) return '/images/pets/placeholder.png';
  const s = String(image);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/pets/${s}`;
}

/** equipment_type khớp *weapon (weapon, melee_weapon, …) */
function isWeaponEquipmentType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'weapon' || t.endsWith('weapon') || t.includes('weapon');
}

function isShieldEquipmentType(typeOrItem) {
  if (typeOrItem && typeof typeOrItem === 'object') {
    return [typeOrItem.equipment_type, typeOrItem.slot_type].some(
      (value) => String(value || '').trim().toLowerCase() === 'shield'
    );
  }
  return String(typeOrItem || '').trim().toLowerCase() === 'shield';
}

function shieldHpValue(defDmg) {
  const hp = Number(defDmg);
  return Number.isFinite(hp) && hp > 0 ? Math.floor(hp) : 0;
}

function shieldHpFromLogText(text) {
  const matched = String(text || '').match(/shield\s+(\d+)/i);
  return matched ? shieldHpValue(matched[1]) : 0;
}

function withShield(unit, defDmg) {
  const value = shieldHpValue(defDmg);
  return {
    ...unit,
    current_def_dmg: value,
    shield_hold: true,
  };
}

function catalogFxWaitMs(animationId) {
  const entry = getBattleFxByNumId(animationId, null, {
    fallback: Number(animationId) === BATTLE_FX_ATTACK_ANIM_ID,
  });
  if (!entry) return 900;
  return Math.max(600, (Number(entry.delayMs) || 0) + (Number(entry.durationMs) || 550) + 80);
}

function unitSpd(u) {
  return Number(u?.final_stats?.spd ?? u?.spd ?? 0) || 0;
}

function unitMaxHp(u) {
  return Math.max(1, Number(u?.final_stats?.hp ?? u?.hp ?? 1) || 1);
}

function unitHpPct(u) {
  return Math.max(0, Math.min(100, ((Number(u?.current_hp) || 0) / unitMaxHp(u)) * 100));
}

function hpToneClass(u) {
  const pct = unitHpPct(u);
  if (pct > 60) return 'arena-hp--high';
  if (pct > 30) return 'arena-hp--mid';
  return 'arena-hp--low';
}

function sumTeamSpd(units) {
  return (units || []).reduce((s, u) => s + unitSpd(u), 0);
}

function modeDeploySlots(mode) {
  if (mode === '5v5') return 5;
  if (mode === '3v3') return 3;
  return 1;
}

/**
 * Team SPD cao hơn mở lượt trước (pet SPD cao nhất của team đó),
 * rồi xen kẽ: P1, E1, P2, E2, ... (không dump cả team trước).
 */
function buildSpeedQueue(playerUnits, enemyUnits) {
  const p = (playerUnits || [])
    .filter(Boolean)
    .map((u) => ({ ...u, side: 'player', queueKey: `player-${u.id}` }));
  const e = (enemyUnits || [])
    .filter(Boolean)
    .map((u) => ({ ...u, side: 'enemy', queueKey: `enemy-${u.id}` }));
  const bySpd = (a, b) =>
    unitSpd(b) - unitSpd(a) || String(a.id).localeCompare(String(b.id));
  p.sort(bySpd);
  e.sort(bySpd);
  const pTot = sumTeamSpd(p);
  const eTot = sumTeamSpd(e);
  const firstIsPlayer =
    pTot > eTot || (pTot === eTot && unitSpd(p[0] || {}) >= unitSpd(e[0] || {}));
  return interleaveSides(firstIsPlayer ? p : e, firstIsPlayer ? e : p);
}

/** Xen kẽ 2 dãy (giữ thứ tự trong từng dãy). */
function interleaveSides(primary, secondary) {
  const queue = [];
  const n = Math.max(primary.length, secondary.length);
  for (let i = 0; i < n; i += 1) {
    if (primary[i]) queue.push(primary[i]);
    if (secondary[i]) queue.push(secondary[i]);
  }
  return queue;
}

/**
 * Sau mỗi lượt: đưa pet vừa đánh xuống cuối, luôn kéo pet phía đối diện lên đầu
 * nếu còn trong hàng — tránh dồn E-E-E khi 2 đội lệch số lượng.
 */
function advanceAlternatingQueue(queue) {
  if (!queue?.length) return queue || [];
  if (queue.length === 1) return queue;
  const [acted, ...rest] = queue;
  const opposite = acted.side === 'player' ? 'enemy' : 'player';
  const oppIdx = rest.findIndex((u) => u.side === opposite);
  if (oppIdx === -1) {
    return [...rest, acted];
  }
  if (oppIdx === 0) {
    return [...rest, acted];
  }
  const oppUnit = rest[oppIdx];
  const others = [...rest.slice(0, oppIdx), ...rest.slice(oppIdx + 1)];
  return [oppUnit, ...others, acted];
}

/** Sau khi bỏ pet chết: tái xen kẽ, giữ pet đang đầu hàng làm phía mở đầu. */
function rebalanceAlternatingQueue(queue) {
  if (!queue?.length) return queue || [];
  const firstSide = queue[0].side;
  const primary = [];
  const secondary = [];
  queue.forEach((u) => {
    if (u.side === firstSide) primary.push(u);
    else secondary.push(u);
  });
  return interleaveSides(primary, secondary);
}

/** Header HP: 1v1 = 1 pet; 3v3 mỗi pet = 100/3%; 5v5 = 100/5%. Thiếu pet → max < 100%. */
function teamHeaderHpPct(units, battleMode) {
  const slots = modeDeploySlots(battleMode);
  const list = (units || []).filter(Boolean);
  if (slots <= 1) {
    if (!list.length) return 0;
    return unitHpPct(list[0]);
  }
  const share = 100 / slots;
  return list.reduce((sum, u) => {
    const max = unitMaxHp(u);
    const cur = Math.max(0, Number(u.current_hp) || 0);
    return sum + (cur / max) * share;
  }, 0);
}

function livingUnits(units) {
  return (units || []).filter((u) => u && (Number(u.current_hp) || 0) > 0);
}

function pickRandomLiving(units) {
  const live = livingUnits(units);
  if (!live.length) return null;
  return live[Math.floor(Math.random() * live.length)];
}

function teamStillAlive(units) {
  return livingUnits(units).length > 0;
}

function turnLimitForMode(mode) {
  return mode === '1v1' ? 50 : 200;
}

/** Crit burst icon (orange jagged impact) */
function CritBurstIcon() {
  return (
    <svg className="abm-float__crit-icon" viewBox="0 0 36 36" aria-hidden focusable="false">
      <path
        fill="currentColor"
        stroke="#1a1008"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M18 1.5l3.2 9.2 9.8-2.6-6.2 7.8 8.6 5.6-10.2-1.2-1.4 10.4-3.8-9.6-8.8 6.2 3.2-9.4L2 14.8l9.6-2.2L18 1.5z"
      />
    </svg>
  );
}

/** Floating dmg / crit / heal / miss over pet */
function FloatingCombatText({ value, kind = 'damage' }) {
  if (kind === 'miss') {
    return (
      <span className="abm-float abm-float--miss" aria-hidden>
        <em className="abm-float__num">MISS</em>
      </span>
    );
  }
  const n = Math.abs(Math.round(Number(value) || 0));
  if (!n) return null;
  const label = kind === 'heal' ? `+${n}` : String(n);
  return (
    <span className={`abm-float abm-float--${kind}`} aria-hidden>
      {kind === 'crit' ? <CritBurstIcon /> : null}
      <em className="abm-float__num">{label}</em>
    </span>
  );
}

function floatTextsForUnit(floatTexts, unitId) {
  if (!unitId || !Array.isArray(floatTexts)) return [];
  const id = String(unitId);
  return floatTexts.filter((t) => String(t.unitId) === id);
}

/** Parse dmg/crit/heal/miss từ 1 dòng log */
function parseCombatFloatFromText(text) {
  const t = String(text || '');
  if (/trượt|miss/i.test(t)) return { kind: 'miss', value: 1 };
  const reflect = t.match(/phản đòn\s+(\d+)/i);
  if (reflect) return { value: Number(reflect[1]), kind: 'damage', reflected: true };
  const dmg = t.match(/gây\s+(\d+)\s+sát thương/i);
  if (dmg) {
    return {
      value: Number(dmg[1]),
      kind: /\(CRIT\)/i.test(t) ? 'crit' : 'damage',
      reflected: false,
    };
  }
  const heal = t.match(/(?:hồi|heal)\s*\+?(\d+)|\+(\d+)\s*(?:HP|máu|hp)/i);
  if (heal) return { value: Number(heal[1] || heal[2]), kind: 'heal', reflected: false };
  return null;
}

/**
 * Các nhịp combat mới trong history (từ fromIndex).
 * Dùng cho Redis: play FX player rồi NPC trong cùng 1 turn.
 */
function parseHistoryCombatBeats(history, fromIndex = 0, names = {}) {
  const beats = [];
  const list = Array.isArray(history) ? history : [];
  const playerName = String(names.playerName || '');
  const enemyName = String(names.enemyName || '');
  for (let i = Math.max(0, fromIndex); i < list.length; i += 1) {
    const entry = list[i];
    const type = String(entry?.type || '');
    const text = String(entry?.text || '');
    if (type !== 'player_attack' && type !== 'enemy_attack') continue;
    const parsed = parseCombatFloatFromText(text);
    if (!parsed) continue;

    let side = type === 'enemy_attack' ? 'enemy' : 'player';
    // Phản đòn: log đôi khi ghi type sai — suy ra từ tên attacker trong câu
    if (parsed.reflected) {
      const who = text.match(/^(.+?)\s+đánh/);
      const atkName = who?.[1]?.trim() || '';
      if (atkName && playerName && atkName === playerName) side = 'player';
      else if (atkName && enemyName && atkName === enemyName) side = 'enemy';
    }

    beats.push({
      side,
      miss: parsed.kind === 'miss',
      reflected: !!parsed.reflected,
      floatText: { value: parsed.value, kind: parsed.kind },
    });
  }
  return beats;
}

function floatFromDamageResult(result) {
  const dmg = Math.round(Number(result?.damage) || 0);
  if (dmg <= 0) return null;
  return { value: dmg, kind: result?.critical ? 'crit' : 'damage' };
}

function floatFromReflectResult(result) {
  const dmg = Math.round(Number(result?.reflectedDamage) || 0);
  if (dmg <= 0) return null;
  return { value: dmg, kind: 'damage' };
}

function floatMiss() {
  return { value: 1, kind: 'miss' };
}


/** Ô pet multi: HP + status icons phía trên, Lv phía dưới — không hiện tên/stats */
function PetShieldOverlay({ active, side }) {
  if (!active) return null;
  return (
    <img
      className={`arena-pet-shield arena-pet-shield--${side === 'enemy' ? 'enemy' : 'player'}`}
      src="/images/skill-animation/shield.png"
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}

function unitHasShield(unit) {
  return unit?.shield_hold === true || Number(unit?.current_def_dmg) > 0;
}

function MultiBattleUnit({
  unit,
  side,
  isLead,
  isLunge,
  isHit,
  fx,
  fxAnimId,
  fxToken,
  lifePhase = 'alive',
  entrySpawn = false,
  statusIcons = [],
  pose,
  floatTexts = [],
}) {
  if (!unit) return null;
  if (lifePhase === 'gone') return null;
  const pct = unitHpPct(unit);
  const style = pose
    ? {
        left: pose.left,
        top: pose.top,
        zIndex: pose.zIndex,
        '--abm-s': String(pose.scale),
      }
    : undefined;
  const isFinaleDying = lifePhase === 'finale-death';
  const isDying = lifePhase === 'death' || isFinaleDying;
  return (
    <div
      className={[
        'abm-unit',
        `abm-unit--${side}`,
        isLead ? 'abm-unit--lead' : '',
        isLunge ? 'abm-unit--lunge' : '',
        isHit ? 'abm-unit--hit' : '',
        entrySpawn ? 'abm-unit--spawn' : '',
        isFinaleDying ? 'abm-unit--finale-death' : isDying ? 'abm-unit--death' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <div className="abm-unit__hud">
        <div className="abm-unit__statuses" aria-hidden>
          {(statusIcons.length ? statusIcons : []).slice(0, 6).map((st, i) => (
            <span key={st.id || i} className={`abm-status abm-status--${st.tone || 'neutral'}`}>
              {st.icon ? <img src={st.icon} alt="" /> : null}
              {st.stacks != null ? <em>{st.stacks}</em> : null}
            </span>
          ))}
        </div>
        <div className="abm-unit__bars">
          <div className={`abm-hp abm-hp--${side}`}>
            <div className="abm-hp__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="abm-unit__lv">Lv.{unit.level ?? '?'}</div>
      </div>
      <div className="abm-unit__sprite-wrap">
        <div className="arena-pet-sprite-frame arena-pet-sprite-frame--fill">
          <img
            src={battlePetImg(unit.image)}
            alt={unit.name || ''}
            className="abm-unit__sprite"
            draggable={false}
          />
          <PetShieldOverlay active={unitHasShield(unit)} side={side} />
        </div>
        {floatTexts.map((ft) => (
          <FloatingCombatText key={ft.id} value={ft.value} kind={ft.kind} />
        ))}
        {fxAnimId != null ? (
          <BattleFxOverlay fxNumId={fxAnimId} token={fxToken || 'bolt'} />
        ) : fx ? (
          <span
            key={fxToken || fx}
            className={`abm-unit__fx abm-unit__fx--${fx}`}
            aria-hidden
          />
        ) : null}
        <span className="abm-unit__ground-shadow" aria-hidden />
      </div>
    </div>
  );
}

/** Sàn chiến đấu perspective — 1 không gian chung, không tách board BPS */
function MultiBattleArena({
  playerFormationId,
  enemyFormationId,
  playerUnitsBySlot,
  enemyUnitsBySlot,
  actingUnit,
  battleFx,
  lifeFx = {},
  floatTexts = [],
  entrySpawn = false,
  battleMode = '5v5',
}) {
  // Poses from src/data/arenaFieldConfig.js (no localStorage)
  const attackerId = battleFx?.attackerId != null ? String(battleFx.attackerId) : null;
  const hitId = battleFx?.hitId != null ? String(battleFx.hitId) : null;
  const fxId = battleFx?.fxId != null ? String(battleFx.fxId) : hitId;
  const placements = [];
  const pushSide = (side, formationId, unitsBySlot) => {
    Object.keys(unitsBySlot || {}).forEach((key) => {
      const slotIndex = Number(key);
      const unit = unitsBySlot[slotIndex];
      if (!unit) return;
      const uid = String(unit.id);
      const lifePhase = lifeFx[uid] || 'alive';
      if (lifePhase === 'gone') return;
      placements.push({
        key: `${side}-${slotIndex}-${unit.id}`,
        unit,
        side,
        pose: getArenaPose(side, formationId, slotIndex, battleMode),
        isLead:
          actingUnit &&
          actingUnit.side === side &&
          String(actingUnit.id) === String(unit.id),
        isLunge: Boolean(attackerId) && uid === attackerId,
        isHit: Boolean(hitId) && uid === hitId,
        fx: fxId && uid === fxId ? battleFx.effect : null,
        fxAnimId: fxId && uid === fxId ? battleFx.animationId ?? null : null,
        fxToken: battleFx?.token,
        lifePhase,
        entrySpawn,
        floatTexts: floatTextsForUnit(floatTexts, uid),
      });
    });
  };
  pushSide('player', playerFormationId, playerUnitsBySlot);
  pushSide('enemy', enemyFormationId, enemyUnitsBySlot);

  // Redis/multi: hitId đôi khi không khớp id trong squad → vẫn gắn FX lên pet địch/đồng minh sống
  const animId = battleFx?.animationId ?? null;
  if (animId != null && !placements.some((p) => p.fxAnimId != null)) {
    const atkSide =
      attackerId && placements.find((p) => String(p.unit.id) === attackerId)?.side;
    const preferSide = atkSide === 'player' ? 'enemy' : atkSide === 'enemy' ? 'player' : 'enemy';
    const fallback =
      placements.find((p) => p.side === preferSide && p.lifePhase !== 'gone') ||
      placements.find((p) => p.lifePhase !== 'gone');
    if (fallback) {
      fallback.fxAnimId = animId;
      fallback.isHit = true;
      fallback.fxToken = battleFx?.token;
    }
  }
  // Lunge fallback
  if (attackerId && !placements.some((p) => p.isLunge)) {
    const fallAtk =
      placements.find((p) => p.side === 'player' && p.isLead) ||
      placements.find((p) => p.side === 'player' && p.lifePhase !== 'gone');
    if (fallAtk) fallAtk.isLunge = true;
  }

  placements.sort((a, b) => (a.pose.zIndex || 0) - (b.pose.zIndex || 0));

  return (
    <div
      className={`abm-arena${battleMode === '3v3' ? ' abm-arena--3v3' : ''}`}
      aria-label="Chiến trường"
    >
      <div className="abm-arena__cast">
        {placements.map((p) => (
          <MultiBattleUnit
            key={p.key}
            unit={p.unit}
            side={p.side}
            pose={p.pose}
            isLead={p.isLead}
            isLunge={p.isLunge}
            isHit={p.isHit}
            fx={p.fx}
            fxAnimId={p.fxAnimId}
            fxToken={p.fxToken}
            lifePhase={p.lifePhase}
            entrySpawn={p.entrySpawn}
            floatTexts={p.floatTexts}
          />
        ))}
      </div>
    </div>
  );
}

function SpeedOrderBar({ units, leaving, battleSpeed, onBattleSpeedChange }) {
  if (!units.length) return null;
  const cycleSpeed = () => {
    if (typeof onBattleSpeedChange !== 'function') return;
    const next = battleSpeed >= 3 ? 1 : (Number(battleSpeed) || 1) + 1;
    onBattleSpeedChange(next);
  };
  return (
    <div className="abm-speedbar" aria-label="Thứ tự tốc độ">
      <div className="abm-speedbar__label">
        <img src="/images/icons/speed.png" alt="" aria-hidden />
        <span>SPD</span>
      </div>
      <div className="abm-speedbar__track">
        <div className="abm-speedbar__rail" aria-hidden />
        {units.map((u, i) => (
          <div
            key={u.queueKey || `${u.side}-${u.id}-${i}`}
            className={[
              'abm-speedbar__chip',
              `abm-speedbar__chip--${u.side}`,
              i === 0 ? 'abm-speedbar__chip--active' : '',
              leaving && i === 0 ? 'abm-speedbar__chip--leaving' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={u.name || ''}
          >
            <img src={battlePetImg(u.image)} alt="" />
          </div>
        ))}
      </div>
      {typeof onBattleSpeedChange === 'function' ? (
        <button
          type="button"
          className="abm-pace-btn"
          onClick={cycleSpeed}
          title="Đổi tốc độ trận"
          aria-label={`Tốc độ x${battleSpeed || 1}, bấm để đổi`}
        >
          x{battleSpeed || 1}
        </button>
      ) : null}
    </div>
  );
}

function readStoredBattleReturn() {
  try {
    const raw = sessionStorage.getItem(BATTLE_RETURN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

function clearStoredBattleReturn() {
  try {
    sessionStorage.removeItem(BATTLE_RETURN_KEY);
  } catch {
    /* ignore */
  }
}

function ArenaBattlePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(UserContext) || {};
    const {
      playerPet,
      enemyPet,
      matchState: initialMatchState,
      useRedisMatch: useRedisMatchFromState,
      fromHunting: fromHuntingState,
      battleSource: battleSourceState,
      returnPath: returnPathState,
      huntingMapId: huntingMapIdState,
      battleMode: battleModeState,
      formationId: formationIdState,
      enemyFormationId: enemyFormationIdState,
      playerTeam: playerTeamState,
      enemyTeam: enemyTeamState,
    } = location.state || {};
    const squadMatch = initialMatchState?.squad === true ? initialMatchState : null;
    const fromMatch = !!initialMatchState && !!useRedisMatchFromState && !squadMatch;
    const openedWithSquad =
      !!squadMatch || (Array.isArray(playerTeamState) && playerTeamState.length > 0);
    const [battleMode, setBattleMode] = useState(() =>
      normalizeBattleMode(battleModeState || initialMatchState?.battleMode || '1v1')
    );
    const isMulti = battleMode === '3v3' || battleMode === '5v5';
    const [formationId, setFormationId] = useState(() =>
      normalizeFormationId(
        formationIdState || initialMatchState?.formationId || (battleMode === '3v3' ? '2-1' : '3-2'),
        battleMode
      )
    );
    const [enemyFormationId, setEnemyFormationId] = useState(() =>
      normalizeFormationId(
        enemyFormationIdState ||
          initialMatchState?.enemyFormationId ||
          formationIdState ||
          (battleMode === '3v3' ? '2-1' : '3-2'),
        battleMode
      )
    );
    const [squadPersist, setSquadPersist] = useState(() => !!squadMatch);

    const returnMeta = useMemo(() => {
      const match = initialMatchState;
      const enemy = match?.enemy || enemyPet;
      const locId = Number(enemy?.location_id);
      const activeMapId = getActiveHuntingMap()?.mapId || null;
      const stored = readStoredBattleReturn();

      if (
        battleSourceState === 'champion' ||
        stored?.battleSource === 'champion' ||
        enemy?.isChampionNpc
      ) {
        return {
          battleSource: 'champion',
          returnPath: returnPathState || stored?.returnPath || '/battle/champion',
          returnLabel: 'Về Champion Challenge',
        };
      }

      // Ưu tiên nguồn từ LẦN navigate hiện tại / sessionStorage, không để match Redis cũ (arena) ghi đè
      let isHunting = false;
      if (
        battleSourceState === 'hunting' ||
        fromHuntingState === true ||
        stored?.battleSource === 'hunting'
      ) {
        isHunting = true;
      } else if (battleSourceState === 'arena' || stored?.battleSource === 'arena') {
        isHunting = false;
      } else if (match?.battleSource === 'hunting') {
        isHunting = true;
      } else if (match?.battleSource === 'arena') {
        isHunting = false;
      } else {
        isHunting =
          match?.stats_scaled === true ||
          enemy?.statsScaled === true ||
          (Number.isFinite(locId) && locId > 0) ||
          Boolean(huntingMapIdState || match?.huntingMapId || stored?.huntingMapId);
      }

      const mapId =
        huntingMapIdState ||
        match?.huntingMapId ||
        stored?.huntingMapId ||
        (isHunting ? activeMapId : null) ||
        null;

      let path =
        (isHunting
          ? returnPathState || match?.returnPath || stored?.returnPath
          : returnPathState || stored?.returnPath || match?.returnPath) || null;

      // Nếu đang săn mà path vẫn trỏ arena → ép về map săn
      if (isHunting && (!path || String(path).startsWith('/battle'))) {
        path = mapId
          ? `/hunting-world/map/${encodeURIComponent(String(mapId))}`
          : '/hunting-world';
      }
      if (!path) path = isHunting ? '/hunting-world' : '/battle/arena';

      return {
        battleSource: isHunting ? 'hunting' : 'arena',
        returnPath: path,
        returnLabel: isHunting ? 'Về đi săn' : 'Về Đấu Trường',
      };
    }, [
      battleSourceState,
      fromHuntingState,
      returnPathState,
      huntingMapIdState,
      initialMatchState,
      enemyPet,
    ]);

    const goBackAfterBattle = useCallback(() => {
      clearStoredBattleReturn();
      navigate(returnMeta.returnPath || '/battle/arena');
    }, [navigate, returnMeta.returnPath]);

    const goPowerTip = useCallback(
      (path) => {
        clearStoredBattleReturn();
        navigate(path);
      },
      [navigate]
    );

    const loseFlavorRef = React.useRef('');
    const [battleBgEntry, setBattleBgEntry] = useState(null);
    useEffect(() => {
      let cancelled = false;
      const key = resolveBattleBackgroundKey({
        battleSource: returnMeta.battleSource,
        battleMode,
      });
      loadBattleBackgroundCatalogAsync()
        .then((cat) => {
          if (cancelled) return;
          setBattleBgEntry(getBackgroundById(cat, key));
        })
        .catch(() => {
          if (!cancelled) setBattleBgEntry(getBackgroundById(null, key));
        });
      return () => {
        cancelled = true;
      };
    }, [returnMeta.battleSource, battleMode]);

    const arenaSceneBgStyle = useMemo(() => {
      const key = resolveBattleBackgroundKey({
        battleSource: returnMeta.battleSource,
        battleMode,
      });
      return sceneBackgroundStyle(battleBgEntry || getBackgroundById(null, key));
    }, [battleBgEntry, returnMeta.battleSource, battleMode]);

    const [player, setPlayer] = useState(() => {
      if ((fromMatch || squadMatch) && initialMatchState?.player) return { ...initialMatchState.player, current_def_dmg: initialMatchState.player.current_def_dmg ?? 0 };
      return { ...playerPet, current_hp: playerPet?.current_hp || playerPet?.final_stats?.hp, current_def_dmg: 0, shield_hold: false };
    });
    const [enemy, setEnemy] = useState(() => {
      if ((fromMatch || squadMatch) && initialMatchState?.enemy) return { ...initialMatchState.enemy, current_def_dmg: initialMatchState.enemy.current_def_dmg ?? 0 };
      return { ...enemyPet, current_hp: enemyPet?.current_hp || enemyPet?.final_stats?.hp, current_def_dmg: 0, shield_hold: false };
    });
    const [playerSquad, setPlayerSquad] = useState(() =>
      Array.isArray(squadMatch?.playerSquad) && squadMatch.playerSquad.length
        ? squadMatch.playerSquad
        : Array.isArray(playerTeamState) && playerTeamState.length
          ? playerTeamState
          : []
    );
    const [enemySquad, setEnemySquad] = useState(() =>
      Array.isArray(squadMatch?.enemySquad) && squadMatch.enemySquad.length
        ? squadMatch.enemySquad
        : Array.isArray(enemyTeamState) && enemyTeamState.length
          ? enemyTeamState
          : []
    );
    const [turn, setTurn] = useState(
      squadMatch ? (squadMatch.turn_count ?? 0) : fromMatch ? (initialMatchState?.turn_count ?? 0) : 0
    );
    const turnRef = React.useRef(turn);
    turnRef.current = turn;
    const [matchId, setMatchId] = useState(() => {
      const id = initialMatchState?.matchId || null;
      if (id) {
        try {
          sessionStorage.setItem(CLASSIC_MATCH_KEY, id);
        } catch {
          /* ignore */
        }
      }
      return id;
    });
    const matchIdRef = React.useRef(matchId);
    matchIdRef.current = matchId;
    const turnLimit = turnLimitForMode(battleMode);
    const [turnNumber, setTurnNumber] = useState(() => {
      const tc = Number(initialMatchState?.turn_count);
      return Number.isFinite(tc) && tc > 0 ? Math.min(tc, turnLimitForMode(battleMode)) : 1;
    });
    const [speedQueue, setSpeedQueue] = useState(() =>
      Array.isArray(squadMatch?.speedQueue) ? squadMatch.speedQueue : []
    );
    const [chipLeaving, setChipLeaving] = useState(false);
    const speedQueueRef = React.useRef(Array.isArray(squadMatch?.speedQueue) ? squadMatch.speedQueue : []);
    const chipAnimRef = React.useRef(null);
    const enemyAutoRef = React.useRef(false);
    const [battleSpeed, setBattleSpeed] = useState(1);
    const battleSpeedRef = React.useRef(1);
    battleSpeedRef.current = battleSpeed;

    const paceMs = useCallback((baseMs) => {
      const sp = Math.max(1, Number(battleSpeedRef.current) || 1);
      return Math.max(80, Math.round(baseMs / sp));
    }, []);

    const waitPace = useCallback(
      (baseMs) => new Promise((resolve) => setTimeout(resolve, paceMs(baseMs))),
      [paceMs]
    );
    /** Real-time wait (không chia battle-speed) — dùng cho finale death / hold.result */
    const waitRaw = useCallback((ms) => new Promise((resolve) => setTimeout(resolve, ms)), []);

    const [isRedisMatch, setIsRedisMatch] = useState(!!useRedisMatchFromState);
    /** 3v3/5v5 local (champion test): combat theo từng pet trong squad */
    const useSquadCombat = isMulti && !isRedisMatch;
    const isChampionBattle =
      returnMeta.battleSource === 'champion' ||
      battleSourceState === 'champion' ||
      !!enemyPet?.isChampionNpc;
    const playerRef = React.useRef(player);
    const enemyRef = React.useRef(enemy);
    playerRef.current = player;
    enemyRef.current = enemy;
    const playerSquadRef = React.useRef(playerSquad);
    const enemySquadRef = React.useRef(enemySquad);
    playerSquadRef.current = playerSquad;
    enemySquadRef.current = enemySquad;

    /** Pet cuối trên đội bị KO → quyết định thắng/thua (1v1 / multi / redis đều dùng) */
    const isLastPetKo = useCallback((unitId) => {
      if (unitId == null) return false;
      const id = String(unitId);
      const pSquad = playerSquadRef.current || [];
      const eSquad = enemySquadRef.current || [];
      const inPlayer = pSquad.some((u) => String(u.id) === id);
      const inEnemy = eSquad.some((u) => String(u.id) === id);
      const squad = inPlayer ? pSquad : inEnemy ? eSquad : null;
      // Multi: chỉ slow khi không còn pet sống khác trên cùng đội
      if (squad && squad.length > 1) {
        const othersAlive = squad.filter(
          (u) => String(u.id) !== id && (Number(u.current_hp) || 0) > 0
        );
        return othersAlive.length === 0;
      }
      // 1v1 / lead-only / chưa có squad: mọi KO đều là kết thúc trận
      return true;
    }, []);

    // Sync HP combat lead → squad (1v1 Redis / lead-only). Squad combat: squad là source of truth.
    useEffect(() => {
      if (useSquadCombat || !player) return;
      setPlayerSquad((prev) => {
        if (!prev.length) {
          return [
            {
              id: player.id,
              name: player.name,
              image: player.image,
              level: player.level,
              slotIndex: 0,
              current_hp: player.current_hp,
              final_stats: player.final_stats,
              spd: player.final_stats?.spd ?? player.spd,
              side: 'player',
            },
          ];
        }
        return prev.map((u) =>
          String(u.id) === String(player.id)
            ? {
                ...u,
                current_hp: player.current_hp,
                final_stats: player.final_stats || u.final_stats,
              }
            : u
        );
      });
    }, [useSquadCombat, player?.id, player?.current_hp, player?.final_stats]);

    useEffect(() => {
      if (useSquadCombat || !enemy) return;
      setEnemySquad((prev) => {
        if (!prev.length) {
          return [
            {
              id: enemy.id,
              name: enemy.name,
              image: enemy.image,
              level: enemy.level,
              slotIndex: 0,
              current_hp: enemy.current_hp,
              final_stats: enemy.final_stats,
              spd: enemy.final_stats?.spd ?? enemy.spd,
              side: 'enemy',
            },
          ];
        }
        // Lead combat enemy → slot 0 (hoặc id trùng)
        return prev.map((u, i) =>
          i === 0 || String(u.id) === String(enemy.id)
            ? {
                ...u,
                current_hp: enemy.current_hp,
                final_stats: {
                  ...(u.final_stats || {}),
                  ...(enemy.final_stats || {}),
                  hp: enemy.final_stats?.hp ?? u.final_stats?.hp,
                },
              }
            : u
        );
      });
    }, [useSquadCombat, enemy?.id, enemy?.current_hp, enemy?.final_stats]);

    const playerUnitsBySlot = useMemo(() => {
      const map = {};
      playerSquad.forEach((u) => {
        const idx = Number.isFinite(u.slotIndex) ? u.slotIndex : 0;
        map[idx] = { ...u, side: 'player' };
      });
      return map;
    }, [playerSquad]);

    const enemyUnitsBySlot = useMemo(() => {
      const map = {};
      enemySquad.forEach((u) => {
        const idx = Number.isFinite(u.slotIndex) ? u.slotIndex : 0;
        map[idx] = { ...u, side: 'enemy' };
      });
      return map;
    }, [enemySquad]);

    const playerTeamUnits = useMemo(() => {
      const base = playerSquad.length
        ? playerSquad
        : player
          ? [
              {
                id: player.id,
                name: player.name,
                image: player.image,
                level: player.level,
                final_stats: player.final_stats,
                spd: player.final_stats?.spd ?? player.spd,
                current_hp: player.current_hp,
                side: 'player',
              },
            ]
          : [];
      if (useSquadCombat || !player) return base;
      // Lead-only combat: merge HP live từ player vào unit trùng id
      return base.map((u) =>
        String(u.id) === String(player.id)
          ? {
              ...u,
              current_hp: player.current_hp,
              final_stats: player.final_stats || u.final_stats,
            }
          : u
      );
    }, [playerSquad, player, useSquadCombat]);

    const enemyTeamUnits = useMemo(() => {
      const base = enemySquad.length
        ? enemySquad
        : enemy
          ? [
              {
                id: enemy.id,
                name: enemy.name,
                image: enemy.image,
                level: enemy.level,
                final_stats: enemy.final_stats,
                spd: enemy.final_stats?.spd ?? enemy.spd,
                current_hp: enemy.current_hp,
                side: 'enemy',
              },
            ]
          : [];
      if (useSquadCombat || !enemy) return base;
      return base.map((u, i) =>
        i === 0 || String(u.id) === String(enemy.id)
          ? {
              ...u,
              current_hp: enemy.current_hp,
              final_stats: {
                ...(u.final_stats || {}),
                ...(enemy.final_stats || {}),
                hp: enemy.final_stats?.hp ?? u.final_stats?.hp,
              },
            }
          : u
      );
    }, [enemySquad, enemy, useSquadCombat]);

    const playerTeamSpd = useMemo(() => sumTeamSpd(playerTeamUnits), [playerTeamUnits]);
    const enemyTeamSpd = useMemo(() => sumTeamSpd(enemyTeamUnits), [enemyTeamUnits]);
    const playerHeaderHpPct = useMemo(
      () => teamHeaderHpPct(playerTeamUnits, battleMode),
      [playerTeamUnits, battleMode]
    );
    const enemyHeaderHpPct = useMemo(
      () => teamHeaderHpPct(enemyTeamUnits, battleMode),
      [enemyTeamUnits, battleMode]
    );

    // Khởi tạo hàng đợi SPD 1 lần khi có đủ đội
    useEffect(() => {
      if (!playerTeamUnits.length || !enemyTeamUnits.length) return;
      if (speedQueueRef.current.length) return;
      const q = buildSpeedQueue(playerTeamUnits, enemyTeamUnits);
      speedQueueRef.current = q;
      setSpeedQueue(q);
    }, [playerTeamUnits, enemyTeamUnits]);

    // Không ghi đè ref khi đang animate xoay chip
    useEffect(() => {
      if (chipLeaving) return;
      speedQueueRef.current = speedQueue;
    }, [speedQueue, chipLeaving]);

    const actingUnit = speedQueue[0] || null;
    const isPlayerActing = !actingUnit || actingUnit.side === 'player';

    // Đảm bảo Boss có đủ action_pattern + skills (nếu vào trận với enemy thiếu dữ liệu)
    useEffect(() => {
      const bossSrc =
        fromMatch && initialMatchState?.enemy ? initialMatchState.enemy : enemyPet;
      if (!bossSrc?.id || !bossSrc?.isBoss) return;
      const hasPattern = Array.isArray(bossSrc.action_pattern) && bossSrc.action_pattern.length > 0;
      const hasSkills = Array.isArray(bossSrc.skills) && bossSrc.skills.length > 0;
      if (hasPattern && hasSkills) return;
      const lv = Math.max(1, Number(bossSrc.level) || 0);
      const qs = lv > 0 ? `?level=${lv}` : '';
      fetch(`${process.env.REACT_APP_API_BASE_URL || ''}/api/bosses/${bossSrc.id}${qs}`)
        .then((r) => r.json())
        .then((boss) => {
          setEnemy((prev) => ({
            ...prev,
            skills: Array.isArray(boss.skills) && boss.skills.length ? boss.skills : prev.skills,
            action_pattern:
              Array.isArray(boss.action_pattern) && boss.action_pattern.length
                ? boss.action_pattern
                : prev.action_pattern,
            // Giữ HP/stats đã scale từ match Redis; chỉ bổ sung AI data
            isBoss: true,
          }));
        })
        .catch((err) => console.error('Load full boss for action_pattern:', err));
    }, [enemyPet?.id, enemyPet?.isBoss, fromMatch, initialMatchState?.enemy]);
    const [log, setLog] = useState(() => (
      (squadMatch || fromMatch) && Array.isArray(initialMatchState?.history) ? initialMatchState.history : []
    ));
    const [autoMode, setAutoMode] = useState(false);
    const [isBlitzMode, setIsBlitzMode] = useState(false);
    const [battleEnded, setBattleEnded] = useState(false);

    /** Trận: ẩn peta-sectiontitle; Result: hiện lại + title KẾT QUẢ */
    useEffect(() => {
      window.dispatchEvent(
        new CustomEvent('petaria-battle-ui', {
          detail: battleEnded
            ? { hideSectionTitle: false, sectionTitle: 'KẾT QUẢ' }
            : { hideSectionTitle: true, sectionTitle: null },
        })
      );
      return () => {
        window.dispatchEvent(
          new CustomEvent('petaria-battle-ui', {
            detail: { hideSectionTitle: false, sectionTitle: null },
          })
        );
      };
    }, [battleEnded]);

      const [equippedItems, setEquippedItems] = useState(() => {
        if (fromMatch && Array.isArray(initialMatchState?.equipment)) {
          return initialMatchState.equipment.map((e) => ({ ...e, image_url: e.image_url || '' }));
        }
        return [];
      });
  const [attackAnimation, setAttackAnimation] = useState('');
    /** { attackerId, hitId, fxId, effect, token } — CSS lunge / hit / overlay */
    const [battleFx, setBattleFx] = useState(null);
    /** unitId → 'alive'|'death'|'finale-death'|'gone' (spawn entry dùng entrySpawn riêng) */
    const [lifeFx, setLifeFx] = useState({});
    const lifeFxRef = React.useRef({});
    lifeFxRef.current = lifeFx;
    /** Chặn useEffect auto-end trong lúc phát death finale */
    const endPresentationLockRef = React.useRef(false);
    const [finaleSlowMo, setFinaleSlowMo] = useState(false);
    const [floatTexts, setFloatTexts] = useState([]);
    const floatTimersRef = React.useRef([]);
    const [entrySpawn, setEntrySpawn] = useState(true);
    const entrySpawnDoneRef = React.useRef(false);
    const [resultEffect, setResultEffect] = useState('');
    const [actionLocked, setActionLocked] = useState(false);
    const [selectedAction, setSelectedAction] = useState('');
    const [battleReward, setBattleReward] = useState({ expGained: 0, levelUp: false, newLevel: null, loot: [] });
    const [holdingItemId, setHoldingItemId] = useState(null);
    const [infoItemId, setInfoItemId] = useState(null);
    const [infoAnchorRect, setInfoAnchorRect] = useState(null);
    const holdTimerRef = React.useRef(null);
    const longPressTriggeredRef = React.useRef(false);
    /** Tránh double-fire: pointerup đã dùng item thì bỏ click tiếp theo */
    const equipPointerUsedRef = React.useRef(false);
    const equipItemElsRef = React.useRef({});

    const clearCombatFx = useCallback(() => {
      setBattleFx(null);
      setAttackAnimation('');
    }, []);

    // Preload catalog + IndexedDB images so overlay không miss khi đánh
    useEffect(() => {
      loadBattleFxCatalogAsync().catch(() => {});
    }, []);

    const unitCurrentHp = useCallback((unitId) => {
      if (unitId == null) return 1;
      const sid = String(unitId);
      const fromP = (playerSquadRef.current || []).find((u) => String(u.id) === sid);
      if (fromP) return Number(fromP.current_hp) || 0;
      const fromE = (enemySquadRef.current || []).find((u) => String(u.id) === sid);
      if (fromE) return Number(fromE.current_hp) || 0;
      if (String(playerRef.current?.id) === sid) return Number(playerRef.current?.current_hp) || 0;
      if (String(enemyRef.current?.id) === sid) return Number(enemyRef.current?.current_hp) || 0;
      return 1;
    }, []);

    /** Finale (pet cuối quyết định thắng/thua): chậm đúng ~x2 — mọi chế độ trận */
    const FINALE_SLOW_MULT = 2;
    const FINALE_DEATH_MS = 800; // death thường 0.4s × 2
    const FINALE_HOLD_MS = 1000;
    const FLOAT_TEXT_MS = 1000;

    const pushFloatText = useCallback((unitId, floatText) => {
      if (unitId == null || !floatText) return;
      const kind =
        floatText.kind === 'crit' || floatText.kind === 'heal' || floatText.kind === 'miss'
          ? floatText.kind
          : 'damage';
      const value = kind === 'miss' ? 1 : Math.round(Number(floatText.value) || 0);
      if (kind !== 'miss' && !value) return;
      const id = `${unitId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setFloatTexts((prev) => [...prev.slice(-10), { id, unitId: String(unitId), value, kind }]);
      const t = window.setTimeout(() => {
        setFloatTexts((prev) => prev.filter((x) => x.id !== id));
      }, FLOAT_TEXT_MS);
      floatTimersRef.current.push(t);
    }, []);

    useEffect(
      () => () => {
        floatTimersRef.current.forEach((t) => window.clearTimeout(t));
        floatTimersRef.current = [];
      },
      []
    );

    /** Attacker lunge → defender shake + catalog / CSS effect overlay */
    const playCombatFx = useCallback(
      async ({
        attackerId,
        hitId = null,
        effect = null,
        animationId = null,
        side = 'player',
        miss = false,
        noLunge = false,
        /** Đòn kết thúc trận (pet cuối) — chậm ~x2 */
        killingBlow = false,
        /** { value, kind: 'damage'|'crit'|'heal'|'miss' } — hiện ~50% animation */
        floatText = null,
      }) => {
        // Khóa end sớm (trước mọi await) để useEffect HP không skip death delay
        if (killingBlow || (hitId != null && !miss && isLastPetKo(hitId) && unitCurrentHp(hitId) <= 0)) {
          endPresentationLockRef.current = true;
        }

        const token = Date.now();
        const anim =
          !miss && animationId != null && Number(animationId) >= 1
            ? Math.round(Number(animationId))
            : null;
        if (anim != null) {
          try {
            await loadBattleFxCatalogAsync();
          } catch {
            /* overlay vẫn tự load */
          }
        }
        const finaleBlow =
          !miss &&
          hitId != null &&
          isLastPetKo(hitId) &&
          (killingBlow || unitCurrentHp(hitId) <= 0);
        if (finaleBlow) {
          endPresentationLockRef.current = true;
          setFinaleSlowMo(true);
        }
        // Miss: vẫn lunge attacker; không hit-shake / catalog FX trên target
        const resolvedHitId = hitId == null ? null : String(hitId);
        setAttackAnimation(noLunge ? '' : side);
        setBattleFx({
          attackerId: noLunge || attackerId == null ? null : String(attackerId),
          hitId: miss ? null : resolvedHitId,
          fxId: miss || resolvedHitId == null ? null : resolvedHitId,
          effect: miss ? null : anim != null ? 'catalog' : effect,
          animationId: anim,
          token,
        });
        const waitMs = miss
          ? 420
          : anim != null
            ? catalogFxWaitMs(anim)
            : 900;
        const totalWait = finaleBlow
          ? Math.round(waitMs * FINALE_SLOW_MULT)
          : paceMs(waitMs);
        const resolvedFloat =
          floatText ||
          (miss && resolvedHitId ? floatMiss() : null);
        if (resolvedFloat && resolvedHitId != null) {
          const delay = Math.max(80, Math.round(totalWait * 0.5));
          const floatTimer = window.setTimeout(() => {
            pushFloatText(resolvedHitId, resolvedFloat);
          }, delay);
          floatTimersRef.current.push(floatTimer);
        }
        if (finaleBlow) {
          await waitRaw(totalWait);
        } else {
          await waitPace(waitMs);
        }
        clearCombatFx();
        if (finaleBlow) setFinaleSlowMo(false);
      },
      [waitPace, waitRaw, paceMs, clearCombatFx, unitCurrentHp, isLastPetKo, pushFloatText]
    );

    /** After hit FX: pet vanish. Finale = pet cuối — chậm ~x2 rồi biến mất. */
    const playDeathFx = useCallback(
      async (unitId, { finale = false } = {}) => {
        if (unitId == null) return;
        const id = String(unitId);
        const cur = lifeFxRef.current[id];
        if (cur === 'death' || cur === 'finale-death' || cur === 'gone') return;
        if (finale) {
          endPresentationLockRef.current = true;
          setFinaleSlowMo(true);
          setLifeFx((prev) => ({ ...prev, [id]: 'finale-death' }));
          await waitRaw(FINALE_DEATH_MS);
          setLifeFx((prev) => ({ ...prev, [id]: 'gone' }));
          setFinaleSlowMo(false);
          return;
        }
        setLifeFx((prev) => ({ ...prev, [id]: 'death' }));
        await waitPace(420);
        setLifeFx((prev) => ({ ...prev, [id]: 'gone' }));
      },
      [waitPace, waitRaw]
    );

    const playDeathIfKo = useCallback(
      async (unitId, hpAfter) => {
        if (unitId == null) return;
        if ((Number(hpAfter) || 0) > 0) return;
        const finale = isLastPetKo(unitId);
        if (finale) endPresentationLockRef.current = true;
        await playDeathFx(unitId, { finale });
        if (finale) {
          await waitRaw(FINALE_HOLD_MS);
        }
      },
      [playDeathFx, isLastPetKo, waitRaw]
    );

    const battleUiLocked =
      actionLocked || battleEnded || !isPlayerActing;

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const userName = getDisplayName(user, user?.name || 'Người chơi');

    const getItemImageSrc = (imageUrl) => {
      if (!imageUrl) return '/images/equipments/placeholder.png';
      if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
      return `/images/equipments/${imageUrl}`;
    };

    const getHpClass = (current, max) => {
      if (!max || max <= 0) return 'low';
      const pct = (current ?? 0) / max * 100;
      return pct > 70 ? 'high' : pct > 25 ? 'mid' : 'low';
    };

    const isPermanentDurability = (item) =>
      String(item?.durability_mode || '').toLowerCase() === 'unbreakable'
      || Number(item?.max_durability || 0) >= 999999;
    const isRandomDurability = (item) => {
      const modeKey = String(item?.durability_mode || '').toLowerCase();
      return modeKey === 'unknown' || modeKey === 'random';
    };
    const isItemUsableByDurability = (item) => {
      if (isPermanentDurability(item) || isRandomDurability(item)) return true;
      return Number(item?.durability_left ?? 0) > 0;
    };
    const getBattleDurabilityText = (item) => {
      if (isPermanentDurability(item)) return 'Vĩnh viễn';
      if (isRandomDurability(item)) return 'Ngẫu Nhiên';
      return `${item?.durability_left ?? 0}/${item?.max_durability ?? 0}`;
    };


    /** Công thức giống dùng item: Dmg_out / Def_dmg với R = random(power_min, power_max). Tấn công thường & Phòng thủ vật lý dùng cố định 7, 10. */
    const NORMAL_POWER_MIN = 7;
    const NORMAL_POWER_MAX = 10;

    const expProgress = Number(player.current_exp) || 0;
    const expToNextLevel = expTable[player.level + 1] ?? expTable[player.level] ?? 1;
  
    const appendLog = (entry, type = 'default') => {
      setLog((prev) => [...prev.slice(-49), { text: entry, type }]);
    };
    const logEndRef = React.useRef(null);
    useEffect(() => {
      // Chỉ cuộn trong khung log — không kéo cả page xuống bottom
      const end = logEndRef.current;
      if (!end) return;
      const inner = end.closest('.arena-log-inner');
      if (inner) inner.scrollTop = inner.scrollHeight;
    }, [log]);
  
    const checkBattleEnded = (nextEnemyHp, nextPlayerHp) => {
      if (nextEnemyHp <= 0 || nextPlayerHp <= 0) {
        setBattleEnded(true);
        setResultEffect(nextEnemyHp <= 0 ? 'win' : 'lose');
        return true;
      }
      return false;
    };

    const checkSquadBattleEnded = (nextPlayerSquad, nextEnemySquad) => {
      const pAlive = teamStillAlive(nextPlayerSquad);
      const eAlive = teamStillAlive(nextEnemySquad);
      if (!eAlive) {
        setBattleEnded(true);
        setResultEffect('win');
        return true;
      }
      if (!pAlive) {
        setBattleEnded(true);
        setResultEffect('lose');
        return true;
      }
      return false;
    };

    const purgeDeadFromQueue = useCallback((pSquad, eSquad) => {
      setSpeedQueue((prev) => {
        const filtered = prev.filter((u) => {
          const list = u.side === 'player' ? pSquad : eSquad;
          const found = (list || []).find((s) => String(s.id) === String(u.id));
          return found && (Number(found.current_hp) || 0) > 0;
        });
        const next = rebalanceAlternatingQueue(filtered);
        speedQueueRef.current = next;
        return next;
      });
    }, []);

    const endByTurnLimit = useCallback(() => {
      setBattleEnded((ended) => {
        if (ended) return ended;
        if (useSquadCombat) {
          const pPct = teamHeaderHpPct(playerSquadRef.current, battleMode);
          const ePct = teamHeaderHpPct(enemySquadRef.current, battleMode);
          if (pPct > ePct) setResultEffect('win');
          else setResultEffect('lose');
        } else {
          const p = playerRef.current;
          const e = enemyRef.current;
          const pPct = (p?.current_hp ?? 0) / Math.max(1, p?.final_stats?.hp ?? 1);
          const ePct = (e?.current_hp ?? 0) / Math.max(1, e?.final_stats?.hp ?? 1);
          if (pPct > ePct) setResultEffect('win');
          else if (ePct > pPct) setResultEffect('lose');
          else setResultEffect('lose');
        }
        setLog((prev) => [
          ...prev.slice(-49),
          { text: `Hết ${turnLimit} lượt — kết thúc trận!`, type: 'default' },
        ]);
        return true;
      });
    }, [turnLimit, useSquadCombat, battleMode]);

    const rotateSpeedChip = useCallback(() => {
      return new Promise((resolve) => {
        setChipLeaving(true);
        if (chipAnimRef.current) clearTimeout(chipAnimRef.current);
        const animMs = paceMs(420);
        chipAnimRef.current = setTimeout(() => {
          setSpeedQueue((prev) => {
            if (!prev.length) {
              speedQueueRef.current = prev;
              return prev;
            }
            const next = advanceAlternatingQueue(prev);
            speedQueueRef.current = next;
            return next;
          });
          setChipLeaving(false);
          resolve();
        }, animMs);
      });
    }, [paceMs]);

    /** Redis: 1 animate — đưa player + enemy đã resolve xuống cuối, không flash "Đối thủ đang hành động" */
    const rotateAfterRedisCombinedTurn = useCallback(() => {
      return new Promise((resolve) => {
        setChipLeaving(true);
        if (chipAnimRef.current) clearTimeout(chipAnimRef.current);
        const animMs = paceMs(420);
        chipAnimRef.current = setTimeout(() => {
          setSpeedQueue((prev) => {
            if (!prev.length) {
              speedQueueRef.current = prev;
              return prev;
            }
            let next = advanceAlternatingQueue(prev);
            // Redis đã resolve enemy trong cùng turn — bỏ qua mọi enemy đứng đầu
            let guard = 0;
            while (next[0]?.side === 'enemy' && guard++ < 8) {
              next = advanceAlternatingQueue(next);
            }
            speedQueueRef.current = next;
            return next;
          });
          setChipLeaving(false);
          resolve();
        }, animMs);
      });
    }, [paceMs]);

    const bumpTurnAfterAction = useCallback(
      (serverTurnCount) => {
        if (serverTurnCount != null) {
          const completed = Number(serverTurnCount) || 0;
          if (completed >= turnLimit) {
            setTurnNumber(turnLimit);
            setTurn(completed);
            endByTurnLimit();
            return true;
          }
          const nextDisplay = Math.min(turnLimit, Math.max(1, completed + 1));
          setTurnNumber(nextDisplay);
          setTurn(completed);
          return false;
        }
        let hitLimit = false;
        setTurnNumber((prev) => {
          if (prev >= turnLimit) {
            hitLimit = true;
            return turnLimit;
          }
          const next = prev + 1;
          if (next > turnLimit) {
            hitLimit = true;
            return turnLimit;
          }
          return next;
        });
        setTurn((prev) => prev + 1);
        if (hitLimit) endByTurnLimit();
        return hitLimit;
      },
      [turnLimit, endByTurnLimit]
    );

    const cancelHold = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setHoldingItemId(null);
      longPressTriggeredRef.current = false;
    };

    useEffect(() => () => cancelHold(), []);

    const openItemInfo = (id) => {
      const el = equipItemElsRef.current?.[id];
      if (el?.getBoundingClientRect) {
        setInfoAnchorRect(el.getBoundingClientRect());
      } else {
        setInfoAnchorRect(null);
      }
      setInfoItemId(id);
    };

    // keep modal positioned on scroll/resize while open
    useEffect(() => {
      if (!infoItemId) return;
      const update = () => {
        const el = equipItemElsRef.current?.[infoItemId];
        if (el?.getBoundingClientRect) setInfoAnchorRect(el.getBoundingClientRect());
      };
      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }, [infoItemId]);

    const applyServerReward = useCallback((reward) => {
      if (!reward || typeof reward !== 'object') return;
      setBattleReward({
        expGained: Number(reward.expGained) || 0,
        levelUp: !!reward.levelUp,
        newLevel: reward.newLevel ?? null,
        loot: Array.isArray(reward.loot) ? reward.loot : [],
      });
      dispatchCurrencyUpdate();
    }, []);

    const sendMatchTurn = async (payload) => {
      const body = {
        ...payload,
        matchId: matchIdRef.current,
        expectedTurn: turnRef.current,
      };
      const res = await fetch(`${API_BASE_URL}/api/arena/match/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Turn failed');
      if (data.matchId) {
        setMatchId(data.matchId);
        try {
          sessionStorage.setItem(CLASSIC_MATCH_KEY, data.matchId);
        } catch {
          /* ignore */
        }
      }
      if (data.finished) endPresentationLockRef.current = true;
      const histBefore = Array.isArray(log) ? log.length : 0;
      const freshHistory = (Array.isArray(data.history) ? data.history : []).slice(histBefore);
      const defenseEntry = [...freshHistory].reverse().find((entry) => entry?.type === 'defense');
      const defenseHp = shieldHpFromLogText(defenseEntry?.text);
      const serverPlayerDef = Number(data.player?.current_def_dmg) || 0;
      const serverEnemyDef = Number(data.enemy?.current_def_dmg) || 0;
      const playerShieldHp = serverPlayerDef > 0 ? serverPlayerDef : defenseHp;
      const nextPlayer = {
        ...data.player,
        current_def_dmg: playerShieldHp,
        shield_hold: !!defenseEntry || playerShieldHp > 0,
      };
      const nextEnemy = {
        ...data.enemy,
        current_def_dmg: serverEnemyDef,
        shield_hold: serverEnemyDef > 0,
      };
      playerRef.current = nextPlayer;
      enemyRef.current = nextEnemy;
      setPlayer(nextPlayer);
      setEnemy(nextEnemy);
      setLog(Array.isArray(data.history) ? data.history : []);
      if (Array.isArray(data.equipment)) {
        setEquippedItems(data.equipment.map((e) => ({ ...e, image_url: e.image_url || '' })));
      }
      setTurn(data.turn_count ?? turnRef.current);
      if (data.finished && data.reward) applyServerReward(data.reward);
      return data;
    };

    /** Redis: sau combat FX — slow death pet cuối + hold 1s rồi hiện result */
    const settleMatchFinish = async (data) => {
      if (!data?.finished) return false;
      endPresentationLockRef.current = true;
      const pHp = Number(data.player?.current_hp) || 0;
      const eHp = Number(data.enemy?.current_hp) || 0;
      if (eHp <= 0 && data.enemy?.id != null) {
        await playDeathFx(data.enemy.id, { finale: true });
      } else if (pHp <= 0 && data.player?.id != null) {
        await playDeathFx(data.player.id, { finale: true });
      }
      await waitRaw(FINALE_HOLD_MS);
      if (data.reward) applyServerReward(data.reward);
      setResultEffect(data.result || (eHp <= 0 ? 'win' : 'lose'));
      setBattleEnded(true);
      return true;
    };

    /** Redis: play FX theo đúng thứ tự history (player/NPC/defend) */
    const playRedisMatchTurnPresentation = async (data, histBeforeLen) => {
      const playerId = data.player?.id ?? playerRef.current?.id;
      const enemyId = data.enemy?.id ?? enemyRef.current?.id;
      const pHp = Number(data.player?.current_hp) || 0;
      const eHp = Number(data.enemy?.current_hp) || 0;
      const finished = !!data.finished;
      const names = {
        playerName: data.player?.name || playerRef.current?.name,
        enemyName: data.enemy?.name || enemyRef.current?.name,
      };
      const list = Array.isArray(data.history) ? data.history : [];

      for (let i = Math.max(0, histBeforeLen); i < list.length; i += 1) {
        const entry = list[i];
        const type = String(entry?.type || '');

        if (type === 'defense') {
          const shieldHp = shieldHpFromLogText(entry?.text);
          setPlayer((prev) => {
            const next = withShield(prev, shieldHp > 0 ? shieldHp : prev?.current_def_dmg);
            playerRef.current = next;
            return next;
          });
          if (useSquadCombat) {
            setPlayerSquad((prev) => {
              const next = prev.map((u) =>
                String(u.id) === String(playerId)
                  ? withShield(u, shieldHp > 0 ? shieldHp : u?.current_def_dmg)
                  : u
              );
              playerSquadRef.current = next;
              return next;
            });
          }
          await playCombatFx({
            attackerId: playerId,
            hitId: playerId,
            animationId: BATTLE_FX_DEFEND_ANIM_ID,
            side: 'player',
            noLunge: true,
          });
          continue;
        }

        if (type !== 'player_attack' && type !== 'enemy_attack') continue;
        const beats = parseHistoryCombatBeats([entry], 0, names);
        for (const beat of beats) {
          if (beat.side === 'player') {
            const hitId = beat.reflected ? playerId : enemyId;
            await playCombatFx({
              attackerId: playerId,
              hitId,
              animationId: beat.miss ? null : BATTLE_FX_ATTACK_ANIM_ID,
              side: 'player',
              miss: !!beat.miss,
              floatText: beat.floatText,
              killingBlow:
                finished &&
                !beat.miss &&
                (beat.reflected ? pHp <= 0 : eHp <= 0),
            });
          } else {
            const hitId = beat.reflected ? enemyId : playerId;
            const playerWasHit = !beat.miss && !beat.reflected;
            if (playerWasHit) {
              const finalDef = Number(data.player?.current_def_dmg) || 0;
              setPlayer((prev) => {
                const next = { ...prev, current_def_dmg: finalDef, shield_hold: finalDef > 0 };
                playerRef.current = next;
                return next;
              });
              if (useSquadCombat) {
                setPlayerSquad((prev) => {
                  const next = prev.map((u) =>
                    String(u.id) === String(playerId)
                      ? { ...u, current_def_dmg: finalDef, shield_hold: finalDef > 0 }
                      : u
                  );
                  playerSquadRef.current = next;
                  return next;
                });
              }
            }
            await playCombatFx({
              attackerId: enemyId,
              hitId,
              animationId: beat.miss ? null : BATTLE_FX_ATTACK_ANIM_ID,
              side: 'enemy',
              miss: !!beat.miss,
              floatText: beat.floatText,
              killingBlow:
                finished &&
                !beat.miss &&
                (beat.reflected ? eHp <= 0 : pHp <= 0),
            });
          }
        }
      }
    };

    const advanceQueueAfterPlayer = async ({ redisCombined, serverTurnCount, ended }) => {
      if (ended) {
        setActionLocked(false);
        return;
      }
      const limitHit = bumpTurnAfterAction(redisCombined ? serverTurnCount : null);
      if (limitHit) {
        setActionLocked(false);
        return;
      }
      if (redisCombined) {
        await rotateAfterRedisCombinedTurn();
      } else {
        await rotateSpeedChip();
      }
      setActionLocked(false);
    };
  
      const handleAttackWithItem = async (item) => {
      if (battleUiLocked) return;
      if (!isItemUsableByDurability(item)) return;
      setActionLocked(true);
      const powerMin = item.power_min != null ? item.power_min : 0;
      const powerMax = item.power_max != null ? item.power_max : 0;

      if (isRedisMatch) {
        try {
          const histBefore = Array.isArray(log) ? log.length : 0;
          const data = await sendMatchTurn({ action: 'attack_item', itemId: item.id, power_min: powerMin, power_max: powerMax, moveName: item.item_name || 'Weapon' });
          await playRedisMatchTurnPresentation(data, histBefore);
          const ended = await settleMatchFinish(data);
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended,
          });
        } catch (err) {
          console.error('Match turn (attack_item):', err);
          setActionLocked(false);
        }
        return;
      }

      try {
        const actingPlayer =
          useSquadCombat && actingUnit?.side === 'player'
            ? playerSquadRef.current.find((u) => String(u.id) === String(actingUnit.id)) ||
              playerSquadRef.current.find((u) => (Number(u.current_hp) || 0) > 0) ||
              player
            : player;
        const targetEnemy = useSquadCombat
          ? pickRandomLiving(enemySquadRef.current)
          : enemy;
        if (!targetEnemy || (Number(targetEnemy.current_hp) || 0) <= 0) {
          setActionLocked(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attacker: {
              ...actingPlayer,
              name: actingPlayer.name,
              final_stats: actingPlayer.final_stats,
              current_hp: actingPlayer.current_hp,
            },
            defender: {
              ...targetEnemy,
              name: targetEnemy.name,
              final_stats: targetEnemy.final_stats,
              current_hp: targetEnemy.current_hp,
              current_def_dmg: targetEnemy.current_def_dmg ?? 0,
            },
            movePower: item.power ?? 10,
            moveName: item.item_name || 'Weapon',
            power_min: powerMin,
            power_max: powerMax,
            defender_current_def_dmg: targetEnemy.current_def_dmg ?? 0,
          }),
        });
        const result = await res.json();

        let nextPlayerSquad = playerSquadRef.current;
        let nextEnemySquad = enemySquadRef.current;

        if (useSquadCombat) {
          if (result.reflectedDamage > 0) {
            appendLog(
              `${actingPlayer.name} đánh ${targetEnemy.name}, bị phản đòn ${result.reflectedDamage} sát thương!`,
              'enemy_attack'
            );
            nextPlayerSquad = nextPlayerSquad.map((u) =>
              String(u.id) === String(actingPlayer.id)
                ? { ...u, current_hp: result.attacker_hp_after ?? Math.max(0, (Number(u.current_hp) || 0) - result.reflectedDamage) }
                : u
            );
            setPlayerSquad(nextPlayerSquad);
            playerSquadRef.current = nextPlayerSquad;
            await playCombatFx({
              attackerId: actingPlayer.id,
              hitId: actingPlayer.id,
              animationId: BATTLE_FX_ATTACK_ANIM_ID,
              side: 'player',
              killingBlow: (Number(result.attacker_hp_after) || 0) <= 0,
              floatText: floatFromReflectResult(result),
            });
            await playDeathIfKo(actingPlayer.id, result.attacker_hp_after);
          } else if (result.miss) {
            appendLog(
              `${actingPlayer.name} dùng ${result.moveUsed} vào ${targetEnemy.name} nhưng trượt!`,
              'player_attack'
            );
            await playCombatFx({
              attackerId: actingPlayer.id,
              hitId: targetEnemy.id,
              side: 'player',
              miss: true,
            });
          } else {
            appendLog(
              `${actingPlayer.name} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''} vào ${targetEnemy.name}, gây ${result.damage} sát thương.`,
              'player_attack'
            );
            nextEnemySquad = nextEnemySquad.map((u) =>
              String(u.id) === String(targetEnemy.id)
                ? {
                    ...u,
                    current_hp: result.defender_hp_after ?? Math.max(0, (Number(u.current_hp) || 0) - (result.damage || 0)),
                    current_def_dmg: 0, shield_hold: false,
                  }
                : u
            );
            setEnemySquad(nextEnemySquad);
            enemySquadRef.current = nextEnemySquad;
            await playCombatFx({
              attackerId: actingPlayer.id,
              hitId: targetEnemy.id,
              animationId: BATTLE_FX_ATTACK_ANIM_ID,
              side: 'player',
              killingBlow: (Number(result.defender_hp_after) || 0) <= 0,
              floatText: floatFromDamageResult(result),
            });
            if ((result.defender_hp_after ?? 0) <= 0) {
              appendLog(`${targetEnemy.name} đã bị hạ!`, 'default');
              await playDeathIfKo(targetEnemy.id, result.defender_hp_after);
            }
          }
          playerSquadRef.current = nextPlayerSquad;
          enemySquadRef.current = nextEnemySquad;
          purgeDeadFromQueue(nextPlayerSquad, nextEnemySquad);
          const ended = checkSquadBattleEnded(nextPlayerSquad, nextEnemySquad);
          // Cập nhật durability
          try {
            const durabilityRes = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/use-durability`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: 1 }),
            });
            const durabilityResult = await durabilityRes.json();
            if (durabilityResult.item_destroyed) {
              setEquippedItems((prev) => prev.filter((i) => i.id !== item.id));
              appendLog(`${item.item_name} đã hỏng và bị tiêu hủy.`, 'default');
            } else {
              setEquippedItems((prev) =>
                prev.map((i) =>
                  i.id === item.id ? { ...i, durability_left: durabilityResult.durability_left } : i
                )
              );
            }
          } catch (err) {
            console.error('Error updating durability:', err);
            setEquippedItems((prev) =>
              prev.map((i) => {
                if (i.id !== item.id) return i;
                if (!isItemUsableByDurability(i) || isRandomDurability(i) || isPermanentDurability(i)) return i;
                return { ...i, durability_left: Math.max((i.durability_left ?? 1) - 1, 0) };
              })
            );
          }
          await advanceQueueAfterPlayer({ redisCombined: false, ended });
          return;
        }

        if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'enemy_attack');
          setPlayer((prev) => {
            const next = { ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp };
            playerRef.current = next;
            return next;
          });
        } else {
          const playerActor =
            actingUnit?.side === 'player' ? actingUnit.name : result.attacker;
          appendLog(
            `${playerActor} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`,
            'player_attack'
          );
        }
        setEnemy((prev) => {
          const next = {
            ...prev,
            current_hp: result.defender_hp_after ?? Math.max(0, prev.current_hp - result.damage),
            current_def_dmg: 0, shield_hold: false,
          };
          enemyRef.current = next;
          return next;
        });
        
        // Cập nhật durability trong database
        try {
          const durabilityRes = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/use-durability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 1 })
          });
          const durabilityResult = await durabilityRes.json();
          
          if (durabilityResult.item_destroyed) {
            setEquippedItems((prev) => prev.filter(i => i.id !== item.id));
            appendLog(`${item.item_name} đã hỏng và bị tiêu hủy.`, 'default');
          } else {
            // Cập nhật durability
            setEquippedItems((prev) => prev.map(i => 
              i.id === item.id ? { ...i, durability_left: durabilityResult.durability_left } : i
            ));
          }
        } catch (err) {
          console.error('Error updating durability:', err);
          // Fallback: chỉ trừ durability khi là mode fixed
          setEquippedItems((prev) => prev.map((i) => {
            if (i.id !== item.id) return i;
            if (!isItemUsableByDurability(i) || isRandomDurability(i) || isPermanentDurability(i)) return i;
            return { ...i, durability_left: Math.max((i.durability_left ?? 1) - 1, 0) };
          }));
        }
        
        const newEnemyHp = result.defender_hp_after ?? Math.max(0, enemy.current_hp - result.damage);
        const newPlayerHp = result.reflectedDamage > 0 ? result.attacker_hp_after : player.current_hp;
        await playCombatFx({
          attackerId: actingPlayer?.id || player?.id,
          hitId: result.reflectedDamage > 0 ? actingPlayer?.id || player?.id : enemy?.id,
          animationId: BATTLE_FX_ATTACK_ANIM_ID,
          side: 'player',
          killingBlow:
            result.reflectedDamage > 0
              ? (Number(newPlayerHp) || 0) <= 0
              : (Number(newEnemyHp) || 0) <= 0,
          floatText:
            result.reflectedDamage > 0
              ? floatFromReflectResult(result)
              : floatFromDamageResult(result),
        });

        if (result.reflectedDamage > 0) {
          await playDeathIfKo(actingPlayer?.id || player?.id, newPlayerHp);
        } else {
          await playDeathIfKo(enemy?.id, newEnemyHp);
        }
        const ended = checkBattleEnded(newEnemyHp, newPlayerHp);
        await advanceQueueAfterPlayer({ redisCombined: false, ended });
      } catch (err) {
        console.error('Lỗi khi đánh bằng vũ khí:', err);
        setActionLocked(false);
      }
    };
  
    const applyActorShield = (defDmg) => {
      const actingId =
        useSquadCombat && actingUnit?.side === 'player' ? actingUnit.id : player?.id;
      if (useSquadCombat && actingUnit?.side === 'player') {
        setPlayerSquad((prev) => {
          const next = prev.map((u) =>
            String(u.id) === String(actingId) ? withShield(u, defDmg) : u
          );
          playerSquadRef.current = next;
          return next;
        });
      }
      setPlayer((prev) => {
        if (useSquadCombat && String(prev?.id) !== String(actingId)) {
          playerRef.current = prev;
          return prev;
        }
        const next = withShield(prev, defDmg);
        playerRef.current = next;
        return next;
      });
    };

    const handleDefend = async (shieldItem) => {
      if (battleUiLocked) return;
      if (!shieldItem || !isShieldEquipmentType(shieldItem) || !isItemUsableByDurability(shieldItem)) return;
      setActionLocked(true);
      const powerMin = shieldItem.power_min != null ? shieldItem.power_min : (shieldItem.power ?? 0);
      const powerMax = shieldItem.power_max != null ? shieldItem.power_max : (shieldItem.power ?? powerMin);
      applyActorShield(0);
      if (isRedisMatch) {
        try {
          const histBefore = Array.isArray(log) ? log.length : 0;
          const data = await sendMatchTurn({ action: 'defend_shield', itemId: shieldItem.id, power_min: powerMin, power_max: powerMax });
          await playRedisMatchTurnPresentation(data, histBefore);
          const ended = await settleMatchFinish(data);
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended,
          });
        } catch (err) {
          console.error('Match turn (defend_shield):', err);
          setPlayer((prev) => {
            const next = { ...prev, current_def_dmg: 0, shield_hold: false };
            playerRef.current = next;
            return next;
          });
          setActionLocked(false);
        }
        return;
      }
      try {
        const actingPlayer =
          useSquadCombat && actingUnit?.side === 'player'
            ? playerSquadRef.current.find((u) => String(u.id) === String(actingUnit.id)) || player
            : player;
        const foeForDefend = useSquadCombat
          ? pickRandomLiving(enemySquadRef.current) || enemy
          : enemy;
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-defend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defenderUnit: actingPlayer,
            enemy: foeForDefend,
            shield_power_min: powerMin,
            shield_power_max: powerMax,
          })
        });
        const result = await res.json();
        appendLog(
          result.logMessage ||
            `${actingPlayer.name} sử dụng Phòng thủ, thiết lập shield ${result.defDmg ?? 0} HP phòng ngự.`,
          'defense'
        );
        applyActorShield(result.defDmg);
        await playCombatFx({
          attackerId: actingPlayer.id,
          hitId: actingPlayer.id,
          animationId: BATTLE_FX_DEFEND_ANIM_ID,
          side: 'player',
          noLunge: true,
        });
        try {
          const durRes = await fetch(`${API_BASE_URL}/api/inventory/${shieldItem.id}/use-durability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 1 })
          });
          const durData = await durRes.json();
          if (durData.item_destroyed) setEquippedItems((prev) => prev.filter(i => i.id !== shieldItem.id));
          else setEquippedItems((prev) => prev.map(i => i.id === shieldItem.id ? { ...i, durability_left: durData.durability_left } : i));
        } catch (_) {
          setEquippedItems((prev) => prev.map((i) => {
            if (i.id !== shieldItem.id) return i;
            if (!isItemUsableByDurability(i) || isRandomDurability(i) || isPermanentDurability(i)) return i;
            return { ...i, durability_left: Math.max((i.durability_left || 1) - 1, 0) };
          }));
        }
        const ended = useSquadCombat
          ? checkSquadBattleEnded(playerSquadRef.current, enemySquadRef.current)
          : checkBattleEnded(enemy.current_hp, player.current_hp);
        await advanceQueueAfterPlayer({ redisCombined: false, ended });
      } catch (err) {
        console.error('Lỗi khi phòng thủ:', err);
        setPlayer((prev) => {
          const next = { ...prev, current_def_dmg: 0, shield_hold: false };
          playerRef.current = next;
          return next;
        });
        setActionLocked(false);
      }
    };

    const handleNormalAttack = async () => {
      if (battleUiLocked) return;
      setActionLocked(true);
      if (isRedisMatch) {
        try {
          const histBefore = Array.isArray(log) ? log.length : 0;
          const data = await sendMatchTurn({ action: 'normal_attack', power_min: NORMAL_POWER_MIN, power_max: NORMAL_POWER_MAX, moveName: 'Normal Attack' });
          await playRedisMatchTurnPresentation(data, histBefore);
          const ended = await settleMatchFinish(data);
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended,
          });
        } catch (err) {
          console.error('Match turn (normal_attack):', err);
          setActionLocked(false);
        }
        return;
      }

      try {
        const actingPlayer =
          useSquadCombat && actingUnit?.side === 'player'
            ? playerSquadRef.current.find((u) => String(u.id) === String(actingUnit.id)) ||
              playerSquadRef.current.find((u) => (Number(u.current_hp) || 0) > 0) ||
              player
            : player;
        const targetEnemy = useSquadCombat
          ? pickRandomLiving(enemySquadRef.current)
          : enemy;
        if (!targetEnemy) {
          setActionLocked(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attacker: actingPlayer,
            defender: targetEnemy,
            movePower: 10,
            moveName: 'Normal Attack',
            power_min: NORMAL_POWER_MIN,
            power_max: NORMAL_POWER_MAX,
            defender_current_def_dmg: targetEnemy.current_def_dmg ?? 0,
          })
        });
        const result = await res.json();

        if (useSquadCombat) {
          let nextPlayerSquad = playerSquadRef.current;
          let nextEnemySquad = enemySquadRef.current;
          if (result.reflectedDamage > 0) {
            appendLog(
              `${actingPlayer.name} đánh ${targetEnemy.name}, bị phản đòn ${result.reflectedDamage} sát thương!`,
              'enemy_attack'
            );
            nextPlayerSquad = nextPlayerSquad.map((u) =>
              String(u.id) === String(actingPlayer.id)
                ? { ...u, current_hp: result.attacker_hp_after ?? Math.max(0, (Number(u.current_hp) || 0) - result.reflectedDamage) }
                : u
            );
            setPlayerSquad(nextPlayerSquad);
            playerSquadRef.current = nextPlayerSquad;
            await playCombatFx({
              attackerId: actingPlayer.id,
              hitId: actingPlayer.id,
              animationId: BATTLE_FX_ATTACK_ANIM_ID,
              side: 'player',
              killingBlow: (Number(result.attacker_hp_after) || 0) <= 0,
              floatText: floatFromReflectResult(result),
            });
            await playDeathIfKo(actingPlayer.id, result.attacker_hp_after);
          } else if (result.miss) {
            appendLog(
              `${actingPlayer.name} dùng ${result.moveUsed} vào ${targetEnemy.name} nhưng trượt!`,
              'player_attack'
            );
            await playCombatFx({
              attackerId: actingPlayer.id,
              hitId: targetEnemy.id,
              side: 'player',
              miss: true,
            });
          } else {
            appendLog(
              `${actingPlayer.name} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''} vào ${targetEnemy.name}, gây ${result.damage} sát thương.`,
              'player_attack'
            );
            nextEnemySquad = nextEnemySquad.map((u) =>
              String(u.id) === String(targetEnemy.id)
                ? {
                    ...u,
                    current_hp:
                      result.defender_hp_after ??
                      Math.max(0, (Number(u.current_hp) || 0) - (result.damage || 0)),
                    current_def_dmg: 0, shield_hold: false,
                  }
                : u
            );
            setEnemySquad(nextEnemySquad);
            enemySquadRef.current = nextEnemySquad;
            await playCombatFx({
              attackerId: actingPlayer.id,
              hitId: targetEnemy.id,
              animationId: BATTLE_FX_ATTACK_ANIM_ID,
              side: 'player',
              killingBlow: (Number(result.defender_hp_after) || 0) <= 0,
              floatText: floatFromDamageResult(result),
            });
            if ((result.defender_hp_after ?? 0) <= 0) {
              appendLog(`${targetEnemy.name} đã bị hạ!`, 'default');
              await playDeathIfKo(targetEnemy.id, result.defender_hp_after);
            }
          }
          purgeDeadFromQueue(nextPlayerSquad, nextEnemySquad);
          const ended = checkSquadBattleEnded(nextPlayerSquad, nextEnemySquad);
          await advanceQueueAfterPlayer({ redisCombined: false, ended });
          return;
        }

        if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'enemy_attack');
          setPlayer((prev) => {
            const next = { ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp };
            playerRef.current = next;
            return next;
          });
        } else {
          const playerActor =
            actingUnit?.side === 'player' ? actingUnit.name : result.attacker;
          appendLog(
            `${playerActor} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`,
            'player_attack'
          );
        }
        setEnemy((prev) => {
          const next = {
            ...prev,
            current_hp: result.defender_hp_after ?? Math.max(0, prev.current_hp - result.damage),
            current_def_dmg: 0, shield_hold: false,
          };
          enemyRef.current = next;
          return next;
        });

        const newEnemyHp = result.defender_hp_after ?? Math.max(0, enemy.current_hp - result.damage);
        const newPlayerHp = result.reflectedDamage > 0 ? result.attacker_hp_after : player.current_hp;
        await playCombatFx({
          attackerId: actingPlayer?.id || player?.id,
          hitId: result.reflectedDamage > 0 ? actingPlayer?.id || player?.id : enemy?.id,
          animationId: BATTLE_FX_ATTACK_ANIM_ID,
          side: 'player',
          miss: !!result.miss,
          killingBlow: !result.miss && (
            result.reflectedDamage > 0
              ? (Number(newPlayerHp) || 0) <= 0
              : (Number(newEnemyHp) || 0) <= 0
          ),
          floatText: result.miss
            ? null
            : result.reflectedDamage > 0
              ? floatFromReflectResult(result)
              : floatFromDamageResult(result),
        });

        if (!result.miss) {
          if (result.reflectedDamage > 0) {
            await playDeathIfKo(actingPlayer?.id || player?.id, newPlayerHp);
          } else {
            await playDeathIfKo(enemy?.id, newEnemyHp);
          }
        }
        const ended = checkBattleEnded(newEnemyHp, newPlayerHp);
        await advanceQueueAfterPlayer({ redisCombined: false, ended });
      } catch (err) {
        console.error('Lỗi khi tấn công thường:', err);
        setActionLocked(false);
      }
    };

    /** Phòng thủ vật lý cơ bản (không cần khiên): cùng công thức defend với khiên, dùng power cố định 7, 10. */
    const handleBasicDefend = async () => {
      if (battleUiLocked) return;
      setActionLocked(true);
      if (isRedisMatch) {
        try {
          const histBefore = Array.isArray(log) ? log.length : 0;
          const data = await sendMatchTurn({ action: 'defend_basic', power_min: NORMAL_POWER_MIN, power_max: NORMAL_POWER_MAX });
          await playRedisMatchTurnPresentation(data, histBefore);
          const ended = await settleMatchFinish(data);
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended,
          });
        } catch (err) {
          console.error('Match turn (defend_basic):', err);
          setActionLocked(false);
        }
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-defend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defenderUnit: player,
            enemy,
            shield_power_min: NORMAL_POWER_MIN,
            shield_power_max: NORMAL_POWER_MAX,
          })
        });
        const result = await res.json();
        appendLog(result.logMessage || `${player.name} sử dụng Phòng thủ vật lý, thiết lập shield ${result.defDmg ?? 0} HP phòng ngự.`, 'defense');
        applyActorShield(result.defDmg);
        await playCombatFx({
          attackerId: player.id,
          hitId: player.id,
          animationId: BATTLE_FX_DEFEND_ANIM_ID,
          side: 'player',
          noLunge: true,
        });
        const ended = checkBattleEnded(enemy.current_hp, player.current_hp);
        await advanceQueueAfterPlayer({ redisCombined: false, ended });
      } catch (err) {
        console.error('Lỗi khi phòng thủ vật lý:', err);
        setActionLocked(false);
      }
    };
  
    const handleEnemyTurn = async () => {
      if (useSquadCombat) {
        const acting =
          actingUnit?.side === 'enemy'
            ? enemySquadRef.current.find((u) => String(u.id) === String(actingUnit.id))
            : null;
        const attacker =
          acting && (Number(acting.current_hp) || 0) > 0
            ? acting
            : pickRandomLiving(enemySquadRef.current);
        const target = pickRandomLiving(playerSquadRef.current);
        if (!attacker || !target) {
          return checkSquadBattleEnded(playerSquadRef.current, enemySquadRef.current);
        }

        try {
          const payload = {
            attacker: {
              ...attacker,
              name: attacker.name,
              final_stats: attacker.final_stats,
              current_hp: attacker.current_hp,
              skills: attacker.skills,
              action_pattern: attacker.action_pattern,
              current_def_dmg: attacker.current_def_dmg ?? 0,
            },
            defender: {
              ...target,
              name: target.name,
              final_stats: target.final_stats,
              current_hp: target.current_hp,
              current_def_dmg: target.current_def_dmg ?? 0,
            },
            movePower: 10,
            moveName: 'Tấn công thường',
            isEnemyAttack: true,
            turnNumber,
            power_min: 80,
            power_max: 100,
            defender_current_def_dmg: target.current_def_dmg ?? 0,
          };

          const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await res.json();
          let nextPlayerSquad = playerSquadRef.current;
          let nextEnemySquad = enemySquadRef.current;

          if (result.miss) {
            appendLog(
              `${attacker.name} dùng ${result.moveUsed || 'Tấn công thường'} vào ${target.name} nhưng trượt!`,
              'enemy_attack'
            );
            await playCombatFx({
              attackerId: attacker.id,
              hitId: target.id,
              side: 'enemy',
              miss: true,
            });
          } else if (result.isBossDefend) {
            appendLog(
              `${attacker.name} sử dụng Phòng thủ, thiết lập shield ${result.bossDefDmg ?? 0} HP phòng ngự.`,
              'defense'
            );
            nextEnemySquad = nextEnemySquad.map((u) =>
              String(u.id) === String(attacker.id)
                ? withShield(u, result.bossDefDmg)
                : u
            );
            setEnemySquad(nextEnemySquad);
            await playCombatFx({
              attackerId: attacker.id,
              hitId: attacker.id,
              animationId: BATTLE_FX_DEFEND_ANIM_ID,
              side: 'enemy',
              noLunge: true,
            });
          } else if (result.reflectedDamage > 0) {
            appendLog(
              `${attacker.name} đánh ${target.name}, bị phản đòn ${result.reflectedDamage} sát thương!`,
              'player_attack'
            );
            nextPlayerSquad = nextPlayerSquad.map((u) =>
              String(u.id) === String(target.id)
                ? { ...u, current_def_dmg: 0, shield_hold: false }
                : u
            );
            nextEnemySquad = nextEnemySquad.map((u) =>
              String(u.id) === String(attacker.id)
                ? {
                    ...u,
                    current_hp:
                      result.attacker_hp_after ??
                      Math.max(0, (Number(u.current_hp) || 0) - result.reflectedDamage),
                  }
                : u
            );
            setPlayerSquad(nextPlayerSquad);
            setEnemySquad(nextEnemySquad);
            playerSquadRef.current = nextPlayerSquad;
            enemySquadRef.current = nextEnemySquad;
            await playCombatFx({
              attackerId: attacker.id,
              hitId: attacker.id,
              animationId: BATTLE_FX_ATTACK_ANIM_ID,
              side: 'enemy',
              killingBlow: (Number(result.attacker_hp_after) || 0) <= 0,
              floatText: floatFromReflectResult(result),
            });
            await playDeathIfKo(attacker.id, result.attacker_hp_after);
          } else {
            const dmg = result.damage ?? 0;
            const newHp =
              result.defender_hp_after ?? Math.max(0, (Number(target.current_hp) || 0) - dmg);
            appendLog(
              `${attacker.name} dùng ${result.moveUsed || 'Tấn công thường'}${
                result.critical ? ' (CRIT)' : ''
              } vào ${target.name}, gây ${dmg} sát thương.`,
              'enemy_attack'
            );
            nextPlayerSquad = nextPlayerSquad.map((u) =>
              String(u.id) === String(target.id)
                ? { ...u, current_hp: newHp, current_def_dmg: 0, shield_hold: false }
                : u
            );
            setPlayerSquad(nextPlayerSquad);
            playerSquadRef.current = nextPlayerSquad;
            await playCombatFx({
              attackerId: attacker.id,
              hitId: target.id,
              animationId: BATTLE_FX_ATTACK_ANIM_ID,
              side: 'enemy',
              killingBlow: newHp <= 0,
              floatText: floatFromDamageResult(result),
            });
            if (newHp <= 0) {
              appendLog(`${target.name} đã bị hạ!`, 'default');
              await playDeathIfKo(target.id, newHp);
            }
          }

          playerSquadRef.current = nextPlayerSquad;
          enemySquadRef.current = nextEnemySquad;
          purgeDeadFromQueue(nextPlayerSquad, nextEnemySquad);
          return checkSquadBattleEnded(nextPlayerSquad, nextEnemySquad);
        } catch (err) {
          console.error('Enemy squad attack failed:', err);
          return false;
        }
      }

      const latestPlayer = playerRef.current;
      const latestEnemy = enemyRef.current;
      if (latestEnemy.current_hp <= 0 || latestPlayer.current_hp <= 0) return true;

      try {
        const payload = {
          attacker: latestEnemy,
          defender: latestPlayer,
          movePower: 10,
          moveName: 'Enemy Strike',
          isEnemyAttack: true,
          defender_current_def_dmg: latestPlayer.current_def_dmg ?? 0,
        };
        if (Array.isArray(latestEnemy.skills) && latestEnemy.skills.length > 0) {
          payload.turnNumber = turnNumber;
        }

        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        let ended = false;
        if (result.miss) {
          appendLog(`${result.attacker} dùng ${result.moveUsed} nhưng trượt!`, 'enemy_attack');
          await playCombatFx({
            attackerId: latestEnemy?.id,
            hitId: latestPlayer?.id,
            side: 'enemy',
            miss: true,
          });
        } else if (result.isBossDefend) {
          appendLog(`${result.attacker} sử dụng Phòng thủ, thiết lập shield ${result.bossDefDmg ?? 0} HP phòng ngự.`, 'defense');
          setEnemy((prev) => {
            const next = withShield(prev, result.bossDefDmg);
            enemyRef.current = next;
            return next;
          });
          await playCombatFx({
            attackerId: latestEnemy?.id,
            hitId: latestEnemy?.id,
            animationId: BATTLE_FX_DEFEND_ANIM_ID,
            side: 'enemy',
            noLunge: true,
          });
        } else if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'player_attack');
          setPlayer((prev) => {
            const next = { ...prev, current_hp: result.defender_hp_after ?? prev.current_hp, current_def_dmg: 0, shield_hold: false };
            playerRef.current = next;
            return next;
          });
          setEnemy((prev) => {
            const next = { ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp };
            enemyRef.current = next;
            return next;
          });
          await playCombatFx({
            attackerId: latestEnemy?.id,
            hitId: latestEnemy?.id,
            animationId: BATTLE_FX_ATTACK_ANIM_ID,
            side: 'enemy',
            killingBlow: (Number(result.attacker_hp_after) || 0) <= 0,
            floatText: floatFromReflectResult(result),
          });
          await playDeathIfKo(latestEnemy?.id, result.attacker_hp_after);
          ended = checkBattleEnded(result.attacker_hp_after ?? enemy.current_hp, result.defender_hp_after ?? player.current_hp);
        } else {
          const newPlayerHp = result.defender_hp_after ?? Math.max(0, player.current_hp - (result.damage ?? 0));
          const enemyActor =
            actingUnit?.side === 'enemy' ? actingUnit.name : result.attacker;
          appendLog(
            `${enemyActor} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`,
            'enemy_attack'
          );
          setPlayer((prev) => {
            const next = { ...prev, current_hp: newPlayerHp, current_def_dmg: 0, shield_hold: false };
            playerRef.current = next;
            return next;
          });
          await playCombatFx({
            attackerId: latestEnemy?.id,
            hitId: latestPlayer?.id,
            animationId: BATTLE_FX_ATTACK_ANIM_ID,
            side: 'enemy',
            killingBlow: newPlayerHp <= 0,
            floatText: floatFromDamageResult(result),
          });
          await playDeathIfKo(latestPlayer?.id, newPlayerHp);
          ended = checkBattleEnded(enemy.current_hp, newPlayerHp);
        }

        return ended;
      } catch (err) {
        console.error('Enemy attack failed:', err);
        return false;
      }
    };
  
    const handleBlitz = async () => {
      if (battleUiLocked) return;
      const firstWeapon = equippedItems.find(i => i.equipment_type !== 'shield');
      const playerPowerMin = firstWeapon?.power_min != null ? firstWeapon.power_min : 0;
      const playerPowerMax = firstWeapon?.power_max != null ? firstWeapon.power_max : 0;
      const firstAttackSkill = Array.isArray(enemy.skills) && enemy.skills.length
        ? enemy.skills.find(s => s.type === 'attack') || enemy.skills[0]
        : null;
      const enemyPowerMin = firstAttackSkill?.power_min ?? 80;
      const enemyPowerMax = firstAttackSkill?.power_max ?? 100;
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/simulate-full`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerPet: player,
            enemyPet: enemy,
            playerMovePower: 10,
            playerMoveName: 'Slash',
            enemyMovePower: 10,
            enemyMoveName: firstAttackSkill?.name || 'Bite',
            playerPowerMin,
            playerPowerMax,
            enemyPowerMin,
            enemyPowerMax,
          })
        });
        const result = await res.json();
        setLog(result.log);
        setResultEffect(result.winner === player.name ? 'win' : 'lose');
        setBattleEnded(true);
      } catch (err) {
        console.error('Lỗi khi blitz:', err);
      }
    };
  
  // Reconnect: nếu vào trang không có matchState nhưng user đã đăng nhập -> kiểm tra match đang chơi
  const [redisMatchRestored, setRedisMatchRestored] = useState(false);
  /** Chỉ gọi battle-stats/equipment sau khi đã biết có/không match Redis — tránh ghi đè current_hp = max HP */
  const [redisStatusChecked, setRedisStatusChecked] = useState(
    () => !!fromMatch || openedWithSquad
  );
  useEffect(() => {
    if (fromMatch || redisMatchRestored || openedWithSquad) {
      setRedisStatusChecked(true);
      return;
    }
    if (!user?.token) {
      setRedisStatusChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/match/status`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) {
          if (res.status === 404 && !playerPet) navigate('/battle/arena', { replace: true });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data?.active === false || !data?.player) return;
        try {
          sessionStorage.setItem(
            BATTLE_RETURN_KEY,
            JSON.stringify({
              battleSource: data.battleSource || 'arena',
              returnPath: data.returnPath || '/battle/arena',
              huntingMapId: data.huntingMapId || null,
            })
          );
        } catch {
          /* ignore */
        }
        if (data.squad && Array.isArray(data.playerSquad)) {
          const mode = normalizeBattleMode(data.battleMode);
          const queue = Array.isArray(data.speedQueue) ? data.speedQueue : [];
          speedQueueRef.current = queue;
          setSpeedQueue(queue);
          setPlayerSquad(data.playerSquad);
          setEnemySquad(Array.isArray(data.enemySquad) ? data.enemySquad : []);
          setPlayer({ ...data.player, current_def_dmg: data.player.current_def_dmg ?? 0 });
          setEnemy({ ...data.enemy, current_def_dmg: data.enemy?.current_def_dmg ?? 0 });
          setTurn(data.turn_count ?? 0);
          setTurnNumber(Math.max(1, Number(data.turn_count) || 1));
          setLog(Array.isArray(data.history) ? data.history : []);
          setMatchId(data.matchId || null);
          setBattleMode(mode);
          setFormationId(normalizeFormationId(data.formationId, mode));
          setEnemyFormationId(normalizeFormationId(data.enemyFormationId, mode));
          setSquadPersist(true);
          setIsRedisMatch(false);
          setRedisMatchRestored(true);
          return;
        }
        setPlayer({ ...data.player, current_def_dmg: data.player.current_def_dmg ?? 0 });
        setEnemy({ ...data.enemy, current_def_dmg: data.enemy.current_def_dmg ?? 0 });
        setTurn(data.turn_count ?? 0);
        setLog(Array.isArray(data.history) ? data.history : []);
        if (Array.isArray(data.equipment)) {
          setEquippedItems(data.equipment.map((e) => ({ ...e, image_url: e.image_url || '' })));
        }
        setRedisMatchRestored(true);
        setIsRedisMatch(true);
      } catch (err) {
        if (!playerPet) navigate('/battle/arena', { replace: true });
      } finally {
        if (!cancelled) setRedisStatusChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user?.token,
    fromMatch,
    redisMatchRestored,
    navigate,
    playerPet,
    API_BASE_URL,
    openedWithSquad,
  ]);

  useEffect(() => {
    if (!squadPersist || battleEnded || !matchId || !user?.token) return undefined;
    const timer = setTimeout(() => {
      const players = playerSquadRef.current || [];
      const enemies = enemySquadRef.current || [];
      if (!players.length || !enemies.length) return;
      fetch(`${API_BASE_URL}/api/arena/match/squad/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          matchId: matchIdRef.current,
          turn_count: turnRef.current,
          playerSquad: players,
          enemySquad: enemies,
          speedQueue: speedQueueRef.current,
          history: log,
        }),
      }).catch((err) => console.error('Không lưu snapshot trận:', err));
    }, 350);
    return () => clearTimeout(timer);
  }, [
    squadPersist,
    battleEnded,
    matchId,
    user?.token,
    API_BASE_URL,
    playerSquad,
    enemySquad,
    speedQueue,
    log,
    turn,
  ]);

      useEffect(() => {
    if (!redisStatusChecked) return;
    if (!player?.id) return;
    if (isRedisMatch) return; // Đã có từ matchState / status
    if (useSquadCombat) return; // HP theo squad từ select
    // Lấy battle stats với đầy đủ bonus (cached)
      fetch(`${API_BASE_URL}/api/pets/${player.id}/battle-stats`)
      .then(res => res.json())
      .then(data => {
        setPlayer(prev => ({ 
          ...prev, 
          final_stats: data.battle_stats,
          current_hp: data.battle_stats.hp 
        }));
      })
      .catch(err => console.error('Error loading battle stats:', err));
    }, [player?.id, isRedisMatch, useSquadCombat, redisStatusChecked, API_BASE_URL]);

    // Equipment theo pet đang tới lượt (player)
    useEffect(() => {
      if (!isPlayerActing) return;
      const petId = actingUnit?.id || player?.id;
      if (!petId) return;
      if (isRedisMatch && String(petId) === String(player?.id) && equippedItems.length) return;
      let cancelled = false;
      fetch(`${API_BASE_URL}/api/pets/${petId}/equipment`, {
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((list) => {
          if (!cancelled) setEquippedItems(Array.isArray(list) ? list : []);
        })
        .catch((err) => console.error('Error loading acting pet equipment:', err));
      return () => {
        cancelled = true;
      };
    }, [
      isPlayerActing,
      actingUnit?.queueKey,
      actingUnit?.id,
      player?.id,
      isRedisMatch,
      API_BASE_URL,
      user?.token,
    ]);

    const actionLockedRef = React.useRef(false);
    actionLockedRef.current = actionLocked;

    // Tự động xử lý khi đầu queue là enemy (local only — Redis đã resolve trong match/turn)
    useEffect(() => {
      if (isRedisMatch) return;
      if (battleEnded || chipLeaving) return;
      if (!speedQueue.length || isPlayerActing) return;
      if (enemyAutoRef.current || actionLockedRef.current) return;

      enemyAutoRef.current = true;
      setActionLocked(true);

      (async () => {
        try {
          // Cho kịp nhìn pet active trước khi NPC ra đòn
          await waitPace(420);
          const ended = await handleEnemyTurn();
          if (!ended) {
            bumpTurnAfterAction(null);
            await rotateSpeedChip();
          }
        } catch (err) {
          console.error('Enemy auto turn failed:', err);
        } finally {
          enemyAutoRef.current = false;
          setActionLocked(false);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      actingUnit?.queueKey,
      isPlayerActing,
      battleEnded,
      chipLeaving,
      isRedisMatch,
      speedQueue.length,
    ]);

    // Redis: nếu queue mở đầu bằng enemy (SPD), kéo chip enemy xuống cuối 1 lần — không combat local
    useEffect(() => {
      if (!isRedisMatch || battleEnded || chipLeaving) return;
      if (!speedQueue.length || isPlayerActing) return;
      if (enemyAutoRef.current || actionLockedRef.current) return;
      enemyAutoRef.current = true;
      setActionLocked(true);
      (async () => {
        try {
          await rotateAfterRedisCombinedTurn();
        } finally {
          enemyAutoRef.current = false;
          setActionLocked(false);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      isRedisMatch,
      actingUnit?.queueKey,
      isPlayerActing,
      battleEnded,
      chipLeaving,
      speedQueue.length,
    ]);

    /** Battle entry flash (~1.8s) */
    useEffect(() => {
      if (entrySpawnDoneRef.current) return undefined;
      const hasUnits =
        (playerSquadRef.current || []).length > 0 ||
        (enemySquadRef.current || []).length > 0 ||
        !!player?.id;
      if (!hasUnits) return undefined;

      entrySpawnDoneRef.current = true;
      setEntrySpawn(true);
      window.setTimeout(() => setEntrySpawn(false), 1800);
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerSquad.length, enemySquad.length, player?.id, enemy?.id]);

    const gainExpIfVictory = async () => {
        if (!battleEnded || resultEffect !== 'win') return;
        // Champion challenge: không cộng EXP / loot
        if (isChampionBattle || returnMeta.battleSource === 'champion') return;
        if (!useSquadCombat && player.current_hp <= 0) return;
        if (useSquadCombat && !teamStillAlive(playerSquadRef.current)) return;
          // Cập nhật hunger status sau battle
          try {
            await fetch(`${API_BASE_URL}/api/pets/${player.id}/update-hunger-after-battle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (err) {
            console.error('Error updating hunger status after battle:', err);
          }
          try {
            const res = await fetch(`${API_BASE_URL}/api/pets/${player.id}/gain-exp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'arena',
                enemy_level: enemy.level,
                custom_amount: null
              })
            });
            const updatedPet = await res.json();
            const oldLevel = player.level; // Lưu lại level cũ trước khi update
            // ✅ Update player stats nếu level up
            if (updatedPet.stats_updated && updatedPet.new_stats) {
              setPlayer(prev => ({ 
                ...prev, 
                level: updatedPet.level, 
                current_exp: updatedPet.current_exp,
                hp: updatedPet.new_stats.hp,
                max_hp: updatedPet.new_stats.hp,
                mp: updatedPet.new_stats.mp,
                max_mp: updatedPet.new_stats.mp,
                str: updatedPet.new_stats.str,
                def: updatedPet.new_stats.def,
                intelligence: updatedPet.new_stats.intelligence,
                spd: updatedPet.new_stats.spd,
                final_stats: updatedPet.new_stats
              }));
            } else {
              setPlayer(prev => ({ 
                ...prev, 
                level: updatedPet.level, 
                current_exp: updatedPet.current_exp 
              }));
            }

            setBattleReward((prev) => ({
              ...prev,
              expGained: updatedPet.gained ?? 0,
              levelUp: updatedPet.level > oldLevel,
              newLevel: updatedPet.level,
            }));
          } catch (err) {
            console.error('Lỗi khi cộng EXP sau chiến thắng:', err);
          }
          // Boss loot: gọi claim-loot khi thắng Boss
          if (enemy?.isBoss && enemy?.id && user?.token) {
            try {
              const lootRes = await fetch(`${API_BASE_URL}/api/arena/claim-loot`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${user.token}`,
                },
                body: JSON.stringify({ bossId: enemy.id, petId: player.id }),
              });
              const lootData = await lootRes.json();
              if (lootData.success && lootData.loot?.length > 0) {
                setBattleReward((prev) => ({ ...prev, loot: lootData.loot || [] }));
              }
            } catch (err) {
              console.error('Lỗi khi nhận loot Boss:', err);
            }
          }
      };

      // Save HP to database after battle
      const savePlayerHP = async () => {
        try {
          await fetch(`${API_BASE_URL}/api/pets/${player.id}/update-hp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_hp: player.current_hp })
          });
        } catch (err) {
          console.error('Error saving player HP:', err);
        }
      };

      const squadHpSavedRef = React.useRef(false);
      useEffect(() => {
        if (!battleEnded) return;
        // Redis: reward đã từ match/turn|terminate (server finalize). Client claim = 410.
        if (isRedisMatch) return;
        if (useSquadCombat) {
          if (squadHpSavedRef.current) return;
          const units = (playerSquadRef.current || []).filter((unit) => Number(unit?.id) > 0);
          if (!units.length || !user?.token) return;
          squadHpSavedRef.current = true;
          const lost = resultEffect !== 'win';
          fetch(`${API_BASE_URL}/api/arena/squad/finish`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({
              result: lost ? 'lose' : 'win',
              matchId: matchIdRef.current,
              pets: units.map((unit) => ({
                id: Number(unit.id),
                current_hp: lost ? 0 : Math.max(0, Math.floor(Number(unit.current_hp) || 0)),
              })),
            }),
          }).catch((err) => console.error('Không lưu máu đội sau trận:', err));
          return;
        }
        if (resultEffect === 'win' && player.current_hp > 0) {
          gainExpIfVictory();
        }
        savePlayerHP();
      }, [battleEnded, resultEffect, isRedisMatch, useSquadCombat, user?.token, API_BASE_URL]);

      const handleFleeBattle = async () => {
        if ((!isRedisMatch && !squadPersist) || battleEnded || battleUiLocked) return;
        if (!window.confirm('Bỏ chạy sẽ kết thúc trận và tính là thua. Tiếp tục?')) return;
        setActionLocked(true);
        try {
          const res = await fetch(`${API_BASE_URL}/api/arena/match/terminate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            body: JSON.stringify({ matchId: matchIdRef.current }),
          });
          const data = await res.json().catch(() => ({}));
          if (data.reward) applyServerReward(data.reward);
        } catch (err) {
          console.error('Bỏ chạy / terminate:', err);
        }
        setLog((prev) => [...prev.slice(-49), { text: 'Bạn đã bỏ chạy! Trận đấu kết thúc.', type: 'default' }]);
        setResultEffect('lose');
        setBattleEnded(true);
        setActionLocked(false);
      };

      const handleLeaveBattle = async (e) => {
        if ((!isRedisMatch && !squadPersist) || battleEnded) return;
        e?.preventDefault?.();
        if (!window.confirm('Nếu bạn rời đi, trận đấu sẽ tính là THUA.')) return;
        try {
          await fetch(`${API_BASE_URL}/api/arena/match/terminate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
            body: JSON.stringify({ matchId: matchIdRef.current }),
          });
        } catch (err) {
          console.error('Terminate match:', err);
        }
        navigate(returnMeta.returnPath || '/battle/arena');
        clearStoredBattleReturn();
      };

      useEffect(() => {
        if ((!isRedisMatch && !squadPersist) || battleEnded) return;
        const onBeforeUnload = (e) => {
          e.preventDefault();
          e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
      }, [isRedisMatch, squadPersist, battleEnded]);

      const resetBattle = () => {
        const newPlayer = { 
          ...player, 
          current_hp: player.current_hp || player.final_stats?.hp,
          current_def_dmg: 0, shield_hold: false,
        };
        const newEnemy = { ...enemyPet, current_hp: enemyPet?.current_hp ?? enemyPet?.final_stats?.hp, current_def_dmg: 0, shield_hold: false };
        setPlayer(newPlayer);
        setEnemy(newEnemy);
        setTurn(0);
        setLog([]);
        setAutoMode(false);
        setIsBlitzMode(false);
        setBattleEnded(false);
        loseFlavorRef.current = '';
        setAttackAnimation('');
        setBattleFx(null);
        setLifeFx({});
        setFloatTexts([]);
        setFinaleSlowMo(false);
        endPresentationLockRef.current = false;
        entrySpawnDoneRef.current = false;
        setEntrySpawn(true);
        setResultEffect('');
        setActionLocked(false);
        setBattleReward({ expGained: 0, levelUp: false, newLevel: null, loot: [] });
      
        // ✅ Gọi lại API lấy item trang bị
        fetch(`${API_BASE_URL}/api/pets/${newPlayer.id}/equipment`)
          .then(res => res.json())
          .then(setEquippedItems)
          .catch(err => console.error('Lỗi khi load trang bị (reset):', err));
      };
    useEffect(() => {
        if (location.state?._refresh) {
          resetBattle();
        }
      }, [location.state?._refresh]);

      const handleGo = () => {
        if (!selectedAction || battleUiLocked) return;
        if (selectedAction === 'normal_attack') handleNormalAttack();
        else if (selectedAction === 'basic_defend') handleBasicDefend();
        setSelectedAction('');
      };

      const actionOptions = [
        { value: 'normal_attack', label: 'Tấn công thường' },
        { value: 'basic_defend', label: 'Phòng thủ vật lý' },
      ];

    const outcomeWin = resultEffect === 'win';
    const rewardLoot = Array.isArray(battleReward.loot) ? battleReward.loot : [];

    if (!redisStatusChecked && !openedWithSquad && !fromMatch) {
      return (
        <TemplatePage showSearch={false} showTabs={false}>
          <div className="arena-battle-container">
            <p className="loading" style={{ padding: '2rem', textAlign: 'center' }}>Đang khôi phục trận đấu...</p>
          </div>
        </TemplatePage>
      );
    }

    if (battleEnded) {
      if (!outcomeWin && !loseFlavorRef.current) {
        loseFlavorRef.current = pickLoseFlavor(player?.name, enemy?.name);
      }
      const loseFlavor = loseFlavorRef.current;
      return (
        <TemplatePage showSearch={false} showTabs={false}>
          <main className="classic-battle">
            <section className="classic-result" aria-labelledby="arena-result-title">
              <img
                className={`classic-result-pet${outcomeWin ? '' : ' classic-result-pet--lose'}`}
                src={petImgSrc(player?.image)}
                alt={player?.name || ''}
              />
              <h1 id="arena-result-title">{outcomeWin ? 'Chiến thắng!' : 'Thất bại'}</h1>
              <p>
                {outcomeWin
                  ? `Xin chúc mừng, bạn đã đánh bại ${enemy?.name || 'đối thủ'}!`
                  : loseFlavor}
              </p>
              {outcomeWin && battleReward.expGained > 0 && (
                <p>
                  <strong>{formatNum(battleReward.expGained)}</strong> EXP
                </p>
              )}
              {battleReward.levelUp && battleReward.newLevel != null && (
                <p className="classic-level">Thú cưng lên cấp {formatNum(battleReward.newLevel)}!</p>
              )}
              {outcomeWin && rewardLoot.length > 0 && (
                <div className="classic-loot">
                  <p className="classic-loot-label">Bạn nhận được:</p>
                  <BattleRewardStrip
                    rewards={rewardLoot}
                    className="classic-loot-strip"
                    ariaLabel="Vật phẩm nhận được"
                  />
                </div>
              )}
              {!outcomeWin && (
                <div className="classic-power-tips" aria-label="Gợi ý nâng sức mạnh">
                  <p className="classic-power-tips__label">Nâng cao sức mạnh:</p>
                  <div className="classic-power-tips__row">
                    {RESULT_POWER_TIPS.map((tip) => (
                      <button
                        key={tip.key}
                        type="button"
                        className="classic-power-tip"
                        onClick={() => goPowerTip(tip.to)}
                        title={tip.label}
                      >
                        <span className="classic-power-tip__icon" aria-hidden>
                          <img src={tip.icon} alt="" draggable={false} />
                        </span>
                        <span className="classic-power-tip__hint">{tip.hint}</span>
                        <span className="classic-power-tip__label">{tip.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="classic-result__back" onClick={goBackAfterBattle}>
                {returnMeta.returnLabel ||
                  (returnMeta.battleSource === 'hunting' ? 'Trở lại bản đồ' : 'Về Đấu Trường')}
              </button>
            </section>
          </main>
        </TemplatePage>
      );
    }

    return (
        <TemplatePage showSearch={false} showTabs={false}>
        <div
          className={`arena-battle-container${isMulti ? ' arena-battle-container--themed arena-battle-container--multi' : ' arena-battle-container--1v1'}${finaleSlowMo ? ' arena-battle-container--finale-slow' : ''}`}
          style={{
            '--battle-pace': String(
              finaleSlowMo ? Math.max(0.25, Number(battleSpeed) / FINALE_SLOW_MULT) : battleSpeed
            ),
          }}
        >
          <div
            className={`arena-battle-scene${isMulti ? ' arena-battle-scene--bg' : ''}`}
            style={isMulti ? arenaSceneBgStyle : undefined}
          >
          {/* Top: [Avatar + Speed] [HP bar + Name] | VS | [HP bar + Name] [Avatar + Speed] */}
          <header className="arena-battle-header">
            <div className="arena-header-player">
              <div className="arena-header-avatar-col">
                <div className="arena-header-avatar" style={{ backgroundImage: `url(/images/pets/${player?.image})` }} />
                <div className="arena-header-speed-box">
                  <img className="arena-speed-icon" src="/images/icons/speed.png" alt="" aria-hidden />
                  <span className="arena-speed-value">{playerTeamSpd}</span>
                </div>
              </div>
              <div className="arena-header-main">
                <div className="arena-header-hp">
                  <div className="arena-hp-bar">
                    <div
                      className="arena-hp-fill"
                      style={{ width: `${Math.max(0, Math.min(100, playerHeaderHpPct))}%` }}
                    />
                  </div>
                </div>
                <span className="arena-header-name">{userName}</span>
              </div>
            </div>
            <div className="arena-header-vs" title="Lượt hiện tại">
              {turnNumber}/{turnLimit}
            </div>
            <div className="arena-header-enemy">
              <div className="arena-header-main">
                <div className="arena-header-hp">
                  <div className="arena-hp-bar enemy">
                    <div
                      className="arena-hp-fill"
                      style={{ width: `${Math.max(0, Math.min(100, enemyHeaderHpPct))}%` }}
                    />
                  </div>
                </div>
                <span className="arena-header-name">{enemy?.name}</span>
              </div>
              <div className="arena-header-avatar-col">
                <div className="arena-header-avatar enemy" style={{ backgroundImage: `url(${enemy?.image})` }} />
                <div className="arena-header-speed-box">
                  <img className="arena-speed-icon" src="/images/icons/speed.png" alt="" aria-hidden />
                  <span className="arena-speed-value">{enemyTeamSpd}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Middle: multi formation | 1v1 classic pets (size giữ) + speed bar */}
          {isMulti ? (
            <div className="abm-stage">
              <MultiBattleArena
                playerFormationId={formationId}
                enemyFormationId={enemyFormationId}
                playerUnitsBySlot={playerUnitsBySlot}
                enemyUnitsBySlot={enemyUnitsBySlot}
                actingUnit={actingUnit}
                battleFx={battleFx}
                lifeFx={lifeFx}
                floatTexts={floatTexts}
                entrySpawn={entrySpawn}
                battleMode={battleMode}
              />
              <SpeedOrderBar
                units={speedQueue}
                leaving={chipLeaving}
                battleSpeed={battleSpeed}
                onBattleSpeedChange={setBattleSpeed}
              />
            </div>
          ) : (
            <div className="arena-battle-pets">
              {(() => {
                const pLife = lifeFx[String(player?.id)] || 'alive';
                const eLife = lifeFx[String(enemy?.id)] || 'alive';
                if (pLife === 'gone' && eLife === 'gone') return null;
                return (
                  <>
              <div
                className={[
                  'arena-pet-block',
                  'arena-pet-block--player',
                  attackAnimation === 'player' ? 'arena-pet--lunge' : '',
                  (attackAnimation === 'enemy' && battleFx?.hitId) ||
                  (battleFx?.hitId != null && String(battleFx.hitId) === String(player?.id))
                    ? 'arena-pet--hit'
                    : '',
                  entrySpawn ? 'arena-pet--spawn' : '',
                  pLife === 'finale-death' ? 'arena-pet--finale-death' : '',
                  pLife === 'death' ? 'arena-pet--death' : '',
                  pLife === 'gone' ? 'arena-pet--hidden' : '',
                  actingUnit && String(actingUnit.id) === String(player?.id) ? 'arena-pet--lead' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="arena-pet-sprite-wrap">
                  <div className="arena-pet-sprite-frame">
                    <img
                      className="arena-pet-figure"
                      src={`/images/pets/${player?.image}`}
                      alt={player?.name}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <PetShieldOverlay active={unitHasShield(player)} side="player" />
                  </div>
                  {floatTextsForUnit(floatTexts, player?.id).map((ft) => (
                    <FloatingCombatText key={ft.id} value={ft.value} kind={ft.kind} />
                  ))}
                  {battleFx?.hitId != null &&
                  String(battleFx.hitId) === String(player?.id) &&
                  battleFx?.animationId != null ? (
                    <BattleFxOverlay fxNumId={battleFx.animationId} token={battleFx?.token || 'p'} />
                  ) : battleFx?.hitId != null &&
                    String(battleFx.hitId) === String(player?.id) &&
                    battleFx?.effect &&
                    battleFx.effect !== 'catalog' ? (
                    <span className={`abm-unit__fx abm-unit__fx--${battleFx.effect}`} aria-hidden />
                  ) : null}
                </div>
                <p className="arena-pet-name">
                  {player?.name}
                  {player?.level != null ? (
                    <span className="arena-pet-level"> Lv.{player.level}</span>
                  ) : null}
                </p>
                <div className="arena-pet-stats">
                  <div className="arena-stats-row">
                    HP:{' '}
                    <span className={`arena-hp-value ${hpToneClass(player)}`}>
                      {Math.max(0, Math.floor(Number(player?.current_hp) || 0))}/
                      {unitMaxHp(player)}
                    </span>
                  </div>
                  <div className="arena-stats-row">
                    STR: {player?.final_stats?.str ?? '—'} · DEF: {player?.final_stats?.def ?? '—'}
                  </div>
                </div>
              </div>
              <div
                className={[
                  'arena-pet-block',
                  'arena-pet-block--enemy',
                  attackAnimation === 'enemy' ? 'arena-pet--lunge' : '',
                  (attackAnimation === 'player' && battleFx?.hitId) ||
                  (battleFx?.hitId != null && String(battleFx.hitId) === String(enemy?.id))
                    ? 'arena-pet--hit'
                    : '',
                  entrySpawn ? 'arena-pet--spawn' : '',
                  eLife === 'finale-death' ? 'arena-pet--finale-death' : '',
                  eLife === 'death' ? 'arena-pet--death' : '',
                  eLife === 'gone' ? 'arena-pet--hidden' : '',
                  actingUnit && String(actingUnit.id) === String(enemy?.id) ? 'arena-pet--lead' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="arena-pet-sprite-wrap">
                  <div className="arena-pet-sprite-frame">
                    <img
                      className="arena-pet-figure"
                      src={enemy?.image}
                      alt={enemy?.name}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <PetShieldOverlay active={unitHasShield(enemy)} side="enemy" />
                  </div>
                  {floatTextsForUnit(floatTexts, enemy?.id).map((ft) => (
                    <FloatingCombatText key={ft.id} value={ft.value} kind={ft.kind} />
                  ))}
                  {battleFx?.hitId != null &&
                  String(battleFx.hitId) === String(enemy?.id) &&
                  battleFx?.animationId != null ? (
                    <BattleFxOverlay fxNumId={battleFx.animationId} token={battleFx?.token || 'e'} />
                  ) : battleFx?.hitId != null &&
                    String(battleFx.hitId) === String(enemy?.id) &&
                    battleFx?.effect &&
                    battleFx.effect !== 'catalog' ? (
                    <span className={`abm-unit__fx abm-unit__fx--${battleFx.effect}`} aria-hidden />
                  ) : null}
                </div>
                <p className="arena-pet-name">
                  {enemy?.name}
                  {enemy?.level != null ? (
                    <span className="arena-pet-level"> Lv.{enemy.level}</span>
                  ) : null}
                </p>
                <div className="arena-pet-stats">
                  <div className="arena-stats-row">
                    HP:{' '}
                    <span className={`arena-hp-value ${hpToneClass(enemy)}`}>
                      {Math.max(0, Math.floor(Number(enemy?.current_hp) || 0))}/
                      {unitMaxHp(enemy)}
                    </span>
                  </div>
                  <div className="arena-stats-row">
                    STR: {enemy?.final_stats?.str ?? '—'} · DEF: {enemy?.final_stats?.def ?? '—'}
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </div>
          )}

          {isMulti ? (
          <div className="arena-battle-log">
            <div className="arena-log-inner">
              {log.length === 0 && <div className="arena-log-line">Trận đấu bắt đầu!</div>}
              {log.map((entry, idx) => {
                const item = typeof entry === 'string' ? { text: entry, type: 'default' } : entry;
                return <div key={idx} className={`arena-log-line arena-log-${item.type}`}>{item.text}</div>;
              })}
              <div ref={logEndRef} />
            </div>
          </div>
          ) : null}
          </div>

          <div className={isMulti ? 'arena-battle-controls' : 'arena-battle-panel'}>
          {!isMulti ? (
            <>
              <SpeedOrderBar
                units={speedQueue}
                leaving={chipLeaving}
                battleSpeed={battleSpeed}
                onBattleSpeedChange={setBattleSpeed}
              />
              <div className="arena-battle-log">
                <div className="arena-log-inner">
                  {log.length === 0 && <div className="arena-log-line">Trận đấu bắt đầu!</div>}
                  {log.map((entry, idx) => {
                    const item = typeof entry === 'string' ? { text: entry, type: 'default' } : entry;
                    return <div key={idx} className={`arena-log-line arena-log-${item.type}`}>{item.text}</div>;
                  })}
                  <div ref={logEndRef} />
                </div>
              </div>
            </>
          ) : null}

          {/* Equipment - flex wrap; click item = trigger action directly */}
          <section className="arena-equipment-section">
            <h3 className="arena-equipment-title">
              {isPlayerActing
                ? `Equipment — ${actingUnit?.name || player?.name || ''}`
                : 'Đối thủ đang hành động...'}
            </h3>
            <div className="arena-equipment-grid">
              {equippedItems.map((item) => {
                const isShield = isShieldEquipmentType(item);
                const magicVal = item.magic_value ?? item.power ?? 0;
                const disabled = !isItemUsableByDurability(item);
                const handleClick = () => {
                  if (battleUiLocked || disabled) return;
                  if (isShield) handleDefend(item);
                  else handleAttackWithItem(item);
                };
                const handlePointerDown = (e) => {
                  e.stopPropagation();
                  // Chỉ chặn callout trên touch; mouse cần giữ click path
                  if (e.pointerType === 'touch') e.preventDefault();
                  if (battleUiLocked || disabled) return;
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
                  longPressTriggeredRef.current = false;
                  equipPointerUsedRef.current = false;
                  setInfoItemId(null);
                  setHoldingItemId(item.id);
                  if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                  holdTimerRef.current = setTimeout(() => {
                    holdTimerRef.current = null;
                    setHoldingItemId(null);
                    openItemInfo(item.id);
                    longPressTriggeredRef.current = true;
                  }, 1000);
                };
                const finishPointer = (e) => {
                  e.stopPropagation();
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
                  const wasLongPress = longPressTriggeredRef.current;
                  const shortTap = holdTimerRef.current != null;
                  if (holdTimerRef.current) {
                    clearTimeout(holdTimerRef.current);
                    holdTimerRef.current = null;
                  }
                  setHoldingItemId(null);
                  if (wasLongPress) return;
                  if (shortTap && !battleUiLocked && !disabled) {
                    equipPointerUsedRef.current = true;
                    handleClick();
                  }
                };
                return (
                  <div
                    key={item.id}
                    ref={(el) => { if (el) equipItemElsRef.current[item.id] = el; }}
                    className={`arena-equipment-item ${disabled || battleUiLocked ? 'disabled' : ''}`}
                    role="button"
                    tabIndex={disabled || battleUiLocked ? -1 : 0}
                    onKeyDown={(e) => {
                      if (disabled || battleUiLocked) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick();
                      }
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerUp={finishPointer}
                    onPointerCancel={finishPointer}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Đã dùng item ở pointerup → bỏ qua click trùng
                      if (equipPointerUsedRef.current) {
                        equipPointerUsedRef.current = false;
                        return;
                      }
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      if (infoItemId === item.id) return;
                      handleClick();
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <img
                      src={getItemImageSrc(item.image_url)}
                      alt={item.item_name}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      onError={(e) => { e.target.src = '/images/equipments/placeholder.png'; }}
                    />
                    {holdingItemId === item.id && (
                      <svg className="arena-hold-badge" viewBox="0 0 36 36" aria-hidden>
                        <circle className="arena-hold-badge-bg" cx="18" cy="18" r="16" />
                        <circle className="arena-hold-badge-fg" cx="18" cy="18" r="16" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Item info modal (render outside equipment item) */}
          {infoItemId && (() => {
            const item = equippedItems.find((i) => i.id === infoItemId);
            if (!item) return null;
            const magicVal = item.magic_value ?? item.power ?? 0;
            const rect = infoAnchorRect;
            const top = rect ? Math.max(8, rect.top - 10) : 80;
            const left = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
            return createPortal(
              <div className="arena-item-info-overlay" onPointerDown={() => { setInfoItemId(null); setInfoAnchorRect(null); }}>
                <div
                  className="arena-item-info-modal"
                  style={{ top, left, transform: 'translate(-50%, -100%)' }}
                  onPointerDown={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-label="Item info"
                >
                  <div className="arena-item-info-title">{item.item_name}</div>
                  <div className="arena-item-info-row">Độ bền: <b>{getBattleDurabilityText(item)}</b></div>
                  <div className="arena-item-info-row">Chỉ số Ma thuật: <b>{magicVal}</b></div>
                </div>
              </div>,
              document.body
            );
          })()}

          {/* Select ability + Go */}
          <div className="arena-action-row">
            <select
              className="arena-action-select"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              disabled={battleUiLocked}
              aria-label="Chọn hành động"
            >
              <option value="">Chọn hành động</option>
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button type="button" className="arena-action-go" onClick={handleGo} disabled={!selectedAction || battleUiLocked}>
              Go!
            </button>
          </div>

          {(isRedisMatch || squadPersist) && !battleEnded && (
            <div className="arena-flee-row">
              <button type="button" className="arena-flee-btn" onClick={handleFleeBattle} disabled={battleUiLocked}>
                Bỏ chạy
              </button>
            </div>
          )}
          </div>
        </div>
        </TemplatePage>
      );
    }

export default ArenaBattlePage;
