import React, { useState, useMemo, useEffect } from 'react';
import { useGameCenterConfig } from './GameCenterConfigContext';

function randomIconId(reelIcons) {
  if (!reelIcons?.length) return '';
  return reelIcons[Math.floor(Math.random() * reelIcons.length)].id;
}

function evaluateSlots(ids, rules, reelIcons) {
  const [a, b, c] = ids;
  const tripleSame = a && a === b && b === c;
  const anyPair = a === b || b === c || a === c;
  const list = rules?.length ? rules : [];

  const jackpot = list.find((r) => r.kind === 'triple_icon' && r.iconId);
  if (jackpot && tripleSame && a === jackpot.iconId) {
    return {
      tier: 'jackpot',
      msg: jackpot.rewardDescription || jackpot.label || 'Jackpot',
    };
  }

  const tripleRule = list.find((r) => r.kind === 'triple_same');
  if (tripleSame && tripleRule) {
    return {
      tier: 'triple',
      msg: tripleRule.rewardDescription || tripleRule.label || 'Ba giống nhau',
    };
  }

  const pairRule = list.find((r) => r.kind === 'any_pair');
  if (anyPair && pairRule) {
    return { tier: 'pair', msg: pairRule.rewardDescription || pairRule.label || 'Hai trùng' };
  }

  return { tier: 'none', msg: 'Không đủ điều kiện — quay lại sau.' };
}

function SlotMachineGame() {
  const { config, loading } = useGameCenterConfig();
  const sm = config?.slotMachine;
  const reelIcons = useMemo(
    () => (sm?.reelIcons?.length ? sm.reelIcons : []),
    [sm?.reelIcons],
  );
  const rules = sm?.winRules || [];

  const defaultIds = useMemo(() => {
    if (!reelIcons.length) return ['', '', ''];
    const pick = () => randomIconId(reelIcons);
    return [pick(), pick(), pick()];
  }, [reelIcons]);

  const [reels, setReels] = useState(defaultIds);

  useEffect(() => {
    if (loading || !reelIcons.length) return;
    setReels([randomIconId(reelIcons), randomIconId(reelIcons), randomIconId(reelIcons)]);
  }, [loading, reelIcons]);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState(null);

  const spin = () => {
    if (!reelIcons.length) return;
    setSpinning(true);
    setMsg(null);
    window.setTimeout(() => {
      const a = randomIconId(reelIcons);
      const b = randomIconId(reelIcons);
      const c = randomIconId(reelIcons);
      setReels([a, b, c]);
      setSpinning(false);
      setMsg(evaluateSlots([a, b, c], rules, reelIcons));
    }, 1200);
  };

  const renderReel = (id) => {
    const icon = reelIcons.find((x) => x.id === id);
    if (icon?.imageUrl) {
      return <img src={icon.imageUrl} alt="" className="ec-slot-img" />;
    }
    return icon?.emoji || '🎰';
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
        Guồng và điều kiện thắng do Admin cấu hình (icon + loại rule: ba giống, ba icon chỉ định, hai trùng).
      </p>

      <div className="ec-slots" aria-live="polite">
        {reels.map((id, i) => (
          <div key={i} className={`ec-slot-reel ${spinning ? 'is-spinning' : ''}`}>
            {spinning ? '🎰' : renderReel(id)}
          </div>
        ))}
      </div>

      <div className="ec-btn-row">
        <button type="button" className="ec-btn" onClick={spin} disabled={spinning || !reelIcons.length}>
          {reelIcons.length ? (spinning ? 'Đang quay...' : 'Quay') : 'Chưa có icon'}
        </button>
      </div>

      {msg && (
        <p style={{ marginTop: 14, fontWeight: 600, color: msg.tier !== 'none' ? '#059669' : '#64748b' }}>
          {msg.msg}
        </p>
      )}

      <p className="ec-note">Thứ tự ưu tiên: triple_icon (jackpot) → triple_same → any_pair.</p>
    </div>
  );
}

export default SlotMachineGame;
