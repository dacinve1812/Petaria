import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useUser } from '../../UserContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const MISSING_ITEM_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#e2e8f0" width="64" height="64" rx="10"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-size="26">?</text></svg>',
  );

function invImgSrc(imageUrl) {
  if (!imageUrl) return MISSING_ITEM_IMG;
  const s = String(imageUrl);
  if (s.startsWith('/') || s.startsWith('http')) return s;
  return `/images/equipments/${s}`;
}

const RARITY_LABEL = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

function MysteryBoxGame() {
  const { user } = useUser();
  const { loading } = useGameCenterConfig();

  const [srv, setSrv] = useState(null);
  const [statusErr, setStatusErr] = useState('');
  const [inventory, setInventory] = useState([]);
  const [invErr, setInvErr] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exchangeErr, setExchangeErr] = useState('');
  const [resultDlg, setResultDlg] = useState(null);

  const fetchStatus = useCallback(async () => {
    setStatusErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/mystery-box/status`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSrv(null);
        setStatusErr(typeof data.error === 'string' ? data.error : 'Không tải được cấu hình');
        return;
      }
      setSrv(data);
    } catch (e) {
      setSrv(null);
      setStatusErr(e.message || 'Lỗi mạng');
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    if (!user?.token || !user?.userId) {
      setInventory([]);
      return;
    }
    setInvErr('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/users/${user.userId}/inventory`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await r.json().catch(() => []);
      if (!r.ok) {
        setInventory([]);
        setInvErr(typeof data.error === 'string' ? data.error : 'Không tải kho');
        return;
      }
      setInventory(Array.isArray(data) ? data : []);
    } catch (e) {
      setInventory([]);
      setInvErr(e.message || 'Lỗi mạng');
    }
  }, [user?.token, user?.userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const selectableRows = useMemo(
    () => inventory.filter((row) => Number(row.is_equipped) !== 1 && Number(row.quantity) > 0),
    [inventory],
  );

  const openPicker = () => {
    setExchangeErr('');
    setPickerOpen(true);
    fetchInventory();
  };

  const pickRow = (row) => {
    setSelected(row);
    setPickerOpen(false);
  };

  const doExchange = async () => {
    if (!user?.token || !selected?.id) return;
    setBusy(true);
    setExchangeErr('');
    setConfirmOpen(false);
    try {
      const r = await fetch(`${API_BASE_URL}/api/game-center/mystery-box/exchange`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inventoryId: Number(selected.id) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data.error || 'Không đổi được');
      }
      setResultDlg(data);
      setSelected(null);
      await fetchInventory();
      await fetchStatus();
    } catch (e) {
      setExchangeErr(e.message || 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ec-game ec-game--mystery">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--mystery">
      <p className="ec-game__lead">
        Cho <strong>một</strong> vật phẩm từ kho vào hộp (tiêu thụ). Bạn nhận <strong>ngẫu nhiên</strong> một vật phẩm
        khác — rarity do Admin quyết (tỉ lệ), cụ thể item random trong catalog cùng rarity.
      </p>

      {!user?.token && (
        <p className="ec-note">
          <Link to="/login">Đăng nhập</Link> để dùng kho thật.
        </p>
      )}

      {statusErr && (
        <p className="ec-guess-alert ec-guess-alert--error" role="alert">
          {statusErr}
        </p>
      )}

      {srv && (
        <div className="ec-mystery-rates" aria-label="Tỉ lệ rarity">
          {(srv.rarityWeights || []).map((rw) => (
            <span key={rw.rarity} className="ec-mystery-rate-pill">
              <span className="ec-mystery-rate-pill__r">{RARITY_LABEL[rw.rarity] || rw.rarity}</span>
              <span className="ec-mystery-rate-pill__p">{rw.percent != null ? `${rw.percent}%` : '—'}</span>
              <span className="ec-mystery-rate-pill__c">
                ({srv.poolCounts?.[rw.rarity] ?? 0} item trong DB)
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="ec-mystery-slot">
        <div className="ec-mystery-slot__box" aria-hidden>
          ?
        </div>
        <div className="ec-mystery-slot__meta">
          {selected ? (
            <>
              <div className="ec-mystery-picked">
                <img src={invImgSrc(selected.image_url)} alt="" className="ec-mystery-picked__img" />
                <div>
                  <div className="ec-mystery-picked__name">{selected.name}</div>
                  <div className="ec-mystery-picked__sub">
                    x{selected.quantity} · {RARITY_LABEL[String(selected.rarity || '').toLowerCase()] || selected.rarity}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="ec-mystery-slot__hint">Chưa chọn vật phẩm.</p>
          )}
        </div>
      </div>

      <div className="ec-btn-row ec-mystery-actions">
        <button
          type="button"
          className="ec-btn ec-btn--ghost"
          onClick={openPicker}
          disabled={!user?.token || busy || !!statusErr}
        >
          Chọn vật phẩm cho vào hộp
        </button>
        <button
          type="button"
          className="ec-btn"
          onClick={() => {
            setExchangeErr('');
            setConfirmOpen(true);
          }}
          disabled={!user?.token || !selected || busy || !!statusErr}
        >
          Đổi ngẫu nhiên
        </button>
      </div>

      {invErr && (
        <p className="ec-guess-alert ec-guess-alert--warn" role="alert">
          {invErr}
        </p>
      )}

      {exchangeErr && (
        <p className="ec-guess-alert ec-guess-alert--error" role="alert">
          {exchangeErr}
        </p>
      )}

      <p className="ec-note ec-mystery-admin-hint">
        Cấu hình tỉ lệ rarity trong Admin → Game center → Hộp bí ẩn.
      </p>

      {pickerOpen && (
        <div
          className="ec-mystery-picker-overlay"
          role="presentation"
          onClick={() => setPickerOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
        >
          <div
            className="ec-mystery-picker-modal"
            role="dialog"
            aria-labelledby="ec-mystery-picker-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ec-mystery-picker-head">
              <h2 id="ec-mystery-picker-title">Chọn vật phẩm trong kho</h2>
              <button type="button" className="ec-mystery-picker-close" onClick={() => setPickerOpen(false)}>
                ×
              </button>
            </div>
            <p className="ec-mystery-picker-note">Vật phẩm đang trang bị không hiển thị.</p>
            <ul className="ec-mystery-picker-grid">
              {selectableRows.length === 0 ? (
                <li className="ec-mystery-picker-empty">Không có vật phẩm khả dụng.</li>
              ) : (
                selectableRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="ec-mystery-picker-card"
                      onClick={() => pickRow(row)}
                    >
                      <img src={invImgSrc(row.image_url)} alt="" />
                      <span className="ec-mystery-picker-card__name">{row.name}</span>
                      <span className="ec-mystery-picker-card__qty">x{row.quantity}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      <GameDialogModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xác nhận"
        mode="confirm"
        confirmLabel="Đồng ý"
        cancelLabel="Hủy"
        onConfirm={() => void doExchange()}
        onCancel={() => setConfirmOpen(false)}
        tone="warning"
      >
        <p>Vật phẩm đã chọn sẽ bị tiêu thụ. Bạn nhận một phần thưởng ngẫu nhiên theo tỉ lệ rarity. Tiếp tục?</p>
      </GameDialogModal>

      <GameDialogModal
        isOpen={!!resultDlg}
        onClose={() => setResultDlg(null)}
        title="Phần thưởng"
        mode="alert"
        confirmLabel="Đóng"
        tone="info"
        onConfirm={() => setResultDlg(null)}
      >
        {resultDlg?.reward && (
          <div className="ec-mystery-result">
            <p className="ec-mystery-result__rarity">
              Rarity quay: <strong>{RARITY_LABEL[resultDlg.rolledRarity] || resultDlg.rolledRarity}</strong>
            </p>
            <div className="ec-mystery-result__reward">
              <img src={invImgSrc(resultDlg.reward.image_url)} alt="" />
              <div>
                <div className="ec-mystery-result__name">{resultDlg.reward.name}</div>
                <div className="ec-mystery-result__sub">
                  {RARITY_LABEL[resultDlg.reward.rarity] || resultDlg.reward.rarity}
                </div>
              </div>
            </div>
            <p className="ec-mystery-result__muted">Đã thêm vào kho. Vật phẩm đưa vào hộp đã trừ.</p>
          </div>
        )}
      </GameDialogModal>
    </div>
  );
}

export default MysteryBoxGame;
