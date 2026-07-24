import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import GameDialogModal from '../ui/GameDialogModal';
import { asOwnedList } from '../../utils/inventoryApi';
import { getDisplayName } from '../../utils/userDisplay';
import formationSystem from '../../data/formationSystem';
import './BattlePetSelectPage.css';

const {
  FORMATIONS,
  FORMATION_ORDER,
  FORMATION_MAX_LEVEL,
  FORMATION_MIN_LEVEL,
  normalizeFormationId,
  getFormation,
  getLineIndices,
  getDiagramSkillNumbers,
  getFormationBonusesAtLevel,
  costEnhanceRange,
  formatPct,
  normalizeLevelsMap,
  defaultFormationLevels,
} = formationSystem;

const MODE_SLOT_COUNT = {
  '1v1': 1,
  '3v3': 5, // vẫn 5 ô layout; giới hạn deploy riêng
  '5v5': 5,
};

/** Số pet tối đa được xếp theo chế độ trận */
const MODE_DEPLOY_LIMIT = {
  '1v1': 1,
  '3v3': 3,
  '5v5': 5,
};

/**
 * Battle sources không cho long-press xem info đối thủ (PvP…).
 * Có thể ghi đè bằng prep.canViewEnemyInfo.
 */
const ENEMY_INFO_HIDDEN_SOURCES = new Set(['pvp', 'ranked', 'duel']);

const DRAG_THRESHOLD_PX = 6;
const ICON_PETA = '/images/icons/peta.png';

function normalizeMode(raw) {
  const m = String(raw || '1v1').toLowerCase();
  if (m === '3v3' || m === '3vs3') return '3v3';
  if (m === '5v5' || m === '5vs5') return '5v5';
  return '1v1';
}

function petImageSrc(img) {
  if (!img) return '/images/pets/placeholder.png';
  if (String(img).startsWith('http') || String(img).startsWith('/')) return img;
  return `/images/pets/${img}`;
}

function petMaxHp(p) {
  if (p?.final_stats && typeof p.final_stats.hp === 'number') return p.final_stats.hp;
  return p?.hp != null ? Number(p.hp) : 1;
}

function petCurrentHp(p) {
  return p?.current_hp != null ? Number(p.current_hp) : petMaxHp(p);
}

function petSpd(p) {
  if (p?.final_stats && p.final_stats.spd != null) return Number(p.final_stats.spd) || 0;
  return Number(p?.spd) || 0;
}

function petKeyOf(p) {
  if (!p) return null;
  return p.uuid || String(p.id);
}

/** Trùng species trong đội = cùng pet_species_id (fallback name/image). */
function petSpeciesKey(p) {
  if (!p) return null;
  const sid = p.pet_species_id ?? p.species_id ?? p.speciesId;
  if (sid != null && String(sid) !== '') return `id:${sid}`;
  if (p.species_name) return `name:${String(p.species_name).toLowerCase()}`;
  if (p.image) return `img:${String(p.image).toLowerCase()}`;
  return null;
}

const HOLD_RING_DELAY_MS = 200; // chưa hiện vòng (tránh lộ khi double-click)
const HOLD_FILL_MS = 500; // thời gian vòng chạy đầy
const HOLD_OPEN_MS = HOLD_RING_DELAY_MS + HOLD_FILL_MS;
const HOLD_CIRCUMFERENCE = 2 * Math.PI * 15.5; // r=15.5

function HoldRing({ fillMs = HOLD_FILL_MS }) {
  return (
    <div className="bps-hold-ring" aria-hidden>
      <svg viewBox="0 0 36 36" className="bps-hold-ring__svg">
        <circle className="bps-hold-ring__track" cx="18" cy="18" r="15.5" />
        <circle
          className="bps-hold-ring__prog"
          cx="18"
          cy="18"
          r="15.5"
          style={{
            strokeDasharray: HOLD_CIRCUMFERENCE,
            strokeDashoffset: HOLD_CIRCUMFERENCE,
            animationDuration: `${fillMs}ms`,
          }}
        />
      </svg>
    </div>
  );
}

/** Mũi tên vòng tròn ngược — gỡ hết pet khỏi đội hình */
function ClearSlotsIcon() {
  return (
    <svg
      className="bps-clear-slots__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 5V2.21c0-.45-.54-.67-.85-.35L7.35 5.65c-.2.2-.2.51 0 .71l3.79 3.79c.32.31.86.09.86-.35V7c3.73 0 6.68 3.42 5.93 7.27-.46 2.36-2.38 4.27-4.74 4.73-3.28.64-6.15-1.48-6.89-4.5-.13-.54-.63-.9-1.18-.9-.81 0-1.42.78-1.23 1.56.94 3.91 4.86 6.52 9.06 5.63 2.86-.61 5.19-2.9 5.85-5.75C19.53 9.43 16.2 5 12 5z"
      />
    </svg>
  );
}

