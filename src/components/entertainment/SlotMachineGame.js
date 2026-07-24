import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';
import { dispatchGameCenterAlertsRefresh } from '../../utils/gameCenterAlertEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const ICON_PETA = '/images/icons/peta.png';
const ICON_PETA_GOLD = '/images/icons/petagold.png';

const IMG_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect fill="#e2e8f0" width="48" height="48" rx="10"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-size="20">?</text></svg>',
  );

function itemImgSrc(imageUrl) {
  if (!imageUrl) return IMG_FALLBACK;
  const s = String(imageUrl);
  if (s.startsWith('/') || s.startsWith('http')) return s;
  return `/images/equipments/${s}`;
}

function spiritImgSrc(image) {
  if (!image) return IMG_FALLBACK;
  const s = String(image);
  if (s.startsWith('/') || s.startsWith('http')) return s;
  return `/images/spirit/${s}`;
}

function randomIconId(reelIcons) {
  if (!reelIcons?.length) return '';
  return reelIcons[Math.floor(Math.random() * reelIcons.length)].id;
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function evaluateSlots(ids, rules) {
  const [a, b, c] = ids;
  const tripleSame = a && a === b && b === c;
  const anyPair = a === b || b === c || a === c;
  const list = rules?.length ? rules : [];

  const jackpot = list.find((r) => r.kind === 'triple_icon' && r.iconId);
  if (jackpot && tripleSame && a === jackpot.iconId) {
    return {
      tier: 'jackpot',
      msg: jackpot.rewardDescription || jackpot.label || 'Jackpot',
    };
  }

  const tripleRule = list.find((r) => r.kind === 'triple_same');
  if (tripleSame && tripleRule) {
    return {
      tier: 'triple',
      msg: tripleRule.rewardDescription || tripleRule.label || 'Ba giống nhau',
    };
  }

  const pairRule = list.find((r) => r.kind === 'any_pair');
  if (anyPair && pairRule) {
    return { tier: 'pair', msg: pairRule.rewardDescription || pairRule.label || 'Hai trùng' };
  }

  return { tier: 'none', msg: 'Không đủ điều kiện — quay lại sau.' };
}

function iconDisplayNode(icon) {
  if (!icon) return '🔥';
  if (icon.imageUrl) return <img src={icon.imageUrl} alt="" className="ec-slot-img" />;
  return icon.emoji || '🔥';
}

/** /game-center/slot-machine — nội dung trang trực tiếp (không NarrativeHost). */
function SlotMachineGame() {
  const { config, loading } = useGameCenterConfig();
  const { user, updateUserData } = useUser();
  const backNav = useFeatureBackNav();
  const sm = config?.slotMachine || {};
  const narrative = sm.narrative || {};
  const reelIcons = useMemo(
    () => (sm?.reelIcons?.length ? sm.reelIcons : []),
    [sm?.reelIcons],
  );
  const rules = sm?.winRules || [];

  const defaultIds = useMemo(() => {
    if (!reelIcons.length) return ['', '', ''];
    const pick = () => randomIconId(reelIcons);
    return [pick(), pick(), pick()];
  }, [reelIcons]);

  const [finalReels, setFinalReels] = useState(defaultIds);
  const [displayReels, setDisplayReels] = useState(defaultIds);
  const [spinningIdx, setSpinningIdx] = useState([false, false, false]);
  const timersRef = useRef([]);
  const resultTimerRef = useRef(null);

  const [msg, setMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [spinErr, setSpinErr] = useState('');
  const [rewardDlg, setRewardDlg] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (loading || !reelIcons.length) return;
    const init = [randomIconId(reelIcons), randomIconId(reelIcons), randomIconId(reelIcons)];
    setFinalReels(init);
    setDisplayReels(init);
  }, [loading, reelIcons]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (resultTimerRef.current != null) {
        window.clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
    },
    [],
  );

  const spinPrice = Number(status?.spinPricePeta ?? sm.spinPricePeta ?? 50000);
  const maxPlays = Number(status?.maxPlaysPerDay ?? sm.maxPlaysPerDay ?? 10);
  const pairReward = Number(status?.pairRewardPeta ?? sm.pairRewardPeta ?? 20000);
  const playsRem = status?.playsRemaining;

  const vars = useMemo(
    () => ({
      spinPrice: spinPrice.toLocaleString('vi-VN'),
      maxPlays: String(maxPlays),
      pairReward: pairReward.toLocaleString('vi-VN'),
      playerName: user?.username || user?.name || 'bạn',
    }),
    [spinPrice, maxPlays, pairReward, user?.username, user?.name],
  );

  const intro = useMemo(
    () =>
      buildFeatureNpcProps(narrative, vars, {
        speaker: 'Ignis',
        portraitSrc: '/images/character/Ignis.png',
        lines: [
          'Chào ngươi! Đây là Làng Đỏ Đen trên Hỏa Diệm Sơn.',
          'Dân làng mê Máy đánh bạc. Quay một phát {spinPrice} Peta — xem ai móc túi ai!',
        ],
      }),
    [narrative, vars],
  );

  const spinWithFinals = useCallback(
    (finals, serverPayload) => {
      if (!reelIcons.length) return;
      setMsg(null);
      setResult(null);
      setSpinErr('');
      setFinalReels(finals);

      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (resultTimerRef.current != null) {
        window.clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }

      setSpinningIdx([true, true, true]);

      const startMs = Date.now();
      const baseStop1 = randInt(900, 1150);
      const baseStop2 = baseStop1 + randInt(420, 560);
      let baseStop3 = baseStop2 + randInt(520, 720);
      if (finals[0] && finals[0] === finals[1]) baseStop3 += randInt(500, 850);

      const tick = () => {
        const elapsed = Date.now() - startMs;
        const next = ['', '', ''];

        const isSpin0 = elapsed < baseStop1;
        const isSpin1 = elapsed < baseStop2;
        const isSpin2 = elapsed < baseStop3;
        setSpinningIdx([isSpin0, isSpin1, isSpin2]);

        next[0] = isSpin0 ? randomIconId(reelIcons) : finals[0];
        next[1] = isSpin1 ? randomIconId(reelIcons) : finals[1];
        next[2] = isSpin2 ? randomIconId(reelIcons) : finals[2];

        setDisplayReels(next);

        if (!isSpin0 && !isSpin1 && !isSpin2) {
          const out = evaluateSlots(finals, rules);
          setMsg(out);
          setResult({ reels: finals, tier: out.tier });
          const spinMeta = {
            tier: serverPayload?.tier || out.tier,
            message: serverPayload?.message || out.msg,
            rewards: Array.isArray(serverPayload?.rewards) ? serverPayload.rewards : [],
          };
          resultTimerRef.current = window.setTimeout(() => {
            resultTimerRef.current = null;
            setRewardDlg({
              tier: spinMeta.tier,
              message: spinMeta.message,
              rewards: spinMeta.rewards,
            });
          }, 500);
          return;
        }

        const remaining = Math.max(0, baseStop3 - elapsed);
        const delay = remaining < 350 ? 120 : remaining < 700 ? 85 : 55;
        timersRef.current.push(window.setTimeout(tick, delay));
      };

      timersRef.current.push(window.setTimeout(tick, 0));
    },
    [reelIcons, rules],
  );

  const fetchStatus = useCallback(async () => {
    setSpinErr('');
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const r = await fetch(`${API_BASE_URL}/api/game-center/slot-machine/status`, { headers });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus(null);
        if (typeof data.error === 'string') setSpinErr(data.error);
        return;
      }
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const doSpin = async () => {
    if (!reelIcons.length) return;
    if (!user?.token) {
      setSpinErr('Cần đăng nhập để quay và nhận thưởng thật.');
      return;
    }
    setSpinErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/slot-machine/spin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSpinErr(data.error || 'Không quay được');
        await fetchStatus();
        return;
      }
      const finals = Array.isArray(data.reels) && data.reels.length === 3 ? data.reels : defaultIds;
      spinWithFinals(finals, data);
      if (data.petagoldRemaining != null) {
        updateUserData({ petagold: Number(data.petagoldRemaining) });
      }
      if (data.petaRemaining != null) {
        updateUserData({ peta: Number(data.petaRemaining) });
      }
      dispatchCurrencyUpdate();
      dispatchGameCenterAlertsRefresh();
      await fetchStatus();
    } catch (e) {
      setSpinErr(e.message || 'Lỗi mạng');
    }
  };

  const renderReel = (id) => iconDisplayNode(reelIcons.find((x) => x.id === id));
  const isSpinning = spinningIdx.some(Boolean);

  const backButton =
    backNav.kind === 'link' ? (
      <Link to={backNav.to} className="ec-btn ec-btn--ghost">
        {backNav.label}
      </Link>
    ) : (
      <button type="button" className="ec-btn ec-btn--ghost" onClick={backNav.go}>
        {backNav.label}
      </button>
    );

  if (loading) {
    return (
      <div className="ec-game ec-game--slot">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--slot">
      <FeatureNpcIntro
        speaker={intro.speaker}
        portraitSrc={intro.portraitSrc}
        lorePortraitSrc={intro.lorePortraitSrc}
        greeting={intro.greeting}
        loreLines={intro.loreLines}
      />

      <div className="ec-slot-play">
        <p className="ec-slot-stats" role="note">
          Mỗi lần quay tốn{' '}
          <strong className="ec-slot-stats__em">{spinPrice.toLocaleString('vi-VN')} Peta</strong>.
          Hai ô trùng (pair) nhận{' '}
          <strong className="ec-slot-stats__em ec-slot-stats__em--pair">
            +{pairReward.toLocaleString('vi-VN')} Peta
          </strong>
          .
          {user?.token && playsRem != null ? (
            <>
              {' '}
              Còn{' '}
              <strong className="ec-slot-stats__em ec-slot-stats__em--turns">
                {playsRem}/{maxPlays}
              </strong>{' '}
              lượt trong kỳ này.
            </>
          ) : null}
        </p>

        {!user?.token && (
          <p className="ec-guess-alert ec-guess-alert--warn">
            <Link to="/login">Đăng nhập</Link> để nhận thưởng thật từ server.
          </p>
        )}

        <div
          className={`ec-slot-machine-frame${
            result?.tier === 'jackpot' ? ' is-jackpot' : result?.tier && result.tier !== 'none' ? ' is-win' : ''
          }`}
        >
          <div className="ec-slot-machine-frame__top" aria-hidden>
            <span className="ec-slot-machine-frame__badge">ĐĐ</span>
            <span className="ec-slot-machine-frame__title">Máy đánh bạc</span>
          </div>
          <div className="ec-slots" aria-live="polite">
            {displayReels.map((id, i) => (
              <div
                key={i}
                className={`ec-slot-reel ec-slot-reel--fancy${spinningIdx[i] ? ' is-spinning' : ''}`}
              >
                <div className="ec-slot-reel__glow" aria-hidden />
                <div className="ec-slot-reel__inner">{renderReel(id)}</div>
              </div>
            ))}
          </div>
          {msg && !isSpinning ? (
            <p className={`ec-slot-hint ec-slot-hint--${msg.tier}`}>{msg.msg}</p>
          ) : (
            <p className="ec-slot-hint">Ba ô trùng lửa — Jackpot. Hai ô trùng vẫn có thưởng.</p>
          )}
        </div>

        <div className="ec-btn-row ec-slot-actions">
          <button
            type="button"
            className="ec-btn ec-slot-spin-btn"
            onClick={() => void doSpin()}
            disabled={
              isSpinning ||
              !!rewardDlg ||
              !reelIcons.length ||
              !user?.token ||
              (playsRem != null && Number(playsRem) <= 0)
            }
          >
            {reelIcons.length ? (isSpinning ? 'Đang quay…' : 'Quay') : 'Chưa có icon'}
          </button>
        </div>

        {spinErr && (
          <p className="ec-guess-alert ec-guess-alert--warn" role="alert">
            {spinErr}
          </p>
        )}

        <div className="ec-btn-row ec-slot-actions ec-feature-actions--back">{backButton}</div>
      </div>

      <GameDialogModal
        isOpen={!!rewardDlg}
        onClose={() => setRewardDlg(null)}
        title={rewardDlg?.tier === 'jackpot' ? 'Jackpot!' : 'Kết quả nhận thưởng'}
        mode="alert"
        confirmLabel="Đóng"
        tone={
          rewardDlg?.tier === 'jackpot'
            ? 'info'
            : rewardDlg?.tier === 'none'
              ? 'warning'
              : 'default'
        }
        onConfirm={() => setRewardDlg(null)}
      >
        {rewardDlg && (
          <div className="ec-wheel-result-modal">
            <div className="ec-wheel-result-modal__visual">
              {rewardDlg.rewards?.[0]?.kind === 'petagold' ? (
                <img src={ICON_PETA_GOLD} alt="" className="ec-wheel-result-modal__icon" />
              ) : rewardDlg.rewards?.[0]?.kind === 'peta' ? (
                <img src={ICON_PETA} alt="" className="ec-wheel-result-modal__icon" />
              ) : rewardDlg.rewards?.[0]?.kind === 'item' ? (
                <img
                  src={itemImgSrc(rewardDlg.rewards[0].image_url)}
                  alt=""
                  className="ec-wheel-result-modal__img"
                />
              ) : rewardDlg.rewards?.[0]?.kind === 'spirit' ? (
                <img
                  src={spiritImgSrc(rewardDlg.rewards[0].image)}
                  alt=""
                  className="ec-wheel-result-modal__img"
                />
              ) : null}
            </div>
            <div className="ec-wheel-result-modal__label">{rewardDlg.message || '—'}</div>
            {(() => {
              const rw = rewardDlg.rewards?.[0];
              if (!rw) {
                return <div className="ec-wheel-result-modal__reward">Chưa nhận được phần thưởng.</div>;
              }
              if (rw.kind === 'petagold') {
                return (
                  <div className="ec-wheel-result-modal__reward">
                    +{Number(rw.amount || 0).toLocaleString('vi-VN')} PetaGold
                  </div>
                );
              }
              if (rw.kind === 'peta') {
                return (
                  <div className="ec-wheel-result-modal__reward">
                    +{Number(rw.amount || 0).toLocaleString('vi-VN')} Peta
                  </div>
                );
              }
              if (rw.kind === 'item') {
                return (
                  <div className="ec-wheel-result-modal__reward">
                    {rw.name || `Item #${rw.itemId}`}
                  </div>
                );
              }
              if (rw.kind === 'spirit') {
                return (
                  <div className="ec-wheel-result-modal__reward">
                    {rw.name || `Spirit #${rw.spiritId}`}
                  </div>
                );
              }
              return (
                <div className="ec-wheel-result-modal__reward">
                  {String(rw.label || 'Phần thưởng')}
                </div>
              );
            })()}
          </div>
        )}
      </GameDialogModal>
    </div>
  );
}

export default SlotMachineGame;
