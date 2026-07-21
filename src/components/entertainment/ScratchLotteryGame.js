import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useFeatureBackNav } from './useFeatureBackNav';
import ScratchCell from './ScratchCell';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const SCRATCH_TICKET_3_IMG = `${process.env.PUBLIC_URL || ''}/images/entertainment/2win.png`;
const SCRATCH_TICKET_5_IMG = `${process.env.PUBLIC_URL || ''}/images/entertainment/3win.png`;

function randomSymbolIds(count, symbolList) {
  const pool =
    symbolList.length > 0
      ? symbolList
      : [{ id: 'fallback', emoji: '❔', label: '?', imageUrl: '' }];
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)].id);
}

function clampInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

/** Biểu tượng trúng = symbol xuất hiện ≥ requiredMatch lần trên vé (khớp server). */
function inferWinSymbolId(ids, requiredMatch) {
  const c = {};
  (ids || []).forEach((id) => {
    if (!id) return;
    c[id] = (c[id] || 0) + 1;
  });
  const matches = Object.entries(c).filter(([, n]) => n >= requiredMatch);
  if (!matches.length) return null;
  matches.sort((a, b) => b[1] - a[1]);
  return matches[0][0];
}

const SIDEBAR_TIER_LABELS = ['Small', 'Medium', 'Big'];

/** Một symbol chỉ một dòng trong sidebar; nếu trùng symbolId trong Admin thì giữ phần thưởng cao hơn. */
function sidebarRewardRowsFromConfig(rewards) {
  const list = Array.isArray(rewards) ? rewards : [];
  const bySym = new Map();
  for (const r of list) {
    const id = String(r?.symbolId || '').trim();
    if (!id) continue;
    const rewardPeta = Math.max(0, clampInt(Number(r.rewardPeta), 0));
    const cur = bySym.get(id);
    if (!cur || rewardPeta >= cur.rewardPeta)
      bySym.set(id, { symbolId: id, rewardPeta, weight: Number(r.weight) || 0 });
  }
  return [...bySym.values()].sort(
    (a, b) => a.rewardPeta - b.rewardPeta || a.symbolId.localeCompare(b.symbolId),
  );
}

function sidebarTierLabel(index) {
  if (index < SIDEBAR_TIER_LABELS.length) return SIDEBAR_TIER_LABELS[index];
  if (index === 3) return 'Huge';
  return 'Giant';
}

function sidebarTierBadgeClass(index) {
  if (index === 0) return 'ec-scratch-rewards__badge';
  if (index === 1) return 'ec-scratch-rewards__badge ec-scratch-rewards__badge--mid';
  if (index === 2) return 'ec-scratch-rewards__badge ec-scratch-rewards__badge--big';
  return 'ec-scratch-rewards__badge ec-scratch-rewards__badge--extra';
}

