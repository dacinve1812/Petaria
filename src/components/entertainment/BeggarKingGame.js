import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { applyNarrativeVars } from '../ui/NarrativeScene';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';
import { dispatchGameCenterAlertsRefresh } from '../../utils/gameCenterAlertEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function formatDur(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

/**
 * /game-center/beggar-king — nội dung trang trực tiếp (không NarrativeHost).
 */
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
  const [claimErr, setClaimErr] = useState('');
  const [rewardDlg, setRewardDlg] = useState(null);

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

  const vars = useMemo(
    () => ({
      minPeta: Number(minPeta).toLocaleString('vi-VN'),
      maxPeta: Number(maxPeta).toLocaleString('vi-VN'),
      cooldownHours,
      remaining: remainingLabel || 'một chút',
      amount:
        rewardDlg?.amount != null ? Number(rewardDlg.amount).toLocaleString('vi-VN') : '…',
      playerName: user?.username || user?.name || 'bạn',
    }),
    [minPeta, maxPeta, cooldownHours, remainingLabel, rewardDlg, user?.username, user?.name],
  );

  const speaker = narrative.speaker || 'Richies';
  const claimLabel = narrative.claimLabel || 'Xin lì xì';

  const intro = useMemo(
    () =>
      buildFeatureNpcProps(narrative, vars, {
        speaker: 'Richies',
        portraitSrc: '/images/character/richies.jpg',
        lines: [
          'Chào ngươi! Ta là Richies, trưởng làng Phú Gia.',
          'Mỗi lần ghé thăm, ta lì xì khoảng {minPeta}–{maxPeta} Peta — mỗi {cooldownHours} giờ một lần.',
        ],
      }),
    [narrative, vars],
  );

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
        await fetchStatus();
        return;
      }
      if (!r.ok) {
        throw new Error(data.error || 'Không nhận được Peta');
      }
      const granted = Math.max(0, Number(data.grantedPeta) || 0);
      const tpl =
        narrative.rewardLine ||
        'Ha ha! Cầm lấy {amount} Peta lì xì đi — đừng khách khí với ta!';
      setRewardDlg({
        amount: granted,
        message: applyNarrativeVars(tpl, {
          ...vars,
          amount: Number(granted).toLocaleString('vi-VN'),
        }),
      });
      if (data.petaRemaining != null) {
        updateUserData({ peta: Number(data.petaRemaining) });
      }
      dispatchCurrencyUpdate();
      dispatchGameCenterAlertsRefresh();
      await fetchStatus();
    } catch (e) {
      setClaimErr(e.message || 'Lỗi');
    } finally {
      setClaiming(false);
    }
  };

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
      <div className="ec-game ec-game--beggar">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--beggar">
      <FeatureNpcIntro
        speaker={intro.speaker}
        portraitSrc={intro.portraitSrc}
        lorePortraitSrc={intro.lorePortraitSrc}
        greeting={intro.greeting}
        loreLines={intro.loreLines}
      />

      {statusErr ? (
        <p className="ec-guess-alert ec-guess-alert--error" role="alert">
          {statusErr}
        </p>
      ) : null}
      {claimErr ? (
        <p className="ec-guess-alert ec-guess-alert--warn" role="alert">
          {claimErr}
        </p>
      ) : null}

      {!user?.token ? (
        <p className="ec-note">
          <Link to="/login">Đăng nhập</Link> để nhận lì xì thật và đồng bộ thời gian chờ.
        </p>
      ) : null}

      {user?.token && onCooldown ? (
        <p className="ec-guess-alert ec-guess-alert--warn" role="status">
          Còn lại: {remainingLabel || '…'}
        </p>
      ) : null}

      <div className="ec-btn-row ec-feature-actions">
        {!user?.token ? (
          <Link to="/login" className="ec-btn ec-mystery-btn-primary">
            Đăng nhập để xin lì xì
          </Link>
        ) : (
          <button
            type="button"
            className="ec-btn ec-mystery-btn-primary"
            onClick={() => void handleClaim()}
            disabled={!canClaim || claiming || !!statusErr}
          >
            {claiming ? 'Đang xử lý…' : claimLabel}
          </button>
        )}
      </div>
      <div className="ec-btn-row ec-feature-actions ec-feature-actions--back">{backButton}</div>

      <GameDialogModal
        isOpen={!!rewardDlg}
        onClose={() => setRewardDlg(null)}
        title={speaker}
        mode="alert"
        confirmLabel="Cảm ơn!"
        tone="info"
        onConfirm={() => setRewardDlg(null)}
      >
        {rewardDlg ? <p>{rewardDlg.message}</p> : null}
      </GameDialogModal>
    </div>
  );
}

export default BeggarKingGame;
