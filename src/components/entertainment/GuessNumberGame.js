import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/** Hiện số trong vòng trước, sau đó mới mở GameDialogModal (ms). */
const REVEAL_MODAL_DELAY_MS = 1200;

function GuessNumberGame() {
  const { user, updateUserData } = useUser();
  const { config, loading } = useGameCenterConfig();
  const gn = config?.guessNumber || {};
  const fbMin = gn.minSecret ?? 1;
  const fbMax = gn.maxSecret ?? 99;
  const fbWin = gn.rewardPetaWin ?? 10000;
  const fbLose = gn.penaltyPetaLose ?? 5000;
  const fbMaxPlays = gn.maxPlaysPerDay ?? 10;

  const [srv, setSrv] = useState(null);
  const [statusErr, setStatusErr] = useState('');
  const [pivot, setPivot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  /** Số ẩn vừa lộ trong vòng tròn (chờ modal); đóng modal thì reset về ? */
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [revealTone, setRevealTone] = useState(null); // 'win' | 'lose'
  const [resultDlg, setResultDlg] = useState(null);
  const revealModalTimerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    setStatusErr('');
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const r = await fetch(`${API_BASE_URL}/api/game-center/guess-number/status`, { headers });
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
    if (!srv) return;
    if (srv.hasPending && srv.pendingPivot != null) {
      setPivot(Number(srv.pendingPivot));
    } else if (!srv.hasPending) {
      setPivot(null);
    }
  }, [srv]);

  useEffect(
    () => () => {
      if (revealModalTimerRef.current != null) {
        window.clearTimeout(revealModalTimerRef.current);
        revealModalTimerRef.current = null;
      }
    },
    [],
  );

  const minS = srv?.minSecret ?? fbMin;
  const maxS = srv?.maxSecret ?? fbMax;
  const rewardWin = srv?.rewardPetaWin ?? fbWin;
  const penaltyLose = srv?.penaltyPetaLose ?? fbLose;
  const maxPlays = srv?.maxPlaysPerDay ?? fbMaxPlays;
  const playsRem = srv?.playsRemaining;
  const hasRound = pivot != null && Number.isFinite(pivot);
  const showGuessButtons = hasRound;
  const showStartButton = !showGuessButtons;
  const blockStartUntilDlgClosed = revealedSecret !== null || resultDlg !== null;

  const startRound = async () => {
    if (!user?.token || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/guess-number/start-round`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) {
        setMsg(data.error || 'Đã hết lượt chơi');
        await fetchStatus();
        return;
      }
      if (!r.ok) throw new Error(data.error || 'Không bắt đầu được vòng');
      setPivot(Number(data.pivot));
      await fetchStatus();
    } catch (e) {
      setMsg(e.message || 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  const submitChoice = async (choice) => {
    if (!user?.token || !hasRound || busy) return;
    setBusy(true);
    setMsg('');
    if (revealModalTimerRef.current != null) {
      window.clearTimeout(revealModalTimerRef.current);
      revealModalTimerRef.current = null;
    }
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/guess-number/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ choice }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 402) {
        setMsg(data.error || 'Không đủ Peta khi đoán sai');
        return;
      }
      if (r.status === 429) {
        setMsg(data.error || 'Hết lượt');
        await fetchStatus();
        return;
      }
      if (!r.ok) throw new Error(data.error || 'Không gửi được lựa chọn');
      const delta = Number(data.deltaPeta) || 0;
      const payload = {
        correct: !!data.correct,
        deltaPeta: delta,
        secret: Number(data.secret),
        pivot: Number(data.pivot),
      };
      setRevealedSecret(payload.secret);
      setRevealTone(payload.correct ? 'win' : 'lose');
      if (data.petaRemaining != null) {
        updateUserData({ peta: Number(data.petaRemaining) });
      }
      dispatchCurrencyUpdate();
      await fetchStatus();
      revealModalTimerRef.current = window.setTimeout(() => {
        revealModalTimerRef.current = null;
        setResultDlg(payload);
      }, REVEAL_MODAL_DELAY_MS);
    } catch (e) {
      setMsg(e.message || 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  const closeResultDialog = () => {
    if (revealModalTimerRef.current != null) {
      window.clearTimeout(revealModalTimerRef.current);
      revealModalTimerRef.current = null;
    }
    setResultDlg(null);
    setRevealedSecret(null);
    setRevealTone(null);
  };

  if (loading) {
    return (
      <div className="ec-game ec-game--guess">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--guess">
      <p className="ec-game__lead ec-game__lead--guess">
        Một số bí mật ({minS}–{maxS}) được giấu trên server. So sánh với mốc{' '}
        {hasRound ? (
          <strong className="ec-guess-pivot-chip">{pivot}</strong>
        ) : (
          <strong className="ec-guess-pivot-chip ec-guess-pivot-chip--empty">—</strong>
        )}
        : đoán số ẩn <em>cao hơn</em> hay <em>thấp hơn</em> mốc?
      </p>

      <div className="ec-guess-stats" aria-label="Thưởng phạt và lượt">
        <span className="ec-guess-stat ec-guess-stat--win">
          <span className="ec-guess-stat__label">Đúng</span>
          <span className="ec-guess-stat__val">+{Number(rewardWin).toLocaleString('vi-VN')}</span>
        </span>
        <span className="ec-guess-stat ec-guess-stat--lose">
          <span className="ec-guess-stat__label">Sai</span>
          <span className="ec-guess-stat__val">−{Number(penaltyLose).toLocaleString('vi-VN')}</span>
        </span>
        {user?.token && playsRem != null ? (
          <span className="ec-guess-stat ec-guess-stat--turns">
            <span className="ec-guess-stat__label">Lượt</span>
            <span className="ec-guess-stat__val">
              {playsRem}/{maxPlays}
            </span>
          </span>
        ) : null}
      </div>

      {!user?.token && (
        <p className="ec-note ec-guess-login-hint">
          <Link to="/login">Đăng nhập</Link> để chơi (lượt &amp; Peta theo server).
        </p>
      )}

      {statusErr && (
        <p className="ec-guess-alert ec-guess-alert--error" role="alert">
          {statusErr}
        </p>
      )}

      {msg && (
        <p className="ec-guess-alert ec-guess-alert--warn" role="alert">
          {msg}
        </p>
      )}

      <div className="ec-guess-board">
        <div className="ec-guess-mystery-wrap">
          <div
            className={
              revealedSecret != null && revealTone
                ? `ec-guess-mystery ec-guess-mystery--revealed ec-guess-mystery--revealed-${revealTone}`
                : 'ec-guess-mystery'
            }
            aria-hidden={revealedSecret == null ? true : undefined}
            aria-live="polite"
          >
            {revealedSecret != null ? revealedSecret : '?'}
          </div>
          <span className="ec-guess-mystery-caption">Số ẩn</span>
        </div>
        <div className="ec-guess-compare">
          {hasRound ? (
            <>
              Số ẩn lớn hơn <strong>{pivot}</strong> hay bé hơn <strong>{pivot}</strong>?
            </>
          ) : (
            <>Bấm &quot;Bắt đầu vòng&quot; để nhận mốc so sánh.</>
          )}
        </div>
      </div>

      <div className="ec-btn-row ec-guess-actions">
        {showStartButton && (
          <button
            type="button"
            className="ec-btn ec-btn--ghost ec-guess-btn ec-guess-btn--start"
            onClick={() => void startRound()}
            disabled={
              !user?.token ||
              busy ||
              !!statusErr ||
              blockStartUntilDlgClosed ||
              (playsRem != null && playsRem <= 0)
            }
          >
            {busy && !hasRound ? 'Đang tạo…' : 'Bắt đầu vòng'}
          </button>
        )}
        {showGuessButtons && (
          <>
            <button
              type="button"
              className="ec-btn ec-guess-btn ec-guess-btn--high"
              onClick={() => void submitChoice('high')}
              disabled={!user?.token || !hasRound || busy || !!statusErr}
            >
              <span className="ec-guess-btn__icon" aria-hidden>
                ↑
              </span>
              Cao hơn {hasRound ? pivot : '…'}
            </button>
            <button
              type="button"
              className="ec-btn ec-btn--ghost ec-guess-btn ec-guess-btn--low"
              onClick={() => void submitChoice('low')}
              disabled={!user?.token || !hasRound || busy || !!statusErr}
            >
              <span className="ec-guess-btn__icon" aria-hidden>
                ↓
              </span>
              Thấp hơn {hasRound ? pivot : '…'}
            </button>
          </>
        )}
      </div>

      <p className="ec-note ec-guess-admin-hint">
        Min/max, thưởng, phạt và lượt/ngày chỉnh trên Admin (Game center → Đoán số).
      </p>

      <GameDialogModal
        isOpen={!!resultDlg}
        onClose={closeResultDialog}
        title={resultDlg?.correct ? 'Đoán đúng' : 'Đoán sai'}
        mode="alert"
        confirmLabel="Đóng"
        tone={resultDlg?.correct ? 'info' : 'warning'}
        onConfirm={closeResultDialog}
      >
        {resultDlg && (
          <div className="ec-guess-result-summary">
            <p className="ec-guess-result-line">
              Số ẩn là <strong>{resultDlg.secret}</strong>, mốc {resultDlg.pivot}.
            </p>
            <p
              className={
                resultDlg.correct ? 'ec-guess-result-delta is-win' : 'ec-guess-result-delta is-lose'
              }
            >
              {resultDlg.correct ? (
                <>+{Math.abs(resultDlg.deltaPeta).toLocaleString('vi-VN')} Peta</>
              ) : (
                <>
                  {resultDlg.deltaPeta <= 0 ? '−' : ''}
                  {Math.abs(resultDlg.deltaPeta).toLocaleString('vi-VN')} Peta
                </>
              )}
            </p>
          </div>
        )}
      </GameDialogModal>
    </div>
  );
}

export default GuessNumberGame;
