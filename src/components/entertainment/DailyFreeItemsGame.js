import React, { useEffect, useMemo, useState } from 'react';
import { useGameCenterConfig } from './GameCenterConfigContext';

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function DailyFreeItemsGame() {
  const { config, loading } = useGameCenterConfig();
  const tiers = config?.dailyFree?.tiers?.length ? config.dailyFree.tiers : [];

  const [claimed, setClaimed] = useState(false);
  const key = useMemo(() => `entertainment-daily-free-${dayKey()}`, []);

  useEffect(() => {
    try {
      setClaimed(localStorage.getItem(key) === '1');
    } catch (_) {
      setClaimed(false);
    }
  }, [key]);

  const handleClaim = () => {
    try {
      localStorage.setItem(key, '1');
    } catch (_) {}
    setClaimed(true);
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
        Mỗi ngày một lần — danh sách quà theo bậc và tỉ lệ weight (Admin). Item ID có thể nối inventory sau.
      </p>

      <ul style={{ margin: '12px 0', paddingLeft: 20, color: '#334155' }}>
        {tiers.map((t) => (
          <li key={t.id || t.itemLabel}>
            <strong>{t.tierLabel}</strong> — {t.itemLabel}
            {t.dailyWeight != null && (
              <span style={{ color: '#64748b' }}> (weight {t.dailyWeight})</span>
            )}
          </li>
        ))}
      </ul>

      <div className="ec-btn-row">
        <button type="button" className="ec-btn" onClick={handleClaim} disabled={claimed}>
          {claimed ? 'Đã nhận hôm nay' : 'Nhận quà ngày'}
        </button>
      </div>

      {claimed && (
        <p style={{ marginTop: 12, fontWeight: 600, color: '#059669' }}>
          Đã ghi nhận (demo — chưa cộng đồ thật).
        </p>
      )}

      <p className="ec-note">Admin thêm dòng: tier, tên hiển thị, itemId, dailyWeight.</p>
    </div>
  );
}

export default DailyFreeItemsGame;
