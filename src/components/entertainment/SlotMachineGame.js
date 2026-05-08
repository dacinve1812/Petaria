import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

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

function evaluateSlots(ids, rules, reelIcons) {
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
  if (!icon) return '🎰';
  if (icon.imageUrl) return <img src={icon.imageUrl} alt="" className="ec-slot-img" />;
  return icon.emoji || '🎰';
}

function rewardLabelForIcon(icon, itemsById) {
  const k = String(icon?.reward?.kind || 'placeholder');
  if (k === 'item') {
    const id = icon?.reward?.itemId;
    const it = id != null ? itemsById.get(Number(id)) : null;
    return it ? it.name : id != null ? `Item #${id}` : 'Item';
  }
  if (k === 'spirit') {
    const sid = icon?.reward?.spiritId;
    return sid != null ? `Spirit #${sid}` : 'Spirit';
  }
  return String(icon?.label || icon?.id || 'Phần thưởng');
}

function SlotMachineGame() {
  const { config, loading } = useGameCenterConfig();
  const { user, updateUserData } = useUser();
  const sm = config?.slotMachine;
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

  useEffect(() => {
    if (loading || !reelIcons.length) return;
    const init = [randomIconId(reelIcons), randomIconId(reelIcons), randomIconId(reelIcons)];
    setFinalReels(init);
    setDisplayReels(init);
  }, [loading, reelIcons]);
  const [msg, setMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [spinErr, setSpinErr] = useState('');
  const [rewardDlg, setRewardDlg] = useState(null);
  const [status, setStatus] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    },
    [],
  );

  const spinWithFinals = useCallback(
    (finals) => {
      if (!reelIcons.length) return;
      setMsg(null);
      setResult(null);
      setSpinErr('');

      setFinalReels(finals);

      // Clear timers
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];

      // Start spinning all reels
      setSpinningIdx([true, true, true]);

      const startMs = Date.now();
      const baseStop1 = randInt(900, 1150);
      const baseStop2 = baseStop1 + randInt(420, 560);
      let baseStop3 = baseStop2 + randInt(520, 720);
      if (finals[0] && finals[0] === finals[1]) baseStop3 += randInt(500, 850);

      const tick = () => {
        const elapsed = Date.now() - startMs;
        const next = [...displayReels];

        const isSpin0 = elapsed < baseStop1;
        const isSpin1 = elapsed < baseStop2;
        const isSpin2 = elapsed < baseStop3;
        setSpinningIdx([isSpin0, isSpin1, isSpin2]);

        if (isSpin0) next[0] = randomIconId(reelIcons);
        else next[0] = finals[0];
        if (isSpin1) next[1] = randomIconId(reelIcons);
        else next[1] = finals[1];
        if (isSpin2) next[2] = randomIconId(reelIcons);
        else next[2] = finals[2];

        setDisplayReels(next);

        if (!isSpin0 && !isSpin1 && !isSpin2) {
          const out = evaluateSlots(finals, rules, reelIcons);
          setMsg(out);
          setResult({ reels: finals, tier: out.tier });
          return;
        }

        const remaining = Math.max(0, baseStop3 - elapsed);
        const delay = remaining < 350 ? 120 : remaining < 700 ? 85 : 55;
        timersRef.current.push(window.setTimeout(tick, delay));
      };

      timersRef.current.push(window.setTimeout(tick, 0));
    },
    [displayReels, reelIcons, rules],
  );

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
      spinWithFinals(finals);
      if (data.petagoldRemaining != null) {
        updateUserData({ petagold: Number(data.petagoldRemaining) });
      }
      if (data.petaRemaining != null) {
        updateUserData({ peta: Number(data.petaRemaining) });
      }
      dispatchCurrencyUpdate();
      await fetchStatus();
      // mở modal sau khi animation kết thúc 1 nhịp
      const delayOpen = 2600 + (finals[0] === finals[1] ? 600 : 0);
      window.setTimeout(() => {
        setRewardDlg({
          tier: data.tier,
          message: data.message,
          rewards: Array.isArray(data.rewards) ? data.rewards : [],
        });
      }, delayOpen);
    } catch (e) {
      setSpinErr(e.message || 'Lỗi mạng');
    }
  };

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
    } catch (e) {
      setStatus(null);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const itemsById = useMemo(() => {
    const map = new Map();
    // slotMachine reward picker lấy từ Admin items list; client game-center/config không có tên item → fallback label
    // map rỗng ở đây, để hàm rewardLabelForIcon vẫn hoạt động (Item #id)
    return map;
  }, []);

  const renderReel = (id) => iconDisplayNode(reelIcons.find((x) => x.id === id));

  if (loading) {
    return (
      <div className="ec-game ec-game--slot">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--slot">
      <p className="ec-game__lead ec-slot-lead">
        Quay guồng theo kiểu casino: ô 1 dừng trước, rồi ô 2, rồi ô 3. Nếu 2 ô đầu trùng, ô 3 sẽ chạy lâu hơn để gây hồi
        hộp.
      </p>

      {!user?.token && (
        <p className="ec-guess-alert ec-guess-alert--warn">
          <Link to="/login">Đăng nhập</Link> để nhận thưởng thật (item/spirit/petagold) từ server.
        </p>
      )}

      <div className={`ec-slot-machine-frame ${result?.tier === 'jackpot' ? 'is-jackpot' : ''}`}>
        <div className="ec-slots" aria-live="polite">
        {displayReels.map((id, i) => (
          <div
            key={i}
            className={`ec-slot-reel ec-slot-reel--fancy ${spinningIdx[i] ? 'is-spinning' : ''}`}
          >
            <div className="ec-slot-reel__glow" aria-hidden />
            <div className="ec-slot-reel__inner">{renderReel(id)}</div>
          </div>
        ))}
        </div>
      </div>

      <div className="ec-btn-row">
        <button
          type="button"
          className="ec-btn ec-slot-spin-btn"
          onClick={() => setConfirmOpen(true)}
          disabled={
            spinningIdx.some(Boolean) ||
            !reelIcons.length ||
            (status?.playsRemaining != null && Number(status.playsRemaining) <= 0)
          }
        >
          {reelIcons.length ? (spinningIdx.some(Boolean) ? 'Đang quay…' : 'Quay') : 'Chưa có icon'}
        </button>
      </div>

      {spinErr && (
        <p className="ec-guess-alert ec-guess-alert--warn" role="alert">
          {spinErr}
        </p>
      )}

      <GameDialogModal
        isOpen={!!rewardDlg}
        onClose={() => setRewardDlg(null)}
        title={rewardDlg?.tier === 'jackpot' ? 'Jackpot!' : 'Kết quả nhận thưởng'}
        mode="alert"
        confirmLabel="Đóng"
        tone={rewardDlg?.tier === 'jackpot' ? 'info' : rewardDlg?.tier === 'none' ? 'warning' : 'default'}
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
              if (!rw) return <div className="ec-wheel-result-modal__reward">Chưa nhận được phần thưởng.</div>;
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
                return <div className="ec-wheel-result-modal__reward">{rw.name || `Item #${rw.itemId}`}</div>;
              }
              if (rw.kind === 'spirit') {
                return <div className="ec-wheel-result-modal__reward">{rw.name || `Spirit #${rw.spiritId}`}</div>;
              }
              return <div className="ec-wheel-result-modal__reward">{String(rw.label || 'Phần thưởng')}</div>;
            })()}
          </div>
        )}
      </GameDialogModal>

      <GameDialogModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xác nhận mua lượt quay"
        mode="confirm"
        tone="info"
        cancelLabel="Hủy"
        confirmLabel={spinningIdx.some(Boolean) ? 'Đang quay…' : 'Quay'}
        confirmDisabled={
          spinningIdx.some(Boolean) ||
          !user?.token ||
          !reelIcons.length ||
          (status?.playsRemaining != null && Number(status.playsRemaining) <= 0)
        }
        costPill={{
          icon: <img src={ICON_PETA} alt="" style={{ width: 18, height: 18 }} />,
          amount: Number(status?.spinPricePeta ?? 0).toLocaleString('vi-VN'),
          suffix: ' Peta',
          prefix: '',
        }}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void doSpin();
        }}
      >
        <p style={{ margin: 0, textAlign: 'center', fontWeight: 700 }}>
          Bạn sẽ mua <strong>1</strong> lượt quay.
        </p>
        <p style={{ margin: '10px 0 0', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
          Lượt còn lại trong kỳ: <strong>{status?.playsRemaining ?? '—'}</strong>/{status?.maxPlaysPerDay ?? '—'} · Pair
          thưởng <strong>+{Number(status?.pairRewardPeta ?? 0).toLocaleString('vi-VN')} Peta</strong>
        </p>
      </GameDialogModal>
    </div>
  );
}

export default SlotMachineGame;
