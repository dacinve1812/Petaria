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

/** Hiển thị admin: tên + mã nghiệp vụ (không dùng id trong label). */
function formatItemNameWithCode(item) {
  if (!item) return '';
  const code = item.item_code != null && item.item_code !== '' ? item.item_code : '—';
  return `${item.name} (${code})`;
}

function EditEquipmentStats() {
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
  const [equipmentFilter, setEquipmentFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.token && user?.isAdmin) loadAll();
  }, [user?.token, user?.isAdmin]);

  const selectedItemId = useMemo(() => new URLSearchParams(location.search).get('item_id'), [location.search]);

  const showMsg = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setUploadResult(null);
  };

  const loadAll = async () => {
    try {
      const [i, e] = await Promise.all([
        fetch(`${API_BASE}/api/admin/items`, { headers: authHeaders(user.token) }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/equipment-stats`, { headers: authHeaders(user.token) }).then((r) => r.json()),
      ]);
      setItems((Array.isArray(i) ? i : []).filter((x) => x.type === 'equipment'));
      setRows(Array.isArray(e) ? e : []);
    } catch (err) {
      showMsg('Lỗi tải dữ liệu: ' + err.message, 'error');
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa dòng cấu hình này?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/equipment-stats/${id}`, { method: 'DELETE', headers: authHeaders(user.token) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi xóa');
      showMsg('Đã xóa equipment stat.');
      loadAll();
    } catch (err) {
      showMsg(err.message || 'Lỗi xóa', 'error');
    }
  };

  const saveRow = async (payload) => {
    const { mode, row } = modal;
    try {
      const url = mode === 'edit' ? `${API_BASE}/api/admin/equipment-stats/${row.id}` : `${API_BASE}/api/admin/equipment-stats`;
      const r = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi lưu');
      setModal(null);
      showMsg(mode === 'edit' ? 'Đã cập nhật equipment stat.' : 'Đã thêm equipment stat.');
      loadAll();
    } catch (err) {
      showMsg(err.message || 'Lỗi lưu', 'error');
    }
  };

  const downloadCSV = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/equipment-stats/csv`, { headers: authHeaders(user.token) });
      if (!r.ok) throw new Error('Lỗi tải CSV');
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = 'equipment_data.csv';
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
      const r = await fetch(`${API_BASE}/api/admin/equipment-stats/csv`, {
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
  const formatDurabilityMode = (mode) => {
    const key = String(mode || '').toLowerCase();
    if (key === 'unbreakable') return 'Vĩnh viễn';
    if (key === 'unknown' || key === 'random') return 'Ngẫu Nhiên';
    return 'Có độ bền';
  };
  const displayRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const byEquipmentFilter = rows.filter((r) => {
      if (equipmentFilter === 'booster') return r.equipment_type === 'booster';
      if (equipmentFilter === 'non-booster') return r.equipment_type !== 'booster';
      return true;
    });
    const filtered = q
      ? byEquipmentFilter.filter((r) => {
          const item = items.find((i) => Number(i.id) === Number(r.item_id));
          const hay = [
            r.id, r.item_id, item?.name, item?.item_code, r.equipment_type, r.power_min, r.power_max,
            r.slot_type, r.durability_mode, r.durability_max, r.magic_value, r.crit_rate, r.block_rate, r.element, r.effect_id,
          ].map((v) => String(v ?? '').toLowerCase()).join(' ');
          return hay.includes(q);
        })
      : [...byEquipmentFilter];

    const sorted = [...filtered].sort((a, b) => {
      const itemA = items.find((i) => Number(i.id) === Number(a.item_id));
      const itemB = items.find((i) => Number(i.id) === Number(b.item_id));
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
  }, [rows, items, searchTerm, sortConfig, equipmentFilter]);

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return <div className="admin-npc-boss"><div className="access-denied"><h2>Access Denied</h2></div></div>;

  return (
    <div className="admin-npc-boss">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý Equipment Stats</h1>
          <p>Chỉnh bảng `equipment_data` theo kiểu mới: thêm/sửa/xóa và upload/download CSV.</p>
        </div>
        <div className="cell-actions">
          <button className="back-admin-btn" onClick={() => navigate('/admin/edit-items')}>← Quay lại Quản lý Items</button>
          <button className="back-admin-btn" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
        </div>
      </div>
      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && <div className="message success">Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.</div>}

      <div className="section-card">
        <h3>Bảng equipment_data</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'add', row: { item_id: selectedItemId || '' } })}>Thêm</button>
          <button className="btn btn-secondary" onClick={downloadCSV}>Tải CSV</button>
          <button className={`btn ${equipmentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEquipmentFilter('all')}>All</button>
          <button className={`btn ${equipmentFilter === 'non-booster' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEquipmentFilter('non-booster')}>non-booster</button>
          <button className={`btn ${equipmentFilter === 'booster' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEquipmentFilter('booster')}>booster</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCSV(f); e.target.value = ''; }} />
          </label>
          <input
            type="text"
            placeholder="Search equipment stats..."
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
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('equipment_type')}>type{sortIndicator('equipment_type')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('slot_type')}>slot_type{sortIndicator('slot_type')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('power_min')}>power_min{sortIndicator('power_min')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('power_max')}>power_max{sortIndicator('power_max')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('durability_max')}>durability_max{sortIndicator('durability_max')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('durability_mode')}>durability_mode{sortIndicator('durability_mode')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('magic_value')}>magic_value{sortIndicator('magic_value')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('crit_rate')}>crit_rate{sortIndicator('crit_rate')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('block_rate')}>block_rate{sortIndicator('block_rate')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('element')}>element{sortIndicator('element')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('effect_id')}>effect_id{sortIndicator('effect_id')}</th>
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
                      {item ? formatItemNameWithCode(item) : `Thiếu item (item_id=${r.item_id})`}
                    </td>
                    <td>{r.equipment_type}</td>
                    <td>{r.slot_type ?? ''}</td>
                    <td>{r.power_min ?? ''}</td>
                    <td>{r.power_max ?? ''}</td>
                    <td>{r.durability_max ?? ''}</td>
                    <td>{formatDurabilityMode(r.durability_mode)}</td>
                    <td>{r.magic_value ?? ''}</td>
                    <td>{r.crit_rate ?? ''}</td>
                    <td>{r.block_rate ?? ''}</td>
                    <td>{r.element ?? ''}</td>
                    <td>{r.effect_id ?? ''}</td>
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
                  <td colSpan={15} style={{ textAlign: 'center', color: '#6c757d' }}>Không có dữ liệu phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <EquipmentModal items={items} modal={modal} onClose={() => setModal(null)} onSave={saveRow} />}
    </div>
  );
}

