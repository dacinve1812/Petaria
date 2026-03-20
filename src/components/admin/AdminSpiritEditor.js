import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminNpcBossManagement.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const rarityText = (r) => {
  switch (r) {
    case 'rare': return 'Hiếm';
    case 'epic': return 'Epic';
    case 'legendary': return 'Huyền thoại';
    default: return 'Thường';
  }
};

const imgSrc = (v) => {
  if (!v) return '/images/spirit/angelpuss.gif';
  if (v.startsWith('http') || v.startsWith('/')) return v;
  return `/images/spirit/${v}`;
};

function AdminSpiritEditor() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
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
    if (user?.token && user?.isAdmin) loadSpirits();
  }, [user?.token, user?.isAdmin]);

  const showMsg = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setUploadResult(null);
  };

  const loadSpirits = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/spirits`, { headers: authHeaders(user.token) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.message || 'Lỗi tải spirits');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      showMsg(err.message || 'Lỗi tải spirits', 'error');
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa Linh Thú này?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/spirits/${id}`, { method: 'DELETE', headers: authHeaders(user.token) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || data.message || 'Lỗi xóa');
      showMsg('Đã xóa Linh Thú.');
      loadSpirits();
    } catch (err) {
      showMsg(err.message || 'Lỗi xóa', 'error');
    }
  };

  const saveRow = async (payload) => {
    const { mode, row } = modal;
    try {
      const url = mode === 'edit' ? `${API_BASE}/api/admin/spirits/${row.id}` : `${API_BASE}/api/admin/spirits`;
      const r = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || data.message || 'Lỗi lưu');
      setModal(null);
      showMsg(mode === 'edit' ? 'Đã cập nhật Linh Thú.' : 'Đã thêm Linh Thú.');
      loadSpirits();
    } catch (err) {
      showMsg(err.message || 'Lỗi lưu', 'error');
    }
  };

  const downloadCSV = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/spirits/csv`, { headers: authHeaders(user.token) });
      if (!r.ok) throw new Error('Lỗi tải CSV');
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = 'spirits.csv';
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
      const r = await fetch(`${API_BASE}/api/admin/spirits/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi upload CSV');
      setUploadResult(data);
      showMsg(`CSV: ${data.inserted || 0} thêm, ${data.updated || 0} cập nhật.`);
      loadSpirits();
    } catch (err) {
      showMsg(err.message || 'Lỗi upload CSV', 'error');
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => (prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
  };
  const sortIndicator = (key) => (sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : '');

  const displayRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => {
          const statsText = Array.isArray(r.stats) ? r.stats.map((s) => `${s.stat_type}:${s.stat_value}${s.stat_modifier === 'percentage' ? '%' : ''}`).join(', ') : '';
          const hay = [r.id, r.name, r.description, r.image_url, r.rarity, r.max_stats_count, statsText].map((v) => String(v ?? '').toLowerCase()).join(' ');
          return hay.includes(q);
        })
      : [...rows];

    return [...filtered].sort((a, b) => {
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      const aNum = Number(av);
      const bNum = Number(bv);
      let cmp = 0;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && av !== '' && bv !== '') cmp = aNum - bNum;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'vi', { sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [rows, searchTerm, sortConfig]);

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return <div className="admin-npc-boss"><div className="access-denied"><h2>Access Denied</h2></div></div>;

  return (
    <div className="admin-npc-boss">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý Linh Thú</h1>
          <p>Quản lý bảng `spirits` + `spirit_stats` với CRUD, search/sort và upload/download CSV.</p>
        </div>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && <div className="message success">Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.</div>}

      <div className="section-card">
        <h3>Bảng spirits</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'add', row: {} })}>Thêm</button>
          <button className="btn btn-secondary" onClick={downloadCSV}>Tải CSV</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCSV(f); e.target.value = ''; }} />
          </label>
          <input
            type="text"
            placeholder="Search spirits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ced4da', minWidth: 220 }}
          />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>id{sortIndicator('id')}</th>
                <th>img</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>name{sortIndicator('name')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('rarity')}>rarity{sortIndicator('rarity')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('max_stats_count')}>max_stats_count{sortIndicator('max_stats_count')}</th>
                <th>description</th>
                <th>stats</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <img src={imgSrc(r.image_url)} alt={r.name} className="boss-thumb" onError={(e) => { e.target.src = '/images/spirit/angelpuss.gif'; e.target.onerror = null; }} />
                  </td>
                  <td>{r.name}</td>
                  <td>{rarityText(r.rarity)}</td>
                  <td>{r.max_stats_count}</td>
                  <td title={r.description}>{String(r.description || '').slice(0, 50)}{String(r.description || '').length > 50 ? '…' : ''}</td>
                  <td title={JSON.stringify(r.stats || [])}>
                    {Array.isArray(r.stats) && r.stats.length > 0
                      ? r.stats.map((s) => `${s.stat_type}:${s.stat_value}${s.stat_modifier === 'percentage' ? '%' : ''}`).join(', ')
                      : '-'}
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn-edit" onClick={() => setModal({ mode: 'edit', row: r })}>Sửa</button>
                      <button className="btn-delete" onClick={() => deleteRow(r.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#6c757d' }}>Không có dữ liệu phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <SpiritModal modal={modal} onClose={() => setModal(null)} onSave={saveRow} />}
    </div>
  );
}

