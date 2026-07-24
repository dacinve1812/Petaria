import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';
import { dispatchGameCenterAlertsRefresh } from '../../utils/gameCenterAlertEvents';
import { useGameCenterConfig } from './GameCenterConfigContext';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useFeatureBackNav } from './useFeatureBackNav';
import { buildLuckyWheelSegments } from '../../utils/luckyWheelSegments';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const ICON_PETA = '/images/icons/peta.png';
/** Khớp `--ec-spin-duration` trong EntertainmentCenter.css */
const SPIN_DURATION_MS = 4200;
const ICON_PETA_GOLD = '/images/icons/petagold.png';

function equipImageSrc(imageField) {
  const s = String(imageField || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `/images/equipments/${s}`;
}

function compactAmount(n) {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${Math.round(abs)}`;
}

/** Chữ nhỏ trên đĩa quay (số Peta / Gold). */
function wheelCurrencyCaption(seg) {
  const c = String(seg?.currency || '').toLowerCase();
  if (c !== 'peta' && c !== 'petagold') return null;
  const min = Number(seg.amountMin);
  const max = Number(seg.amountMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) return compactAmount(min);
  return `${compactAmount(min)}–${compactAmount(max)}`;
}

/** Góc từ mốc 12h theo chiều kim đồng hồ đến giữa ô i (trùng conic-gradient + logic quay). */
function segmentCenterCwFromTopDeg(i, n) {
  const seg = 360 / Math.max(1, n);
  return (i + 0.5) * seg;
}

function normalizeDeg(d) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function buildConicGradient(n) {
  /* Trắng / kem ấm — tối giản như vòng quay tham chiếu */
  const light = '#ffffff';
  const soft = '#f5e6c8';
  const stops = [];
  const seg = Math.max(1, n);
  for (let i = 0; i < seg; i += 1) {
    const c = i % 2 === 0 ? light : soft;
    const start = (i / seg) * 360;
    const end = ((i + 1) / seg) * 360;
    stops.push(`${c} ${start}deg ${end}deg`);
  }
  return `conic-gradient(from -90deg, ${stops.join(', ')})`;
}

/** Hiển thị khoảng Peta / Peta Gold từ cấu hình (min=max → một số). */
function formatCurrencyAmountLine(seg) {
  const c = String(seg?.currency || '').toLowerCase();
  if (c !== 'peta' && c !== 'petagold') return '';
  const min = Number(seg.amountMin);
  const max = Number(seg.amountMax);
  const unit = c === 'peta' ? 'Peta' : 'Peta Gold';
  if (Number.isFinite(min) && Number.isFinite(max)) {
    if (min === max) return `${min} ${unit}`;
    return `${min}–${max} ${unit}`;
  }
  return unit;
}

function LuckyWheelGame() {
  const { config, loading, reload } = useGameCenterConfig();
  const backNav = useFeatureBackNav();
  const lw = config?.luckyWheel;
  const narrative = lw?.narrative || {};
  const segments = useMemo(() => buildLuckyWheelSegments(lw), [lw]);
  const maxFromConfig = lw?.maxPurchasesPerDay ?? 2;
  const historyRows = lw?.serverHistory?.length ? lw.serverHistory : [];

  const intro = useMemo(
    () => buildFeatureNpcProps(narrative, {}, { speaker: '', portraitSrc: '', lines: [] }),
    [narrative],
  );

  const gradient = useMemo(() => buildConicGradient(segments.length || 2), [segments.length]);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  /** null = chưa tải / khách; có token sau fetch */
  const [spinQuota, setSpinQuota] = useState(null);

  const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (loading) return;
    const t = localStorage.getItem('token');
    if (!t) {
      setSpinQuota(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/game-center/lucky-wheel/status`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('status'))))
      .then((d) => {
        if (cancelled) return;
        setSpinQuota({
          used: Number(d.spinsUsedToday) || 0,
          max: Math.max(1, Number(d.maxSpinsPerDay) || maxFromConfig),
        });
      })
      .catch(() => {
        if (!cancelled) setSpinQuota({ used: 0, max: Math.max(1, maxFromConfig) });
      });
    return () => {
      cancelled = true;
    };
  }, [loading, maxFromConfig]);

  const maxSpins = spinQuota?.max ?? Math.max(1, maxFromConfig);
  const spinsUsed = spinQuota?.used ?? 0;

  const canSpin =
    !!authToken &&
    spinQuota != null &&
    spinsUsed < maxSpins &&
    !spinning &&
    segments.length >= 2;

  const handleSpin = async () => {
    if (!authToken) return;
    if (!canSpin) return;

    const t = localStorage.getItem('token');
    setSpinning(true);
    setLastWin(null);
    setResultModalOpen(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/game-center/lucky-wheel/spin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSpinning(false);
        window.alert(data.error || 'Không quay được.');
        if (res.status === 429 && data.maxSpinsPerDay != null) {
          setSpinQuota({
            used: data.spinsUsedToday ?? maxSpins,
            max: Math.max(1, Number(data.maxSpinsPerDay) || maxSpins),
          });
        }
        return;
      }

      const idx = Number(data.segmentIndex);
      const n = segments.length;
      if (!Number.isFinite(idx) || idx < 0 || idx >= n) {
        setSpinning(false);
        reload?.();
        window.alert('Cấu hình vòng quay đã thay đổi. Hãy tải lại trang.');
        return;
      }
      const segmentAngle = 360 / n;
      const alpha = (idx + 0.5) * segmentAngle;
      const spins = 5 + Math.floor(Math.random() * 3);

      setRotation((rPrev) => {
        const world = normalizeDeg(alpha + normalizeDeg(rPrev));
        const deltaExtra = world === 0 ? 0 : 360 - world;
        return rPrev + spins * 360 + deltaExtra;
      });

      if (data.spinsUsedToday != null && data.maxSpinsPerDay != null) {
        setSpinQuota({
          used: Number(data.spinsUsedToday),
          max: Math.max(1, Number(data.maxSpinsPerDay)),
        });
      }

      window.setTimeout(() => {
        setSpinning(false);
        setLastWin(data.lastWin || null);
        setResultModalOpen(true);
        dispatchCurrencyUpdate();
        dispatchGameCenterAlertsRefresh();
        reload?.();
      }, SPIN_DURATION_MS);
    } catch {
      setSpinning(false);
      window.alert('Lỗi mạng hoặc server.');
    }
  };

  if (loading) {
    return (
      <div className="ec-game ec-game--wheel">
        <p className="ec-game__lead">Đang tải cấu hình...</p>
      </div>
    );
  }

  const currencyRewardHint = lastWin ? formatCurrencyAmountLine(lastWin) : '';
  const curWin = lastWin ? String(lastWin.currency || '').toLowerCase() : '';

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

  const quotaLabel =
    !authToken ? (
      <span>Đăng nhập để quay và nhận thưởng.</span>
    ) : spinQuota == null ? (
      <span>
        Lượt đã dùng: <strong>…</strong> / {maxSpins}
      </span>
    ) : (
      <span>
        Lượt đã dùng: <strong>{spinQuota.used}</strong> / {spinQuota.max}
        <span style={{ color: '#64748b', fontSize: '0.85em', marginLeft: 8 }}>
          
        </span>
      </span>
    );

  return (
    <div className="ec-game ec-game--wheel">
      <FeatureNpcIntro
        speaker={intro.speaker}
        portraitSrc={intro.portraitSrc}
        lorePortraitSrc={intro.lorePortraitSrc}
        greeting={intro.greeting}
        loreLines={intro.loreLines}
      />

      <div className="ec-wheel-stats">{quotaLabel}</div>

      <div className="ec-wheel-wrap">
        <div className="ec-wheel">
          <span className="ec-wheel__pointer" aria-hidden />
          <div
            className="ec-wheel__spin-layer"
            style={{
              transform: `rotate(${rotation}deg)`,
              '--ec-spin-duration': `${SPIN_DURATION_MS}ms`,
            }}
          >
            <div className="ec-wheel__disk" style={{ background: gradient }} />
            <div className="ec-wheel__prizes">
              {segments.map((s, i) => {
                const n = segments.length;
                const cwDeg = segmentCenterCwFromTopDeg(i, n);
                const cur = String(s.currency || '').toLowerCase();
                const cap = wheelCurrencyCaption(s);
                return (
                  <div
                    key={s.id || `seg-${i}`}
                    className="ec-wheel-prize"
                    style={{ '--cw': `${cwDeg}deg` }}
                    title={s.label}
                  >
                    <div className="ec-wheel-prize__tile ec-wheel-prize__tile--radial">
                      {cur === 'peta' && (
                        <>
                          <img
                            src={ICON_PETA}
                            alt=""
                            className="ec-wheel-prize__icon-img ec-wheel-prize__icon-img--currency"
                          />
                          {cap ? <span className="ec-wheel-prize__cap">{cap}</span> : null}
                        </>
                      )}
                      {cur === 'petagold' && (
                        <>
                          <img
                            src={ICON_PETA_GOLD}
                            alt=""
                            className="ec-wheel-prize__icon-img ec-wheel-prize__icon-img--currency"
                          />
                          {cap ? <span className="ec-wheel-prize__cap">{cap}</span> : null}
                        </>
                      )}
                      {cur !== 'peta' && cur !== 'petagold' && (
                        <>
                          {s.itemImage ? (
                            <img src={equipImageSrc(s.itemImage)} alt="" className="ec-wheel-prize__item-img" />
                          ) : (
                            <span className="ec-wheel-prize__fallback">{i + 1}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <button type="button" className="ec-btn" onClick={handleSpin} disabled={!canSpin}>
          {!authToken
            ? 'Đăng nhập để quay'
            : segments.length < 2
              ? 'Thiếu cấu hình ô Peta / Gold'
              : spinning
                ? 'Đang quay...'
                : canSpin
                  ? 'Quay'
                  : spinQuota != null && spinsUsed >= maxSpins
                    ? 'Đã hết lượt quay hôm nay'
                    : 'Đang tải lượt...'}
        </button>
      </div>

      <GameDialogModal
        isOpen={resultModalOpen && !!lastWin}
        onClose={() => setResultModalOpen(false)}
        title="Kết quả nhận thưởng"
        mode="alert"
        tone="info"
        confirmLabel="Đóng"
        onConfirm={() => setResultModalOpen(false)}
      >
        {lastWin && (
          <div className="ec-wheel-result-modal">
            <div className="ec-wheel-result-modal__visual">
              {curWin === 'peta' && (
                <img src={ICON_PETA} alt="" className="ec-wheel-result-modal__icon" />
              )}
              {curWin === 'petagold' && (
                <img src={ICON_PETA_GOLD} alt="" className="ec-wheel-result-modal__icon" />
              )}
              {lastWin.itemImage ? (
                <img
                  src={equipImageSrc(lastWin.itemImage)}
                  alt=""
                  className="ec-wheel-result-modal__img"
                />
              ) : null}
            </div>
            <div className="ec-wheel-result-modal__label">{lastWin.label}</div>
            {lastWin.rarity ? (
              <div className="ec-wheel-result-modal__rarity">{lastWin.rarity}</div>
            ) : null}
            {currencyRewardHint ? (
              <div className="ec-wheel-result-modal__reward">{currencyRewardHint}</div>
            ) : null}
          </div>
        )}
      </GameDialogModal>

      <h3 className="ec-section-heading">Lịch sử trúng thưởng</h3>
      <div className="ec-history">
        <table>
          <thead>
            <tr>
              <th>Người chơi</th>
              <th>Phần thưởng</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {historyRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="ec-history__empty-cell">
                  Chưa có lượt quay được ghi nhận.
                </td>
              </tr>
            ) : (
              historyRows.map((row, i) => (
                <tr key={`${row.time}-${row.user}-${i}`}>
                  <td>{row.user}</td>
                  <td>{row.prize}</td>
                  <td>{row.time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="ec-btn-row ec-feature-actions ec-feature-actions--back">{backButton}</div>
    </div>
  );
}

export default LuckyWheelGame;