function EquipmentModal({ items, modal, onClose, onSave }) {
  const { mode, row } = modal;
  const selectedItem = items.find((item) => Number(item.id) === Number(row.item_id));
  const [form, setForm] = useState({
    item_id: row.item_id ?? '',
    equipment_type: row.equipment_type ?? 'weapon',
    slot_type: row.slot_type ?? 'weapon',
    power_min: row.power_min ?? '',
    power_max: row.power_max ?? '',
    durability_max: row.durability_max ?? '',
    durability_mode: row.durability_mode ?? 'fixed',
    random_break_chance: row.random_break_chance ?? '',
    magic_value: row.magic_value ?? '',
    crit_rate: row.crit_rate ?? '',
    block_rate: row.block_rate ?? '',
    element: row.element ?? '',
    effect_id: row.effect_id ?? '',
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toNumOrNull = (v) => (v === '' || v == null ? null : Number(v));

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h4>{mode === 'edit' ? 'Sửa' : 'Thêm'} equipment stat</h4>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, item_id: Number(form.item_id), power_min: toNumOrNull(form.power_min), power_max: toNumOrNull(form.power_max), durability_max: form.durability_mode === 'unknown' ? null : toNumOrNull(form.durability_max), random_break_chance: form.durability_mode === 'unknown' ? toNumOrNull(form.random_break_chance) : null, magic_value: toNumOrNull(form.magic_value), crit_rate: toNumOrNull(form.crit_rate), block_rate: toNumOrNull(form.block_rate), effect_id: toNumOrNull(form.effect_id), element: form.element || null }); }}>
          {mode === 'edit' ? (
            <div className="form-row">
              <label>Item</label>
              <input value={selectedItem ? formatItemNameWithCode(selectedItem) : `item_id=${row.item_id}`} readOnly title={`item_id=${row.item_id}`} />
            </div>
          ) : (
            <div className="form-row"><label>Item *</label>
              <select value={form.item_id} onChange={(e) => update('item_id', e.target.value)} required>
                <option value="">-- chọn item equipment --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id} title={`item_id=${item.id}`}>
                    {formatItemNameWithCode(item)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-row"><label>equipment_type</label>
            <select value={form.equipment_type} onChange={(e) => {
              const nextType = e.target.value;
              update('equipment_type', nextType);
              if (nextType === 'shield') update('slot_type', 'shield');
              else if (nextType === 'booster') update('slot_type', 'stat_boost');
              else update('slot_type', 'weapon');
            }}>
              <option value="weapon">weapon</option>
              <option value="shield">shield</option>
              <option value="crit_weapon">crit_weapon</option>
              <option value="booster">booster</option>
            </select>
          </div>
          <div className="form-row"><label>slot_type</label>
            <select value={form.slot_type} onChange={(e) => update('slot_type', e.target.value)}>
              <option value="weapon">weapon</option>
              <option value="shield">shield</option>
              <option value="stat_boost">stat_boost</option>
            </select>
          </div>
          <div className="form-row"><label>power_min</label><input type="number" value={form.power_min} onChange={(e) => update('power_min', e.target.value)} /></div>
          <div className="form-row"><label>power_max</label><input type="number" value={form.power_max} onChange={(e) => update('power_max', e.target.value)} /></div>
          <div className="form-row"><label>durability_mode</label>
            <select value={form.durability_mode} onChange={(e) => update('durability_mode', e.target.value)}>
              <option value="fixed">fixed (Có độ bền)</option>
              <option value="unknown">unknown (Ngẫu Nhiên)</option>
              <option value="unbreakable">unbreakable (Vĩnh viễn)</option>
            </select>
          </div>
          <div className="form-row"><label>durability_max</label><input type="number" value={form.durability_max} onChange={(e) => update('durability_max', e.target.value)} disabled={form.durability_mode === 'unknown'} placeholder={form.durability_mode === 'unknown' ? 'Không dùng ở mode Ngẫu Nhiên' : ''} /></div>
          {form.durability_mode === 'unknown' && (
            <div className="form-row"><label>random_break_chance (%)</label><input type="number" value={form.random_break_chance} onChange={(e) => update('random_break_chance', e.target.value)} /></div>
          )}
          <div className="form-row"><label>magic_value</label><input type="number" value={form.magic_value} onChange={(e) => update('magic_value', e.target.value)} /></div>
          <div className="form-row"><label>crit_rate</label><input type="number" value={form.crit_rate} onChange={(e) => update('crit_rate', e.target.value)} /></div>
          <div className="form-row"><label>block_rate</label><input type="number" value={form.block_rate} onChange={(e) => update('block_rate', e.target.value)} /></div>
          <div className="form-row"><label>element</label><input value={form.element} onChange={(e) => update('element', e.target.value)} /></div>
          <div className="form-row"><label>effect_id</label><input type="number" value={form.effect_id} onChange={(e) => update('effect_id', e.target.value)} /></div>
          <div className="form-actions">
            <button type="submit" className="btn-save">Lưu</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditEquipmentStats;
