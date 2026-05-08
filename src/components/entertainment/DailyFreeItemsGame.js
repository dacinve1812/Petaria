import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';
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
  const { loading } = useGameCenterConfig();
  const { user } = useUser();

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

  const handleClaim = async () => {
    if (!user?.token || !srv?.canClaim || claiming) return;
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
      setResultDlg({
        itemCount: data.itemCount,
        rewards: Array.isArray(data.rewards) ? data.rewards : [],
      });
      await fetchStatus();
    } catch (e) {
      setClaimErr(e.message || 'Lỗi');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="ec-game ec-game--daily-free">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  const minN = srv?.minItemsPerClaim ?? 1;
  const maxN = srv?.maxItemsPerClaim ?? 3;
  const canClaim = !!user?.token && srv?.canClaim === true;

  return (
    <div className="ec-game ec-game--daily-free">
      <p className="ec-game__lead">
        <strong>Một lần mỗi kỳ</strong> (theo giờ reset server). Mỗi lần nhận ngẫu nhiên{' '}
        <strong>
          {minN}–{maxN}
        </strong>{' '}
        vật phẩm; mỗi món quay rarity rồi random trong catalog (tối thiểu common).
      </p>

      {!user?.token && (
        <p className="ec-note">
          <Link to="/login">Đăng nhập</Link> để nhận quà vào kho.
        </p>
      )}

      {statusErr && (
        <p className="ec-guess-alert ec-guess-alert--error" role="alert">
          {statusErr}
        </p>
      )}

      {srv && (
        <div className="ec-daily-rates" aria-label="Tỉ lệ rarity">
          {(srv.rarityWeights || []).map((rw) => (
            <span key={rw.rarity} className="ec-daily-rate-pill">
              <span className="ec-daily-rate-pill__r">{RARITY_LABEL[rw.rarity] || rw.rarity}</span>
              <span className="ec-daily-rate-pill__p">{rw.percent != null ? `${rw.percent}%` : '—'}</span>
              <span className="ec-daily-rate-pill__c">({srv.poolCounts?.[rw.rarity] ?? 0} trong DB)</span>
            </span>
          ))}
        </div>
      )}

      <div className="ec-btn-row">
        <button
          type="button"
          className="ec-btn"
          onClick={() => void handleClaim()}
          disabled={!user?.token || !canClaim || claiming || !!statusErr}
        >
          {!user?.token
            ? 'Đăng nhập để nhận'
            : claiming
              ? 'Đang nhận…'
              : srv?.canClaim === false
                ? 'Đã nhận trong kỳ này'
                : 'Nhận quà'}
        </button>
      </div>

      {claimErr && (
        <p className="ec-guess-alert ec-guess-alert--warn" role="alert">
          {claimErr}
        </p>
      )}

      <p className="ec-note">Min/max số item và tỉ lệ rarity chỉnh trong Admin → Game center → Vật phẩm miễn phí.</p>

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