function ScratchLotteryGame() {
  const { user, updateUserData } = useUser();
  const { config, loading } = useGameCenterConfig();
  const backNav = useFeatureBackNav();
  const sc = config?.scratchLottery;
  const narrative = sc?.narrative || {};
  const symbols = useMemo(
    () => (sc?.symbols?.length ? sc.symbols : []),
    [sc?.symbols],
  );
  const t3 = sc?.ticket3;
  const t5 = sc?.ticket5;
  const price3 = t3?.pricePeta ?? 10;
  const price5 = t5?.pricePeta ?? 25;
  const dailyLimit3 = Math.max(0, clampInt(t3?.dailyBuyLimit ?? 0, 0));
  const dailyLimit5 = Math.max(0, clampInt(t5?.dailyBuyLimit ?? 0, 0));

  const intro = useMemo(
    () => buildFeatureNpcProps(narrative, {}, { speaker: '', portraitSrc: '', lines: [] }),
    [narrative],
  );

  const npcIntro = (
    <FeatureNpcIntro
      speaker={intro.speaker}
      portraitSrc={intro.portraitSrc}
      lorePortraitSrc={intro.lorePortraitSrc}
      greeting={intro.greeting}
      loreLines={intro.loreLines}
    />
  );

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

  const [mode, setMode] = useState(3);
  const [view, setView] = useState('shop'); // 'shop' | 'ticket'
  const [revealed, setRevealed] = useState([]);
  const [ids, setIds] = useState(() => randomSymbolIds(3, symbols));
  const [roundId, setRoundId] = useState(1);
  const [ticketBought, setTicketBought] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [winReward, setWinReward] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [scratchSrv, setScratchSrv] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientDetail, setInsufficientDetail] = useState({ need: 0, have: 0 });

  const rewardClaimedForRoundRef = useRef(null);
  const claimInFlightRef = useRef(false);
  const resumedPendingRef = useRef(false);

  const count = mode === 3 ? 3 : 5;
  const requiredMatch = mode === 3 ? 2 : 3;

  const scratchSidebarRows = useMemo(() => {
    const rewards = mode === 3 ? t3?.rewards : t5?.rewards;
    return sidebarRewardRowsFromConfig(rewards);
  }, [mode, t3?.rewards, t5?.rewards]);

  const fetchScratchStatus = useCallback(async () => {
    if (!user?.token) {
      setScratchSrv(null);
      return null;
    }
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/scratch/status`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setScratchSrv(null);
        return null;
      }
      setScratchSrv(data);
      return data;
    } catch {
      setScratchSrv(null);
      return null;
    }
  }, [user?.token]);

  useEffect(() => {
    fetchScratchStatus();
  }, [fetchScratchStatus]);

  useEffect(() => {
    if (!scratchSrv?.hasPendingTicket || !scratchSrv?.pendingResume) {
      resumedPendingRef.current = false;
      return;
    }
    if (resumedPendingRef.current) return;
    resumedPendingRef.current = true;
    const pr = scratchSrv.pendingResume;
    setMode(pr.mode);
    setIds(pr.ids);
    setRevealed([]);
    setRoundId((x) => x + 1);
    setTicketBought(true);
    setView('ticket');
    setWinOpen(false);
    setWinReward(null);
    rewardClaimedForRoundRef.current = null;
  }, [scratchSrv]);

  const resetRound = useCallback(
    (nextMode) => {
      const n = nextMode === 3 ? 3 : 5;
      setMode(nextMode);
      setIds(randomSymbolIds(n, symbols));
      setRevealed([]);
      setRoundId((x) => x + 1);
      setTicketBought(false);
      setView('shop');
      setBuyOpen(false);
      setLimitOpen(false);
      setWinOpen(false);
      setWinReward(null);
      rewardClaimedForRoundRef.current = null;
      resumedPendingRef.current = false;
      fetchScratchStatus();
    },
    [symbols, fetchScratchStatus],
  );

  useEffect(() => {
    if (loading || !symbols.length) return;
    if (ticketBought && view === 'ticket') return;
    const n = mode === 3 ? 3 : 5;
    setIds(randomSymbolIds(n, symbols));
    setRevealed([]);
    setRoundId((x) => x + 1);
    setTicketBought(false);
    setView('shop');
    setWinOpen(false);
    setWinReward(null);
    rewardClaimedForRoundRef.current = null;
  }, [loading, symbols, mode, ticketBought, view]);

  useEffect(() => {
    if (loading) return;
    setBuyOpen(false);
    setLimitOpen(false);
  }, [loading, symbols]);

  const allRevealed = revealed.length === count;
  const winSymbolId = useMemo(() => inferWinSymbolId(ids, requiredMatch), [ids, requiredMatch]);

  const winInfo = useMemo(() => {
    if (!ticketBought || !winSymbolId) return null;
    const counts = {};
    revealed.forEach((idx) => {
      const id = ids[idx];
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    const winCount = counts[winSymbolId] || 0;
    if (winCount >= requiredMatch) {
      return {
        win: true,
        text: `Đã trùng ${requiredMatch} biểu tượng — nhận thưởng!`,
        maxMatch: winCount,
      };
    }
    if (allRevealed) {
      return { win: false, text: `Chưa trùng đủ ${requiredMatch} biểu tượng.`, maxMatch: winCount };
    }
    return null;
  }, [allRevealed, ids, revealed, requiredMatch, ticketBought, winSymbolId]);

  const markRevealed = (index) => {
    setRevealed((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  const renderCell = (symId) => {
    const s = symbols.find((x) => x.id === symId);
    if (s?.imageUrl) {
      return <img src={s.imageUrl} alt="" className="ec-scratch-img" />;
    }
    return <span className="ec-scratch-emoji">{s?.emoji || '❔'}</span>;
  };

  const renderScratchSlot = (i) => {
    const symId = ids[i];
    const isOpen = revealed.includes(i);
    return (
      <div key={`${roundId}-${i}`} className="ec-scratch-slot-wrap">
        <ScratchCell
          disabled={!ticketBought || isOpen}
          onRevealed={() => markRevealed(i)}
          coverText="CÀO"
          coverColor="#9ca3af"
          brushAlpha={0.18}
          revealThreshold={0.7}
          centerRevealThreshold={0.22}
        >
          {renderCell(symId)}
        </ScratchCell>
      </div>
    );
  };

  useEffect(() => {
    if (view !== 'ticket' || !ticketBought || !user?.token) return;
    if (!winInfo?.win || !revealed.length) return;
    if (rewardClaimedForRoundRef.current === roundId) return;
    if (claimInFlightRef.current) return;

    claimInFlightRef.current = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/game-center/scratch/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ revealedIndices: revealed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || res.statusText || 'Không nhận được thưởng');
        }
        rewardClaimedForRoundRef.current = roundId;
        const granted = Math.max(0, Number(data.grantedPeta) || 0);
        if (data.petaRemaining != null) {
          updateUserData({ peta: data.petaRemaining });
        }
        dispatchCurrencyUpdate();
        setWinReward({ amount: granted });
        setWinOpen(true);
        await fetchScratchStatus();
      } catch (e) {
        alert(e.message || 'Lỗi nhận thưởng');
      } finally {
        claimInFlightRef.current = false;
      }
    })();
  }, [
    winInfo?.win,
    view,
    ticketBought,
    user?.token,
    revealed,
    roundId,
    updateUserData,
    fetchScratchStatus,
  ]);

  const handleBuy = (nextMode) => {
    if (!user?.token) {
      setLoginOpen(true);
      return;
    }
    setMode(nextMode);
    setBuyOpen(true);
  };

  const doBuy = async () => {
    if (!user?.token) {
      setBuyOpen(false);
      setLoginOpen(true);
      return;
    }
    const limit = mode === 3 ? dailyLimit3 : dailyLimit5;
    const srv = scratchSrv || (await fetchScratchStatus());
    if (srv?.hasPendingTicket) {
      setBuyOpen(false);
      alert(srv.pendingResume ? 'Bạn có vé đang chưa cào xong.' : 'Bạn đang có vé chưa hoàn thành.');
      return;
    }
    const used = mode === 3 ? srv?.buysToday3 ?? 0 : srv?.buysToday5 ?? 0;
    if (limit > 0 && used >= limit) {
      setBuyOpen(false);
      setLimitOpen(true);
      return;
    }

    setPurchasing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/game-center/scratch/purchase`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setBuyOpen(false);
        setInsufficientDetail({
          need: data.pricePeta ?? (mode === 3 ? price3 : price5),
          have: data.petaRemaining ?? 0,
        });
        setInsufficientOpen(true);
        return;
      }
      if (res.status === 429) {
        setBuyOpen(false);
        setLimitOpen(true);
        return;
      }
      if (res.status === 409) {
        setBuyOpen(false);
        alert(data.error || 'Đang có vé chưa xong.');
        await fetchScratchStatus();
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Không mua được vé');
      }
      setBuyOpen(false);
      if (data.petaRemaining != null) {
        updateUserData({ peta: data.petaRemaining });
      }
      dispatchCurrencyUpdate();
      if (Array.isArray(data.ids)) {
        setIds(data.ids);
      }
      setRevealed([]);
      setRoundId((x) => x + 1);
      setTicketBought(true);
      setView('ticket');
      setWinOpen(false);
      setWinReward(null);
      rewardClaimedForRoundRef.current = null;
      resumedPendingRef.current = true;
      await fetchScratchStatus();
    } catch (e) {
      alert(e.message || 'Lỗi mua vé');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="ec-game">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  if (view === 'shop') {
    const used3 = scratchSrv?.buysToday3 ?? 0;
    const used5 = scratchSrv?.buysToday5 ?? 0;
    const left3 =
      user?.token && dailyLimit3 > 0 ? Math.max(0, dailyLimit3 - used3) : null;
    const left5 =
      user?.token && dailyLimit5 > 0 ? Math.max(0, dailyLimit5 - used5) : null;
    return (
      <div className="ec-game ec-game--scratch">
        {npcIntro}

        <div className="ec-scratch-shop">
          <button
            type="button"
            className="ec-scratch-card"
            onClick={() => handleBuy(3)}
          >
            <div className="ec-scratch-card__left">
              <div className="ec-scratch-card__iconbox">
                <span className="ec-scratch-card__icontext">2x</span>
              </div>
            </div>
            <div className="ec-scratch-card__main">
              <div className="ec-scratch-card__title">Two Win</div>
              <div className="ec-scratch-card__desc">
                Cào 3 ô. Luôn có <strong>2</strong> icon trùng nhau. Thưởng tùy icon (Admin chỉnh).
              </div>
              <div className="ec-scratch-card__price">
                Giá: <strong>{price3.toLocaleString('vi-VN')} Peta</strong>
                {left3 != null ? (
                  <>
                    {' '}
                    — Còn: <strong>{left3}</strong> lượt/ngày
                  </>
                ) : null}
              </div>
            </div>
          </button>

          <button
            type="button"
            className="ec-scratch-card"
            onClick={() => handleBuy(5)}
          >
            <div className="ec-scratch-card__left">
              <div className="ec-scratch-card__iconbox ec-scratch-card__iconbox--gold">
                <span className="ec-scratch-card__icontext">5x</span>
              </div>
            </div>
            <div className="ec-scratch-card__main">
              <div className="ec-scratch-card__title">Five Scratch</div>
              <div className="ec-scratch-card__desc">
                Cào 5 ô. Luôn có <strong>3</strong> icon trùng nhau. Thưởng tùy icon (Admin chỉnh).
              </div>
              <div className="ec-scratch-card__price">
                Giá: <strong>{price5.toLocaleString('vi-VN')} Peta</strong>
                {left5 != null ? (
                  <>
                    {' '}
                    — Còn: <strong>{left5}</strong> lượt/ngày
                  </>
                ) : null}
              </div>
            </div>
          </button>
        </div>

        <GameDialogModal
          isOpen={buyOpen}
          onClose={() => setBuyOpen(false)}
          title="Mua vé cào"
          mode="confirm"
          confirmLabel="Mua"
          cancelLabel="Hủy"
          onConfirm={() => void doBuy()}
          onCancel={() => setBuyOpen(false)}
          tone="info"
          confirmDisabled={purchasing}
        >
          <p>
            Bạn muốn mua vé cào <strong>Vé {mode} ô</strong> với giá{' '}
            <strong>{(mode === 3 ? price3 : price5).toLocaleString('vi-VN')} Peta</strong>?
          </p>
        </GameDialogModal>

        <GameDialogModal
          isOpen={limitOpen}
          onClose={() => setLimitOpen(false)}
          title="Hết lượt hôm nay"
          mode="alert"
          confirmLabel="Đóng"
          onConfirm={() => setLimitOpen(false)}
          tone="warning"
        >
          <p style={{ textAlign: 'center' }}>
            Bạn đã hết lượt mua vé <strong>{mode} ô</strong> trong hôm nay.
          </p>
        </GameDialogModal>

        <GameDialogModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          title="Đăng nhập"
          mode="alert"
          confirmLabel="Đóng"
          onConfirm={() => setLoginOpen(false)}
          tone="info"
        >
          <p style={{ textAlign: 'center', marginBottom: 12 }}>
            Vui lòng đăng nhập để mua vé và cập nhật Peta.
          </p>
          <div style={{ textAlign: 'center' }}>
            <Link to="/login" className="ec-btn ec-btn--ghost">
              Đăng nhập
            </Link>
          </div>
        </GameDialogModal>

        <GameDialogModal
          isOpen={insufficientOpen}
          onClose={() => setInsufficientOpen(false)}
          title="Không đủ Peta"
          mode="alert"
          confirmLabel="Đóng"
          onConfirm={() => setInsufficientOpen(false)}
          tone="warning"
        >
          <p style={{ textAlign: 'center' }}>
            Bạn đang có <strong>{Number(insufficientDetail.have).toLocaleString('vi-VN')}</strong> Peta —
            vé cần <strong>{Number(insufficientDetail.need).toLocaleString('vi-VN')}</strong> Peta.
          </p>
        </GameDialogModal>

        <div className="ec-btn-row ec-feature-actions ec-feature-actions--back">{backButton}</div>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--scratch">
      {npcIntro}

      <div className="ec-scratch-layout">
        <div
          className={`ec-scratch-ticket ec-scratch-ticket--slots-${count}`}
        >
          <div className="ec-scratch-ticket__art" aria-hidden>
            {count === 5 ? (
              <img src={SCRATCH_TICKET_5_IMG} alt="" draggable={false} />
            ) : count === 3 ? (
              <img src={SCRATCH_TICKET_3_IMG} alt="" draggable={false} />
            ) : null}
          </div>
          <div
            className={`ec-scratch-ticket__body ${
              count === 5
                ? 'ec-scratch-ticket__body--five'
                : count === 3
                  ? 'ec-scratch-ticket__body--three'
                  : ''
            }`}
          >
            {count === 5 ? (
              <div className="ec-scratch-board ec-scratch-board--5">
                <div className="ec-scratch-board__row ec-scratch-board__row--top">
                  {[0, 1, 2].map((i) => renderScratchSlot(i))}
                </div>
                <div className="ec-scratch-board__row ec-scratch-board__row--bottom">
                  {[3, 4].map((i) => renderScratchSlot(i))}
                </div>
              </div>
            ) : count === 3 ? (
              <div className="ec-scratch-board ec-scratch-board--3">
                <div className="ec-scratch-board__row ec-scratch-board__row--three">
                  {[0, 1, 2].map((i) => renderScratchSlot(i))}
                </div>
              </div>
            ) : (
              <div className={`ec-scratch-grid ec-scratch-grid--${count}`}>
                {ids.slice(0, count).map((_, i) => renderScratchSlot(i))}
              </div>
            )}

            {winInfo && (
              <p
                className={`ec-scratch-result ${
                  count === 5 || count === 3 ? 'ec-scratch-result--on-ticket' : ''
                } ${winInfo.win ? 'is-win' : 'is-lose'}`}
              >
                {winInfo.text}
              </p>
            )}
          </div>
        </div>

        <aside className="ec-scratch-rewards">
          <div className="ec-scratch-rewards__title">Phần thưởng</div>
          <div className="ec-scratch-rewards__row">
            <span className="ec-scratch-rewards__muted">Giá vé:</span>{' '}
            <strong>{(mode === 3 ? price3 : price5).toLocaleString('vi-VN')} Peta</strong>
          </div>
          <ul className="ec-scratch-rewards__list">
            {scratchSidebarRows.length === 0 ? (
              <li className="ec-scratch-rewards__empty">Chưa cấu hình phần thưởng vé {mode} ô trên Admin.</li>
            ) : (
              scratchSidebarRows.map((row, idx) => {
              const sym = symbols.find((s) => s.id === row.symbolId);
              const label = sym?.label || row.symbolId;
              return (
                <li key={row.symbolId} className="ec-scratch-rewards__item">
                  <div className="ec-scratch-rewards__thumb" aria-hidden>
                    {sym?.imageUrl ? (
                      <img src={sym.imageUrl} alt="" className="ec-scratch-rewards__thumb-img" />
                    ) : (
                      <span className="ec-scratch-rewards__thumb-emoji">{sym?.emoji || '❔'}</span>
                    )}
                  </div>
                  <div className="ec-scratch-rewards__item-main">
                    <div className="ec-scratch-rewards__item-line">
                      <span className={sidebarTierBadgeClass(idx)}>{sidebarTierLabel(idx)}</span>
                      <strong className="ec-scratch-rewards__amount">
                        {Number(row.rewardPeta).toLocaleString('vi-VN')}
                      </strong>
                      <span className="ec-scratch-rewards__muted"> Peta</span>
                    </div>
                    <div className="ec-scratch-rewards__item-symbol">{label}</div>
                  </div>
                </li>
              );
            })
            )}
          </ul>
          <div className="ec-scratch-rewards__hint">
            Trúng khi có <strong>{requiredMatch}</strong> icon giống nhau.
          </div>
        </aside>
      </div>

      <GameDialogModal
        isOpen={winOpen && !!winReward}
        onClose={() => {
          setWinOpen(false);
          setWinReward(null);
        }}
        title="Phần thưởng"
        mode="alert"
        confirmLabel="Đóng"
        onConfirm={() => {
          setWinOpen(false);
          setWinReward(null);
        }}
        tone="info"
      >
        {winReward ? (
          <p style={{ fontWeight: 700, textAlign: 'center' }}>
            Chúc mừng! Bạn nhận được{' '}
            <strong>{Number(winReward.amount || 0).toLocaleString('vi-VN')} Peta</strong>
          </p>
        ) : null}
      </GameDialogModal>

      <div className="ec-btn-row ec-feature-actions ec-feature-actions--back">
        <button
          type="button"
          className="ec-btn ec-mystery-btn-primary"
          onClick={() => resetRound(mode)}
        >
          Về Shop
        </button>
        {backButton}
      </div>
    </div>
  );
}

export default ScratchLotteryGame;
