import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { applyNarrativeVars } from '../ui/NarrativeScene';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const REVEAL_RESULT_DELAY_MS = 1100;

/** /game-center/guess-number — nội dung trang trực tiếp (không NarrativeHost). */
function GuessNumberGame() {
  const { user, updateUserData } = useUser();
  const { config, loading } = useGameCenterConfig();
  const backNav = useFeatureBackNav();
  const gn = config?.guessNumber || {};
  const narrative = gn.narrative || {};
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
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [revealTone, setRevealTone] = useState(null);
  const [resultDlg, setResultDlg] = useState(null);
  const revealTimerRef = useRef(null);

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
      if (revealTimerRef.current != null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
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
  const showGuessButtons = hasRound && revealedSecret == null;
  const showStartButton = !hasRound && revealedSecret == null;
  const blockPlay = revealedSecret !== null || !!resultDlg;

  const vars = useMemo(
    () => ({
      minSecret: String(minS),
      maxSecret: String(maxS),
      rewardWin: Number(rewardWin).toLocaleString('vi-VN'),
      penaltyLose: Number(penaltyLose).toLocaleString('vi-VN'),
      secret: resultDlg?.secret != null ? String(resultDlg.secret) : '…',
      pivot: resultDlg?.pivot != null ? String(resultDlg.pivot) : '…',
      amount:
        resultDlg != null
          ? Math.abs(Number(resultDlg.deltaPeta) || 0).toLocaleString('vi-VN')
          : '…',
      playerName: user?.username || user?.name || 'bạn',
    }),
    [minS, maxS, rewardWin, penaltyLose, resultDlg, user?.username, user?.name],
  );

  const intro = useMemo(
    () =>
      buildFeatureNpcProps(narrative, vars, {
        speaker: 'Trẻ làng',
        portraitSrc: '/images/character/char2.jpg',
        lines: [
          'Chào ngươi! Đây là Làng trẻ con — cùng chơi Đoán số nhé!',
          'Ta chọn số từ {minSecret} đến {maxSecret}. Đoán cao hơn hay thấp hơn mốc!',
        ],
      }),
    [narrative, vars],
  );

  const closeResult = () => {
    if (revealTimerRef.current != null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setResultDlg(null);
    setRevealedSecret(null);
    setRevealTone(null);
  };

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
    if (revealTimerRef.current != null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
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
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        const tpl = payload.correct
          ? narrative.winLine ||
            'Giỏi lắm! Số ẩn là {secret} (mốc {pivot}). Ngươi được +{amount} Peta!'
          : narrative.loseLine ||
            'Tiếc quá! Số ẩn là {secret} (mốc {pivot}). Lần này −{amount} Peta — thử lại nhé!';
        setResultDlg({
          ...payload,
          message: applyNarrativeVars(tpl, {
            ...vars,
            secret: String(payload.secret),
            pivot: String(payload.pivot),
            amount: Math.abs(delta).toLocaleString('vi-VN'),
          }),
        });
      }, REVEAL_RESULT_DELAY_MS);
    } catch (e) {
      setMsg(e.message || 'Lỗi');
    } finally {
      setBusy(false);
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
      <div className="ec-game ec-game--guess">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--guess">
      <FeatureNpcIntro
        speaker={intro.speaker}
        portraitSrc={intro.portraitSrc}
        lorePortraitSrc={intro.lorePortraitSrc}
        greeting={intro.greeting}
        loreLines={intro.loreLines}
      />

      <div className="ec-guess-play">
        <p className="ec-guess-stats" role="note">
          Số bí mật từ <strong className="ec-guess-stats__em">{minS}–{maxS}</strong>
          {hasRound ? (
            <>
              . So với mốc{' '}
              <strong className="ec-guess-stats__em ec-guess-stats__em--pivot">{pivot}</strong>
              : cao hơn hay thấp hơn?
            </>
          ) : (
            <> — bấm bắt đầu vòng để nhận mốc so sánh.</>
          )}{' '}
          Đúng nhận{' '}
          <strong className="ec-guess-stats__em ec-guess-stats__em--win">
            +{Number(rewardWin).toLocaleString('vi-VN')} Peta
          </strong>
          ; sai mất{' '}
          <strong className="ec-guess-stats__em ec-guess-stats__em--lose">
            −{Number(penaltyLose).toLocaleString('vi-VN')} Peta
          </strong>
          .
          {user?.token && playsRem != null ? (
            <>
              {' '}
              Còn{' '}
              <strong className="ec-guess-stats__em ec-guess-stats__em--turns">
                {playsRem}/{maxPlays}
              </strong>{' '}
              lượt.
            </>
          ) : null}
        </p>

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
                blockPlay ||
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
                disabled={!user?.token || !hasRound || busy || !!statusErr || blockPlay}
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
                disabled={!user?.token || !hasRound || busy || !!statusErr || blockPlay}
              >
                <span className="ec-guess-btn__icon" aria-hidden>
                  ↓
                </span>
                Thấp hơn {hasRound ? pivot : '…'}
              </button>
            </>
          )}
        </div>

        <div className="ec-btn-row ec-guess-actions ec-feature-actions--back">{backButton}</div>
      </div>

      <GameDialogModal
        isOpen={!!resultDlg}
        onClose={closeResult}
        title={resultDlg?.correct ? 'Đúng rồi!' : 'Chưa đúng'}
        mode="alert"
        confirmLabel="Tiếp tục"
        tone={resultDlg?.correct ? 'info' : 'warning'}
        onConfirm={closeResult}
      >
        {resultDlg ? <p>{resultDlg.message}</p> : null}
      </GameDialogModal>
    </div>
  );
}

export default GuessNumberGame;
