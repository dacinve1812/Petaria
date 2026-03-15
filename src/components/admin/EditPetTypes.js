import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminNpcBossManagement.css';
import './EditPetTypes.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const ITEMS_PER_PAGE = 30;
const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

function EditPetTypes() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [list, setList] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [modal, setModal] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [rarityFilter, setRarityFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.isAdmin && user?.token) loadAll();
  }, [user?.isAdmin, user?.token]);

  const loadAll = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/pet-species`, { headers: authHeaders(user.token) });
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage('Lỗi tải dữ liệu: ' + e.message);
      setMessageType('error');
    }
  };

  const showMsg = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setUploadResult(null);
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Xác nhận xóa pet species này?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species/${id}`, {
        method: 'DELETE',
        headers: authHeaders(user.token),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi xóa');
      showMsg('Đã xóa.');
      loadAll();
    } catch (e) {
      showMsg(e.message || 'Lỗi xóa', 'error');
    }
  };

  const downloadCSV = () => {
    const link = document.createElement('a');
    link.href = `${API_BASE}/api/admin/pet-species/csv`;
    link.setAttribute('download', 'pet_species.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    fetch(`${API_BASE}/api/admin/pet-species/csv`, { headers: authHeaders(user.token) })
      .then((r) => { if (!r.ok) throw new Error('Lỗi tải'); return r.blob(); })
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        link.href = u;
        link.download = 'pet_species.csv';
        link.click();
        URL.revokeObjectURL(u);
      })
      .catch(() => showMsg('Lỗi tải CSV', 'error'))
      .finally(() => link.remove());
  };

  const uploadCSV = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species/csv`, {
        method: 'POST',
        headers: authHeaders(user.token),
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi upload');
      setUploadResult(data);
      showMsg(`CSV: ${data.inserted || 0} thêm, ${data.updated || 0} cập nhật.`);
      loadAll();
    } catch (e) {
      showMsg(e.message || 'Lỗi upload', 'error');
    }
  };

  const saveModal = async (payload) => {
    try {
      const isEdit = modal.mode === 'edit' && payload.id != null;
      const url = isEdit
        ? `${API_BASE}/api/admin/pet-species/${payload.id}`
        : `${API_BASE}/api/admin/pet-species`;
      const method = isEdit ? 'PUT' : 'POST';
      const body = { ...payload };
      if (body.evolve_to !== undefined && body.evolve_to !== null && body.evolve_to !== '') {
        try {
          body.evolve_to = typeof body.evolve_to === 'string' ? JSON.parse(body.evolve_to) : body.evolve_to;
        } catch (_) {
          body.evolve_to = null;
        }
      } else body.evolve_to = null;
      delete body.id;
      delete body.created_at;
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi lưu');
      showMsg(isEdit ? 'Đã cập nhật.' : 'Đã thêm.');
      setModal(null);
      loadAll();
    } catch (e) {
      showMsg(e.message || 'Lỗi lưu', 'error');
    }
  };

  const filtered = list
    .filter((s) => {
      const matchSearch = !search.trim() || (s.name && s.name.toLowerCase().includes(search.toLowerCase()));
      const matchRarity = !rarityFilter || s.rarity === rarityFilter;
      return matchSearch && matchRarity;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      const sum = (x) => (Number(x.base_hp) || 0) + (Number(x.base_str) || 0) + (Number(x.base_def) || 0) + (Number(x.base_intelligence) || 0) + (Number(x.base_spd) || 0) + (Number(x.base_mp) || 0);
      return sum(b) - sum(a);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return <div className="admin-npc-boss"><div className="access-denied"><h2>Access Denied</h2></div></div>;

  return (
    <div className="admin-npc-boss admin-pet-species">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý Pet Species</h1>
          <p>Chỉnh sửa bảng pet_species. Tải / upload CSV theo cấu trúc bảng. Pagination 30, có sort và search.</p>
        </div>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && <div className="message success">Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.</div>}

      <div className="section-card">
        <h3>Bảng pet_species</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'add', row: {} })}>Thêm</button>
          <button className="btn btn-secondary" onClick={downloadCSV}>Tải CSV</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCSV(f); e.target.value = ''; }} />
          </label>
        </div>
        <div className="pet-species-controls">
          <input
            type="text"
            placeholder="Tìm theo tên..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pet-species-search"
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pet-species-sort">
            <option value="name">Sắp xếp: Tên (A-Z)</option>
            <option value="stat">Sắp xếp: Tổng Stat</option>
          </select>
          <select value={rarityFilter} onChange={(e) => { setRarityFilter(e.target.value); setCurrentPage(1); }} className="pet-species-rarity">
            <option value="">Tất cả độ hiếm</option>
            {['common', 'uncommon', 'rare', 'epic', 'legend', 'mythic'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <span className="pet-species-total">Tổng: {filtered.length}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>id</th>
                <th>Hình</th>
                <th>name</th>
                <th>image</th>
                <th>type</th>
                <th>rarity</th>
                <th>Total</th>
                <th>base_hp</th>
                <th>base_mp</th>
                <th>base_str</th>
                <th>base_def</th>
                <th>base_intelligence</th>
                <th>base_spd</th>
                <th>evolve_to</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td className="pet-species-thumb-cell">
                    {r.image ? (
                      <img
                        src={`/images/pets/${r.image}`}
                        alt=""
                        className="pet-species-thumb"
                        onError={(e) => { e.target.src = '/images/pets/default.png'; e.target.onerror = null; }}
                      />
                    ) : (
                      <span className="pet-species-thumb-empty">—</span>
                    )}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.image}</td>
                  <td>{r.type ?? '-'}</td>
                  <td>{r.rarity ?? '-'}</td>
                  <td className="pet-species-total-cell">
                    {(Number(r.base_hp) || 0) + (Number(r.base_str) || 0) + (Number(r.base_def) || 0) + (Number(r.base_spd) || 0) + (Number(r.base_intelligence) || 0)}
                  </td>
                  <td>{r.base_hp ?? '-'}</td>
                  <td>{r.base_mp ?? '-'}</td>
                  <td>{r.base_str ?? '-'}</td>
                  <td>{r.base_def ?? '-'}</td>
                  <td>{r.base_intelligence ?? '-'}</td>
                  <td>{r.base_spd ?? '-'}</td>
                  <td title={typeof r.evolve_to === 'string' ? r.evolve_to : (r.evolve_to ? JSON.stringify(r.evolve_to) : '')}>
                    {r.evolve_to ? (typeof r.evolve_to === 'string' ? r.evolve_to.slice(0, 15) : JSON.stringify(r.evolve_to).slice(0, 15)) + (String(r.evolve_to).length > 15 ? '…' : '') : '-'}
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn-edit" onClick={() => setModal({ mode: 'edit', row: r })}>Sửa</button>
                      <button className="btn-delete" onClick={() => deleteRow(r.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination-wrap">
            <button type="button" className="btn-page" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Trước</button>
            <span className="pagination-info">Trang {currentPage} / {totalPages}</span>
            <button type="button" className="btn-page" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Sau</button>
          </div>
        )}
      </div>

      {modal && <ModalPetSpecies modal={modal} onClose={() => setModal(null)} onSave={saveModal} />}
    </div>
  );
}

function ModalPetSpecies({ modal, onClose, onSave }) {
  const { mode, row } = modal;
  const [form, setForm] = useState(() => ({
    name: row.name ?? '',
    image: row.image ?? '',
    type: row.type ?? '',
    description: row.description ?? '',
    rarity: row.rarity ?? 'common',
    base_hp: row.base_hp ?? 0,
    base_mp: row.base_mp ?? 0,
    base_str: row.base_str ?? 0,
    base_def: row.base_def ?? 0,
    base_intelligence: row.base_intelligence ?? 0,
    base_spd: row.base_spd ?? 0,
    evolve_to: row.evolve_to != null ? (typeof row.evolve_to === 'string' ? row.evolve_to : JSON.stringify(row.evolve_to)) : '',
  }));

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, id: row.id };
    if (payload.evolve_to !== undefined && payload.evolve_to !== null && payload.evolve_to !== '') {
      try {
        JSON.parse(payload.evolve_to);
      } catch (_) {
        payload.evolve_to = null;
      }
    }
    onSave(payload);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h4>{mode === 'edit' ? 'Sửa' : 'Thêm'} Pet Species</h4>
        <form onSubmit={handleSubmit}>
          <div className="form-row"><label>name *</label><input value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
          <div className="form-row"><label>image *</label><input value={form.image} onChange={(e) => update('image', e.target.value)} required /></div>
          <div className="form-row"><label>type</label><input value={form.type} onChange={(e) => update('type', e.target.value)} placeholder="fire, water..." /></div>
          <div className="form-row"><label>description</label><textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} /></div>
          <div className="form-row"><label>rarity</label>
            <select value={form.rarity} onChange={(e) => update('rarity', e.target.value)}>
              {['common', 'uncommon', 'rare', 'epic', 'legend', 'mythic'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-row"><label>base_hp, base_mp, base_str, base_def, base_intelligence, base_spd</label></div>
          <div className="form-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="number" placeholder="base_hp" value={form.base_hp} onChange={(e) => update('base_hp', e.target.value)} style={{ width: '70px' }} />
            <input type="number" placeholder="base_mp" value={form.base_mp} onChange={(e) => update('base_mp', e.target.value)} style={{ width: '70px' }} />
            <input type="number" placeholder="base_str" value={form.base_str} onChange={(e) => update('base_str', e.target.value)} style={{ width: '70px' }} />
            <input type="number" placeholder="base_def" value={form.base_def} onChange={(e) => update('base_def', e.target.value)} style={{ width: '70px' }} />
            <input type="number" placeholder="base_int" value={form.base_intelligence} onChange={(e) => update('base_intelligence', e.target.value)} style={{ width: '70px' }} />
            <input type="number" placeholder="base_spd" value={form.base_spd} onChange={(e) => update('base_spd', e.target.value)} style={{ width: '70px' }} />
          </div>
          <div className="form-row"><label>evolve_to (JSON array, VD: [2,3])</label><input value={form.evolve_to} onChange={(e) => update('evolve_to', e.target.value)} placeholder="[2, 3]" /></div>
          <div className="form-actions">
            <button type="submit" className="btn-save">Lưu</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPetTypes;
