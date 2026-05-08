import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function digitsJoined(parts) {
  const s = parts.map((c) => String(c || '').replace(/\D/g, '').slice(-1)).join('');
  return /^\d{4}$/.test(s) ? s : null;
}

function LuckyBoothGame() {
  const { loading } = useGameCenterConfig();
  const { user, updateUserData } = useUser();

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

  const ticketPrice = srv?.ticketPrice ?? 10;
  const jackpotPeta = srv?.jackpotPeta ?? 1000000;
  const hasTicket = !!srv?.myTicket;
  const lastDraw = srv?.lastDraw;

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
      setSuccessDlg({ digits: data.digits, paid: data.ticketPrice ?? ticketPrice });
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

  if (loading) {
    return (
      <div className="ec-game ec-game--lucky-booth">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--lucky-booth">
      <p className="ec-game__lead ec-lucky-lead">
        Chọn <strong>4 chữ số</strong> (0000–9999). <strong>1 vé / kỳ / người</strong>, giá{' '}
        <strong>{Number(ticketPrice).toLocaleString('vi-VN')} Peta</strong>. Jackpot{' '}
        <strong>{Number(jackpotPeta).toLocaleString('vi-VN')} Peta</strong> — chia đều nếu nhiều người trùng số.
      </p>

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
              }}
            />
          ))}
        </div>
        {hasTicket && srv?.myTicket && (
          <p className="ec-lucky-locked">
            Vé kỳ này: <strong>{srv.myTicket.digits}</strong>
          </p>
        )}
      </section>

      <div className="ec-btn-row ec-lucky-actions">
        <button
          type="button"
          className="ec-btn ec-lucky-buy"
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
            <div className="ec-lucky-win-num-wrap">
              <span className="ec-lucky-win-label">Số trúng thưởng</span>
              <div className="ec-lucky-win-num" aria-live="polite">
                {lastDraw.winningNumber}
              </div>
              <p className="ec-lucky-draw-meta">
                Kỳ <code className="ec-lucky-code">{lastDraw.periodKey}</code> · {lastDraw.totalTickets} vé · Jackpot{' '}
                {Number(lastDraw.jackpotPeta || jackpotPeta).toLocaleString('vi-VN')} Peta
              </p>
            </div>
            {lastDraw.totalTickets === 0 ? (
              <p className="ec-lucky-muted">Không có vé tham gia kỳ đó.</p>
            ) : lastDraw.winnerCount === 0 ? (
              <p className="ec-lucky-muted">Chưa có người trúng thưởng (không vé nào trùng số).</p>
            ) : (
              <ul className="ec-lucky-winners">
                {winnerLines.map((w) => (
                  <li key={`${w.userId}-${w.digits}`} className="ec-lucky-winner-row">
                    <span className="ec-lucky-winner-name">{w.username || `User #${w.userId}`}</span>
                    <span className="ec-lucky-winner-digits">{w.digits}</span>
                    <span className="ec-lucky-winner-peta">
                      +{Number(w.petaShare || 0).toLocaleString('vi-VN')} Peta
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <p className="ec-note ec-lucky-admin-hint">
        Giá vé và jackpot chỉnh trong Admin → Game center → Lucky booth / Xổ số. Quay thưởng khi sang kỳ mới (theo giờ
        reset server).
      </p>

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
            <p className="ec-lucky-success-digits">{successDlg.digits}</p>
            <p className="ec-lucky-muted" style={{ margin: 0 }}>
              Đã trừ <strong>{Number(successDlg.paid).toLocaleString('vi-VN')} Peta</strong>. Chờ quay số cuối kỳ — nếu
              trúng, bạn sẽ nhận thư và Peta được cộng tự động.
            </p>
          </div>
        )}
      </GameDialogModal>
    </div>
  );
}

export default LuckyBoothGame;
