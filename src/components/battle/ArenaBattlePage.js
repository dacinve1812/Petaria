// ArenaBattlePage.js - Trang chiến đấu PvE (arena / champion / hunting)
import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import GameModalButton from '../ui/GameModalButton';
import { BattleBannerOverlay, BattleResultDimOverlay } from './BattleOverlays';
import { getDisplayName } from '../../utils/userDisplay';
import { getActiveHuntingMap } from '../../utils/huntingSessionStorage';
import formationSystem from '../../data/formationSystem';
import '../css/BattlePage.css';
import '../css/ArenaBattlePage.css';
import expTable from '../../data/exp_table_petaria.json';

const { normalizeFormationId, getLineIndices } = formationSystem;

const BATTLE_RETURN_KEY = 'petaria-arena-battle-return';

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

function unitSpd(u) {
  return Number(u?.final_stats?.spd ?? u?.spd ?? 0) || 0;
}

function unitMaxHp(u) {
  return Math.max(1, Number(u?.final_stats?.hp ?? u?.hp ?? 1) || 1);
}

function unitHpPct(u) {
  return Math.max(0, Math.min(100, ((Number(u?.current_hp) || 0) / unitMaxHp(u)) * 100));
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


/** Ô pet multi: HP + status icons phía trên, Lv phía dưới — không hiện tên/stats */
function MultiBattleUnit({
  unit,
  side,
  isLead,
  flash,
  onFlashEnd,
  statusIcons = [],
}) {
  if (!unit) {
    return <div className={`abm-unit abm-unit--empty abm-unit--${side}`} aria-hidden />;
  }
  const pct = unitHpPct(unit);
  const dead = (Number(unit.current_hp) || 0) <= 0;
  return (
    <div
      className={[
        'abm-unit',
        `abm-unit--${side}`,
        isLead ? 'abm-unit--lead' : '',
        flash ? 'abm-unit--flash' : '',
        dead ? 'abm-unit--dead' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
        <img
          src={battlePetImg(unit.image)}
          alt={unit.name || ''}
          className="abm-unit__sprite"
          draggable={false}
          onAnimationEnd={onFlashEnd}
        />
        <span className="abm-unit__ground-shadow" aria-hidden />
      </div>
    </div>
  );
}

function MultiFormationBoard({
  side,
  formationId,
  unitsBySlot,
  leadId,
  flashUnitId,
  onFlashEnd,
}) {
  const lines = getLineIndices(formationId);
  const renderLine = (lineName, indices) => (
    <div className={`abm-line abm-line--${lineName}`} key={lineName}>
      {indices.map((i) => {
        const unit = unitsBySlot[i] || null;
        return (
          <MultiBattleUnit
            key={`${side}-${i}`}
            unit={unit}
            side={side}
            isLead={unit && String(unit.id) === String(leadId)}
            flash={Boolean(unit) && String(unit.id) === String(flashUnitId)}
            onFlashEnd={onFlashEnd}
          />
        );
      })}
    </div>
  );

  // Player: Back | Front — Enemy mirrored: Front | Back
  return (
    <div className={`abm-board abm-board--${side} abm-board--f${formationId}`}>
      {side === 'player' ? (
        <>
          {renderLine('back', lines.back)}
          {renderLine('front', lines.front)}
        </>
      ) : (
        <>
          {renderLine('front', lines.front)}
          {renderLine('back', lines.back)}
        </>
      )}
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
    const fromMatch = !!initialMatchState && !!useRedisMatchFromState;
    const battleMode = normalizeBattleMode(
      battleModeState || initialMatchState?.battleMode || '1v1'
    );
    const isMulti = battleMode === '3v3' || battleMode === '5v5';
    const formationId = normalizeFormationId(formationIdState || '3-2');
    const enemyFormationId = normalizeFormationId(
      enemyFormationIdState || formationIdState || '3-2'
    );

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
          returnLabel: 'Về Champion',
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
        returnLabel: isHunting ? 'Về đi săn' : 'Về Đấu trường',
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

    const [player, setPlayer] = useState(() => {
      if (fromMatch && initialMatchState?.player) return { ...initialMatchState.player, current_def_dmg: initialMatchState.player.current_def_dmg ?? 0 };
      return { ...playerPet, current_hp: playerPet?.current_hp || playerPet?.final_stats?.hp, current_def_dmg: 0 };
    });
    const [enemy, setEnemy] = useState(() => {
      if (fromMatch && initialMatchState?.enemy) return { ...initialMatchState.enemy, current_def_dmg: initialMatchState.enemy.current_def_dmg ?? 0 };
      return { ...enemyPet, current_hp: enemyPet?.current_hp || enemyPet?.final_stats?.hp, current_def_dmg: 0 };
    });
    const [playerSquad, setPlayerSquad] = useState(() =>
      Array.isArray(playerTeamState) && playerTeamState.length
        ? playerTeamState
        : []
    );
    const [enemySquad, setEnemySquad] = useState(() =>
      Array.isArray(enemyTeamState) && enemyTeamState.length
        ? enemyTeamState
        : []
    );
    const [turn, setTurn] = useState(fromMatch ? (initialMatchState?.turn_count ?? 0) : 0);
    const turnLimit = turnLimitForMode(battleMode);
    const [turnNumber, setTurnNumber] = useState(() => {
      const tc = Number(initialMatchState?.turn_count);
      return Number.isFinite(tc) && tc > 0 ? Math.min(tc, turnLimitForMode(battleMode)) : 1;
    });
    const [speedQueue, setSpeedQueue] = useState([]);
    const [chipLeaving, setChipLeaving] = useState(false);
    const speedQueueRef = React.useRef([]);
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
    const [log, setLog] = useState(() => (fromMatch && Array.isArray(initialMatchState?.history) ? initialMatchState.history : []));
    const [autoMode, setAutoMode] = useState(false);
    const [isBlitzMode, setIsBlitzMode] = useState(false);
    const [battleEnded, setBattleEnded] = useState(false);
    const [startBannerVisible, setStartBannerVisible] = useState(() => {
      const tc = initialMatchState?.turn_count ?? 0;
      const histLen = initialMatchState?.history?.length ?? 0;
      if (fromMatch && (tc > 0 || histLen > 1)) return false;
      return true;
    });
    /** null | 'finish' | 'result' — sau khi battleEnded: FINISH 2s rồi màn kết quả */
    const [postBattlePhase, setPostBattlePhase] = useState(null);
      const [equippedItems, setEquippedItems] = useState(() => {
        if (fromMatch && Array.isArray(initialMatchState?.equipment)) {
          return initialMatchState.equipment.map((e) => ({ ...e, image_url: e.image_url || '' }));
        }
        return [];
      });
  const [attackAnimation, setAttackAnimation] = useState('');
    const [flashUnitId, setFlashUnitId] = useState(null);
    const [resultEffect, setResultEffect] = useState('');
    const [actionLocked, setActionLocked] = useState(false);
    const [selectedAction, setSelectedAction] = useState('');
    const [battleReward, setBattleReward] = useState({ expGained: 0, levelUp: false, newLevel: null, loot: [] });
    const [holdingItemId, setHoldingItemId] = useState(null);
    const [infoItemId, setInfoItemId] = useState(null);
    const [infoAnchorRect, setInfoAnchorRect] = useState(null);
    const holdTimerRef = React.useRef(null);
    const longPressTriggeredRef = React.useRef(false);
    const equipItemElsRef = React.useRef({});

    const battleUiLocked =
      actionLocked || battleEnded || startBannerVisible || !isPlayerActing;

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
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    const sendMatchTurn = async (payload) => {
      const res = await fetch(`${API_BASE_URL}/api/arena/match/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Turn failed');
      setPlayer({ ...data.player, current_def_dmg: data.player?.current_def_dmg ?? 0 });
      setEnemy({ ...data.enemy, current_def_dmg: data.enemy?.current_def_dmg ?? 0 });
      setLog(Array.isArray(data.history) ? data.history : []);
      if (Array.isArray(data.equipment)) setEquippedItems(data.equipment.map((e) => ({ ...e, image_url: e.image_url || '' })));
      setTurn(data.turn_count ?? 0);
      setBattleEnded(!!data.finished);
      setResultEffect(data.result || '');
      setAttackAnimation('player');
      return data;
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
          const data = await sendMatchTurn({ action: 'attack_item', itemId: item.id, power_min: powerMin, power_max: powerMax, moveName: item.item_name || 'Weapon' });
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended: !!data.finished,
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
            setFlashUnitId(actingPlayer.id);
          } else if (result.miss) {
            appendLog(
              `${actingPlayer.name} dùng ${result.moveUsed} vào ${targetEnemy.name} nhưng trượt!`,
              'player_attack'
            );
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
                    current_def_dmg: 0,
                  }
                : u
            );
            setEnemySquad(nextEnemySquad);
            setFlashUnitId(targetEnemy.id);
            if ((result.defender_hp_after ?? 0) <= 0) {
              appendLog(`${targetEnemy.name} đã bị hạ!`, 'default');
            }
          }
          playerSquadRef.current = nextPlayerSquad;
          enemySquadRef.current = nextEnemySquad;
          setAttackAnimation('player');
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
          await waitPace(780);
          await advanceQueueAfterPlayer({ redisCombined: false, ended });
          return;
        }

        if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'enemy_attack');
          setPlayer((prev) => ({ ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp }));
        } else {
          const playerActor =
            actingUnit?.side === 'player' ? actingUnit.name : result.attacker;
          appendLog(
            `${playerActor} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`,
            'player_attack'
          );
        }
        setEnemy((prev) => ({ ...prev, current_hp: result.defender_hp_after ?? Math.max(0, prev.current_hp - result.damage), current_def_dmg: 0 }));
        
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
        
        setAttackAnimation('player');

        const newEnemyHp = result.defender_hp_after ?? Math.max(0, enemy.current_hp - result.damage);
        const newPlayerHp = result.reflectedDamage > 0 ? result.attacker_hp_after : player.current_hp;
        const ended = checkBattleEnded(newEnemyHp, newPlayerHp);
        await waitPace(650);
        await advanceQueueAfterPlayer({ redisCombined: false, ended });
      } catch (err) {
        console.error('Lỗi khi đánh bằng vũ khí:', err);
        setActionLocked(false);
      }
    };
  
    const handleDefend = async (shieldItem) => {
      if (battleUiLocked) return;
      if (!shieldItem || shieldItem.equipment_type !== 'shield' || !isItemUsableByDurability(shieldItem)) return;
      setActionLocked(true);
      const powerMin = shieldItem.power_min != null ? shieldItem.power_min : 0;
      const powerMax = shieldItem.power_max != null ? shieldItem.power_max : 0;
      if (isRedisMatch) {
        try {
          const data = await sendMatchTurn({ action: 'defend_shield', itemId: shieldItem.id, power_min: powerMin, power_max: powerMax });
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended: !!data.finished,
          });
        } catch (err) {
          console.error('Match turn (defend_shield):', err);
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
        if (useSquadCombat) {
          setPlayerSquad((prev) =>
            prev.map((u) =>
              String(u.id) === String(actingPlayer.id)
                ? { ...u, current_def_dmg: result.defDmg ?? 0 }
                : u
            )
          );
        } else {
          setPlayer((prev) => ({ ...prev, current_def_dmg: result.defDmg ?? 0 }));
        }
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
        setActionLocked(false);
      }
    };

    const handleNormalAttack = async () => {
      if (battleUiLocked) return;
      setActionLocked(true);
      if (isRedisMatch) {
        try {
          const data = await sendMatchTurn({ action: 'normal_attack', power_min: NORMAL_POWER_MIN, power_max: NORMAL_POWER_MAX, moveName: 'Normal Attack' });
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended: !!data.finished,
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
            setFlashUnitId(actingPlayer.id);
          } else if (result.miss) {
            appendLog(
              `${actingPlayer.name} dùng ${result.moveUsed} vào ${targetEnemy.name} nhưng trượt!`,
              'player_attack'
            );
          } else {
            appendLog(
              `${actingPlayer.name} dùng ${result.moveUsed} vào ${targetEnemy.name}, gây ${result.damage} sát thương.`,
              'player_attack'
            );
            nextEnemySquad = nextEnemySquad.map((u) =>
              String(u.id) === String(targetEnemy.id)
                ? {
                    ...u,
                    current_hp:
                      result.defender_hp_after ??
                      Math.max(0, (Number(u.current_hp) || 0) - (result.damage || 0)),
                    current_def_dmg: 0,
                  }
                : u
            );
            setEnemySquad(nextEnemySquad);
            setFlashUnitId(targetEnemy.id);
            if ((result.defender_hp_after ?? 0) <= 0) appendLog(`${targetEnemy.name} đã bị hạ!`, 'default');
          }
          setAttackAnimation('player');
          purgeDeadFromQueue(nextPlayerSquad, nextEnemySquad);
          const ended = checkSquadBattleEnded(nextPlayerSquad, nextEnemySquad);
          await waitPace(780);
          await advanceQueueAfterPlayer({ redisCombined: false, ended });
          return;
        }

        if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'enemy_attack');
          setPlayer((prev) => ({ ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp }));
        } else {
          const playerActor =
            actingUnit?.side === 'player' ? actingUnit.name : result.attacker;
          appendLog(
            `${playerActor} dùng ${result.moveUsed}, gây ${result.damage} sát thương.`,
            'player_attack'
          );
        }
        setEnemy((prev) => ({ ...prev, current_hp: result.defender_hp_after ?? Math.max(0, prev.current_hp - result.damage), current_def_dmg: 0 }));
        setAttackAnimation('player');

        const newEnemyHp = result.defender_hp_after ?? Math.max(0, enemy.current_hp - result.damage);
        const newPlayerHp = result.reflectedDamage > 0 ? result.attacker_hp_after : player.current_hp;
        const ended = checkBattleEnded(newEnemyHp, newPlayerHp);
        await waitPace(650);
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
          const data = await sendMatchTurn({ action: 'defend_basic', power_min: NORMAL_POWER_MIN, power_max: NORMAL_POWER_MAX });
          await advanceQueueAfterPlayer({
            redisCombined: true,
            serverTurnCount: data.turn_count,
            ended: !!data.finished,
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
        setPlayer((prev) => ({ ...prev, current_def_dmg: result.defDmg ?? 0 }));
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
          } else if (result.isBossDefend) {
            appendLog(
              `${attacker.name} sử dụng Phòng thủ, thiết lập shield ${result.bossDefDmg ?? 0} HP phòng ngự.`,
              'defense'
            );
            nextEnemySquad = nextEnemySquad.map((u) =>
              String(u.id) === String(attacker.id)
                ? { ...u, current_def_dmg: result.bossDefDmg ?? 0 }
                : u
            );
            setEnemySquad(nextEnemySquad);
          } else if (result.reflectedDamage > 0) {
            appendLog(
              `${attacker.name} đánh ${target.name}, bị phản đòn ${result.reflectedDamage} sát thương!`,
              'player_attack'
            );
            nextPlayerSquad = nextPlayerSquad.map((u) =>
              String(u.id) === String(target.id)
                ? { ...u, current_def_dmg: 0 }
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
            setFlashUnitId(attacker.id);
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
                ? { ...u, current_hp: newHp, current_def_dmg: 0 }
                : u
            );
            setPlayerSquad(nextPlayerSquad);
            setFlashUnitId(target.id);
            if (newHp <= 0) appendLog(`${target.name} đã bị hạ!`, 'default');
          }

          setAttackAnimation('enemy');
          playerSquadRef.current = nextPlayerSquad;
          enemySquadRef.current = nextEnemySquad;
          purgeDeadFromQueue(nextPlayerSquad, nextEnemySquad);
          await waitPace(980);
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
        } else if (result.isBossDefend) {
          appendLog(`${result.attacker} sử dụng Phòng thủ, thiết lập shield ${result.bossDefDmg ?? 0} HP phòng ngự.`, 'defense');
          setEnemy((prev) => ({ ...prev, current_def_dmg: result.bossDefDmg ?? 0 }));
        } else if (result.reflectedDamage > 0) {
          appendLog(`${result.attacker} đánh, ${result.defender} phản đòn ${result.reflectedDamage} sát thương!`, 'player_attack');
          setPlayer((prev) => ({ ...prev, current_hp: result.defender_hp_after ?? prev.current_hp, current_def_dmg: 0 }));
          setEnemy((prev) => ({ ...prev, current_hp: result.attacker_hp_after ?? prev.current_hp }));
          ended = checkBattleEnded(result.attacker_hp_after ?? enemy.current_hp, result.defender_hp_after ?? player.current_hp);
        } else {
          const newPlayerHp = result.defender_hp_after ?? Math.max(0, player.current_hp - (result.damage ?? 0));
          const enemyActor =
            actingUnit?.side === 'enemy' ? actingUnit.name : result.attacker;
          appendLog(
            `${enemyActor} dùng ${result.moveUsed}${result.critical ? ' (CRIT)' : ''}, gây ${result.damage} sát thương.`,
            'enemy_attack'
          );
          setPlayer((prev) => ({ ...prev, current_hp: newPlayerHp, current_def_dmg: 0 }));
          ended = checkBattleEnded(enemy.current_hp, newPlayerHp);
        }

        setAttackAnimation('enemy');
        await waitPace(850);
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
    () => !!fromMatch || isChampionBattle || useSquadCombat
  );
  useEffect(() => {
    if (fromMatch || redisMatchRestored) return;
    // Champion / multi local: không restore Redis match
    if (isChampionBattle || useSquadCombat || battleSourceState === 'champion') {
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
        if (data?.player) {
          setPlayer({ ...data.player, current_def_dmg: data.player.current_def_dmg ?? 0 });
          setEnemy({ ...data.enemy, current_def_dmg: data.enemy.current_def_dmg ?? 0 });
          setTurn(data.turn_count ?? 0);
          setLog(Array.isArray(data.history) ? data.history : []);
          if (Array.isArray(data.equipment)) {
            setEquippedItems(data.equipment.map((e) => ({ ...e, image_url: e.image_url || '' })));
          }
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
          setRedisMatchRestored(true);
          setIsRedisMatch(true);
        }
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
    isChampionBattle,
    useSquadCombat,
    battleSourceState,
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
      if (battleEnded || startBannerVisible || chipLeaving) return;
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
      startBannerVisible,
      chipLeaving,
      isRedisMatch,
      speedQueue.length,
    ]);

    // Redis: nếu queue mở đầu bằng enemy (SPD), kéo chip enemy xuống cuối 1 lần — không combat local
    useEffect(() => {
      if (!isRedisMatch || battleEnded || startBannerVisible || chipLeaving) return;
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
      startBannerVisible,
      chipLeaving,
      speedQueue.length,
    ]);
  
    useEffect(() => {
      if (useSquadCombat) {
        if (!teamStillAlive(enemySquad)) {
          setBattleEnded(true);
          setResultEffect('win');
        } else if (!teamStillAlive(playerSquad)) {
          setBattleEnded(true);
          setResultEffect('lose');
        }
        return;
      }
      if (player.current_hp <= 0 || enemy.current_hp <= 0) {
        setBattleEnded(true);
        if ((enemy.current_hp ?? 0) <= 0 && (player.current_hp ?? 0) > 0) setResultEffect('win');
        else if ((player.current_hp ?? 0) <= 0) setResultEffect('lose');
      }
    }, [useSquadCombat, player.current_hp, enemy.current_hp, playerSquad, enemySquad]);

    useEffect(() => {
      if (turn > 0 || log.length > 1) setStartBannerVisible(false);
    }, [turn, log]);

    useEffect(() => {
      if (!startBannerVisible) return undefined;
      const t = window.setTimeout(() => setStartBannerVisible(false), 1800);
      return () => window.clearTimeout(t);
    }, [startBannerVisible]);

    useEffect(() => {
      if (!battleEnded) {
        setPostBattlePhase(null);
        return undefined;
      }
      setPostBattlePhase('finish');
      const t = window.setTimeout(() => setPostBattlePhase('result'), 1800);
      return () => window.clearTimeout(t);
    }, [battleEnded]);

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

      useEffect(() => {
        if (!battleEnded) return;
        if (resultEffect === 'win' && player.current_hp > 0) {
          gainExpIfVictory();
        }
        if (!isRedisMatch) savePlayerHP();
        // Redis match: khi trận kết thúc luôn gọi terminate để xóa key, tránh 400 ACTIVE_MATCH khi khiêu chiến lại
        if (isRedisMatch) {
          fetch(`${API_BASE_URL}/api/arena/match/terminate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
          }).catch(() => {}); // 404 = key đã xóa, bỏ qua
        }
        // Item hỏng sẽ bị xóa khỏi inventory ngay khi durability về 0, nên không cần unequip-broken nữa.
      }, [battleEnded, resultEffect, isRedisMatch]);

      const handleFleeBattle = async () => {
        if (!isRedisMatch || battleEnded || battleUiLocked) return;
        if (!window.confirm('Bỏ chạy sẽ kết thúc trận và tính là thua. Tiếp tục?')) return;
        setActionLocked(true);
        try {
          await fetch(`${API_BASE_URL}/api/arena/match/terminate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
          });
        } catch (err) {
          console.error('Bỏ chạy / terminate:', err);
        }
        setLog((prev) => [...prev.slice(-49), { text: 'Bạn đã bỏ chạy! Trận đấu kết thúc.', type: 'default' }]);
        setIsRedisMatch(false);
        setResultEffect('lose');
        setBattleEnded(true);
        setActionLocked(false);
      };

      const handleLeaveBattle = async (e) => {
        if (!isRedisMatch || battleEnded) return;
        e?.preventDefault?.();
        if (!window.confirm('Nếu bạn rời đi, trận đấu sẽ tính là THUA.')) return;
        try {
          await fetch(`${API_BASE_URL}/api/arena/match/terminate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
          });
        } catch (err) {
          console.error('Terminate match:', err);
        }
        navigate(returnMeta.returnPath || '/battle/arena');
        clearStoredBattleReturn();
      };

      useEffect(() => {
        if (!isRedisMatch || battleEnded) return;
        const onBeforeUnload = (e) => {
          e.preventDefault();
          e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
      }, [isRedisMatch, battleEnded]);

      const resetBattle = () => {
        const newPlayer = { 
          ...player, 
          current_hp: player.current_hp || player.final_stats?.hp,
          current_def_dmg: 0,
        };
        const newEnemy = { ...enemyPet, current_hp: enemyPet?.current_hp ?? enemyPet?.final_stats?.hp, current_def_dmg: 0 };
        setPlayer(newPlayer);
        setEnemy(newEnemy);
        setTurn(0);
        setLog([]);
        setAutoMode(false);
        setIsBlitzMode(false);
        setBattleEnded(false);
        setPostBattlePhase(null);
        setAttackAnimation('');
        setResultEffect('');
        setActionLocked(false);
        setStartBannerVisible(true);
      
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

    return (
        <TemplatePage showSearch={false} showTabs={false}>
        <BattleBannerOverlay
          open={startBannerVisible && !battleEnded}
          imageSrc="/images/banner/start-layout.png"
          alt="Start"
          dimOpacity={0.5}
        />
        <BattleBannerOverlay
          open={postBattlePhase === 'finish'}
          imageSrc="/images/banner/finish-layout.png"
          alt="Finish"
          dimOpacity={0.5}
        />
        <BattleResultDimOverlay
          open={postBattlePhase === 'result'}
          outcome={outcomeWin ? 'win' : 'lose'}
          dimOpacity={0.2}
          rewards={battleReward.loot || []}
          petProgress={[
            {
              id: player?.id || 'arena-player',
              name: player?.name || userName,
              image: player?.image || '',
              expGained: battleReward.expGained || 0,
              levelUp: !!battleReward.levelUp,
              newLevel: battleReward.newLevel,
            },
          ]}
          expGained={battleReward.expGained || 0}
          levelUp={!!battleReward.levelUp}
          newLevel={battleReward.newLevel}
          footer={
            <GameModalButton type="button" variant="primary" showIcon={false} onClick={goBackAfterBattle}>
              {returnMeta.returnLabel || 'Trở lại'}
            </GameModalButton>
          }
        />
        <div
          className={`arena-battle-container${battleEnded ? ' arena-battle-container--ended' : ''}${isMulti ? ' arena-battle-container--multi' : ''}`}
          style={{ '--battle-pace': String(battleSpeed) }}
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

          {/* Middle: 1v1 classic blocks | multi formation + speed bar */}
          {isMulti ? (
            <div className="abm-stage">
              <div className="abm-field">
                <MultiFormationBoard
                  side="player"
                  formationId={formationId}
                  unitsBySlot={playerUnitsBySlot}
                  leadId={actingUnit?.side === 'player' ? actingUnit.id : null}
                  flashUnitId={flashUnitId}
                  onFlashEnd={() => {
                    setAttackAnimation('');
                    setFlashUnitId(null);
                  }}
                />
                <MultiFormationBoard
                  side="enemy"
                  formationId={enemyFormationId}
                  unitsBySlot={enemyUnitsBySlot}
                  leadId={actingUnit?.side === 'enemy' ? actingUnit.id : null}
                  flashUnitId={flashUnitId}
                  onFlashEnd={() => {
                    setAttackAnimation('');
                    setFlashUnitId(null);
                  }}
                />
              </div>
              <SpeedOrderBar
                units={speedQueue}
                leaving={chipLeaving}
                battleSpeed={battleSpeed}
                onBattleSpeedChange={setBattleSpeed}
              />
            </div>
          ) : (
            <div className="arena-battle-pets">
              <div className="arena-pet-block">
                <img src={`/images/pets/${player?.image}`} alt={player?.name} className={attackAnimation === 'enemy' ? 'attack-flash' : ''} onAnimationEnd={() => setAttackAnimation('')} />
                <p className="arena-pet-name">{player?.name} <span className="arena-pet-level">Lv.{player?.level ?? 1}</span></p>
                <div className="arena-pet-stats">
                  <div className="arena-stats-row">HP: <span className={`arena-hp-value arena-hp--${getHpClass(player?.current_hp, player?.final_stats?.hp)}`}>{player?.current_hp ?? 0}/{player?.final_stats?.hp ?? 0}</span></div>
                  <div className="arena-stats-row">STR: {player?.final_stats?.str ?? player?.str ?? 0} · DEF: {player?.final_stats?.def ?? player?.def ?? 0}</div>
                </div>
              </div>
              <div className="arena-pet-block">
                <img src={enemy?.image} alt={enemy?.name} className={attackAnimation === 'player' ? 'attack-flash' : ''} onAnimationEnd={() => setAttackAnimation('')} />
                <p className="arena-pet-name">{enemy?.name} <span className="arena-pet-level">Lv.{enemy?.level ?? 1}</span></p>
                <div className="arena-pet-stats">
                  <div className="arena-stats-row">HP: <span className={`arena-hp-value arena-hp--${getHpClass(enemy?.current_hp, enemy?.final_stats?.hp)}`}>{enemy?.current_hp ?? 0}/{enemy?.final_stats?.hp ?? 0}</span></div>
                  <div className="arena-stats-row">STR: {enemy?.final_stats?.str ?? enemy?.str ?? 0} · DEF: {enemy?.final_stats?.def ?? enemy?.def ?? 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Battle log - scrollable */}
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

          {/* Equipment - flex wrap; click item = trigger action directly */}
          <section className="arena-equipment-section">
            <h3 className="arena-equipment-title">
              {isPlayerActing
                ? `Equipment — ${actingUnit?.name || player?.name || ''}`
                : 'Đối thủ đang hành động...'}
            </h3>
            <div className="arena-equipment-grid">
              {equippedItems.map((item) => {
                const isShield = item.equipment_type === 'shield';
                const magicVal = item.magic_value ?? item.power ?? 0;
                const disabled = !isItemUsableByDurability(item);
                const handleClick = () => {
                  if (battleUiLocked || disabled) return;
                  if (isShield) handleDefend(item);
                  else handleAttackWithItem(item);
                };
                const handlePointerDown = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (battleUiLocked || disabled) return;
                  // Keep receiving pointer events even if finger moves a bit
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
                  longPressTriggeredRef.current = false;
                  setInfoItemId(null);
                  setHoldingItemId(item.id);
                  if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                  holdTimerRef.current = setTimeout(() => {
                    setHoldingItemId(null);
                    openItemInfo(item.id);
                    longPressTriggeredRef.current = true;
                  }, 1000);
                };
                const handlePointerUp = (e) => {
                  e.stopPropagation();
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
                  cancelHold();
                };
                return (
                  <div
                    key={item.id}
                    ref={(el) => { if (el) equipItemElsRef.current[item.id] = el; }}
                    className={`arena-equipment-item ${disabled || battleUiLocked ? 'disabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (battleUiLocked) return;
                      // If info is open, keep it open (close by clicking outside modal)
                      if (infoItemId === item.id) return;
                      // Long-press is for info only (never use item)
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      handleClick();
                    }}
                    role="button"
                    tabIndex={disabled || battleUiLocked ? -1 : 0}
                    onKeyDown={(e) => !disabled && !battleUiLocked && (e.key === 'Enter' || e.key === ' ') && handleClick()}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <img src={getItemImageSrc(item.image_url)} alt={item.item_name} onError={(e) => { e.target.src = '/images/equipments/placeholder.png'; }} />
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
            >
              <option value="">Chọn hành động cho {actingUnit?.name || player?.name}</option>
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button type="button" className="arena-action-go" onClick={handleGo} disabled={!selectedAction || battleUiLocked}>
              Go!
            </button>
          </div>

          {isRedisMatch && !battleEnded && (
            <div className="arena-flee-row">
              <button type="button" className="arena-flee-btn" onClick={handleFleeBattle} disabled={battleUiLocked}>
                Bỏ chạy
              </button>
            </div>
          )}
        </div>
        </TemplatePage>
      );
    }

export default ArenaBattlePage;
