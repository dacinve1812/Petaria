import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';
import { dispatchGameCenterAlertsRefresh } from '../../utils/gameCenterAlertEvents';

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

/** /game-center/daily-free — nội dung trang trực tiếp (không NarrativeHost). */
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

  const vars = useMemo(
    () => ({
      minItems: String(minN),
      maxItems: String(maxN),
      itemCount: resultDlg?.itemCount != null ? String(resultDlg.itemCount) : '…',
      playerName: user?.username || user?.name || 'bạn',
    }),
    [minN, maxN, resultDlg, user?.username, user?.name],
  );

  const claimLabel = narrative.claimLabel || 'Nhận quà hôm nay';

  const intro = useMemo(
    () =>
      buildFeatureNpcProps(narrative, vars, {
        speaker: 'Cư dân làng',
        portraitSrc: '/images/character/char2.jpg',
        lines: [
          'Chào ngươi! Đây là Làng nhân ái — nơi chia sẻ vật phẩm miễn phí mỗi ngày.',
          'Mỗi ngày chỉ nhận một lần, khoảng {minItems}–{maxItems} món.',
        ],
      }),
    [narrative, vars],
  );

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
        await fetchStatus();
        return;
      }
      if (!r.ok) throw new Error(data.error || 'Không nhận được quà');
      const count = Number(data.itemCount) || 0;
      setResultDlg({
        itemCount: count,
        rewards: Array.isArray(data.rewards) ? data.rewards : [],
      });
      await fetchStatus();
      dispatchGameCenterAlertsRefresh();
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
      <div className="ec-game ec-game--daily-free">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--daily-free">
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
          <Link to="/login">Đăng nhập</Link> để nhận quà vào kho.
        </p>
      ) : null}

      {user?.token && alreadyClaimed ? (
        <p className="ec-guess-alert ec-guess-alert--warn" role="status">
          Đã nhận trong kỳ này — quay lại sau giờ reset server.
        </p>
      ) : null}

      <div className="ec-btn-row ec-feature-actions">
        {!user?.token ? (
          <Link to="/login" className="ec-btn ec-mystery-btn-primary">
            Đăng nhập để nhận quà
          </Link>
        ) : (
          <button
            type="button"
            className="ec-btn ec-mystery-btn-primary"
            onClick={() => void handleClaim()}
            disabled={!canClaim || claiming || !!statusErr}
          >
            {claiming ? 'Đang nhận…' : claimLabel}
          </button>
        )}
      </div>
      <div className="ec-btn-row ec-feature-actions ec-feature-actions--back">{backButton}</div>

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
