import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import NarrativeScene, { applyNarrativeVars } from '../ui/NarrativeScene';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function formatDur(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function BeggarKingGame() {
  const { user, updateUserData } = useUser();
  const { config, loading } = useGameCenterConfig();
  const backNav = useFeatureBackNav();
  const bk = config?.beggarKing || {};
  const narrative = bk.narrative || {};
  const fallbackMin = bk.minPeta ?? 100;
  const fallbackMax = bk.maxPeta ?? 5000;
  const fallbackCd = bk.cooldownHours ?? 12;

  const [now, setNow] = useState(() => Date.now());
  const [srv, setSrv] = useState(null);
  const [statusErr, setStatusErr] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(null);
  const [claimErr, setClaimErr] = useState('');
  const [phase, setPhase] = useState('intro'); // intro | cooldown | reward
  /** Snapshot cho script — tránh chữ chạy reset mỗi giây khi {remaining} đổi */
  const [scriptRemaining, setScriptRemaining] = useState('');

  const minPeta = srv?.minPeta ?? fallbackMin;
  const maxPeta = srv?.maxPeta ?? fallbackMax;
  const cooldownHours = srv?.cooldownHours ?? fallbackCd;

  const fetchStatus = useCallback(async () => {
    setStatusErr('');
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const r = await fetch(`${API_BASE_URL}/api/game-center/beggar-king/status`, { headers });
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

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const nextAvailableMs = srv?.nextAvailableMs != null ? Number(srv.nextAvailableMs) : null;
  const canClaim = !!user?.token && srv?.canClaim === true;
  const remainingMs =
    nextAvailableMs != null && now < nextAvailableMs ? nextAvailableMs - now : 0;
  const remainingLabel = remainingMs > 0 ? formatDur(remainingMs) : '';
  const onCooldown = !!user?.token && !canClaim && remainingMs > 0;

  useEffect(() => {
    if (phase === 'reward') return;
    const next = onCooldown ? 'cooldown' : 'intro';
    if (next !== phase) {
      if (next === 'cooldown') setScriptRemaining(remainingLabel || 'một chút');
      setPhase(next);
    }
  }, [onCooldown, phase, remainingLabel]);

  const vars = useMemo(
    () => ({
      minPeta: Number(minPeta).toLocaleString('vi-VN'),
      maxPeta: Number(maxPeta).toLocaleString('vi-VN'),
      cooldownHours,
      remaining: scriptRemaining || remainingLabel || 'một chút',
      amount:
        rewardAmount != null ? Number(rewardAmount).toLocaleString('vi-VN') : '…',
      playerName: user?.username || user?.name || 'bạn',
    }),
    [
      minPeta,
      maxPeta,
      cooldownHours,
      scriptRemaining,
      remainingLabel,
      rewardAmount,
      user?.username,
      user?.name,
    ],
  );

  const speaker = narrative.speaker || 'Richies';
  const portraitSrc = narrative.portraitSrc || '/images/character/richies.jpg';
  const backgroundSrc = narrative.backgroundSrc || '';
  const useBackground = narrative.useBackground !== false;
  const title = narrative.title || 'Làng Phú Gia';
  const typingMsPerChar = narrative.typingMsPerChar ?? 26;
  const claimLabel = narrative.claimLabel || 'Xin lì xì';

  const lines = useMemo(() => {
    if (phase === 'reward') {
      const tpl =
        narrative.rewardLine ||
        'Ha ha! Cầm lấy {amount} Peta lì xì đi — đừng khách khí với ta!';
      return [applyNarrativeVars(tpl, vars)];
    }
    if (phase === 'cooldown') {
      const cd = Array.isArray(narrative.cooldownLines) ? narrative.cooldownLines : [];
      return cd.length ? cd : ['Hãy quay lại sau {remaining} nữa nhé.'];
    }
    const intro = Array.isArray(narrative.lines) ? narrative.lines : [];
    return intro.length
      ? intro
      : [
          'Chào ngươi! Ta là Richies, trưởng làng Phú Gia.',
          'Mỗi lần ghé thăm, ta lì xì khoảng {minPeta}–{maxPeta} Peta — mỗi {cooldownHours} giờ một lần.',
        ];
  }, [phase, narrative, vars]);

  const finishReward = () => {
    setRewardAmount(null);
    if (onCooldown) {
      setScriptRemaining(remainingLabel || 'một chút');
      setPhase('cooldown');
    } else {
      setPhase('intro');
    }
  };

  const handleClaim = async () => {
    if (!user?.token || !canClaim || claiming) return;
    setClaiming(true);
    setClaimErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/beggar-king/claim`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) {
        setClaimErr(data.error || 'Chưa hết thời gian chờ');
        setPhase('cooldown');
        await fetchStatus();
        return;
      }
      if (!r.ok) {
        throw new Error(data.error || 'Không nhận được Peta');
      }
      const granted = Math.max(0, Number(data.grantedPeta) || 0);
      setRewardAmount(granted);
      setPhase('reward');
      if (data.petaRemaining != null) {
        updateUserData({ peta: Number(data.petaRemaining) });
      }
      dispatchCurrencyUpdate();
      await fetchStatus();
    } catch (e) {
      setClaimErr(e.message || 'Lỗi');
    } finally {
      setClaiming(false);
    }
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
      <div className="ec-game ec-game--beggar">
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
            <Link to="/login">Đăng nhập</Link> để nhận lì xì thật và đồng bộ thời gian chờ.
          </p>
          <Link to="/login" className="ec-btn narrative-scene__action-btn">
            Đăng nhập để xin lì xì
          </Link>
        </>
      ) : null}

      {user?.token && phase === 'cooldown' ? (
        <p className="narrative-scene__status narrative-scene__status--warn">
          Còn lại: {remainingLabel || '…'}
        </p>
      ) : null}

      {user?.token && phase === 'intro' ? (
        <button
          type="button"
          className="ec-btn narrative-scene__action-btn"
          onClick={() => void handleClaim()}
          disabled={!canClaim || claiming || !!statusErr}
        >
          {claiming ? 'Đang xử lý…' : claimLabel}
        </button>
      ) : null}

      {user?.token && phase === 'reward' ? (
        <button
          type="button"
          className="ec-btn narrative-scene__action-btn"
          onClick={finishReward}
        >
          Cảm ơn ngài Richies!
        </button>
      ) : null}

      {backButton}
    </>
  );

  return (
    <div className="ec-game ec-game--beggar">
      <NarrativeScene
        className="ec-beggar-narrative"
        title={title}
        speaker={speaker}
        portraitSrc={portraitSrc}
        backgroundSrc={backgroundSrc}
        useBackground={useBackground}
        lines={lines}
        vars={vars}
        typingMsPerChar={typingMsPerChar}
        scriptKey={`${phase}-${rewardAmount ?? 'x'}-${onCooldown ? 'cd' : 'ok'}`}
        showActions="end"
        actions={actions}
        portraitFallback="/images/character/knight_warrior.jpg"
      />
    </div>
  );
}

export default BeggarKingGame;