function SpiritModal({ modal, onClose, onSave }) {
  const { mode, row } = modal;
  const [form, setForm] = useState({
    name: row.name ?? '',
    description: row.description ?? '',
    image_url: row.image_url ?? '',
    rarity: row.rarity ?? 'common',
    max_stats_count: row.max_stats_count ?? 2,
    stats: Array.isArray(row.stats) ? row.stats : [],
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const addStat = () => setForm((p) => ({ ...p, stats: [...p.stats, { stat_type: 'hp', stat_value: 0, stat_modifier: 'flat' }] }));
  const removeStat = (idx) => setForm((p) => ({ ...p, stats: p.stats.filter((_, i) => i !== idx) }));
  const updateStat = (idx, key, val) => setForm((p) => ({ ...p, stats: p.stats.map((s, i) => (i === idx ? { ...s, [key]: val } : s)) }));

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h4>{mode === 'edit' ? 'Sửa' : 'Thêm'} Linh Thú</h4>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            max_stats_count: Number(form.max_stats_count) || 2,
            stats: (form.stats || []).map((s) => ({
              stat_type: s.stat_type || 'hp',
              stat_value: Number(s.stat_value) || 0,
              stat_modifier: s.stat_modifier === 'percentage' ? 'percentage' : 'flat',
            })),
          });
        }}>
          <div className="form-row"><label>name *</label><input value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
          <div className="form-row"><label>description *</label><textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} required /></div>
          <div className="form-row"><label>image_url *</label><input value={form.image_url} onChange={(e) => update('image_url', e.target.value)} required /></div>
          <div className="form-row"><label>rarity</label>
            <select value={form.rarity} onChange={(e) => update('rarity', e.target.value)}>
              <option value="common">common</option><option value="rare">rare</option><option value="epic">epic</option><option value="legendary">legendary</option>
            </select>
          </div>
          <div className="form-row"><label>max_stats_count</label><input type="number" min="1" max="4" value={form.max_stats_count} onChange={(e) => update('max_stats_count', e.target.value)} /></div>

          <div className="form-row">
            <label>stats</label>
            <button type="button" className="btn btn-primary" onClick={addStat}>+ Thêm stat</button>
          </div>
          {(form.stats || []).map((s, idx) => (
            <div key={idx} className="form-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={s.stat_type} onChange={(e) => updateStat(idx, 'stat_type', e.target.value)}>
                <option value="hp">hp</option><option value="mp">mp</option><option value="str">str</option><option value="def">def</option><option value="spd">spd</option><option value="intelligence">intelligence</option>
              </select>
              <input type="number" value={s.stat_value} onChange={(e) => updateStat(idx, 'stat_value', e.target.value)} />
              <select value={s.stat_modifier} onChange={(e) => updateStat(idx, 'stat_modifier', e.target.value)}>
                <option value="flat">flat</option><option value="percentage">percentage</option>
              </select>
              <button type="button" className="btn-delete" onClick={() => removeStat(idx)}>Xóa</button>
            </div>
          ))}

          <div className="form-actions">
            <button type="submit" className="btn-save">Lưu</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminSpiritEditor;
