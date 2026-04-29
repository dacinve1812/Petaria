import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminNpcBossManagement.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });
const getItemImageSrc = (imageUrl) => {
  if (!imageUrl) return '/images/equipments/placeholder.png';
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/images/equipments/${imageUrl}`;
};

function formatItemNameWithCode(item) {
  if (!item) return '';
  const code = item.item_code != null && item.item_code !== '' ? item.item_code : '—';
  return `${item.name} (${code})`;
}

/** Alias cũ trong DB → hiển thị `mood` (một giá trị duy nhất trong admin). */
function canonicalEffectTargetDisplay(raw) {
  const k = String(raw ?? '').trim().toLowerCase();
  if (['happiness', 'tam_trang', 'wellbeing'].includes(k)) return 'mood';
  const s = String(raw ?? '').trim();
  return s || '—';
}

function effectTargetForSelect(raw) {
  const k = String(raw ?? '').trim().toLowerCase();
  if (['happiness', 'tam_trang', 'wellbeing'].includes(k)) return 'mood';
  return raw != null && String(raw).trim() !== '' ? String(raw).trim() : 'hp';
}

/** Item được phép có item_effects (khớp script sync / gameplay). */
function itemAllowsItemEffects(item) {
  if (!item) return false;
  const t = String(item.type || '').toLowerCase();
  const c = String(item.category || '').toLowerCase();
  if (t === 'equipment' && c === 'equipment') return false;
  return (
    ['consumable', 'booster', 'evolve', 'food', 'toy', 'medicine', 'quest', 'repair_kit'].includes(t)
    || (t === 'equipment' && c === 'stat_boost')
  );
}

/** Dòng effect không còn hợp lệ trên UI (DB chưa sync hoặc orphan). */
function isNoiseEffectRow(row, itemsById) {
  const item = itemsById.get(Number(row.item_id));
  if (!item) return true;
  if (item.type === 'equipment' && item.category === 'equipment') return true;
  return !itemAllowsItemEffects(item);
}

function EditItemEffects() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useUser();
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [uploadResult, setUploadResult] = useState(null);
  const [modal, setModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.token && user?.isAdmin) loadAll();
  }, [user?.token, user?.isAdmin]);

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedItemId = urlParams.get('item_id');
  const filterItemId = useMemo(() => {
    const n = Number(selectedItemId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedItemId]);

  /** Từ URL: q = ô tìm; nếu chỉ có item_id thì sau khi có danh sách items sẽ điền tên. */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qRaw = params.get('q');
    const itemIdParam = params.get('item_id');
    if (qRaw != null && String(qRaw).trim() !== '') {
      setSearchTerm(qRaw);
      return;
    }
    if (itemIdParam && items.length > 0) {
      const it = items.find((x) => String(x.id) === String(itemIdParam));
      if (it) setSearchTerm(String(it.name || '').trim());
    }
  }, [location.search, items]);

  const showMsg = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setUploadResult(null);
  };

  const loadAll = async () => {
    try {
      const [i, e] = await Promise.all([
        fetch(`${API_BASE}/api/admin/items`, { headers: authHeaders(user.token), cache: 'no-store' }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/item-effects`, { headers: authHeaders(user.token), cache: 'no-store' }).then((r) => r.json()),
      ]);
      setItems(Array.isArray(i) ? i : []);
      setRows(Array.isArray(e) ? e : []);
    } catch (err) {
      showMsg('Lỗi tải dữ liệu: ' + err.message, 'error');
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa item effect này?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/item-effects/${id}`, { method: 'DELETE', headers: authHeaders(user.token) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi xóa');
      showMsg('Đã xóa item effect.');
      loadAll();
    } catch (err) {
      showMsg(err.message || 'Lỗi xóa', 'error');
    }
  };

  const saveRow = async (payload) => {
    const { mode, row } = modal;
    try {
      const url = mode === 'edit' ? `${API_BASE}/api/admin/item-effects/${row.id}` : `${API_BASE}/api/admin/item-effects`;
      const r = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi lưu');
      setModal(null);
      showMsg(mode === 'edit' ? 'Đã cập nhật item effect.' : 'Đã thêm item effect.');
      loadAll();
    } catch (err) {
      showMsg(err.message || 'Lỗi lưu', 'error');
    }
  };

  const downloadCSV = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/item-effects/csv`, { headers: authHeaders(user.token) });
      if (!r.ok) throw new Error('Lỗi tải CSV');
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = 'item_effects.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
    } catch (err) {
      showMsg(err.message || 'Lỗi tải CSV', 'error');
    }
  };

  const uploadCSV = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API_BASE}/api/admin/item-effects/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi upload CSV');
      setUploadResult(data);
      showMsg(`CSV: ${data.inserted || 0} thêm, ${data.updated || 0} cập nhật.`);
      loadAll();
    } catch (err) {
      showMsg(err.message || 'Lỗi upload CSV', 'error');
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => (prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
  };
  const sortIndicator = (key) => (sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : '');
  const itemsById = useMemo(() => {
    const m = new Map();
    (items || []).forEach((it) => m.set(Number(it.id), it));
    return m;
  }, [items]);

  const itemsForEffectDropdown = useMemo(() => (items || []).filter(itemAllowsItemEffects), [items]);

  const displayRows = useMemo(() => {
    let base = rows.filter((r) => !isNoiseEffectRow(r, itemsById));
    const applyItemIdFromUrl = filterItemId != null && searchTerm.trim() !== '';
    if (applyItemIdFromUrl) {
      base = base.filter((r) => Number(r.item_id) === filterItemId);
    }
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? base.filter((r) => {
          const item = itemsById.get(Number(r.item_id));
          const hay = [
            r.id, r.item_id, item?.name, item?.item_code, r.effect_target, r.effect_type, r.value_min, r.value_max, r.is_permanent, r.duration_turns, r.magic_value,
          ].map((v) => String(v ?? '').toLowerCase()).join(' ');
          return hay.includes(q);
        })
      : [...base];

    const sorted = [...filtered].sort((a, b) => {
      const itemA = itemsById.get(Number(a.item_id));
      const itemB = itemsById.get(Number(b.item_id));
      const av = sortConfig.key === 'item_name' ? formatItemNameWithCode(itemA) : a[sortConfig.key];
      const bv = sortConfig.key === 'item_name' ? formatItemNameWithCode(itemB) : b[sortConfig.key];
      const aNum = Number(av);
      const bNum = Number(bv);
      let cmp = 0;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && av !== '' && bv !== '') cmp = aNum - bNum;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'vi', { sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, itemsById, searchTerm, sortConfig, filterItemId]);

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return <div className="admin-npc-boss"><div className="access-denied"><h2>Access Denied</h2></div></div>;

  return (
    <div className="admin-npc-boss">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý Item Effects</h1>
          <p>Chỉnh bảng `item_effects`: CRUD, download/upload CSV. Danh sách bỏ qua dòng orphan / vũ khí-khiên không hợp lệ; dọn DB: <code>node scripts/sync_item_effects_equipment_magic_v2.js</code>.</p>
        </div>
        <div className="cell-actions">
          <button className="back-admin-btn" onClick={() => navigate('/admin/edit-items')}>← Quay lại Quản lý Items</button>
          <button className="back-admin-btn" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
        </div>
      </div>
      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && <div className="message success">Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.</div>}

      <div className="section-card">
        <h3>Bảng item_effects</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'add', row: { item_id: selectedItemId || '' } })}>Thêm</button>
          <button className="btn btn-secondary" onClick={downloadCSV}>Tải CSV</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCSV(f); e.target.value = ''; }} />
          </label>
          <input
            type="text"
            placeholder="Search item effects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ced4da', minWidth: 240 }}
          />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>id{sortIndicator('id')}</th>
                <th>img</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('item_name')}>item{sortIndicator('item_name')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('effect_target')}>effect_target{sortIndicator('effect_target')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('effect_type')}>effect_type{sortIndicator('effect_type')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('value_min')}>value_min{sortIndicator('value_min')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('value_max')}>value_max{sortIndicator('value_max')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('is_permanent')}>is_permanent{sortIndicator('is_permanent')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('duration_turns')}>duration_turns{sortIndicator('duration_turns')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('magic_value')}>magic_value{sortIndicator('magic_value')}</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => {
                const item = items.find((i) => Number(i.id) === Number(r.item_id));
                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>
                      <img
                        src={getItemImageSrc(item?.image_url)}
                        alt={item?.name || 'item'}
                        className="boss-thumb"
                        onError={(e) => { e.target.src = '/images/equipments/placeholder.png'; e.target.onerror = null; }}
                      />
                    </td>
                    <td title={item ? `item_id=${item.id}` : `item_id=${r.item_id}`}>
                      {item ? formatItemNameWithCode(item) : `⚠ orphan item_id=${r.item_id}`}
                    </td>
                    <td>{canonicalEffectTargetDisplay(r.effect_target)}</td>
                    <td>{r.effect_type}</td>
                    <td>{r.value_min}</td>
                    <td>{r.value_max}</td>
                    <td>{r.is_permanent ? '1' : '0'}</td>
                    <td>{r.duration_turns ?? 0}</td>
                    <td>{r.magic_value ?? ''}</td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn-edit" onClick={() => setModal({ mode: 'edit', row: r })}>Sửa</button>
                        <button className="btn-delete" onClick={() => deleteRow(r.id)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: '#6c757d' }}>Không có dữ liệu phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ItemEffectModal
          key={`ie-${modal.row.id ?? 'new'}-${modal.row.item_id}`}
          items={itemsForEffectDropdown}
          modal={modal}
          onClose={() => setModal(null)}
          onSave={saveRow}
          allItemsById={itemsById}
        />
      )}
    </div>
  );
}

