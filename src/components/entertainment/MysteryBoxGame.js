import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import GameDialogModal from '../ui/GameDialogModal';
import FeatureNpcIntro, { buildFeatureNpcProps } from './FeatureNpcIntro';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useFeatureBackNav } from './useFeatureBackNav';
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

/**
 * /game-center/mystery-box — Làng Tráo Trở / BotBox
 * FeatureNpcIntro + config narrative (admin).
 */
function MysteryBoxGame() {
  const { user } = useUser();
  const { config, loading } = useGameCenterConfig();
  const backNav = useFeatureBackNav();
  const narrative = config?.mysteryBox?.narrative || {};

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

  const intro = useMemo(
    () =>
      buildFeatureNpcProps(narrative, {}, {
        speaker: 'BotBox',
        portraitSrc: '/images/character/Botbox.png',
        lines: [
          'Xin chào, tôi là BotBox — thú cưng của Làng Tráo Trở nổi tiếng trong Khu Rừng Bí Ẩn.',
          'Bạn hãy chọn bất kỳ một vật phẩm nào của bạn và đặt vào bên trong tôi.',
          'Ngay sau đó, tôi sẽ đổi lại cho bạn vật phẩm khác mà trước đây người khác từng đặt vào — dĩ nhiên vật phẩm cũ của bạn sẽ bị tôi lấy mất, hehe.',
          'Dám thử không? Biết đâu bạn sẽ nhận được vật phẩm rất có giá trị!',
        ],
      }),
    [narrative],
  );

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
      setInventory(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
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
      <div className="ec-game ec-game--mystery">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-game ec-game--mystery">
      <FeatureNpcIntro
        speaker={intro.speaker}
        portraitSrc={intro.portraitSrc}
        lorePortraitSrc={intro.lorePortraitSrc}
        greeting={intro.greeting}
        loreLines={intro.loreLines}
        portraitAlt="Hộp thần kỳ của BotBox"
      />

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
              <span className="ec-mystery-rate-pill__p">
                {rw.percent != null ? `${rw.percent}%` : '—'}
              </span>
            </span>
          ))}
        </div>
      )}

      <section className="ec-mystery-slot" aria-label="Vật phẩm đưa vào hộp">
        <div className="ec-mystery-slot__meta">
          {selected ? (
            <div className="ec-mystery-picked">
              <img src={invImgSrc(selected.image_url)} alt="" className="ec-mystery-picked__img" />
              <div>
                <div className="ec-mystery-picked__name">{selected.name}</div>
                <div className="ec-mystery-picked__sub">
                  x{selected.quantity} ·{' '}
                  {RARITY_LABEL[String(selected.rarity || '').toLowerCase()] || selected.rarity}
                </div>
              </div>
            </div>
          ) : (
            <p className="ec-mystery-slot__hint">Chưa chọn vật phẩm để đặt vào hộp.</p>
          )}
        </div>
      </section>

      <div className="ec-btn-row ec-mystery-actions">
        <button
          type="button"
          className="ec-btn ec-btn--ghost"
          onClick={openPicker}
          disabled={!user?.token || busy || !!statusErr}
        >
          Chọn vật phẩm
        </button>
        <button
          type="button"
          className="ec-btn ec-mystery-btn-primary"
          onClick={() => {
            setExchangeErr('');
            setConfirmOpen(true);
          }}
          disabled={!user?.token || !selected || busy || !!statusErr}
        >
          {busy ? 'Đang đổi…' : 'Đặt vào hộp'}
        </button>
      </div>
      <div className="ec-btn-row ec-mystery-actions ec-mystery-actions--back">{backButton}</div>

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
              <button
                type="button"
                className="ec-mystery-picker-close"
                onClick={() => setPickerOpen(false)}
              >
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
        title="Xác nhận với BotBox"
        mode="confirm"
        confirmLabel="Đồng ý"
        cancelLabel="Hủy"
        onConfirm={() => void doExchange()}
        onCancel={() => setConfirmOpen(false)}
        tone="warning"
      >
        <p>
          Vật phẩm đã chọn sẽ biến mất. Bạn nhận lại một món ngẫu nhiên từ hộp thần kỳ.
          Tiếp tục chứ?
        </p>
      </GameDialogModal>

      <GameDialogModal
        isOpen={!!resultDlg}
        onClose={() => setResultDlg(null)}
        title="BotBox đổi cho bạn"
        mode="alert"
        confirmLabel="Đóng"
        tone="info"
        onConfirm={() => setResultDlg(null)}
      >
        {resultDlg?.reward && (
          <div className="ec-mystery-result">
            <div className="ec-mystery-result__reward">
              <img src={invImgSrc(resultDlg.reward.image_url)} alt="" />
              <div>
                <div className="ec-mystery-result__name">{resultDlg.reward.name}</div>
                <div className="ec-mystery-result__sub">
                  <span>Độ Hiếm: </span>
                  {RARITY_LABEL[resultDlg.reward.rarity] || resultDlg.reward.rarity}
                </div>
              </div>
            </div>
            <p className="ec-mystery-result__muted">Đã thêm vào kho.</p>
          </div>
        )}
      </GameDialogModal>
    </div>
  );
}

export default MysteryBoxGame;
