import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminMailTest.css';

const MAIL_PRESETS_KEY = 'petaria_admin_mail_presets_v1';

function loadPresets() {
  try {
    const raw = localStorage.getItem(MAIL_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function itemImageSrc(url) {
  if (!url) return '/images/equipments/placeholder.png';
  const s = String(url);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/equipments/${s}`;
}

function spiritImageSrc(url) {
  if (!url) return '/images/spirit/placeholder.png';
  const s = String(url);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/spirit/${s}`;
}

function petSpeciesImageSrc(image) {
  if (!image) return '/images/pets/placeholder.png';
  const s = String(image);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/pets/${s}`;
}

function matchesSearch(entity, q, keys) {
  if (!q) return true;
  const low = q.toLowerCase();
  return keys.some((k) => String(entity[k] ?? '').toLowerCase().includes(low));
}

function CatalogGrid({ title, search, onSearchChange, rows, onPick, imgFn, idKey, nameKey, searchKeys }) {
  const filtered = useMemo(
    () => rows.filter((e) => matchesSearch(e, search.trim(), searchKeys)),
    [rows, search, searchKeys]
  );

  return (
    <div className="mail-catalog-block">
      <div className="mail-catalog-head">
        <h4>{title}</h4>
        <input
          type="search"
          className="mail-catalog-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo tên hoặc ID…"
        />
      </div>
      <div className="mail-catalog-grid">
        {filtered.length === 0 ? (
          <p className="mail-catalog-empty">Không có kết quả.</p>
        ) : (
          filtered.map((row) => (
            <button
              key={row[idKey]}
              type="button"
              className="mail-catalog-tile"
              onClick={() => onPick(row)}
              title="Thêm vào phần thưởng"
            >
              <img src={imgFn(row)} alt="" onError={(e) => { e.target.src = '/images/equipments/placeholder.png'; }} />
              <span className="mail-catalog-tile-name">{row[nameKey]}</span>
              <span className="mail-catalog-tile-id">#{row[idKey]}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const AdminMailTest = () => {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [recipientUserIds, setRecipientUserIds] = useState(['']);
  const [broadcastAll, setBroadcastAll] = useState(false);
  const [selectedMailType, setSelectedMailType] = useState('1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customPeta, setCustomPeta] = useState(0);
  const [customPetaGold, setCustomPetaGold] = useState(0);
  const [customItems, setCustomItems] = useState([]);
  const [customSpirits, setCustomSpirits] = useState([]);
  const [customPets, setCustomPets] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [availableSpirits, setAvailableSpirits] = useState([]);
  const [availablePets, setAvailablePets] = useState([]);
  const [presets, setPresets] = useState(loadPresets);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetNameInput, setPresetNameInput] = useState('');
  const [searchItem, setSearchItem] = useState('');
  const [searchSpirit, setSearchSpirit] = useState('');
  const [searchPet, setSearchPet] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  const mailTemplates = useMemo(
    () => [
      {
        id: '1',
        subject: 'Hoàn thành nhiệm vụ nhận quà',
        message: 'Chúc mừng! Bạn đã hoàn thành nhiệm vụ và nhận được phần thưởng.',
        attached_rewards: { peta: 100, peta_gold: 50, items: [] },
      },
      {
        id: '2',
        subject: 'Phần thưởng đăng nhập hàng ngày',
        message: 'Phần thưởng đăng nhập hàng ngày của bạn đã sẵn sàng!',
        attached_rewards: { peta: 50, items: [] },
      },
      {
        id: '3',
        subject: 'Sự kiện đặc biệt - Quà tặng',
        message: 'Tham gia sự kiện đặc biệt và nhận quà tặng!',
        attached_rewards: { peta_gold: 100, items: [] },
      },
      {
        id: '4',
        subject: 'Nhiệm vụ tuần hoàn',
        message: 'Hoàn thành nhiệm vụ tuần hoàn và nhận phần thưởng!',
        attached_rewards: { peta: 200, items: [] },
      },
      {
        id: '5',
        subject: 'Quà tặng sinh nhật',
        message: 'Chúc mừng sinh nhật! Đây là quà tặng đặc biệt dành cho bạn.',
        attached_rewards: { peta: 500, peta_gold: 200, items: [] },
      },
      {
        id: '6',
        subject: 'Thông báo bảo trì',
        message: 'Hệ thống sẽ bảo trì trong 2 giờ tới. Cảm ơn sự kiên nhẫn của bạn.',
        attached_rewards: {},
      },
    ],
    []
  );

  useEffect(() => {
    if (!user?.token) return;
    const authHeaders = { Authorization: `Bearer ${user.token}` };

    const fetchData = async () => {
      try {
        const itemsResponse = await fetch(`${API_BASE_URL}/api/admin/items`, { headers: authHeaders });
        if (itemsResponse.ok) {
          const items = await itemsResponse.json();
          setAvailableItems(Array.isArray(items) ? items : []);
        } else {
          setAvailableItems([]);
        }

        const spiritsResponse = await fetch(`${API_BASE_URL}/api/spirits`);
        if (spiritsResponse.ok) {
          const spirits = await spiritsResponse.json();
          setAvailableSpirits(Array.isArray(spirits) ? spirits : []);
        }

        const petsResponse = await fetch(`${API_BASE_URL}/api/admin/pets/unowned-mail`, { headers: authHeaders });
        if (petsResponse.ok) {
          const pets = await petsResponse.json();
          setAvailablePets(Array.isArray(pets) ? pets : []);
        } else {
          setAvailablePets([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [user?.token, API_BASE_URL]);

  useEffect(() => {
    if (!customMode && selectedMailType) {
      const template = mailTemplates.find((t) => t.id === selectedMailType);
      if (template) {
        setCustomSubject(template.subject);
        setCustomMessage(template.message);
        setCustomPeta(template.attached_rewards.peta || 0);
        setCustomPetaGold(template.attached_rewards.peta_gold || 0);
        setCustomItems(template.attached_rewards.items || []);
        setCustomSpirits(template.attached_rewards.spirits || []);
        setCustomPets(template.attached_rewards.pets || []);
      }
    }
  }, [selectedMailType, customMode, mailTemplates]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  const persistPresets = useCallback((next) => {
    localStorage.setItem(MAIL_PRESETS_KEY, JSON.stringify(next));
    setPresets(next);
  }, []);

  const applyPreset = useCallback((preset) => {
    if (!preset) return;
    setCustomSubject(preset.subject || '');
    setCustomMessage(preset.message || '');
    setCustomPeta(preset.peta ?? 0);
    setCustomPetaGold(preset.petaGold ?? preset.peta_gold ?? 0);
    setCustomItems(Array.isArray(preset.items) ? preset.items : []);
    setCustomSpirits(Array.isArray(preset.spirits) ? preset.spirits : []);
    setCustomPets(Array.isArray(preset.pets) ? preset.pets : []);
  }, []);

  const handleSavePreset = () => {
    const name = presetNameInput.trim();
    if (!name) {
      setMessage('Nhập tên mẫu trước khi lưu.');
      return;
    }
    const snapshot = {
      id: `p_${Date.now()}`,
      name,
      subject: customSubject,
      message: customMessage,
      peta: customPeta,
      petaGold: customPetaGold,
      items: customItems,
      spirits: customSpirits,
      pets: customPets,
      savedAt: new Date().toISOString(),
    };
    const existingIdx = presets.findIndex((p) => p.name === name);
    let next;
    if (existingIdx >= 0) {
      next = [...presets];
      next[existingIdx] = { ...next[existingIdx], ...snapshot, id: next[existingIdx].id };
    } else {
      next = [...presets, snapshot];
    }
    persistPresets(next);
    setSelectedPresetId(snapshot.id);
    setMessage(`✅ Đã lưu mẫu "${name}"`);
  };

  const handleDeletePreset = () => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset || !window.confirm(`Xóa mẫu "${preset.name}"?`)) return;
    persistPresets(presets.filter((p) => p.id !== selectedPresetId));
    setSelectedPresetId('');
    setMessage('✅ Đã xóa mẫu.');
  };

  const handleLoadSelectedPreset = () => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) {
      setMessage('Chọn một mẫu trong danh sách.');
      return;
    }
    applyPreset(preset);
    setMessage(`✅ Đã tải mẫu "${preset.name}"`);
  };

  const toggleCustomMode = (checked) => {
    if (checked) {
      const template = mailTemplates.find((t) => t.id === selectedMailType);
      if (template) {
        setCustomSubject(template.subject);
        setCustomMessage(template.message);
        setCustomPeta(template.attached_rewards.peta || 0);
        setCustomPetaGold(template.attached_rewards.peta_gold || 0);
        setCustomItems(template.attached_rewards.items || []);
        setCustomSpirits(template.attached_rewards.spirits || []);
        setCustomPets(template.attached_rewards.pets || []);
      }
    }
    setCustomMode(checked);
  };

  const addRecipientRow = () => setRecipientUserIds((prev) => [...prev, '']);
  const removeRecipientRow = (index) => {
    setRecipientUserIds((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };
  const updateRecipientRow = (index, value) => {
    setRecipientUserIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const pickItem = (row) => {
    setCustomItems((prev) => {
      const i = prev.findIndex((p) => p.item_id === row.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: (copy[i].quantity || 0) + 1 };
        return copy;
      }
      return [...prev, { item_id: row.id, quantity: 1 }];
    });
  };

  const pickSpirit = (row) => {
    setCustomSpirits((prev) => {
      const i = prev.findIndex((p) => p.spirit_id === row.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: (copy[i].quantity || 0) + 1 };
        return copy;
      }
      return [...prev, { spirit_id: row.id, quantity: 1 }];
    });
  };

  const pickPet = (row) => {
    setCustomPets((prev) => {
      const i = prev.findIndex((p) => p.pet_id === row.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: (copy[i].quantity || 0) + 1 };
        return copy;
      }
      return [...prev, { pet_id: row.id, quantity: 1 }];
    });
  };

  const updateItemQty = (index, qty) => {
    setCustomItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(1, parseInt(qty, 10) || 1) };
      return next;
    });
  };
  const updateSpiritQty = (index, qty) => {
    setCustomSpirits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(1, parseInt(qty, 10) || 1) };
      return next;
    });
  };
  const updatePetQty = (index, qty) => {
    setCustomPets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(1, parseInt(qty, 10) || 1) };
      return next;
    });
  };

  const removeItemAt = (index) => setCustomItems((prev) => prev.filter((_, i) => i !== index));
  const removeSpiritAt = (index) => setCustomSpirits((prev) => prev.filter((_, i) => i !== index));
  const removePetAt = (index) => setCustomPets((prev) => prev.filter((_, i) => i !== index));

  const getCurrentRewards = () => {
    if (customMode) {
      return {
        peta: customPeta > 0 ? customPeta : undefined,
        peta_gold: customPetaGold > 0 ? customPetaGold : undefined,
        items: customItems.filter((item) => item.item_id > 0 && item.quantity > 0),
        spirits: customSpirits.filter((s) => s.spirit_id > 0 && s.quantity > 0),
        pets: customPets.filter((p) => p.pet_id > 0 && p.quantity > 0),
      };
    }
    const template = mailTemplates.find((t) => t.id === selectedMailType);
    return template ? template.attached_rewards : {};
  };

  const handleSendMail = async () => {
    const subject = customMode ? customSubject : mailTemplates.find((t) => t.id === selectedMailType)?.subject;
    const messageText = customMode ? customMessage : mailTemplates.find((t) => t.id === selectedMailType)?.message;
    const attached_rewards = getCurrentRewards();

    if (!subject || !messageText) {
      setMessage('Thiếu tiêu đề hoặc nội dung mail.');
      return;
    }

    if (broadcastAll) {
      setLoading(true);
      setMessage('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/mails/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ subject, message: messageText, attached_rewards, expire_days: 30 }),
        });
        if (response.ok) {
          const result = await response.json();
          setMessage(`✅ Broadcast thành công: ${result.sent_count ?? ''} user — ${subject}`);
        } else {
          const err = await response.json().catch(() => ({}));
          setMessage(`❌ ${err.error || 'Không thể broadcast mail'}`);
        }
      } catch (e) {
        setMessage('❌ Lỗi kết nối khi gửi mail');
      } finally {
        setLoading(false);
      }
      return;
    }

    const ids = [...new Set(recipientUserIds.map((x) => parseInt(String(x).trim(), 10)).filter((n) => Number.isFinite(n) && n > 0))];
    if (!ids.length) {
      setMessage('Nhập ít nhất một User ID hợp lệ, hoặc bật gửi cho tất cả tài khoản.');
      return;
    }

    setLoading(true);
    setMessage('');
    let ok = 0;
    let fail = 0;
    try {
      for (const user_id of ids) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/admin/mails/system-send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({ user_id, subject, message: messageText, attached_rewards, expire_days: 30 }),
          });
          if (response.ok) ok += 1;
          else fail += 1;
        } catch {
          fail += 1;
        }
      }
      setMessage(`✅ Gửi xong: ${ok} thành công, ${fail} lỗi (tổng ${ids.length} user).`);
    } catch (e) {
      setMessage('❌ Lỗi kết nối khi gửi mail');
    } finally {
      setLoading(false);
    }
  };

  const sendDisabled =
    loading ||
    (!broadcastAll && recipientUserIds.every((s) => !String(s).trim()));

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  const currentRewards = getCurrentRewards();
  const hasRewardSummary =
    !!currentRewards.peta ||
    !!currentRewards.peta_gold ||
    (currentRewards.items && currentRewards.items.length > 0) ||
    (currentRewards.spirits && currentRewards.spirits.length > 0) ||
    (currentRewards.pets && currentRewards.pets.length > 0);

  return (
    <div className="admin-mail-test">
      <div className="admin-mail-test-header">
        <h1>Hệ thống Mail</h1>
        <button type="button" className="back-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      <div className="admin-mail-test-content">
        <p className="mail-hint">
          Pet thưởng: chỉ chọn pet <strong>chưa có chủ</strong> (tạo tại{' '}
          <button type="button" className="linkish" onClick={() => navigate('/admin/create-pet')}>
            Tạo Pet (Admin)
          </button>
          ). Người chơi nhận mail sẽ được clone pet từ bản mẫu đó.
        </p>

        <div className="form-group">
          <label className="checkbox-line">
            <input type="checkbox" checked={broadcastAll} onChange={(e) => setBroadcastAll(e.target.checked)} />
            Gửi cho tất cả tài khoản (broadcast)
          </label>
        </div>

        {!broadcastAll && (
          <div className="form-group">
            <label>Người nhận (User ID) — có thể thêm nhiều user</label>
            {recipientUserIds.map((uid, idx) => (
              <div key={idx} className="recipient-row">
                <input
                  type="number"
                  value={uid}
                  onChange={(e) => updateRecipientRow(idx, e.target.value)}
                  placeholder="User ID"
                  min="1"
                />
                {recipientUserIds.length > 1 && (
                  <button type="button" className="remove-item-btn recipient-remove" onClick={() => removeRecipientRow(idx)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-item-btn mail-add-user" onClick={addRecipientRow}>
              + Thêm user
            </button>
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-line">
            <input type="checkbox" checked={customMode} onChange={(e) => toggleCustomMode(e.target.checked)} />
            Chế độ tùy chỉnh
          </label>
        </div>

        {!customMode && (
          <div className="form-group">
            <label>Loại mail mẫu:</label>
            <select value={selectedMailType} onChange={(e) => setSelectedMailType(e.target.value)}>
              {mailTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.subject}
                </option>
              ))}
            </select>
          </div>
        )}

        {customMode && (
          <>
            <div className="preset-toolbar">
              <div className="preset-row">
                <label>Mẫu đã lưu</label>
                <select value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
                  <option value="">— Chọn mẫu —</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="preset-btn" onClick={handleLoadSelectedPreset}>
                  Tải mẫu
                </button>
                <button type="button" className="preset-btn danger" onClick={handleDeletePreset} disabled={!selectedPresetId}>
                  Xóa mẫu
                </button>
              </div>
              <div className="preset-row">
                <input
                  type="text"
                  placeholder="Tên mẫu mới (để lưu)"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                />
                <button type="button" className="preset-btn primary" onClick={handleSavePreset}>
                  Lưu mẫu
                </button>
              </div>
              <p className="preset-note">Mẫu lưu trong trình duyệt (localStorage), dùng lại cho lần sau.</p>
            </div>

            <div className="form-group">
              <label>Tiêu đề</label>
              <input type="text" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Tiêu đề mail" />
            </div>

            <div className="form-group">
              <label>Nội dung</label>
              <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Nội dung mail" rows="4" />
            </div>

            <div className="rewards-section">
              <h3>Phần thưởng</h3>
              <div className="currency-rewards">
                <div className="form-group">
                  <label>Peta</label>
                  <input type="number" value={customPeta} onChange={(e) => setCustomPeta(parseInt(e.target.value, 10) || 0)} min="0" />
                </div>
                <div className="form-group">
                  <label>Peta Gold</label>
                  <input type="number" value={customPetaGold} onChange={(e) => setCustomPetaGold(parseInt(e.target.value, 10) || 0)} min="0" />
                </div>
              </div>

              <h4 className="reward-picked-title">Đã chọn</h4>
              <div className="reward-picked-strip">
                {customItems.length === 0 && customSpirits.length === 0 && customPets.length === 0 && (
                  <span className="mail-catalog-empty">Chưa chọn vật phẩm / linh thú / pet. Bấm ô bên dưới để thêm.</span>
                )}
                {customItems.map((it, index) => {
                  const row = availableItems.find((i) => i.id === it.item_id);
                  return (
                    <div key={`i-${it.item_id}-${index}`} className="reward-chip">
                      <img src={itemImageSrc(row?.image_url)} alt="" />
                      <span className="reward-chip-name">{row?.name || `Item #${it.item_id}`}</span>
                      <input
                        type="number"
                        min="1"
                        className="reward-chip-qty"
                        value={it.quantity}
                        onChange={(e) => updateItemQty(index, e.target.value)}
                      />
                      <button type="button" className="remove-item-btn" onClick={() => removeItemAt(index)}>
                        ×
                      </button>
                    </div>
                  );
                })}
                {customSpirits.map((sp, index) => {
                  const row = availableSpirits.find((s) => s.id === sp.spirit_id);
                  return (
                    <div key={`s-${sp.spirit_id}-${index}`} className="reward-chip">
                      <img src={spiritImageSrc(row?.image_url || row?.image)} alt="" />
                      <span className="reward-chip-name">{row?.name || `Spirit #${sp.spirit_id}`}</span>
                      <input
                        type="number"
                        min="1"
                        className="reward-chip-qty"
                        value={sp.quantity}
                        onChange={(e) => updateSpiritQty(index, e.target.value)}
                      />
                      <button type="button" className="remove-item-btn" onClick={() => removeSpiritAt(index)}>
                        ×
                      </button>
                    </div>
                  );
                })}
                {customPets.map((pe, index) => {
                  const row = availablePets.find((p) => p.id === pe.pet_id);
                  return (
                    <div key={`p-${pe.pet_id}-${index}`} className="reward-chip">
                      <img src={petSpeciesImageSrc(row?.species_image)} alt="" />
                      <span className="reward-chip-name">{row?.name || `Pet #${pe.pet_id}`}</span>
                      <input
                        type="number"
                        min="1"
                        className="reward-chip-qty"
                        value={pe.quantity}
                        onChange={(e) => updatePetQty(index, e.target.value)}
                      />
                      <button type="button" className="remove-item-btn" onClick={() => removePetAt(index)}>
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              <CatalogGrid
                title="Vật phẩm — bấm để thêm"
                search={searchItem}
                onSearchChange={setSearchItem}
                rows={availableItems}
                onPick={pickItem}
                imgFn={(r) => itemImageSrc(r.image_url)}
                idKey="id"
                nameKey="name"
                searchKeys={['id', 'name', 'type', 'category', 'item_code']}
              />
              <CatalogGrid
                title="Linh thú — bấm để thêm"
                search={searchSpirit}
                onSearchChange={setSearchSpirit}
                rows={availableSpirits}
                onPick={pickSpirit}
                imgFn={(r) => spiritImageSrc(r.image_url || r.image)}
                idKey="id"
                nameKey="name"
                searchKeys={['id', 'name', 'rarity']}
              />
              <CatalogGrid
                title="Pet sự kiện (chưa chủ) — bấm để thêm"
                search={searchPet}
                onSearchChange={setSearchPet}
                rows={availablePets}
                onPick={pickPet}
                imgFn={(r) => petSpeciesImageSrc(r.species_image)}
                idKey="id"
                nameKey="name"
                searchKeys={['id', 'name', 'species_name', 'uuid']}
              />
            </div>
          </>
        )}

        <div className="mail-preview">
          <h3>Xem trước</h3>
          <div className="preview-content">
            <p>
              <strong>Tiêu đề:</strong> {customMode ? customSubject : mailTemplates.find((t) => t.id === selectedMailType)?.subject}
            </p>
            <p>
              <strong>Nội dung:</strong> {customMode ? customMessage : mailTemplates.find((t) => t.id === selectedMailType)?.message}
            </p>
            <p>
              <strong>Phần thưởng:</strong>
            </p>
            <ul>
              {currentRewards.peta ? <li>Peta: +{currentRewards.peta}</li> : null}
              {currentRewards.peta_gold ? <li>Peta Gold: +{currentRewards.peta_gold}</li> : null}
              {currentRewards.items?.map((item, index) => {
                const row = availableItems.find((i) => i.id === item.item_id);
                return (
                  <li key={`pi-${index}`}>
                    {row ? row.name : `Item ${item.item_id}`} ×{item.quantity}
                  </li>
                );
              })}
              {currentRewards.spirits?.map((spirit, index) => {
                const row = availableSpirits.find((s) => s.id === spirit.spirit_id);
                return (
                  <li key={`ps-${index}`}>
                    {row ? row.name : `Spirit ${spirit.spirit_id}`} ×{spirit.quantity}
                  </li>
                );
              })}
              {currentRewards.pets?.map((pet, index) => {
                const row = availablePets.find((p) => p.id === pet.pet_id);
                return (
                  <li key={`pp-${index}`}>
                    {row ? row.name : `Pet ${pet.pet_id}`} ×{pet.quantity}
                  </li>
                );
              })}
              {!hasRewardSummary && <li>Không có phần thưởng</li>}
            </ul>
          </div>
        </div>

        <div className="action-buttons">
          <button type="button" className="send-single-btn" onClick={handleSendMail} disabled={sendDisabled}>
            {loading ? 'Đang gửi…' : broadcastAll ? 'Gửi mail (broadcast)' : 'Gửi mail'}
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>{message}</div>
        )}
      </div>
    </div>
  );
};

export default AdminMailTest;