function getScrollParent(el) {
  let node = el?.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function equipmentImageSrc(url) {
  if (!url) return '/images/icons/bag.svg';
  const s = String(url);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/equipments/${s}`;
}

function spiritImageSrc(url) {
  if (!url) return '/images/icons/bag.svg';
  const s = String(url);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/spirit/${s}`;
}

function FormationStatRows({ formationId, level }) {
  const bonus = getFormationBonusesAtLevel(formationId, level);
  return (
    <div className="bps-fstat">
      <div className="bps-fstat__row">
        <span className="bps-fstat__tag bps-fstat__tag--back">Back Row</span>
        <span className="bps-fstat__text">
          {bonus.back.label} <strong>{formatPct(bonus.back.each)}%</strong>
        </span>
      </div>
      <div className="bps-fstat__row">
        <span className="bps-fstat__tag bps-fstat__tag--front">Front Row</span>
        <span className="bps-fstat__text">
          {bonus.front.label} <strong>{formatPct(bonus.front.each)}%</strong>
        </span>
      </div>
    </div>
  );
}

/** Mini sơ đồ — số = thứ tự skill khi SPD hòa (front dưới→trên, rồi back dưới→trên). */
function FormationDiagram({ formationId }) {
  const nums = getDiagramSkillNumbers(formationId);
  return (
    <div className="bps-fdiag" aria-hidden>
      <div className="bps-fdiag__row bps-fdiag__row--back">
        {nums.back.map((n, i) => (
          <span key={`b-${i}`} className="bps-fdiag__unit bps-fdiag__unit--back">
            {n}
          </span>
        ))}
      </div>
      <div className="bps-fdiag__row bps-fdiag__row--front">
        {nums.front.map((n, i) => (
          <span key={`f-${i}`} className="bps-fdiag__unit bps-fdiag__unit--front">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function FormationOrbIcon() {
  return (
    <svg className="bps-formation-orb__icon" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="10" r="3.2" fill="#ef4444" />
      <circle cx="10" cy="16" r="3.2" fill="#3b82f6" />
      <circle cx="22" cy="16" r="3.2" fill="#3b82f6" />
      <circle cx="16" cy="22" r="3.2" fill="#ef4444" />
    </svg>
  );
}

function FormationSlot({
  pet,
  active,
  emptyLabel,
  roleClass,
  onClick,
  onDoubleClick,
  readOnly,
  canDrag,
  dragging,
  dragOver,
  onPointerDown,
  onPointerUp,
  onPointerMove,
  onPointerCancel,
  onPointerLeave,
  slotIndex,
  hidePetVisual,
  holding,
  locked,
}) {
  return (
    <div
      role="button"
      tabIndex={readOnly && !pet ? -1 : locked ? -1 : 0}
      data-bps-slot-index={locked ? undefined : slotIndex}
      className={[
        'bps-slot',
        roleClass,
        pet ? 'bps-slot--filled' : 'bps-slot--empty',
        active ? 'bps-slot--active' : '',
        readOnly ? 'bps-slot--readonly' : '',
        locked ? 'bps-slot--locked' : '',
        dragOver ? 'bps-slot--drag-over' : '',
        canDrag ? 'bps-slot--draggable' : '',
        dragging ? 'bps-slot--dragging' : '',
        hidePetVisual ? 'bps-slot--ghost-source' : '',
        holding ? 'bps-slot--holding' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={readOnly || locked ? undefined : onClick}
      onDoubleClick={readOnly || locked ? undefined : onDoubleClick}
      onKeyDown={
        readOnly || locked
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.(e);
              }
            }
      }
      onPointerDown={locked ? undefined : onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      aria-label={
        locked
          ? 'Ô đã khóa'
          : pet
            ? pet.name
            : emptyLabel || 'Thêm thú cưng'
      }
      aria-disabled={readOnly && !pet ? true : locked ? true : undefined}
    >
      {locked && !pet ? (
        <>
          <span className="bps-slot__lock" aria-hidden>
            🔒
          </span>
          <span className="bps-slot__hint">Khóa</span>
        </>
      ) : pet ? (
        <>
          <img
            src={petImageSrc(pet.image)}
            alt=""
            className="bps-slot__img"
            draggable={false}
          />
          <span className="bps-slot__lv">Lv.{pet.level ?? '?'}</span>
          <span className="bps-slot__name">{pet.name}</span>
        </>
      ) : (
        <>
          <span className="bps-slot__plus" aria-hidden>
            +
          </span>
          {emptyLabel ? <span className="bps-slot__hint">{emptyLabel}</span> : null}
        </>
      )}
      {holding ? <HoldRing /> : null}
    </div>
  );
}

function BattlePetSelectPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user, isLoading, updateUserData } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  const prep = location.state || {};
  const battleMode = normalizeMode(prep.battleMode);
  const slotCount = MODE_SLOT_COUNT[battleMode] || 1;
  const maxDeployCount = MODE_DEPLOY_LIMIT[battleMode] || slotCount;
  const battleSource = prep.battleSource || 'arena';
  const canViewEnemyInfo =
    prep.canViewEnemyInfo != null
      ? Boolean(prep.canViewEnemyInfo)
      : !ENEMY_INFO_HIDDEN_SOURCES.has(String(battleSource).toLowerCase());
  const returnPath = prep.returnPath || '/battle/arena';
  const huntingMapId = prep.huntingMapId ?? prep.enemy?.mapId ?? null;
  const bossLevel = prep.bossLevel ?? prep.enemy?.level;
  const enemyFormation = Array.isArray(prep.enemyFormation)
    ? prep.enemyFormation
    : Array.isArray(prep.enemy?.formation)
      ? prep.enemy.formation
      : [];
  const enemyFormationId = normalizeFormationId(
    prep.enemyFormationId || prep.enemy?.formationId || '3-2'
  );

  const [enemy, setEnemy] = useState(prep.enemy || null);
  const [enemyDetail, setEnemyDetail] = useState(null);
  const [userPets, setUserPets] = useState([]);
  const [slots, setSlots] = useState(() => Array(slotCount).fill(null));
  const [activeSlot, setActiveSlot] = useState(null);
  const [mobileSide, setMobileSide] = useState('player'); // 'player' | 'enemy'
  const [loading, setLoading] = useState(true);
  const [matchStarting, setMatchStarting] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const [focusedRosterPetKey, setFocusedRosterPetKey] = useState(null);
  const [fleeConfirmOpen, setFleeConfirmOpen] = useState(false);
  const [dupHint, setDupHint] = useState('');
  const [formationId, setFormationId] = useState(() =>
    normalizeFormationId(prep.formationId || '3-2')
  );
  const [formationModalOpen, setFormationModalOpen] = useState(false);
  const [formationDraft, setFormationDraft] = useState(() =>
    normalizeFormationId(prep.formationId || '3-2')
  );
  const [formationView, setFormationView] = useState('list'); // 'list' | 'enhance'
  const [enhanceFormationId, setEnhanceFormationId] = useState('3-2');
  const [enhanceTargetLevel, setEnhanceTargetLevel] = useState(FORMATION_MIN_LEVEL + 1);
  const [formationLevels, setFormationLevels] = useState(() => defaultFormationLevels());
  const [enhanceBusy, setEnhanceBusy] = useState(false);
  const [dragFromIndex, setDragFromIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragGhost, setDragGhost] = useState(null); // { pet, x, y }
  const [holdUi, setHoldUi] = useState(null); // { type: 'slot'|'roster', key }
  const [petInfoOpen, setPetInfoOpen] = useState(false);
  const [petInfoLoading, setPetInfoLoading] = useState(false);
  const [petInfoDetail, setPetInfoDetail] = useState(null);
  const [petInfoItems, setPetInfoItems] = useState([]);
  const [petInfoSpirits, setPetInfoSpirits] = useState([]);
  const [petInfoError, setPetInfoError] = useState('');

  const isHunting = battleSource === 'hunting';
  const isChampion = battleSource === 'champion';
  const enemyName = enemy?.name || 'Boss';
  const isMulti = battleMode !== '1v1';
  const clickTimerRef = React.useRef(null);
  const pointerDragRef = React.useRef({
    active: false,
    dragging: false,
    from: null,
    moved: false,
    suppressClick: false,
    pointerId: null,
    startX: 0,
    startY: 0,
  });
  const holdTimerRef = React.useRef(null);
  const holdShowTimerRef = React.useRef(null);
  const rosterPointerRef = React.useRef({
    active: false,
    petKey: null,
    suppressClick: false,
    startX: 0,
    startY: 0,
  });
  const enemyHoldRef = React.useRef({
    active: false,
    startX: 0,
    startY: 0,
  });
  const rosterSectionRef = useRef(null);
  const dragOverIndexRef = React.useRef(null);
  const slotsRef = React.useRef(slots);
  slotsRef.current = slots;
  const formation = getFormation(formationId);
  const lineIndices = useMemo(() => getLineIndices(formationId), [formationId]);
  const enemyLineIndices = useMemo(
    () => getLineIndices(enemyFormationId),
    [enemyFormationId]
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login');
  }, [isLoading, user, navigate]);

  useEffect(() => {
    setSlots(Array(slotCount).fill(null));
    setActiveSlot(null);
  }, [slotCount]);

  useEffect(() => {
    if (!user?.token || !user?.userId) return;
    if (!prep.enemy?.id && !prep.enemyId) {
      setLoading(false);
      setErrorModal('Thiếu thông tin đối thủ. Quay lại và chọn lại.');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let enemyData = prep.enemy;
        if (
          !enemyData?.final_stats &&
          (prep.enemyId || prep.enemy?.id) &&
          !prep.enemy?.isChampionNpc &&
          !String(prep.enemyId || prep.enemy?.id || '').startsWith('champion-')
        ) {
          const id = prep.enemyId || prep.enemy.id;
          const encounterLv = Number(bossLevel);
          const scaleByLevel =
            prep.enemy?.statsScaled === true ||
            (battleSource === 'hunting' && Number.isFinite(encounterLv) && encounterLv > 0);
          const qs =
            scaleByLevel && Number.isFinite(encounterLv) && encounterLv > 0
              ? `?level=${encounterLv}`
              : '';
          const res = await fetch(`${API_BASE_URL}/api/bosses/${id}${qs}`);
          if (res.ok) {
            enemyData = { ...(prep.enemy || {}), ...(await res.json()), isBoss: true };
          }
        }
        if (!cancelled && enemyData) {
          setEnemy(enemyData);
          setEnemyDetail(enemyData);
        }

        const petsRes = await fetch(`${API_BASE_URL}/users/${user.userId}/pets`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (petsRes.ok) {
          const json = await petsRes.json();
          if (!cancelled) setUserPets(asOwnedList(json, 'pets'));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setErrorModal('Không tải được dữ liệu trận đấu.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    API_BASE_URL,
    user?.token,
    user?.userId,
    prep.enemy,
    prep.enemyId,
    bossLevel,
    battleSource,
  ]);

  const selectablePets = useMemo(
    () => userPets.filter((p) => petCurrentHp(p) > 0),
    [userPets]
  );

  const selectedIds = useMemo(
    () => new Set(slots.filter(Boolean).map((p) => petKeyOf(p))),
    [slots]
  );

  const selectedSpecies = useMemo(() => {
    const set = new Set();
    slots.forEach((p) => {
      const sk = petSpeciesKey(p);
      if (sk) set.add(sk);
    });
    return set;
  }, [slots]);

  /** Pet đã xếp vào formation thì ẩn; cùng species vẫn hiện để user thấy lý do không chọn được */
  const rosterPets = useMemo(
    () => selectablePets.filter((p) => !selectedIds.has(petKeyOf(p))),
    [selectablePets, selectedIds]
  );

  /** Gỡ pet trùng species còn sót trong đội (giữ ô đầu tiên). */
  useEffect(() => {
    setSlots((prev) => {
      const seen = new Set();
      let changed = false;
      const next = prev.map((p) => {
        if (!p) return null;
        const sk = petSpeciesKey(p);
        if (!sk) return p;
        if (seen.has(sk)) {
          changed = true;
          return null;
        }
        seen.add(sk);
        return p;
      });
      return changed ? next : prev;
    });
  }, [userPets]);

  const filledCount = slots.filter(Boolean).length;
  const canStart = filledCount >= 1;
  const atDeployCap = filledCount >= maxDeployCount;

  const playerSideLabel = useMemo(
    () => getDisplayName(user, user?.username || user?.effectiveName || 'Bạn'),
    [user]
  );

  const enemySideLabel = useMemo(() => {
    if (!enemy) return '';
    // Boss / NPC: không hiện tên. PvP: tên hiển thị hoặc username.
    if (enemy.isBoss || enemy.isChampionNpc) return '';
    return getDisplayName(enemy, enemy.username || enemy.name || '');
  }, [enemy]);

  const isPlayerSlotLocked = useCallback(
    (index) => {
      if (battleMode === '1v1') return false;
      if (slots[index]) return false;
      return filledCount >= maxDeployCount;
    },
    [battleMode, slots, filledCount, maxDeployCount]
  );

  const speedTotal = useMemo(
    () => slots.reduce((sum, p) => sum + (p ? petSpd(p) : 0), 0),
    [slots]
  );

  const enemyStats = enemyDetail || enemy;
  const enemySpd = enemyStats?.final_stats?.spd ?? enemyStats?.spd ?? 0;

  const enemySpeedTotal = useMemo(() => {
    if (enemyFormation.length > 0) {
      return enemyFormation.reduce((sum, p) => sum + petSpd(p), 0);
    }
    return Number(enemySpd) || 0;
  }, [enemyFormation, enemySpd]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const clearSlot = useCallback((index) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const clearAllSlots = useCallback(() => {
    setSlots(Array(slotCount).fill(null));
    setActiveSlot(null);
    setFocusedRosterPetKey(null);
    setDupHint('');
  }, [slotCount]);

  const scrollRosterIntoViewIfNeeded = useCallback(() => {
    const roster = rosterSectionRef.current;
    if (!roster) return;
    const scroller = getScrollParent(roster);
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (maxScroll <= 0) return;
    const nearBottom = scroller.scrollTop >= maxScroll - 32;
    if (nearBottom) return;
    scroller.scrollTo({ top: maxScroll, behavior: 'smooth' });
  }, []);

  const clearHoldUi = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdShowTimerRef.current) {
      clearTimeout(holdShowTimerRef.current);
      holdShowTimerRef.current = null;
    }
    setHoldUi(null);
  }, []);

  const openPetInfoModal = useCallback(
    async (pet) => {
      if (!pet) return;
      setPetInfoOpen(true);
      setPetInfoError('');
      setPetInfoDetail(pet);
      setPetInfoItems([]);
      setPetInfoSpirits([]);

      // Boss / NPC / formation snapshot — không có pet id của user
      if (!pet.id && !pet.uuid) {
        setPetInfoLoading(false);
        return;
      }

      setPetInfoLoading(true);
      try {
        const headers = user?.token
          ? { Authorization: `Bearer ${user.token}` }
          : undefined;
        const tasks = [
          fetch(`${API_BASE_URL}/api/pets/${pet.id}/equipment`, { headers }),
          fetch(`${API_BASE_URL}/api/pets/${pet.id}/spirits`, { headers }),
        ];
        if (pet.uuid) {
          tasks.push(fetch(`${API_BASE_URL}/api/pets/${pet.uuid}`, { headers }));
        }
        const results = await Promise.all(tasks);
        const eqJson = results[0].ok ? await results[0].json() : [];
        const spJson = results[1].ok ? await results[1].json() : [];
        let detail = pet;
        if (pet.uuid && results[2]?.ok) {
          detail = { ...pet, ...(await results[2].json()) };
        }
        setPetInfoDetail(detail);
        setPetInfoItems(Array.isArray(eqJson) ? eqJson : []);
        setPetInfoSpirits(Array.isArray(spJson) ? spJson : []);
      } catch (err) {
        console.error(err);
        setPetInfoError('Không tải được thông tin thú cưng.');
      } finally {
        setPetInfoLoading(false);
      }
    },
    [API_BASE_URL, user?.token]
  );

  const beginHoldTimers = useCallback(
    ({ type, key, getPet, onOpen }) => {
      clearHoldUi();
      holdShowTimerRef.current = setTimeout(() => {
        setHoldUi({ type, key });
      }, HOLD_RING_DELAY_MS);
      holdTimerRef.current = setTimeout(() => {
        const pet = getPet();
        clearHoldUi();
        if (onOpen) onOpen();
        if (pet) void openPetInfoModal(pet);
      }, HOLD_OPEN_MS);
    },
    [clearHoldUi, openPetInfoModal]
  );

  const assignPetToSlot = useCallback((pet, index) => {
    const petKey = petKeyOf(pet);
    const speciesKey = petSpeciesKey(pet);
    setSlots((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((p) => petKeyOf(p) === petKey);
      if (existingIdx >= 0 && existingIdx !== index) {
        next[existingIdx] = null;
      }

      if (speciesKey) {
        const speciesDupIdx = next.findIndex(
          (p, i) => i !== index && petSpeciesKey(p) === speciesKey
        );
        if (speciesDupIdx >= 0) {
          setDupHint('Không thể chọn 2 thú cùng chủng loại trong một đội hình.');
          return prev;
        }
      }

      const filled = next.filter(Boolean).length;
      const placingIntoEmpty = !next[index];
      if (placingIntoEmpty && filled >= maxDeployCount) {
        setDupHint(
          battleMode === '3v3'
            ? `3v3 chỉ được xếp tối đa ${maxDeployCount} thú. Double-click ô để gỡ thú.`
            : `Đội đã đủ tối đa ${maxDeployCount} thú. Double-click ô để gỡ thú.`
        );
        return prev;
      }

      setDupHint('');
      next[index] = pet;

      queueMicrotask(() => {
        const afterFilled = next.filter(Boolean).length;
        for (let i = 0; i < next.length; i++) {
          const j = (index + 1 + i) % next.length;
          if (!next[j] && afterFilled < maxDeployCount) {
            setActiveSlot(j);
            return;
          }
        }
        setActiveSlot(index);
      });

      return next;
    });
    setFocusedRosterPetKey(petKey);
  }, [battleMode, maxDeployCount]);

  const swapSlots = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    if (!Number.isFinite(fromIndex) || !Number.isFinite(toIndex)) return;
    setSlots((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const tmp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = tmp;
      return next;
    });
    setActiveSlot(toIndex);
    setDupHint('');
  }, []);

  /** Click 1 lần = chọn ô; double-click ô có pet = gỡ. */
  const handleSlotClick = (index) => {
    if (pointerDragRef.current.suppressClick) {
      pointerDragRef.current.suppressClick = false;
      return;
    }
    if (isPlayerSlotLocked(index)) {
      setDupHint(
        battleMode === '3v3'
          ? `3v3 chỉ xếp tối đa ${maxDeployCount} thú — ô trống đã bị khóa.`
          : `Đã đủ ${maxDeployCount} thú — ô trống đã bị khóa.`
      );
      return;
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setActiveSlot(index);
      const pet = slots[index];
      if (pet) {
        setFocusedRosterPetKey(petKeyOf(pet));
      } else {
        scrollRosterIntoViewIfNeeded();
      }
      setDupHint('');
    }, 220);
  };

  const handleSlotDoubleClick = (index) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (!slots[index]) {
      setActiveSlot(index);
      scrollRosterIntoViewIfNeeded();
      return;
    }
    clearSlot(index);
    setActiveSlot(index);
    setFocusedRosterPetKey(null);
    setDupHint('');
  };

  const handleSlotPointerDown = (index, e) => {
    if (!slots[index]) return;
    if (e.button != null && e.button !== 0) return;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    pointerDragRef.current = {
      active: true,
      dragging: false,
      from: index,
      moved: false,
      suppressClick: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    setDragFromIndex(null);
    setDragOverIndex(index);
    setDragGhost(null);

    beginHoldTimers({
      type: 'slot',
      key: String(index),
      getPet: () => slotsRef.current[index],
      onOpen: () => {
        const drag = pointerDragRef.current;
        drag.active = false;
        drag.suppressClick = true;
        setDragFromIndex(null);
        setDragOverIndex(null);
        setDragGhost(null);
      },
    });
  };

  const finishPointerDrag = useCallback(
    (toIndex) => {
      const drag = pointerDragRef.current;
      if (!drag.active && !drag.dragging) {
        clearHoldUi();
        return;
      }
      const fromIndex = drag.from;
      const wasDragging = drag.dragging;
      const didMove =
        wasDragging &&
        (drag.moved || (toIndex != null && fromIndex != null && toIndex !== fromIndex));
      clearHoldUi();
      pointerDragRef.current = {
        active: false,
        dragging: false,
        from: null,
        moved: false,
        suppressClick: didMove || drag.suppressClick,
        pointerId: null,
        startX: 0,
        startY: 0,
      };
      setDragFromIndex(null);
      setDragOverIndex(null);
      setDragGhost(null);
      if (didMove && fromIndex != null && toIndex != null && fromIndex !== toIndex) {
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        swapSlots(fromIndex, toIndex);
      }
    },
    [swapSlots, clearHoldUi]
  );

  useEffect(() => {
    const onMove = (e) => {
      const drag = pointerDragRef.current;
      if (!drag.active) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dist2 = dx * dx + dy * dy;

      if (!drag.dragging && dist2 >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        // Bắt đầu drag → hủy hold / modal
        clearHoldUi();
        drag.dragging = true;
        drag.moved = true;
        setDragFromIndex(drag.from);
      }

      if (!drag.dragging) return;

      drag.moved = true;
      const pet = slotsRef.current[drag.from];
      if (pet) {
        setDragGhost({
          pet,
          x: e.clientX,
          y: e.clientY,
        });
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = el?.closest?.('[data-bps-slot-index]');
      if (!slotEl) return;
      const idx = Number(slotEl.getAttribute('data-bps-slot-index'));
      if (!Number.isFinite(idx)) return;
      setDragOverIndex((prev) => (prev === idx ? prev : idx));
    };
    const onUp = () => {
      const drag = pointerDragRef.current;
      if (!drag.active && !drag.dragging) return;
      finishPointerDrag(dragOverIndexRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [finishPointerDrag, clearHoldUi]);

  dragOverIndexRef.current = dragOverIndex;

  const openFormationModal = () => {
    setFormationDraft(formationId);
    setFormationView('list');
    setFormationModalOpen(true);
  };

  const closeFormationModal = () => {
    setFormationModalOpen(false);
    setFormationView('list');
  };

  const confirmFormationSelect = () => {
    if (formationView === 'enhance') {
      setFormationView('list');
      return;
    }
    setFormationId(normalizeFormationId(formationDraft));
    closeFormationModal();
  };

  const openEnhanceView = (id, e) => {
    e?.stopPropagation?.();
    const fid = normalizeFormationId(id);
    const cur = formationLevels[fid] || FORMATION_MIN_LEVEL;
    setEnhanceFormationId(fid);
    setEnhanceTargetLevel(Math.min(FORMATION_MAX_LEVEL, cur + 1));
    setFormationDraft(fid);
    setFormationView('enhance');
  };

  const enhanceCurrentLevel = formationLevels[enhanceFormationId] || FORMATION_MIN_LEVEL;
  const enhanceCost = costEnhanceRange(enhanceCurrentLevel, enhanceTargetLevel);
  const enhanceAtMax = enhanceCurrentLevel >= FORMATION_MAX_LEVEL;
  const petaBalance = Number(user?.peta) || 0;

  const runEnhance = async () => {
    if (enhanceBusy || enhanceAtMax || enhanceTargetLevel <= enhanceCurrentLevel) return;
    if (petaBalance < enhanceCost) {
      setErrorModal(`Không đủ Peta. Cần ${enhanceCost.toLocaleString('vi-VN')} Peta.`);
      return;
    }
    setEnhanceBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/formations/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          formationId: enhanceFormationId,
          targetLevel: enhanceTargetLevel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorModal(data.message || 'Không nâng cấp được đội hình.');
        return;
      }
      const nextLevels = normalizeLevelsMap(data.levels);
      setFormationLevels(nextLevels);
      if (typeof data.petaRemaining === 'number') {
        updateUserData?.({ peta: data.petaRemaining });
      }
      const newLv = nextLevels[enhanceFormationId] || enhanceTargetLevel;
      setEnhanceTargetLevel(Math.min(FORMATION_MAX_LEVEL, newLv + 1));
    } catch (err) {
      setErrorModal(err.message || 'Lỗi kết nối khi nâng cấp.');
    } finally {
      setEnhanceBusy(false);
    }
  };

  useEffect(() => {
    if (!user?.token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/formations/me`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setFormationLevels(normalizeLevelsMap(data.levels));
      } catch (err) {
        console.error('Load formation levels', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, user?.token]);

  const handleRosterPetClick = (pet) => {
    if (rosterPointerRef.current.suppressClick) {
      rosterPointerRef.current.suppressClick = false;
      return;
    }
    const petKey = petKeyOf(pet);
    setFocusedRosterPetKey(petKey);

    const speciesKey = petSpeciesKey(pet);
    if (speciesKey && selectedSpecies.has(speciesKey)) {
      setDupHint('Không thể chọn 2 thú cùng chủng loại trong một đội hình.');
      return;
    }

    let target = activeSlot;
    if (target == null || slots[target] || isPlayerSlotLocked(target)) {
      const empty = slots.findIndex((p, i) => !p && !isPlayerSlotLocked(i));
      if (empty >= 0) target = empty;
      else {
        setDupHint(
          isMulti
            ? battleMode === '3v3'
              ? `3v3 chỉ được xếp tối đa ${maxDeployCount} thú. Double-click ô để gỡ thú.`
              : `Đội đã đủ tối đa ${maxDeployCount} thú. Double-click ô để gỡ thú.`
            : 'Đã chọn thú cưng. Double-click ô để gỡ rồi chọn lại.'
        );
        return;
      }
    }
    if (battleMode === '1v1') target = 0;
    assignPetToSlot(pet, target);
  };

  const handleRosterPointerDown = (pet, e) => {
    if (e.button != null && e.button !== 0) return;
    const petKey = petKeyOf(pet);
    rosterPointerRef.current = {
      active: true,
      petKey,
      suppressClick: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    beginHoldTimers({
      type: 'roster',
      key: petKey,
      getPet: () => pet,
      onOpen: () => {
        rosterPointerRef.current.active = false;
        rosterPointerRef.current.suppressClick = true;
      },
    });
  };

  const handleRosterPointerUp = () => {
    if (!rosterPointerRef.current.active) return;
    rosterPointerRef.current.active = false;
    // Nếu chưa mở info thì hủy vòng hold; click vẫn xử lý qua onClick
    if (!rosterPointerRef.current.suppressClick) {
      clearHoldUi();
    }
  };

  const handleRosterPointerMove = (e) => {
    const rp = rosterPointerRef.current;
    if (!rp.active) return;
    const dx = e.clientX - rp.startX;
    const dy = e.clientY - rp.startY;
    if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      rp.active = false;
      clearHoldUi();
    }
  };

  const handleEnemySlotPointerDown = (index, pet, e) => {
    if (!canViewEnemyInfo || !pet) return;
    if (e.button != null && e.button !== 0) return;
    enemyHoldRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
    };
    beginHoldTimers({
      type: 'slot',
      key: `enemy-${index}`,
      getPet: () => pet,
      onOpen: () => {
        enemyHoldRef.current.active = false;
      },
    });
  };

  const handleEnemySlotPointerUp = () => {
    if (!enemyHoldRef.current.active) return;
    enemyHoldRef.current.active = false;
    clearHoldUi();
  };

  const handleEnemySlotPointerMove = (e) => {
    const ep = enemyHoldRef.current;
    if (!ep.active) return;
    const dx = e.clientX - ep.startX;
    const dy = e.clientY - ep.startY;
    if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      ep.active = false;
      clearHoldUi();
    }
  };

  const leaveToReturnPath = () => {
    navigate(
      returnPath ||
        (isHunting ? '/hunting-world' : isChampion ? '/battle/champion' : '/battle')
    );
  };

  /** Arena: quay lại danh sách. Hunting: mở confirm bỏ chạy. */
  const handleBackClick = () => {
    if (isHunting) {
      setFleeConfirmOpen(true);
      return;
    }
    leaveToReturnPath();
  };

  const confirmFlee = () => {
    setFleeConfirmOpen(false);
    leaveToReturnPath();
  };

  const buildBattleTeams = () => {
    const playerTeam = slots
      .map((p, slotIndex) =>
        p
          ? {
              id: p.id,
              uuid: p.uuid,
              name: p.name,
              image: p.image,
              level: p.level,
              slotIndex,
              current_hp: p.current_hp ?? p.final_stats?.hp ?? p.hp ?? 0,
              final_stats: p.final_stats || {
                hp: p.hp,
                str: p.str,
                def: p.def,
                spd: p.spd,
              },
              spd: p.final_stats?.spd ?? p.spd ?? 0,
              side: 'player',
            }
          : null
      )
      .filter(Boolean);

    const enemyTeam =
      enemyFormation.length > 0
        ? enemyFormation.map((fp, slotIndex) => {
            const fs = fp.final_stats || {};
            const maxHp = fp.hp ?? fs.hp ?? enemy?.final_stats?.hp ?? enemy?.hp ?? 1;
            return {
              id: fp.slotKey || `enemy-${slotIndex}`,
              name: fp.name,
              image: fp.image,
              level: fp.level,
              slotIndex,
              current_hp: maxHp,
              final_stats: {
                hp: maxHp,
                str: fp.str ?? fs.str,
                def: fp.def ?? fs.def,
                spd: fp.spd ?? fs.spd,
              },
              spd: fp.spd ?? fs.spd ?? 0,
              skills: Array.isArray(fp.skills) ? fp.skills : undefined,
              action_pattern: Array.isArray(fp.action_pattern) ? fp.action_pattern : undefined,
              side: 'enemy',
            };
          })
        : [
            {
              id: enemy?.id || 'enemy-0',
              name: enemy?.name,
              image: enemy?.image,
              level: enemy?.level,
              slotIndex: 0,
              current_hp: enemy?.current_hp ?? enemy?.final_stats?.hp ?? enemy?.hp ?? 0,
              final_stats: enemy?.final_stats,
              spd: enemy?.final_stats?.spd ?? enemy?.spd ?? 0,
              skills: Array.isArray(enemy?.skills) ? enemy.skills : undefined,
              action_pattern: Array.isArray(enemy?.action_pattern) ? enemy.action_pattern : undefined,
              side: 'enemy',
            },
          ];

    return { playerTeam, enemyTeam };
  };

  const startMatchAndNavigate = async () => {
    const lead = slots.find(Boolean);
    if (!user?.token || !lead?.id || !enemy?.id) return;

    const speciesSeen = new Set();
    for (const p of slots.filter(Boolean)) {
      const sk = petSpeciesKey(p);
      if (!sk) continue;
      if (speciesSeen.has(sk)) {
        setErrorModal('Đội hình đang có 2 thú cùng loài. Hãy gỡ bớt trước khi bắt đầu.');
        return;
      }
      speciesSeen.add(sk);
    }

    setMatchStarting(true);
    setErrorModal('');
    try {
      const { playerTeam, enemyTeam } = buildBattleTeams();
      const formationPetIds = slots.filter(Boolean).map((p) => p.id);
      const meta = {
        battleSource,
        returnPath,
        huntingMapId: huntingMapId ?? null,
      };

      // Champion 3v3/5v5: combat local theo đội hình — không Redis / không Arena boss
      if (isChampion) {
        try {
          sessionStorage.setItem('petaria-arena-battle-return', JSON.stringify(meta));
        } catch {
          /* ignore */
        }
        const leadPet = {
          ...lead,
          current_hp: lead.current_hp ?? lead.final_stats?.hp ?? lead.hp,
          current_def_dmg: 0,
        };
        navigate('/battle/match', {
          state: {
            playerPet: leadPet,
            enemyPet: {
              ...enemy,
              name: enemy.name,
              image: enemy.image,
              level: enemy.level,
              isChampionNpc: true,
              current_hp: enemyTeam.reduce((s, u) => s + (Number(u.current_hp) || 0), 0),
              final_stats: {
                hp: enemyTeam.reduce((s, u) => s + (Number(u.final_stats?.hp) || 0), 0),
                str: 1,
                def: 1,
                spd: enemyTeam.reduce((s, u) => s + (Number(u.spd) || 0), 0),
              },
              current_def_dmg: 0,
            },
            useRedisMatch: false,
            battleSource: 'champion',
            returnPath: returnPath || '/battle/champion',
            battleMode,
            formationId,
            enemyFormationId,
            playerTeam,
            enemyTeam,
            formationPetIds,
          },
        });
        return;
      }

      const body = {
        petId: lead.id,
        bossId: enemy.id,
        battleSource,
        returnPath,
      };
      if (battleSource === 'hunting') {
        const lv = Number(bossLevel);
        if (Number.isFinite(lv) && lv > 0) body.bossLevel = lv;
        if (huntingMapId != null) body.huntingMapId = huntingMapId;
      }
      if (formationPetIds.length > 1) body.petIds = formationPetIds;

      const res = await fetch(`${API_BASE_URL}/api/arena/match/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      const goBattle = (match) => {
        const matchMeta = {
          battleSource: match.battleSource || battleSource,
          returnPath: match.returnPath || returnPath,
          huntingMapId: match.huntingMapId ?? huntingMapId ?? null,
        };
        try {
          sessionStorage.setItem('petaria-arena-battle-return', JSON.stringify(matchMeta));
        } catch {
          /* ignore */
        }

        navigate('/battle/match', {
          state: {
            matchState: match,
            playerPet: match.player,
            enemyPet: match.enemy,
            useRedisMatch: true,
            battleSource: matchMeta.battleSource,
            returnPath: matchMeta.returnPath,
            huntingMapId: matchMeta.huntingMapId,
            fromHunting: matchMeta.battleSource === 'hunting',
            battleMode,
            formationId,
            enemyFormationId,
            playerTeam,
            enemyTeam,
            formationPetIds,
          },
        });
      };

      if (res.ok) {
        goBattle(data);
        return;
      }
      if (res.status === 400 && data.code === 'ACTIVE_MATCH' && data.match) {
        goBattle(data.match);
        return;
      }
      setErrorModal(data.message || 'Không thể bắt đầu trận đấu.');
    } catch (err) {
      setErrorModal(err.message || 'Lỗi kết nối.');
    } finally {
      setMatchStarting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="bps-page">
          <div className="bps-loading">Đang tải đội hình...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="bps-page">
          <div className="bps-loading">Vui lòng đăng nhập</div>
        </div>
      </TemplatePage>
    );
  }

  const modeLabel = battleMode === '1v1' ? '1 vs 1' : battleMode === '3v3' ? '3 vs 3' : '5 vs 5';

  const renderSlot = (side, index, pet, { readOnly = false } = {}) => {
    const line =
      battleMode === '1v1'
        ? 'center'
        : side === 'player'
          ? index < formation.back
            ? 'back'
            : 'front'
          : index < getFormation(enemyFormationId).back
            ? 'back'
            : 'front';
    // Visual line class: player back=left, enemy front shows on left column
    const lineClass =
      line === 'center'
        ? 'bps-slot--center'
        : line === 'back'
          ? 'bps-slot--back'
          : 'bps-slot--front';
    const locked = !readOnly && side === 'player' && isPlayerSlotLocked(index);
    const holdKey = side === 'enemy' ? `enemy-${index}` : String(index);
    const isHolding =
      Boolean(pet) &&
      holdUi?.type === 'slot' &&
      holdUi.key === holdKey &&
      (side === 'player' || canViewEnemyInfo);
    const enemyHoldHandlers =
      readOnly && canViewEnemyInfo && pet
        ? {
            onPointerDown: (e) => handleEnemySlotPointerDown(index, pet, e),
            onPointerUp: handleEnemySlotPointerUp,
            onPointerCancel: handleEnemySlotPointerUp,
            onPointerLeave: handleEnemySlotPointerUp,
            onPointerMove: handleEnemySlotPointerMove,
          }
        : {};

    return (
      <FormationSlot
        key={`${side}-${index}`}
        slotIndex={readOnly || locked ? undefined : index}
        pet={pet}
        active={
          !readOnly &&
          !locked &&
          activeSlot === index &&
          !(dragFromIndex === index && Boolean(dragGhost)) &&
          !isHolding
        }
        roleClass={`${lineClass} bps-slot--i${index}`}
        emptyLabel={battleMode === '1v1' && !readOnly ? 'Chọn thú cưng' : ''}
        readOnly={readOnly}
        locked={locked}
        onClick={readOnly || locked ? undefined : () => handleSlotClick(index)}
        onDoubleClick={readOnly || locked ? undefined : () => handleSlotDoubleClick(index)}
        canDrag={!readOnly && !locked && Boolean(pet)}
        dragging={!readOnly && dragFromIndex === index}
        hidePetVisual={
          !readOnly && dragFromIndex === index && Boolean(dragGhost)
        }
        dragOver={
          !readOnly &&
          !locked &&
          dragOverIndex === index &&
          dragFromIndex !== index
        }
        holding={isHolding}
        onPointerDown={
          readOnly || locked
            ? enemyHoldHandlers.onPointerDown
            : (e) => handleSlotPointerDown(index, e)
        }
        onPointerUp={enemyHoldHandlers.onPointerUp}
        onPointerMove={enemyHoldHandlers.onPointerMove}
        onPointerCancel={enemyHoldHandlers.onPointerCancel}
        onPointerLeave={enemyHoldHandlers.onPointerLeave}
      />
    );
  };

  const renderLine = (side, lineName, indices, petsByIndex, readOnly) => (
    <div
      className={`bps-line bps-line--${lineName} bps-line--count-${indices.length}`}
      data-line={lineName}
    >
      {indices.map((i) => renderSlot(side, i, petsByIndex[i] || null, { readOnly }))}
    </div>
  );

  const renderPlayerSlots = () => {
    if (battleMode === '1v1') {
      return (
        <div className="bps-board bps-board--single bps-board--player">
          {renderSlot('player', 0, slots[0])}
        </div>
      );
    }
    return (
      <div className="bps-board-wrap">
        <div
          className={`bps-board bps-board--player bps-board--f${formationId}`}
          data-formation={formationId}
        >
          {renderLine('player', 'back', lineIndices.back, slots, false)}
          {renderLine('player', 'front', lineIndices.front, slots, false)}
        </div>
        <button
          type="button"
          className="bps-formation-orb"
          onClick={openFormationModal}
          title={`Đội hình: ${formation.name}`}
          aria-label={`Chọn đội hình (hiện tại ${formation.label})`}
        >
          <FormationOrbIcon />
          <span className="bps-formation-orb__label">{formation.label}</span>
        </button>
      </div>
    );
  };

  const renderEnemySlots = () => {
    const formationPets =
      enemyFormation.length > 0
        ? enemyFormation
        : enemy
          ? [
              {
                name: enemy.name,
                image: enemy.image,
                level: enemy.level,
                spd: enemy.final_stats?.spd ?? enemy.spd,
                final_stats: enemy.final_stats,
              },
            ]
          : [];

    const petsByIndex = Array.from({ length: slotCount }, (_, i) => {
      const fp = formationPets[i] || null;
      if (!fp) return null;
      const fs = fp.final_stats || {};
      // 1v1 / single boss: bổ sung stats từ enemy detail nếu formation pet thiếu
      const bossFs =
        formationPets.length <= 1 && enemyStats?.final_stats
          ? enemyStats.final_stats
          : null;
      return {
        name: fp.name || enemyStats?.name,
        image: fp.image || enemyStats?.image,
        level: fp.level ?? enemyStats?.level,
        spd: fp.spd ?? fs.spd ?? bossFs?.spd ?? enemyStats?.spd,
        hp: fp.hp ?? fs.hp ?? bossFs?.hp ?? enemyStats?.hp,
        str: fp.str ?? fs.str ?? bossFs?.str ?? enemyStats?.str,
        def: fp.def ?? fs.def ?? bossFs?.def ?? enemyStats?.def,
        final_stats: {
          hp: fp.hp ?? fs.hp ?? bossFs?.hp ?? enemyStats?.hp,
          str: fp.str ?? fs.str ?? bossFs?.str ?? enemyStats?.str,
          def: fp.def ?? fs.def ?? bossFs?.def ?? enemyStats?.def,
          spd: fp.spd ?? fs.spd ?? bossFs?.spd ?? enemyStats?.spd,
        },
      };
    });

    if (battleMode === '1v1') {
      return (
        <div className="bps-board bps-board--single bps-board--enemy">
          {renderSlot('enemy', 0, petsByIndex[0], { readOnly: true })}
        </div>
      );
    }

    const eLines = enemyLineIndices;
    return (
      <div
        className={`bps-board bps-board--enemy bps-board--f${enemyFormationId}`}
        data-formation={enemyFormationId}
      >
        {/* Enemy mirrored: Front trái | Back phải */}
        {renderLine('enemy', 'front', eLines.front, petsByIndex, true)}
        {renderLine('enemy', 'back', eLines.back, petsByIndex, true)}
      </div>
    );
  };

  const SpeedBadge = ({ value, title }) => (
    <div className="bps-speed-total" title={title}>
      <img
        className="arena-speed-icon"
        src="/images/icons/speed.png"
        alt=""
        aria-hidden="true"
      />
      <span className="bps-speed-total__value">{value}</span>
    </div>
  );

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className={`bps-page bps-page--${battleMode}`}>
        <header className="bps-header">
          <div className="bps-header__titles">
            <h1 className="bps-header__title">Chuẩn bị chiến đấu</h1>
            <p className="bps-header__mode">{modeLabel}</p>
          </div>
          <button
            type="button"
            className="bps-mobile-toggle"
            onClick={() =>
              setMobileSide((s) => (s === 'player' ? 'enemy' : 'player'))
            }
          >
            {mobileSide === 'player' ? 'Xem đối thủ' : 'Xem đội bạn'}
          </button>
        </header>

        <section className="bps-stage" aria-label="Đội hình">
          <div
            className={`bps-side bps-side--player bps-side--panel${
              mobileSide === 'player' ? ' bps-side--mobile-show' : ' bps-side--mobile-hide'
            }`}
          >
            <button
              type="button"
              className="bps-clear-slots"
              onClick={clearAllSlots}
              disabled={filledCount === 0}
              title="Gỡ hết thú khỏi đội hình"
              aria-label="Gỡ hết thú khỏi đội hình"
            >
              <ClearSlotsIcon />
            </button>
            <div className="bps-side__header">
              <div className="bps-side__label">{playerSideLabel}</div>
            </div>
            <div className="bps-side__speed-row">
              <SpeedBadge value={speedTotal} title="Tổng tốc độ đội hình" />
            </div>
            {isMulti ? (
              <div className="bps-line-legend" aria-hidden>
                <span>Back</span>
                <span>Front</span>
              </div>
            ) : null}
            {renderPlayerSlots()}
          </div>

          <div className="bps-stage__vs" aria-hidden>
            <span>VS</span>
          </div>

          <div
            className={`bps-side bps-side--enemy${
              mobileSide === 'enemy' ? ' bps-side--mobile-show' : ' bps-side--mobile-hide'
            }`}
          >
            <div className="bps-side__header">
              <div className="bps-side__label">{enemySideLabel || '\u00a0'}</div>
            </div>
            <div className="bps-side__speed-row">
              <SpeedBadge value={enemySpeedTotal} title="Tổng tốc độ đối thủ" />
            </div>
            {isMulti ? (
              <div className="bps-line-legend bps-line-legend--enemy" aria-hidden>
                <span>Front</span>
                <span>Back</span>
              </div>
            ) : null}
            {renderEnemySlots()}
          </div>
        </section>

        {dupHint ? <p className="bps-dup-hint">{dupHint}</p> : null}

        <section
          ref={rosterSectionRef}
          className="bps-roster"
          aria-label="Danh sách thú cưng"
        >
          <div className="bps-roster__head">
            <h2>Chọn thú cưng</h2>
            <span>
              {filledCount}/{maxDeployCount}
            </span>
          </div>
          {selectablePets.length === 0 ? (
            <p className="bps-roster__empty">
              {userPets.length > 0
                ? 'Tất cả thú cưng đã hết máu. Hãy chữa trị trước khi chiến đấu.'
                : 'Bạn chưa có thú cưng nào.'}
            </p>
          ) : rosterPets.length === 0 ? (
            <p className="bps-roster__empty">
              Tất cả thú khả chiến đã được xếp vào đội hình.
            </p>
          ) : (
            <div className="bps-roster__grid">
              {rosterPets.map((pet) => {
                const petKey = petKeyOf(pet);
                const speciesBlocked =
                  Boolean(petSpeciesKey(pet)) &&
                  selectedSpecies.has(petSpeciesKey(pet));
                const holding =
                  holdUi?.type === 'roster' && holdUi.key === petKey;
                return (
                  <button
                    type="button"
                    key={petKey}
                    className={`bps-pet-card${
                      focusedRosterPetKey === petKey ? ' bps-pet-card--focus' : ''
                    }${speciesBlocked ? ' bps-pet-card--species-blocked' : ''}${
                      holding ? ' bps-pet-card--holding' : ''
                    }`}
                    onClick={() => handleRosterPetClick(pet)}
                    onPointerDown={(e) => handleRosterPointerDown(pet, e)}
                    onPointerUp={handleRosterPointerUp}
                    onPointerCancel={handleRosterPointerUp}
                    onPointerMove={handleRosterPointerMove}
                    onPointerLeave={handleRosterPointerUp}
                  >
                    <img src={petImageSrc(pet.image)} alt={pet.name} />
                    <span className="bps-pet-card__lv">Lv.{pet.level}</span>
                    <span className="bps-pet-card__name">{pet.name}</span>
                    {holding ? <HoldRing /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <footer className="bps-footer">
          <button
            type="button"
            className={`bps-btn bps-btn--ghost${isHunting ? ' bps-btn--flee' : ''}`}
            onClick={handleBackClick}
          >
            {isHunting ? 'Bỏ chạy' : 'Quay lại'}
          </button>
          <button
            type="button"
            className="bps-btn bps-btn--primary"
            disabled={!canStart || matchStarting}
            onClick={() => void startMatchAndNavigate()}
          >
            {matchStarting ? 'Đang bắt đầu...' : 'Bắt đầu trận đấu'}
          </button>
        </footer>
      </div>

      <GameDialogModal
        isOpen={formationModalOpen}
        onClose={closeFormationModal}
        title={
          formationView === 'enhance'
            ? getFormation(enhanceFormationId).name
            : 'Formation'
        }
        mode={formationView === 'enhance' ? 'alert' : 'confirm'}
        tone="default"
        cancelLabel="Hủy"
        confirmLabel={formationView === 'enhance' ? 'Quay lại' : 'Chọn'}
        onCancel={closeFormationModal}
        onConfirm={
          formationView === 'enhance'
            ? () => setFormationView('list')
            : confirmFormationSelect
        }
        className="bps-formation-modal"
        contentClassName="bps-formation-modal__body"
      >
        {formationView === 'list' ? (
          <>
            <div className="bps-formation-grid">
              {FORMATION_ORDER.map((id) => {
                const f = FORMATIONS[id];
                const selected = formationDraft === id;
                const lv = formationLevels[id] || FORMATION_MIN_LEVEL;
                const atMax = lv >= FORMATION_MAX_LEVEL;
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    className={`bps-formation-card${
                      selected ? ' bps-formation-card--selected' : ''
                    }`}
                    onClick={() => setFormationDraft(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFormationDraft(id);
                      }
                    }}
                  >
                    {selected ? (
                      <span className="bps-formation-card__check" aria-hidden>
                        ✓
                      </span>
                    ) : null}
                    <span className="bps-formation-card__lv">Lv.{lv}</span>
                    <FormationDiagram formationId={id} />
                    <span className="bps-formation-card__name">{f.name}</span>
                    <FormationStatRows formationId={id} level={lv} />
                    {atMax ? (
                      <span className="bps-formation-card__max">Đã đạt cấp tối đa!</span>
                    ) : (
                      <button
                        type="button"
                        className="bps-formation-card__enhance"
                        onClick={(e) => openEnhanceView(id, e)}
                      >
                        Enhance
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="bps-formation-modal__hint">
              Số trên sơ đồ = thứ tự dùng skill khi SPD bằng nhau (Front dưới→trên,
              rồi Back dưới→trên).
            </p>
          </>
        ) : (
          <div className="bps-fenhance">
            <div className="bps-fenhance__level-row">
              <span className="bps-fenhance__lv-box">Lv. {enhanceCurrentLevel}</span>
              <span className="bps-fenhance__arrows" aria-hidden>
                ≫
              </span>
              <button
                type="button"
                className="bps-fenhance__step"
                disabled={enhanceAtMax || enhanceTargetLevel <= enhanceCurrentLevel + 1}
                onClick={() =>
                  setEnhanceTargetLevel((v) => Math.max(enhanceCurrentLevel + 1, v - 1))
                }
              >
                −
              </button>
              <span className="bps-fenhance__lv-box bps-fenhance__lv-box--target">
                Lv. {enhanceAtMax ? enhanceCurrentLevel : enhanceTargetLevel}
              </span>
              <button
                type="button"
                className="bps-fenhance__step"
                disabled={enhanceAtMax || enhanceTargetLevel >= FORMATION_MAX_LEVEL}
                onClick={() =>
                  setEnhanceTargetLevel((v) => Math.min(FORMATION_MAX_LEVEL, v + 1))
                }
              >
                +
              </button>
            </div>

            {(() => {
              const cur = getFormationBonusesAtLevel(enhanceFormationId, enhanceCurrentLevel);
              const next = getFormationBonusesAtLevel(
                enhanceFormationId,
                enhanceAtMax ? enhanceCurrentLevel : enhanceTargetLevel
              );
              return (
                <div className="bps-fenhance__stats">
                  <div className="bps-fstat__row bps-fenhance__stat-row">
                    <span className="bps-fstat__tag bps-fstat__tag--back">Back Row</span>
                    <span className="bps-fstat__text">
                      {cur.back.label} {formatPct(cur.back.each)}%
                      {!enhanceAtMax ? (
                        <>
                          {' '}
                          &gt;{' '}
                          <strong className="bps-fenhance__gain">
                            {formatPct(next.back.each)}%
                          </strong>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="bps-fstat__row bps-fenhance__stat-row">
                    <span className="bps-fstat__tag bps-fstat__tag--front">Front Row</span>
                    <span className="bps-fstat__text">
                      {cur.front.label} {formatPct(cur.front.each)}%
                      {!enhanceAtMax ? (
                        <>
                          {' '}
                          &gt;{' '}
                          <strong className="bps-fenhance__gain">
                            {formatPct(next.front.each)}%
                          </strong>
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>
              );
            })()}

            {enhanceAtMax ? (
              <p className="bps-fenhance__max">Đã đạt cấp tối đa!</p>
            ) : (
              <button
                type="button"
                className="bps-fenhance__btn"
                disabled={enhanceBusy || enhanceCost <= 0 || petaBalance < enhanceCost}
                onClick={() => void runEnhance()}
              >
                <span className="bps-fenhance__cost">
                  <img src={ICON_PETA} alt="" />
                  {enhanceCost.toLocaleString('vi-VN')}
                </span>
                <span>{enhanceBusy ? 'Đang nâng...' : 'Enhance'}</span>
              </button>
            )}
            {!enhanceAtMax && petaBalance < enhanceCost ? (
              <p className="bps-fenhance__warn">
                Không đủ Peta (đang có {petaBalance.toLocaleString('vi-VN')}).
              </p>
            ) : null}
          </div>
        )}
      </GameDialogModal>

      {dragGhost?.pet ? (
        <div
          className="bps-drag-ghost"
          style={{
            left: dragGhost.x,
            top: dragGhost.y,
          }}
          aria-hidden
        >
          <img
            src={petImageSrc(dragGhost.pet.image)}
            alt=""
            draggable={false}
          />
          <span className="bps-drag-ghost__lv">Lv.{dragGhost.pet.level ?? '?'}</span>
        </div>
      ) : null}

      <GameDialogModal
        isOpen={fleeConfirmOpen}
        onClose={() => setFleeConfirmOpen(false)}
        title="Bỏ chạy?"
        mode="confirm"
        tone="warning"
        confirmLabel="Bỏ chạy"
        cancelLabel="Ở lại"
        onConfirm={confirmFlee}
        onCancel={() => setFleeConfirmOpen(false)}
      >
        <p>
          Bạn sắp bỏ chạy khỏi <strong>{enemyName}</strong>.
          Boss sẽ biến mất và bạn trở lại bản đồ săn. Tiếp tục chứ?
        </p>
      </GameDialogModal>

      <GameDialogModal
        isOpen={Boolean(errorModal)}
        onClose={() => {
          const msg = errorModal;
          setErrorModal('');
          if (msg.includes('Thiếu thông tin')) leaveToReturnPath();
        }}
        title="Thông báo"
        mode="alert"
        tone="warning"
        confirmLabel="Đóng"
        onConfirm={() => {
          const msg = errorModal;
          setErrorModal('');
          if (msg.includes('Thiếu thông tin')) leaveToReturnPath();
        }}
      >
        <p>{errorModal}</p>
      </GameDialogModal>
      <GameDialogModal
        isOpen={petInfoOpen}
        onClose={() => setPetInfoOpen(false)}
        title={petInfoDetail?.name || 'Thông tin thú cưng'}
        mode="alert"
        tone="info"
        confirmLabel="Đóng"
        onConfirm={() => setPetInfoOpen(false)}
        className="bps-petinfo-modal"
        contentClassName="bps-petinfo-modal__body"
      >
        {petInfoLoading ? (
          <p className="bps-petinfo__loading">Đang tải...</p>
        ) : petInfoError ? (
          <p className="bps-petinfo__error">{petInfoError}</p>
        ) : petInfoDetail ? (
          <div className="bps-petinfo">
            <div className="bps-petinfo__hero">
              <img
                src={petImageSrc(petInfoDetail.image)}
                alt={petInfoDetail.name || ''}
                className="bps-petinfo__img"
              />
              <div className="bps-petinfo__meta">
                <strong>{petInfoDetail.name}</strong>
                <span>Lv.{petInfoDetail.level ?? '?'}</span>
                {petInfoDetail.species_name ? (
                  <span className="bps-petinfo__species">{petInfoDetail.species_name}</span>
                ) : null}
              </div>
            </div>
            <div className="bps-petinfo__stats">
              {[
                ['HP', petInfoDetail.final_stats?.hp ?? petInfoDetail.hp],
                ['STR', petInfoDetail.final_stats?.str ?? petInfoDetail.str],
                ['DEF', petInfoDetail.final_stats?.def ?? petInfoDetail.def],
                ['SPD', petInfoDetail.final_stats?.spd ?? petInfoDetail.spd],
              ].map(([label, val]) => (
                <div key={label} className="bps-petinfo__stat">
                  <span>{label}</span>
                  <strong>{val ?? '—'}</strong>
                </div>
              ))}
            </div>
            <div className="bps-petinfo__section">
              <h3>Vật phẩm trang bị</h3>
              {petInfoItems.length === 0 ? (
                <p className="bps-petinfo__empty">Không có item</p>
              ) : (
                <div className="bps-petinfo__grid">
                  {petInfoItems.map((item) => (
                    <div key={item.id} className="bps-petinfo__chip" title={item.item_name}>
                      <img
                        src={equipmentImageSrc(item.image_url)}
                        alt={item.item_name || ''}
                        onError={(e) => {
                          e.currentTarget.src = '/images/icons/bag.svg';
                        }}
                      />
                      <span>{item.item_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bps-petinfo__section">
              <h3>Linh thú</h3>
              {petInfoSpirits.length === 0 ? (
                <p className="bps-petinfo__empty">Không có linh thú</p>
              ) : (
                <div className="bps-petinfo__grid">
                  {petInfoSpirits.map((spirit) => (
                    <div
                      key={spirit.id || spirit.user_spirit_id || spirit.spirit_id}
                      className="bps-petinfo__chip"
                      title={spirit.name}
                    >
                      <img
                        src={spiritImageSrc(spirit.image_url)}
                        alt={spirit.name || ''}
                        onError={(e) => {
                          e.currentTarget.src = '/images/icons/bag.svg';
                        }}
                      />
                      <span>{spirit.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </GameDialogModal>
    </TemplatePage>
  );
}

export default BattlePetSelectPage;
