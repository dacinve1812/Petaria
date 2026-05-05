import React, { useEffect, useState } from 'react';
import { useGameCenterConfig } from './GameCenterConfigContext';

const STORAGE_KEY = 'entertainment-beggar-last-ts';

function randomPeta(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function BeggarKingGame() {
  const { config, loading } = useGameCenterConfig();
  const bk = config?.beggarKing || {};
  const minPeta = bk.minPeta ?? 100;
  const maxPeta = bk.maxPeta ?? 5000;
  const cooldownMs = (bk.cooldownHours ?? 6) * 60 * 60 * 1000;

  const [lastClaim, setLastClaim] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastGain, setLastGain] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setLastClaim(raw ? parseInt(raw, 10) : null);
    } catch (_) {
      setLastClaim(null);
    }
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const nextAvailable = lastClaim != null ? lastClaim + cooldownMs : null;
  const canClaim = nextAvailable == null || now >= nextAvailable;
  const remainingMs = nextAvailable != null && now < nextAvailable ? nextAvailable - now : 0;

  const formatDur = (ms) => {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const handleClaim = () => {
    if (!canClaim) return;
    const gain = randomPeta(minPeta, maxPeta);
    const ts = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(ts));
    } catch (_) {}
    setLastClaim(ts);
    setLastGain(gain);
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
          {minPeta}–{maxPeta} Peta
        </strong>
        . Cooldown <strong>{bk.cooldownHours ?? 6} giờ</strong> (client demo).
      </p>

      {lastGain != null && (
        <p style={{ fontWeight: 600, color: '#059669' }}>Lần trước nhận: {lastGain} Peta</p>
      )}

      {!canClaim && <p style={{ color: '#b45309' }}>Còn lại: {formatDur(remainingMs)}</p>}

      <div className="ec-btn-row">
        <button type="button" className="ec-btn" onClick={handleClaim} disabled={!canClaim}>
          {canClaim ? 'Xin Peta' : 'Đang chờ cooldown'}
        </button>
      </div>

      <p className="ec-note">Khoảng Peta và giờ chờ chỉnh trên Admin.</p>
    </div>
  );
}

export default BeggarKingGame;