function ItemEffectModal({ items, modal, onClose, onSave, allItemsById }) {
  const { mode, row } = modal;
  const selectedItem =
    items.find((item) => Number(item.id) === Number(row.item_id))
    || (allItemsById && allItemsById.get(Number(row.item_id)));
  const [form, setForm] = useState({
    item_id: row.item_id ?? '',
    effect_target: effectTargetForSelect(row.effect_target),
    effect_type: row.effect_type ?? 'flat',
    value_min: row.value_min ?? 0,
    value_max: row.value_max ?? 0,
    is_permanent: !!row.is_permanent,
    duration_turns: row.duration_turns ?? 0,
    magic_value: row.magic_value ?? '',
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h4>{mode === 'edit' ? 'Sửa' : 'Thêm'} item effect</h4>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, item_id: Number(form.item_id), value_min: Number(form.value_min) || 0, value_max: Number(form.value_max) || 0, duration_turns: Number(form.duration_turns) || 0, magic_value: form.magic_value === '' ? null : Number(form.magic_value) }); }}>
          {mode === 'edit' ? (
            <div className="form-row">
              <label>Item</label>
              <input
                value={selectedItem ? formatItemNameWithCode(selectedItem) : `item_id=${row.item_id} (không tìm thấy trong items)`}
                readOnly
                title={`item_id=${row.item_id}`}
              />
            </div>
          ) : (
            <div className="form-row"><label>Item *</label>
              <select value={form.item_id} onChange={(e) => update('item_id', e.target.value)} required>
                <option value="">-- chọn item (consumable / booster / evolve / …) --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id} title={`item_id=${item.id}`}>
                    {formatItemNameWithCode(item)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-row"><label>effect_target</label>
            <select value={form.effect_target} onChange={(e) => update('effect_target', e.target.value)}>
              <option value="hp">hp</option>
              <option value="mp">mp</option>
              <option value="str">str</option>
              <option value="def">def</option>
              <option value="spd">spd</option>
              <option value="intelligence">intelligence</option>
              <option value="exp">exp</option>
              <option value="hunger">hunger</option>
              <option value="mood">mood (tâm trạng, đồ chơi)</option>
              <option value="status">status</option>
            </select>
          </div>
          <div className="form-row"><label>effect_type</label>
            <select value={form.effect_type} onChange={(e) => update('effect_type', e.target.value)}>
              <option value="flat">flat</option><option value="percent">percent</option><option value="status_cure">status_cure</option>
            </select>
          </div>
          <div className="form-row"><label>value_min</label><input type="number" value={form.value_min} onChange={(e) => update('value_min', e.target.value)} /></div>
          <div className="form-row"><label>value_max</label><input type="number" value={form.value_max} onChange={(e) => update('value_max', e.target.value)} /></div>
          <div className="form-row">
            <label style={{ display: 'flex', marginBottom: 0 }}>
              <label>is_permanent:</label>
              <input type="checkbox" checked={form.is_permanent} onChange={(e) => update('is_permanent', e.target.checked)} />
              
            </label>
          </div>
          <div className="form-row"><label>duration_turns</label><input type="number" value={form.duration_turns} onChange={(e) => update('duration_turns', e.target.value)} /></div>
          <div className="form-row"><label>magic_value</label><input type="number" value={form.magic_value} onChange={(e) => update('magic_value', e.target.value)} /></div>
          <div className="form-actions">
            <button type="submit" className="btn-save">Lưu</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditItemEffects;
