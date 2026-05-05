import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useGameCenterConfig } from './GameCenterConfigContext';

function randomSymbolIds(count, symbolList) {
  const pool =
    symbolList.length > 0
      ? symbolList
      : [{ id: 'fallback', emoji: '❔', label: '?', imageUrl: '' }];
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)].id);
}

function ScratchLotteryGame() {
  const { config, loading } = useGameCenterConfig();
  const sc = config?.scratchLottery;
  const symbols = useMemo(
    () => (sc?.symbols?.length ? sc.symbols : []),
    [sc?.symbols],
  );
  const price3 = sc?.ticketPrice3 ?? 10;
  const price5 = sc?.ticketPrice5 ?? 25;
  const need3 = sc?.matchCountToWin3 ?? 3;
  const need5 = sc?.matchCountToWin5 ?? 3;

  const [mode, setMode] = useState(3);
  const [revealed, setRevealed] = useState([]);
  const [ids, setIds] = useState(() => randomSymbolIds(3, symbols));

  const count = mode === 3 ? 3 : 5;
  const needMatch = mode === 3 ? need3 : need5;

  const resetRound = useCallback(
    (nextMode) => {
      const n = nextMode === 3 ? 3 : 5;
      setMode(nextMode);
      setIds(randomSymbolIds(n, symbols));
      setRevealed([]);
    },
    [symbols],
  );

  useEffect(() => {
    if (loading || !symbols.length) return;
    const n = mode === 3 ? 3 : 5;
    setIds(randomSymbolIds(n, symbols));
    setRevealed([]);
  }, [loading, symbols, mode]);

  const allRevealed = revealed.length === count;

  const winInfo = useMemo(() => {
    if (!allRevealed) return null;
    const counts = {};
    ids.forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
    const maxMatch = Math.max(0, ...Object.values(counts));
    if (maxMatch >= needMatch)
      return {
        win: true,
        text: `Trùng ${maxMatch} biểu tượng — đủ điều kiện (≥${needMatch}).`,
      };
    return { win: false, text: `Cần ít nhất ${needMatch} biểu tượng giống nhau.` };
  }, [allRevealed, ids, needMatch]);

  const toggleReveal = (index) => {
    if (revealed.includes(index)) return;
    setRevealed((r) => [...r, index]);
  };

  const renderCell = (symId) => {
    const s = symbols.find((x) => x.id === symId);
    if (s?.imageUrl) {
      return <img src={s.imageUrl} alt="" className="ec-scratch-img" />;
    }
    return <span className="ec-scratch-emoji">{s?.emoji || '❔'}</span>;
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
        Vé <strong>3 ô</strong>: {price3} Peta — vé <strong>5 ô</strong>: {price5} Peta (giá chỉnh trên Admin).
        Trùng ít nhất <strong>{need3}</strong> / <strong>{need5}</strong> biểu tượng theo loại vé.
      </p>

      <div className="ec-scratch-tabs">
        <button
          type="button"
          className={mode === 3 ? 'is-active' : ''}
          onClick={() => resetRound(3)}
        >
          Vé 3 ô
        </button>
        <button
          type="button"
          className={mode === 5 ? 'is-active' : ''}
          onClick={() => resetRound(5)}
        >
          Vé 5 ô
        </button>
      </div>

      <div className="ec-scratch-grid">
        {ids.slice(0, count).map((symId, i) => {
          const isOpen = revealed.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={`ec-scratch-cell ${isOpen ? '' : 'is-covered'}`}
              onClick={() => toggleReveal(i)}
            >
              {isOpen ? renderCell(symId) : 'CÀO'}
            </button>
          );
        })}
      </div>

      {winInfo && (
        <p style={{ marginTop: 16, fontWeight: 600, color: winInfo.win ? '#059669' : '#64748b' }}>
          {winInfo.text}
        </p>
      )}

      <div className="ec-btn-row">
        <button type="button" className="ec-btn ec-btn--ghost" onClick={() => resetRound(mode)}>
          Vé mới (random)
        </button>
      </div>

      <p className="ec-note">Biểu tượng vé cào do Admin cấu hình (emoji hoặc ảnh URL).</p>
    </div>
  );
}

export default ScratchLotteryGame;
