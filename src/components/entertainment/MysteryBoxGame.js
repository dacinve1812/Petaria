import React, { useState, useCallback, useMemo } from 'react';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';

function rollOutcomes(outcomes) {
  if (!outcomes?.length) return null;
  const total = outcomes.reduce((s, o) => s + (Number(o.weight) || 1), 0);
  let r = Math.random() * total;
  for (const o of outcomes) {
    r -= Number(o.weight) || 1;
    if (r <= 0) return o;
  }
  return outcomes[0];
}

function MysteryBoxGame() {
  const { config, loading } = useGameCenterConfig();
  const outcomes = useMemo(() => config?.mysteryBox?.outcomes || [], [config?.mysteryBox?.outcomes]);

  const [itemIn, setItemIn] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const roll = useCallback(() => rollOutcomes(outcomes), [outcomes]);

  const handleDeposit = () => {
    setItemIn({ name: 'Vật phẩm từ túi (demo)', rarity: 'Hiếm' });
    setResult(null);
  };

  const handleExchange = () => {
    if (!itemIn) return;
    setConfirmOpen(true);
  };

  const doExchange = () => {
    setConfirmOpen(false);
    setResult(roll());
    setItemIn(null);
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
        Bỏ <strong>một vật phẩm bất kỳ</strong> vào hộp; nhận phần thưởng ngẫu nhiên theo bảng tỉ lệ (Admin).
      </p>

      <div className="ec-btn-row">
        <button type="button" className="ec-btn ec-btn--ghost" onClick={handleDeposit}>
          Chọn đồ cho vào hộp (demo)
        </button>
        <button type="button" className="ec-btn" onClick={handleExchange} disabled={!itemIn}>
          Đổi ngẫu nhiên
        </button>
      </div>

      {itemIn && (
        <p style={{ marginTop: 12 }}>
          Trong hộp: <strong>{itemIn.name}</strong> ({itemIn.rarity})
        </p>
      )}

      {result && (
        <p style={{ marginTop: 12 }}>
          Bạn nhận được: <strong>{result.label}</strong> — <em>{result.rarity}</em>
        </p>
      )}

      <GameDialogModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xác nhận"
        mode="confirm"
        confirmLabel="Đồng ý"
        cancelLabel="Hủy"
        onConfirm={doExchange}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>Vật phẩm đã cho vào sẽ bị tiêu thụ. Tiếp tục?</p>
      </GameDialogModal>

      <p className="ec-note">Tỉ lệ % từng dòng trong Admin (weight).</p>
    </div>
  );
}

export default MysteryBoxGame;
