import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import NarrativeScene, { applyNarrativeVars } from '../ui/NarrativeScene';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const MISSING_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect fill="#e2e8f0" width="48" height="48" rx="8"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-size="20">?</text></svg>',
  );

function invImgSrc(imageUrl) {
  if (!imageUrl) return MISSING_IMG;
  const s = String(imageUrl);
  if (s.startsWith('/') || s.startsWith('http')) return s;
  return `/images/equipments/${s}`;
}

const RARITY_LABEL = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

function DailyFreeItemsGame() {
  const { config, loading } = useGameCenterConfig();
  const { user } = useUser();
  const backNav = useFeatureBackNav();
  const df = config?.dailyFree || {};
  const narrative = df.narrative || {};

  const [srv, setSrv] = useState(null);
  const [statusErr, setStatusErr] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimErr, setClaimErr] = useState('');
  const [resultDlg, setResultDlg] = useState(null);
  const [phase, setPhase] = useState('intro'); // intro | cooldown | reward
  const [lastItemCount, setLastItemCount] = useState(null);

  const fetchStatus = useCallback(async () => {
    setStatusErr('');
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const r = await fetch(`${API_BASE_URL}/api/game-center/daily-free/status`, { headers });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSrv(null);
        setStatusErr(typeof data.error === 'string' ? data.error : 'Không tải được trạng thái');
        return;
      }
      setSrv(data);
    } catch (e) {
      setSrv(null);
      setStatusErr(e.message || 'Lỗi mạng');
    }
  }, [user?.token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const minN = srv?.minItemsPerClaim ?? df.minItemsPerClaim ?? 1;
  const maxN = srv?.maxItemsPerClaim ?? df.maxItemsPerClaim ?? 3;
  const canClaim = !!user?.token && srv?.canClaim === true;
  const alreadyClaimed = !!user?.token && srv?.canClaim === false;

  useEffect(() => {
    if (phase === 'reward') return;
    setPhase(alreadyClaimed ? 'cooldown' : 'intro');
  }, [alreadyClaimed, phase]);

  const vars = useMemo(
    () => ({
      minItems: String(minN),
      maxItems: String(maxN),
      itemCount: lastItemCount != null ? String(lastItemCount) : '…',
      playerName: user?.username || user?.name || 'bạn',
    }),
    [minN, maxN, lastItemCount, user?.username, user?.name],
  );

  const speaker = narrative.speaker || 'Cư dân làng';
  const portraitSrc = narrative.portraitSrc || '/images/character/char2.jpg';
  const backgroundSrc = narrative.backgroundSrc || '';
  const useBackground = narrative.useBackground === true;
  const title = narrative.title || 'Làng Nhân Ái';
  const typingMsPerChar = narrative.typingMsPerChar ?? 26;
  const claimLabel = narrative.claimLabel || 'Nhận quà hôm nay';

  const lines = useMemo(() => {
    if (phase === 'reward') {
      const tpl =
        narrative.rewardLine ||
        'Đây là phần quà làng gửi tặng — {itemCount} vật phẩm. Chúc ngươi bình an!';
      return [applyNarrativeVars(tpl, vars)];
    }
    if (phase === 'cooldown') {
      const cd = Array.isArray(narrative.cooldownLines) ? narrative.cooldownLines : [];
      return cd.length
        ? cd
        : ['Hôm nay ngươi đã nhận phần quà rồi. Hãy quay lại sau kỳ reset tiếp theo nhé!'];
    }
    const intro = Array.isArray(narrative.lines) ? narrative.lines : [];
    return intro.length
      ? intro
      : [
          'Chào ngươi! Đây là Làng nhân ái — nơi chia sẻ vật phẩm miễn phí mỗi ngày.',
          'Mỗi ngày chỉ nhận một lần, khoảng {minItems}–{maxItems} món.',
        ];
  }, [phase, narrative, vars]);

  const handleClaim = async () => {
    if (!user?.token || !canClaim || claiming) return;
    setClaiming(true);
    setClaimErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/daily-free/claim`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) {
        setClaimErr(data.error || 'Đã nhận trong kỳ này');
        setPhase('cooldown');
        await fetchStatus();
        return;
      }
      if (!r.ok) throw new Error(data.error || 'Không nhận được quà');
      const count = Number(data.itemCount) || 0;
      setLastItemCount(count);
      setPhase('reward');
      setResultDlg({
        itemCount: count,
        rewards: Array.isArray(data.rewards) ? data.rewards : [],
      });
      await fetchStatus();
    } catch (e) {
      setClaimErr(e.message || 'Lỗi');
    } finally {
      setClaiming(false);
    }
  };

  const finishReward = () => {
    setLastItemCount(null);
    setPhase(alreadyClaimed || !canClaim ? 'cooldown' : 'intro');
  };

  const backButton =
    backNav.kind === 'link' ? (
      <Link to={backNav.to} className="ec-btn ec-btn--ghost narrative-scene__action-btn">
        {backNav.label}
      </Link>
    ) : (
      <button
        type="button"
        className="ec-btn ec-btn--ghost narrative-scene__action-btn"
        onClick={backNav.go}
      >
        {backNav.label}
      </button>
    );

  if (loading) {
    return (
      <div className="ec-game ec-game--daily-free">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  const actions = (
    <>
      {statusErr ? (
        <p className="narrative-scene__status narrative-scene__status--err" role="alert">
          {statusErr}
        </p>
      ) : null}
      {claimErr ? (
        <p className="narrative-scene__status narrative-scene__status--warn" role="alert">
          {claimErr}
        </p>
      ) : null}

      {!user?.token ? (
        <>
          <p className="narrative-scene__status">
            <Link to="/login">Đăng nhập</Link> để nhận quà vào kho.
          </p>
          <Link to="/login" className="ec-btn narrative-scene__action-btn">
            Đăng nhập để nhận quà
          </Link>
        </>
      ) : null}

      {user?.token && phase === 'cooldown' ? (
        <p className="narrative-scene__status narrative-scene__status--warn">
          Đã nhận trong kỳ này — quay lại sau giờ reset server.
        </p>
      ) : null}

      {user?.token && phase === 'intro' ? (
        <button
          type="button"
          className="ec-btn narrative-scene__action-btn"
          onClick={() => void handleClaim()}
          disabled={!canClaim || claiming || !!statusErr}
        >
          {claiming ? 'Đang nhận…' : claimLabel}
        </button>
      ) : null}

      {user?.token && phase === 'reward' ? (
        <button type="button" className="ec-btn narrative-scene__action-btn" onClick={finishReward}>
          Cảm ơn làng!
        </button>
      ) : null}

      {backButton}
    </>
  );

  return (
    <div className="ec-game ec-game--daily-free">
      <NarrativeScene
        className="ec-daily-narrative"
        title={title}
        speaker={speaker}
        portraitSrc={portraitSrc}
        backgroundSrc={backgroundSrc}
        useBackground={useBackground}
        lines={lines}
        vars={vars}
        typingMsPerChar={typingMsPerChar}
        scriptKey={`${phase}-${lastItemCount ?? 'x'}-${alreadyClaimed ? 'cd' : 'ok'}`}
        showActions="end"
        actions={actions}
        portraitFallback="/images/character/knight_warrior.jpg"
      />

      <GameDialogModal
        isOpen={!!resultDlg}
        onClose={() => setResultDlg(null)}
        title="Đã nhận quà"
        mode="alert"
        confirmLabel="Đóng"
        tone="info"
        onConfirm={() => setResultDlg(null)}
      >
        {resultDlg && (
          <div className="ec-daily-result">
            <p className="ec-daily-result__sum">
              Nhận được <strong>{resultDlg.itemCount}</strong> vật phẩm (đã thêm vào kho).
            </p>
            <ul className="ec-daily-result__list">
              {resultDlg.rewards.map((rw, i) => (
                <li key={`${rw.itemId}-${i}`} className="ec-daily-result__row">
                  <img src={invImgSrc(rw.image_url)} alt="" className="ec-daily-result__img" />
                  <div>
                    <div className="ec-daily-result__name">{rw.name}</div>
                    <div className="ec-daily-result__meta">{RARITY_LABEL[rw.rarity] || rw.rarity}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GameDialogModal>
    </div>
  );
}

export default DailyFreeItemsGame;
