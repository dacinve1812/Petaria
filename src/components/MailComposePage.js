import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import { getDisplayName } from '../utils/userDisplay';
import './MailComposePage.css';

function isMiscInventoryRow(row) {
  const t = String(row?.type || '').toLowerCase();
  const c = String(row?.item_category ?? row?.category ?? '').toLowerCase();
  return t === 'misc' || c === 'misc';
}

function MailComposePage() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  const [friends, setFriends] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pets, setPets] = useState([]);
  const [spirits, setSpirits] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [giftKind, setGiftKind] = useState('items');
  const [itemRows, setItemRows] = useState([{ inventory_id: '', quantity: 1 }]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedSpiritId, setSelectedSpiritId] = useState('');

  const invParam = searchParams.get('inventory_id');
  const appliedInvParam = useRef(false);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user?.token}`,
    }),
    [user?.token]
  );

  const giftableInventory = useMemo(
    () => inventory.filter((row) => !isMiscInventoryRow(row) && !Number(row.is_equipped)),
    [inventory]
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
    }
  }, [isLoading, user, navigate]);

  const loadData = useCallback(async () => {
    if (!user?.token || !user?.userId) return;
    setLoadError('');
    try {
      const [bRes, invRes, petRes, spRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/buddies`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${API_BASE_URL}/api/users/${user.userId}/inventory`, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        fetch(`${API_BASE_URL}/users/${user.userId}/pets`, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        fetch(`${API_BASE_URL}/api/users/${user.userId}/spirits`),
      ]);

      if (bRes.ok) {
        const bData = await bRes.json();
        setFriends(Array.isArray(bData.friends) ? bData.friends : []);
      } else {
        setFriends([]);
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        setInventory(Array.isArray(invData) ? invData : []);
      } else {
        setInventory([]);
      }

      if (petRes.ok) {
        const pData = await petRes.json();
        setPets(Array.isArray(pData) ? pData : []);
      } else {
        setPets([]);
      }

      if (spRes.ok) {
        const sData = await spRes.json();
        setSpirits(Array.isArray(sData) ? sData : []);
      } else {
        setSpirits([]);
      }
    } catch (e) {
      console.error(e);
      setLoadError('Không tải được dữ liệu. Thử lại sau.');
    }
  }, [API_BASE_URL, user?.token, user?.userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (appliedInvParam.current || !invParam || giftableInventory.length === 0) return;
    const iid = parseInt(invParam, 10);
    if (!Number.isFinite(iid)) return;
    const exists = giftableInventory.some((r) => Number(r.id) === iid);
    if (exists) {
      appliedInvParam.current = true;
      setGiftKind('items');
      setItemRows([{ inventory_id: String(iid), quantity: 1 }]);
    }
  }, [invParam, giftableInventory]);

  const optionsForItemRow = (rowIndex) => {
    const current = parseInt(itemRows[rowIndex]?.inventory_id, 10);
    return giftableInventory.filter((inv) => {
      const id = Number(inv.id);
      if (id === current) return true;
      return !itemRows.some(
        (r, idx) => idx !== rowIndex && parseInt(r.inventory_id, 10) === id
      );
    });
  };

  const onKindChange = (kind) => {
    setGiftKind(kind);
    setFormError('');
    if (kind === 'items') {
      setSelectedPetId('');
      setSelectedSpiritId('');
      setItemRows((rows) => (rows.length ? rows : [{ inventory_id: '', quantity: 1 }]));
    } else if (kind === 'pet') {
      setItemRows([{ inventory_id: '', quantity: 1 }]);
      setSelectedSpiritId('');
    } else {
      setItemRows([{ inventory_id: '', quantity: 1 }]);
      setSelectedPetId('');
    }
  };

  const updateItemRow = (idx, patch) => {
    setItemRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addItemRow = () => {
    setItemRows((rows) => [...rows, { inventory_id: '', quantity: 1 }]);
  };

  const removeItemRow = (idx) => {
    setItemRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!user?.token) return;

    const rid = parseInt(recipientId, 10);
    if (!Number.isFinite(rid) || rid <= 0) {
      setFormError('Chọn người nhận trong danh sách bạn bè.');
      return;
    }
    const subj = subject.trim();
    const msg = message.trim();
    if (!subj || !msg) {
      setFormError('Tiêu đề và nội dung không được để trống.');
      return;
    }

    let body = {
      recipient_user_id: rid,
      subject: subj,
      message: msg,
      gift_kind: giftKind,
    };

    if (giftKind === 'items') {
      const items = [];
      for (const row of itemRows) {
        const invId = parseInt(row.inventory_id, 10);
        const qty = Math.max(1, parseInt(row.quantity, 10) || 1);
        if (!Number.isFinite(invId)) continue;
        items.push({ inventory_id: invId, quantity: qty });
      }
      if (!items.length) {
        setFormError('Thêm ít nhất một vật phẩm từ kho (không gồm misc, không đang trang bị).');
        return;
      }
      body.items = items;
    } else if (giftKind === 'pet') {
      const pid = parseInt(selectedPetId, 10);
      if (!Number.isFinite(pid)) {
        setFormError('Chọn một thú cưng để tặng.');
        return;
      }
      body.pet_id = pid;
    } else {
      const sid = parseInt(selectedSpiritId, 10);
      if (!Number.isFinite(sid)) {
        setFormError('Chọn một linh thú để tặng.');
        return;
      }
      body.user_spirit_id = sid;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mails/gift`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || data.message || 'Không gửi được thư.');
        return;
      }
      alert(data.message || 'Đã gửi thư!');
      navigate('/mail');
    } catch (err) {
      console.error(err);
      setFormError('Lỗi kết nối khi gửi thư.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="mail-page-container">
          <div className="loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="mail-page-container">
        <div className="mail-page-wrapper mail-compose-page">
          <form className="mail-compose-card" onSubmit={handleSubmit}>
            <div className="mail-compose-header">
              <h2>Gửi thư cho bạn bè</h2>
              <p>Chọn một loại quà: vật phẩm, thú cưng, hoặc linh thú (không trộn trong cùng một thư).</p>
            </div>

            <div className="mail-compose-body">
              {loadError ? <div className="mail-compose-error">{loadError}</div> : null}
              {formError ? <div className="mail-compose-error">{formError}</div> : null}

              <div className="mail-compose-field">
                <label htmlFor="mail-compose-recipient">Người nhận (bạn bè)</label>
                <select
                  id="mail-compose-recipient"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                >
                  <option value="">— Chọn bạn bè —</option>
                  {friends.map((f) => (
                    <option key={f.user_id} value={f.user_id}>
                      {getDisplayName(f)} (@{f.username})
                    </option>
                  ))}
                </select>
                {!friends.length ? (
                  <p className="mail-compose-hint">
                    Chưa có bạn bè.{' '}
                    <button
                      type="button"
                      className="mail-compose-btn-secondary mail-compose-btn"
                      onClick={() => navigate('/buddies')}
                    >
                      Đến trang bạn bè
                    </button>
                  </p>
                ) : null}
              </div>

              <div className="mail-compose-field">
                <label htmlFor="mail-compose-subject">Tiêu đề</label>
                <input
                  id="mail-compose-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="Tiêu đề thư"
                />
              </div>

              <div className="mail-compose-field">
                <label htmlFor="mail-compose-message">Nội dung</label>
                <textarea
                  id="mail-compose-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Lời nhắn…"
                />
              </div>

              <div className="mail-compose-field">
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Loại quà đính kèm</span>
                <div className="mail-compose-kind">
                  <label>
                    <input
                      type="radio"
                      name="gift_kind"
                      checked={giftKind === 'items'}
                      onChange={() => onKindChange('items')}
                    />
                    Vật phẩm
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="gift_kind"
                      checked={giftKind === 'pet'}
                      onChange={() => onKindChange('pet')}
                    />
                    Thú cưng
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="gift_kind"
                      checked={giftKind === 'spirit'}
                      onChange={() => onKindChange('spirit')}
                    />
                    Linh thú
                  </label>
                </div>
              </div>

              {giftKind === 'items' ? (
                <div className="mail-compose-attach-block">
                  <h3>Vật phẩm đính kèm</h3>
                  {itemRows.map((row, idx) => {
                    const opts = optionsForItemRow(idx);
                    const inv = opts.find((o) => String(o.id) === String(row.inventory_id));
                    const maxQty = inv ? Math.max(1, Number(inv.quantity) || 1) : 1;
                    return (
                      <div key={idx} className="mail-compose-item-row">
                        <select
                          value={row.inventory_id}
                          onChange={(e) =>
                            updateItemRow(idx, { inventory_id: e.target.value, quantity: 1 })
                          }
                        >
                          <option value="">— Chọn từ kho —</option>
                          {opts.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} ×{o.quantity}
                            </option>
                          ))}
                        </select>
                        <input
                          className="qty"
                          type="number"
                          min={1}
                          max={maxQty}
                          value={row.quantity}
                          onChange={(e) =>
                            updateItemRow(idx, {
                              quantity: Math.min(
                                maxQty,
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              ),
                            })
                          }
                        />
                        {itemRows.length > 1 ? (
                          <button
                            type="button"
                            className="mail-compose-row-remove"
                            onClick={() => removeItemRow(idx)}
                          >
                            Xóa dòng
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  <button type="button" className="mail-compose-add-row" onClick={addItemRow}>
                    + Thêm vật phẩm
                  </button>
                  <p className="mail-compose-hint">
                    Không hiển thị vật phẩm loại misc, vật phẩm đang trang bị, hoặc peta/petagold (không thể tặng
                    qua thư).
                  </p>
                </div>
              ) : null}

              {giftKind === 'pet' ? (
                <div className="mail-compose-attach-block">
                  <h3>Thú cưng đính kèm</h3>
                  <select value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
                    <option value="">— Chọn pet —</option>
                    {pets.map((p) => {
                      const ok = Number(p.level) >= 20;
                      return (
                        <option key={p.id} value={p.id} disabled={!ok}>
                          {p.name} — Lv.{p.level} {p.species_name ? `(${p.species_name})` : ''}
                          {!ok ? ' — cần cấp ≥20' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mail-compose-hint">
                    Pet từ cấp 20 trở lên. Khi gửi, hệ thống tự gỡ toàn bộ trang bị và linh thú đang gắn pet;
                    pet chuyển sang người nhận ngay. Pet không được đang trong trận đấu arena.
                  </p>
                </div>
              ) : null}

              {giftKind === 'spirit' ? (
                <div className="mail-compose-attach-block">
                  <h3>Linh thú đính kèm</h3>
                  <select value={selectedSpiritId} onChange={(e) => setSelectedSpiritId(e.target.value)}>
                    <option value="">— Chọn linh thú —</option>
                    {spirits.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} #{s.id}
                      </option>
                    ))}
                  </select>
                  {!spirits.length ? (
                    <p className="mail-compose-pet-warn">Không có linh thú trong kho.</p>
                  ) : (
                    <p className="mail-compose-hint">
                      Khi gửi, hệ thống tự gỡ linh thú khỏi pet (nếu đang trang bị); linh thú chuyển sang người
                      nhận ngay.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="mail-compose-actions">
                <button type="submit" className="mail-compose-btn mail-compose-btn-primary" disabled={submitting}>
                  {submitting ? 'Đang gửi…' : 'Gửi thư'}
                </button>
                <button
                  type="button"
                  className="mail-compose-btn mail-compose-btn-secondary"
                  onClick={() => navigate('/mail')}
                >
                  Hủy
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </TemplatePage>
  );
}

export default MailComposePage;
