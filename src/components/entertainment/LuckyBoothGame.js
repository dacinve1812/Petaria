import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function digitsJoined(parts) {
  const s = parts.map((c) => String(c || '').replace(/\D/g, '').slice(-1)).join('');
  return /^\d{4}$/.test(s) ? s : null;
}

function formatDrawDate(drawnAt, periodKey) {
  let d = null;
  if (drawnAt) d = new Date(drawnAt);
  else if (periodKey != null && /^\d+$/.test(String(periodKey))) {
    d = new Date(Number(periodKey));
  }
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function DigitCircles({ value, className = '' }) {
  const raw = String(value ?? '');
  const chars = (raw + '----').slice(0, 4).split('');
  return (
    <div className={`ec-lucky-digit-circles ${className}`.trim()} aria-label={raw || undefined}>
      {chars.map((ch, i) => (
        <span key={i} className="ec-lucky-digit-circle">
          {ch}
        </span>
      ))}
    </div>
  );
}

/** /game-center/lucky-booth — nội dung trang trực tiếp (không NarrativeHost). */
function LuckyBoothGame() {
  const { config, loading } = useGameCenterConfig();
  const { user, updateUserData } = useUser();
  const backNav = useFeatureBackNav();
  const lb = config?.luckyBooth || {};
  const narrative = lb.narrative || {};

  const [srv, setSrv] = useState(null);
  const [statusErr, setStatusErr] = useState('');
  const [cells, setCells] = useState(['', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [buyErr, setBuyErr] = useState('');
  const [successDlg, setSuccessDlg] = useState(null);

  const fetchStatus = useCallback(async () => {
    setStatusErr('');
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const r = await fetch(`${API_BASE_URL}/api/game-center/lucky-booth/status`, { headers });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSrv(null);
        setStatusErr(typeof data.error === 'string' ? data.error : 'Không tải được Xổ số');
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

  const ticketPrice = srv?.ticketPrice ?? lb.ticketPrice ?? 10;
  const jackpotPeta = srv?.jackpotPeta ?? lb.jackpotPeta ?? 1000000;
  const hasTicket = !!srv?.myTicket;
  const lastDraw = srv?.lastDraw;

  useEffect(() => {
    if (hasTicket && srv?.myTicket?.digits) {
      const d = String(srv.myTicket.digits);
      if (/^\d{4}$/.test(d)) setCells(d.split(''));
    }
  }, [hasTicket, srv?.myTicket?.digits]);

  const canBuy =
    !!user?.token &&
    !hasTicket &&
    srv?.loggedIn !== false &&
    digitsJoined(cells) != null &&
    !busy &&
    !statusErr;

  const setDigitAt = (idx, raw) => {
    const ch = String(raw).replace(/\D/g, '').slice(-1);
    setCells((prev) => {
      const next = [...prev];
      next[idx] = ch;
      return next;
    });
  };

  const vars = useMemo(
    () => ({
      ticketPrice: Number(ticketPrice).toLocaleString('vi-VN'),
      jackpot: Number(jackpotPeta).toLocaleString('vi-VN'),
      playerName: user?.username || user?.name || 'bạn',
      digits: srv?.myTicket?.digits || '….',
    }),
    [ticketPrice, jackpotPeta, user?.username, user?.name, srv?.myTicket?.digits],
  );

  const intro = useMemo(
    () =>
      buildFeatureNpcProps(narrative, vars, {
        speaker: 'Everlyn',
        portraitSrc: '/images/character/Everlyn.png',
        lines: [
          'Chào ngươi! Đây là Làng Hảo Vọng — mọi người ở đây đều thích chơi vé số.',
          'Vé chỉ {ticketPrice} Peta, giải độc đắc {jackpot} Peta. Biết đâu may mắn sẽ đến với ngươi!',
        ],
      }),
    [narrative, vars],
  );

  const handlePurchase = async () => {
    const d = digitsJoined(cells);
    if (!user?.token || !d) return;
    setBusy(true);
    setBuyErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/lucky-booth/purchase`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ digits: d }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) {
        setBuyErr(data.error || 'Đã có vé trong kỳ');
        await fetchStatus();
        return;
      }
      if (r.status === 402) {
        setBuyErr(data.error || 'Không đủ Peta');
        return;
      }
      if (!r.ok) throw new Error(data.error || 'Không mua được vé');
      if (data.petaRemaining != null) {
        updateUserData({ peta: Number(data.petaRemaining) });
      }
      dispatchCurrencyUpdate();
      const digits = data.digits || d;
      const paid = data.ticketPrice ?? ticketPrice;
      setSuccessDlg({ digits, paid });
      await fetchStatus();
    } catch (e) {
      setBuyErr(e.message || 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  const winnerLines = useMemo(() => {
    if (!lastDraw?.winners?.length) return [];
    return lastDraw.winners;
  }, [lastDraw]);

  const myLastWin = useMemo(() => {
    if (!lastDraw?.winners?.length || !user) return null;
    const uid = Number(user.userId ?? user.id);
    const uname = String(user.username || user.effectiveName || '')
      .trim()
      .toLowerCase();
    return (
      lastDraw.winners.find((w) => {
        const wUid = Number(w.userId ?? w.user_id);
        const wName = String(w.username || '')
          .trim()
          .toLowerCase();
        if (uid && wUid && uid === wUid) return true;
        if (uname && wName && uname === wName) return true;
        return false;
      }) || null
    );
  }, [lastDraw, user]);

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
      <div className="ec-game ec-game--lucky-booth">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--lucky-booth">
      <FeatureNpcIntro
        speaker={intro.speaker}
        portraitSrc={intro.portraitSrc}
        lorePortraitSrc={intro.lorePortraitSrc}
        greeting={intro.greeting}
        loreLines={intro.loreLines}
      />

      <div className="ec-lucky-play">
        {!user?.token && (
          <p className="ec-note">
            <Link to="/login">Đăng nhập</Link> để mua vé.
          </p>
        )}

        {statusErr && (
          <p className="ec-guess-alert ec-guess-alert--error" role="alert">
            {statusErr}
          </p>
        )}

        {hasTicket && srv?.myTicket ? (
          <p className="ec-guess-alert" role="status">
            Kỳ này bạn đã có vé <strong>{srv.myTicket.digits}</strong> — chờ giờ sổ số.
          </p>
        ) : null}

        <section className="ec-lucky-panel" aria-labelledby="ec-lucky-pick-title">
          <h2 id="ec-lucky-pick-title" className="ec-lucky-panel__title">
            Dãy số của bạn
          </h2>
          <div className="ec-lucky-digits">
            {[0, 1, 2, 3].map((i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={1}
                autoComplete="off"
                aria-label={`Chữ số thứ ${i + 1}`}
                className="ec-lucky-digit"
                value={cells[i]}
                disabled={hasTicket || !user?.token || busy}
                onChange={(e) => setDigitAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !cells[i] && i > 0) {
                    const prev = document.querySelector(`[aria-label="Chữ số thứ ${i}"]`);
                    if (prev && typeof prev.focus === 'function') prev.focus();
                  }
                  if (/^\d$/.test(e.key) && i < 3) {
                    window.setTimeout(() => {
                      const next = document.querySelector(`[aria-label="Chữ số thứ ${i + 2}"]`);
                      if (next && typeof next.focus === 'function') next.focus();
                    }, 0);
                  }
                }}
              />
            ))}
          </div>
          {hasTicket && srv?.myTicket && (
            <p className="ec-lucky-locked">
              Vé của bạn: <strong>{srv.myTicket.digits}</strong>
            </p>
          )}
          <p className="ec-lucky-jackpot-now">
            Độc đắc:{' '}
            <strong>{Number(jackpotPeta).toLocaleString('vi-VN')} Peta</strong>
          </p>
        </section>

        <div className="ec-btn-row ec-lucky-actions">
          <button
            type="button"
            className="ec-btn"
            onClick={() => void handlePurchase()}
            disabled={!canBuy}
          >
            {busy ? 'Đang xử lý…' : `Mua vé (${Number(ticketPrice).toLocaleString('vi-VN')} Peta)`}
          </button>
        </div>

        {buyErr && (
          <p className="ec-guess-alert ec-guess-alert--warn" role="alert">
            {buyErr}
          </p>
        )}

        <section className="ec-lucky-draw-card" aria-labelledby="ec-lucky-result-title">
          <h2 id="ec-lucky-result-title" className="ec-lucky-draw-card__title">
            Kết quả kỳ gần nhất
          </h2>
          {!lastDraw ? (
            <p className="ec-lucky-muted">Chưa có lần quay nào.</p>
          ) : (
            <>
              {myLastWin ? (
                <p className="ec-lucky-you-won" role="status">
                  Bạn đã trúng độc đắc — số <strong>{myLastWin.digits}</strong>
                  {Number(myLastWin.petaShare) > 0
                    ? `, +${Number(myLastWin.petaShare).toLocaleString('vi-VN')} Peta`
                    : ''}
                  . Kiểm tra hộp thư để xem thư thông báo.
                </p>
              ) : null}
              <div className="ec-lucky-win-num-wrap">
                <span className="ec-lucky-win-label">Số trúng thưởng</span>
                <DigitCircles value={lastDraw.winningNumber} className="ec-lucky-digit-circles--win" />
                <ul className="ec-lucky-draw-stats">
                  <li>
                    <span className="ec-lucky-draw-stats__label">Ngày sổ</span>
                    <span className="ec-lucky-draw-stats__val">
                      {formatDrawDate(lastDraw.drawnAt, lastDraw.periodKey)}
                    </span>
                  </li>
                  <li>
                    <span className="ec-lucky-draw-stats__label">Tổng vé</span>
                    <span className="ec-lucky-draw-stats__val">
                      {Number(lastDraw.totalTickets || 0).toLocaleString('vi-VN')}
                    </span>
                  </li>
                  <li>
                    <span className="ec-lucky-draw-stats__label">Độc đắc</span>
                    <span className="ec-lucky-draw-stats__val">
                      {Number(lastDraw.jackpotPeta ?? 0).toLocaleString('vi-VN')} Peta
                    </span>
                  </li>
                </ul>
              </div>
              {lastDraw.totalTickets === 0 ? (
                <p className="ec-lucky-muted">Không có vé tham gia.</p>
              ) : lastDraw.winnerCount === 0 ? (
                <p className="ec-lucky-muted">Chưa có người trúng thưởng (không vé nào trùng số).</p>
              ) : (
                <ul className="ec-lucky-winners">
                  {winnerLines.map((w) => {
                    const uid = Number(user?.userId ?? user?.id);
                    const uname = String(user?.username || user?.effectiveName || '')
                      .trim()
                      .toLowerCase();
                    const wUid = Number(w.userId ?? w.user_id);
                    const wName = String(w.username || '')
                      .trim()
                      .toLowerCase();
                    const isMe =
                      (uid && wUid && uid === wUid) || (uname && wName && uname === wName);
                    return (
                      <li
                        key={`${w.userId}-${w.digits}`}
                        className={`ec-lucky-winner-row${isMe ? ' is-me' : ''}`}
                      >
                        <span className="ec-lucky-winner-name">
                          Người trúng thưởng: {w.username || `User #${w.userId}`}
                        </span>
                        <span className="ec-lucky-winner-digits">{w.digits}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        <div className="ec-btn-row ec-lucky-actions ec-feature-actions--back">{backButton}</div>
      </div>

      <GameDialogModal
        isOpen={!!successDlg}
        onClose={() => setSuccessDlg(null)}
        title="Đã mua vé"
        mode="alert"
        confirmLabel="Đóng"
        tone="info"
        onConfirm={() => setSuccessDlg(null)}
      >
        {successDlg && (
          <div className="ec-lucky-success-body">
            <DigitCircles value={successDlg.digits} className="ec-lucky-digit-circles--success" />
            <p className="ec-lucky-muted" style={{ margin: '12px 0 0' }}>
              Đã trừ <strong>{Number(successDlg.paid).toLocaleString('vi-VN')} Peta</strong>. Chờ quay số cuối
              kỳ — nếu trúng, Peta được cộng tự động khi bạn đăng nhập ngày hôm sau.
            </p>
          </div>
        )}
      </GameDialogModal>
    </div>
  );
}

export default LuckyBoothGame;
