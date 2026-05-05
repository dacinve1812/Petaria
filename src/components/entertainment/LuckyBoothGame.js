import React, { useState } from 'react';
import { useGameCenterConfig } from './GameCenterConfigContext';

function digitsValid(str) {
  return /^\d{4}$/.test(str);
}

function LuckyBoothGame() {
  const { config, loading } = useGameCenterConfig();
  const lb = config?.luckyBooth || {};
  const ticketPrice = lb.ticketPrice ?? 1;
  const jackpotPeta = lb.jackpotPeta ?? 10000;
  const dailyReset = lb.dailyResetEnabled !== false;

  const [pick, setPick] = useState('');
  const [ticketBought, setTicketBought] = useState(false);
  const [drawResult, setDrawResult] = useState(null);

  const handleBuy = () => {
    if (!digitsValid(pick)) return;
    setTicketBought(true);
    setDrawResult(null);
  };

  const handleMockDraw = () => {
    const win = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    setDrawResult({
      numbers: win,
      match: win === pick,
    });
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
        Chọn dãy <strong>4 chữ số</strong>. Giá vé <strong>{ticketPrice} Peta</strong>, giải lớn{' '}
        <strong>{jackpotPeta} Peta</strong>. Reset vé mỗi ngày:{' '}
        <strong>{dailyReset ? 'bật (theo thiết kế)' : 'tắt'}</strong>.
      </p>

      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#334155' }}>
        Dãy số của bạn
      </label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={pick}
        onChange={(e) => setPick(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="vd: 0420"
        style={{
          fontSize: '1.5rem',
          letterSpacing: '0.2em',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #cbd5e1',
          width: 140,
        }}
      />

      <div className="ec-btn-row">
        <button type="button" className="ec-btn" onClick={handleBuy} disabled={!digitsValid(pick) || ticketBought}>
          {ticketBought ? `Đã mua vé (${ticketPrice} Peta, demo)` : `Mua vé (${ticketPrice} Peta)`}
        </button>
        <button type="button" className="ec-btn ec-btn--ghost" onClick={handleMockDraw} disabled={!ticketBought}>
          Quay thử (demo)
        </button>
      </div>

      {drawResult && (
        <p style={{ marginTop: 16 }}>
          Số trúng (giả lập): <strong>{drawResult.numbers}</strong> —{' '}
          {drawResult.match ? (
            <span style={{ color: '#059669', fontWeight: 700 }}>Trúng giải!</span>
          ) : (
            <span style={{ color: '#64748b' }}>Chưa trúng</span>
          )}
        </p>
      )}

      <p className="ec-note">Giá vé / jackpot / cờ reset chỉnh trên Admin.</p>
    </div>
  );
}

export default LuckyBoothGame;
