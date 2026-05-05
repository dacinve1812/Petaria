import React, { useCallback, useState, useEffect } from 'react';
import { useGameCenterConfig } from './GameCenterConfigContext';

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function newRound(minS, maxS) {
  const min = Math.min(minS, maxS);
  const max = Math.max(minS, maxS);
  let secret = randInt(min, max);
  let pivot = randInt(min, max);
  let guard = 0;
  while (pivot === secret && guard < 50) {
    pivot = randInt(min, max);
    secret = randInt(min, max);
    guard += 1;
  }
  if (pivot === secret) pivot = secret === min ? min + 1 : secret - 1;
  return { secret, pivot };
}

function GuessNumberGame() {
  const { config, loading } = useGameCenterConfig();
  const gn = config?.guessNumber || {};
  const minS = gn.minSecret ?? 1;
  const maxS = gn.maxSecret ?? 99;

  const [round, setRound] = useState(() => newRound(minS, maxS));
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!loading) {
      setRound(newRound(minS, maxS));
      setFeedback(null);
    }
  }, [loading, minS, maxS]);

  const answerHigher = round.secret > round.pivot;
  const answerLower = round.secret < round.pivot;

  const submit = useCallback(
    (choice) => {
      const correct =
        (choice === 'high' && answerHigher) || (choice === 'low' && answerLower);
      setFeedback(
        correct
          ? { ok: true, text: `Đúng! Số ẩn là ${round.secret}.` }
          : { ok: false, text: `Sai rồi. Số ẩn là ${round.secret}.` },
      );
    },
    [answerHigher, answerLower, round.secret],
  );

  const next = () => {
    setRound(newRound(minS, maxS));
    setFeedback(null);
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
        Một số bí mật ({minS}–{maxS}) được giấu. So sánh với mốc <strong>{round.pivot}</strong>: đoán số ẩn{' '}
        <em>cao hơn</em> hay <em>thấp hơn</em> mốc?
      </p>

      <div className="ec-guess-board">
        <div className="ec-guess-mystery" aria-hidden>
          ?
        </div>
        <div className="ec-guess-compare">
          Số ẩn lớn hơn <strong>{round.pivot}</strong> hay bé hơn <strong>{round.pivot}</strong>?
        </div>
      </div>

      <div className="ec-btn-row" style={{ justifyContent: 'center' }}>
        <button
          type="button"
          className="ec-btn"
          onClick={() => submit('high')}
          disabled={!!feedback}
        >
          Cao hơn {round.pivot}
        </button>
        <button
          type="button"
          className="ec-btn ec-btn--ghost"
          onClick={() => submit('low')}
          disabled={!!feedback}
        >
          Thấp hơn {round.pivot}
        </button>
      </div>

      {feedback && (
        <p
          style={{
            marginTop: 16,
            textAlign: 'center',
            fontWeight: 700,
            color: feedback.ok ? '#059669' : '#dc2626',
          }}
        >
          {feedback.text}
        </p>
      )}

      <div className="ec-btn-row" style={{ justifyContent: 'center' }}>
        <button type="button" className="ec-btn ec-btn--ghost" onClick={next}>
          Vòng mới
        </button>
      </div>

      <p className="ec-note">Min/max số ẩn chỉnh trên Admin.</p>
    </div>
  );
}

export default GuessNumberGame;
