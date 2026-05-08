import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function BeggarKingGame() {
  const { user, updateUserData } = useUser();
  const { config, loading } = useGameCenterConfig();
  const bk = config?.beggarKing || {};
  const fallbackMin = bk.minPeta ?? 100;
  const fallbackMax = bk.maxPeta ?? 5000;
  const fallbackCd = bk.cooldownHours ?? 6;

  const [now, setNow] = useState(() => Date.now());
  const [srv, setSrv] = useState(null);
  const [statusErr, setStatusErr] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(null);
  const [claimErr, setClaimErr] = useState('');

  const minPeta = srv?.minPeta ?? fallbackMin;
  const maxPeta = srv?.maxPeta ?? fallbackMax;
  const cooldownHours = srv?.cooldownHours ?? fallbackCd;
  const cooldownMs = srv?.cooldownMs ?? cooldownHours * 60 * 60 * 1000;

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

  const formatDur = (ms) => {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
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
        await fetchStatus();
        return;
      }
      if (!r.ok) {
        throw new Error(data.error || 'Không nhận được Peta');
      }
      const granted = Math.max(0, Number(data.grantedPeta) || 0);
      setRewardAmount(granted);
      setRewardOpen(true);
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

  if (loading) {
    return (
      <div className="ec-game">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game">
      <p className="ec-game__lead">
        Ông nhà giàu cho <strong>
          {minPeta.toLocaleString('vi-VN')}–{maxPeta.toLocaleString('vi-VN')} Peta
        </strong>
        . Cooldown <strong>{cooldownHours} giờ</strong> (theo server).
      </p>

      {!user?.token && (
        <p className="ec-note">
          <Link to="/login">Đăng nhập</Link> để nhận Peta thật và đồng bộ cooldown.
        </p>
      )}

      {statusErr && (
        <p style={{ color: '#b91c1c', fontWeight: 600 }} role="alert">
          {statusErr}
        </p>
      )}

      {claimErr && (
        <p style={{ color: '#b45309', fontWeight: 600 }} role="alert">
          {claimErr}
        </p>
      )}

      {user?.token && !canClaim && remainingMs > 0 && (
        <p style={{ color: '#b45309' }}>Còn lại: {formatDur(remainingMs)}</p>
      )}

      <div className="ec-btn-row">
        <button
          type="button"
          className="ec-btn"
          onClick={() => void handleClaim()}
          disabled={!user?.token || !canClaim || claiming || !!statusErr}
        >
          {!user?.token
            ? 'Đăng nhập để xin Peta'
            : claiming
              ? 'Đang xử lý…'
              : canClaim
                ? 'Xin Peta'
                : 'Đang chờ cooldown'}
        </button>
      </div>

      <p className="ec-note">Khoảng Peta và giờ chờ chỉnh trên Admin (Game center → Vua ăn mày).</p>

      <GameDialogModal
        isOpen={rewardOpen && rewardAmount != null}
        onClose={() => {
          setRewardOpen(false);
          setRewardAmount(null);
        }}
        title="Nhận Peta"
        mode="alert"
        confirmLabel="Đóng"
        onConfirm={() => {
          setRewardOpen(false);
          setRewardAmount(null);
        }}
        tone="info"
      >
        <p style={{ fontWeight: 700, textAlign: 'center', margin: 0 }}>
          Ông nhà giàu cho bạn{' '}
          <strong style={{ color: '#4f46e5' }}>
            {Number(rewardAmount || 0).toLocaleString('vi-VN')} Peta
          </strong>
          .
        </p>
      </GameDialogModal>
    </div>
  );
}

export default BeggarKingGame;
