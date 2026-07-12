import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NarrativeScene, { applyNarrativeVars } from '../ui/NarrativeScene';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/** Hiện số trong vòng trước, sau đó mới mở narrative kết quả (ms). */
const REVEAL_NARRATIVE_DELAY_MS = 1100;

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
  const [revealTone, setRevealTone] = useState(null); // 'win' | 'lose'
  /** intro | play | result */
  const [storyPhase, setStoryPhase] = useState('intro');
  const [lastResult, setLastResult] = useState(null);
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
  const showGuessButtons = hasRound && storyPhase === 'play';
  const showStartButton = !hasRound && storyPhase === 'play';
  const blockPlay = storyPhase !== 'play' || revealedSecret !== null;

  const vars = useMemo(
    () => ({
      minSecret: String(minS),
      maxSecret: String(maxS),
      rewardWin: Number(rewardWin).toLocaleString('vi-VN'),
      penaltyLose: Number(penaltyLose).toLocaleString('vi-VN'),
      secret: lastResult?.secret != null ? String(lastResult.secret) : '…',
      pivot: lastResult?.pivot != null ? String(lastResult.pivot) : '…',
      amount:
        lastResult != null
          ? Math.abs(Number(lastResult.deltaPeta) || 0).toLocaleString('vi-VN')
          : '…',
      playerName: user?.username || user?.name || 'bạn',
    }),
    [minS, maxS, rewardWin, penaltyLose, lastResult, user?.username, user?.name],
  );

  const speaker = narrative.speaker || 'Trẻ làng';
  const portraitSrc = narrative.portraitSrc || '/images/character/char2.jpg';
  const backgroundSrc = narrative.backgroundSrc || '';
  const useBackground = narrative.useBackground === true;
  const title = narrative.title || 'Làng Trẻ Con';
  const typingMsPerChar = narrative.typingMsPerChar ?? 26;
  const playLabel = narrative.playLabel || 'Chơi Đoán số';
  const continueLabel = narrative.continueLabel || 'Tiếp tục chơi';

  const lines = useMemo(() => {
    if (storyPhase === 'result' && lastResult) {
      const tpl = lastResult.correct
        ? narrative.winLine ||
          'Giỏi lắm! Số ẩn là {secret} (mốc {pivot}). Ngươi được +{amount} Peta!'
        : narrative.loseLine ||
          'Tiếc quá! Số ẩn là {secret} (mốc {pivot}). Lần này −{amount} Peta — thử lại nhé!';
      return [applyNarrativeVars(tpl, vars)];
    }
    const intro = Array.isArray(narrative.lines) ? narrative.lines : [];
    return intro.length
      ? intro
      : [
          'Chào ngươi! Đây là Làng trẻ con — cùng chơi Đoán số nhé!',
          'Ta chọn số từ {minSecret} đến {maxSecret}. Đoán cao hơn hay thấp hơn mốc!',
        ];
  }, [storyPhase, lastResult, narrative, vars]);

  const dismissIntro = () => setStoryPhase('play');

  const dismissResult = () => {
    if (revealTimerRef.current != null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setLastResult(null);
    setRevealedSecret(null);
    setRevealTone(null);
    setStoryPhase('play');
  };

  const startRound = async () => {
    if (!user?.token || busy || storyPhase !== 'play') return;
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
    if (!user?.token || !hasRound || busy || storyPhase !== 'play') return;
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
      setLastResult(payload);
      if (data.petaRemaining != null) {
        updateUserData({ peta: Number(data.petaRemaining) });
      }
      dispatchCurrencyUpdate();
      await fetchStatus();
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        setStoryPhase('result');
      }, REVEAL_NARRATIVE_DELAY_MS);
    } catch (e) {
      setMsg(e.message || 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  const backButton =
    backNav.kind === 'link' ? (
      <Link to={backNav.to} className="ec-btn ec-btn--ghost narrative-scene__action-btn">
        {backNav.label}
      </Link>
    ) : (
      <button
        type="button"
        className="ec-btn ec-btn--ghost narrative-scene__action-btn"
        onClick={backNav.go}
      >
        {backNav.label}
      </button>
    );

  const narrativeActions =
    storyPhase === 'intro' ? (
      <>
        <button type="button" className="ec-btn narrative-scene__action-btn" onClick={dismissIntro}>
          {playLabel}
        </button>
        {backButton}
      </>
    ) : (
      <>
        <button type="button" className="ec-btn narrative-scene__action-btn" onClick={dismissResult}>
          {continueLabel}
        </button>
        {backButton}
      </>
    );

  const showNarrative = storyPhase === 'intro' || storyPhase === 'result';

  if (loading) {
    return (
      <div className="ec-game ec-game--guess">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--guess">
      {showNarrative ? (
        <NarrativeScene
          className="ec-guess-narrative"
          title={title}
          speaker={speaker}
          portraitSrc={portraitSrc}
          backgroundSrc={backgroundSrc}
          useBackground={useBackground}
          lines={lines}
          vars={vars}
          typingMsPerChar={typingMsPerChar}
          scriptKey={`${storyPhase}-${lastResult?.secret ?? 'x'}-${
            lastResult?.correct ? 'w' : 'l'
          }`}
          showActions="end"
          actions={narrativeActions}
          onSkip={storyPhase === 'intro' ? dismissIntro : dismissResult}
          portraitFallback="/images/character/knight_warrior.jpg"
        />
      ) : (
        <div className="ec-guess-play">
          <p className="ec-game__lead ec-game__lead--guess">
            Số bí mật ({minS}–{maxS}) trên server. So với mốc{' '}
            {hasRound ? (
              <strong className="ec-guess-pivot-chip">{pivot}</strong>
            ) : (
              <strong className="ec-guess-pivot-chip ec-guess-pivot-chip--empty">—</strong>
            )}
            : cao hơn hay thấp hơn?
          </p>

          <div className="ec-guess-stats" aria-label="Thưởng phạt và lượt">
            <span className="ec-guess-stat ec-guess-stat--win">
              <span className="ec-guess-stat__label">Đúng</span>
              <span className="ec-guess-stat__val">
                +{Number(rewardWin).toLocaleString('vi-VN')}
              </span>
            </span>
            <span className="ec-guess-stat ec-guess-stat--lose">
              <span className="ec-guess-stat__label">Sai</span>
              <span className="ec-guess-stat__val">
                −{Number(penaltyLose).toLocaleString('vi-VN')}
              </span>
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

          <div className="ec-btn-row ec-guess-actions">{backButton}</div>
        </div>
      )}
    </div>
  );
}

export default GuessNumberGame;
