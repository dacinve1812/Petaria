import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminNpcBossManagement.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

function EditItems() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [items, setItems] = useState([]);
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
    if (user?.token && user?.isAdmin) loadItems();
  }, [user?.token, user?.isAdmin]);

  const showMsg = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setUploadResult(null);
  };

  const loadItems = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/items`, { headers: authHeaders(user.token) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.message || 'Lỗi tải items');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      showMsg(e.message || 'Lỗi tải items', 'error');
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa item này?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/items/${id}`, { method: 'DELETE', headers: authHeaders(user.token) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Lỗi xóa');
      showMsg('Đã xóa item.');
      loadItems();
    } catch (e) {
      showMsg(e.message || 'Lỗi xóa item', 'error');
    }
  };

  const saveItem = async (payload) => {
    const { mode, row } = modal;
    try {
      const url = mode === 'edit' ? `${API_BASE}/api/admin/items/${row.id}` : `${API_BASE}/api/admin/items`;
      const r = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Lỗi lưu item');
      showMsg(mode === 'edit' ? 'Đã cập nhật item.' : 'Đã thêm item.');
      setModal(null);
      loadItems();
    } catch (e) {
      showMsg(e.message || 'Lỗi lưu item', 'error');
    }
  };

  const downloadCSV = async () => {
    const url = `${API_BASE}/api/admin/items/csv`;
    try {
      const r = await fetch(url, { headers: authHeaders(user.token) });
      if (!r.ok) throw new Error('Lỗi tải CSV');
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = u;
      link.download = 'items.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(u);
    } catch (e) {
      showMsg(e.message || 'Lỗi tải CSV', 'error');
    }
  };

  const uploadCSV = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API_BASE}/api/admin/items/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi upload CSV');
      setUploadResult(data);
      showMsg(`CSV: ${data.inserted || 0} thêm, ${data.updated || 0} cập nhật.`);
      loadItems();
    } catch (e) {
      showMsg(e.message || 'Lỗi upload CSV', 'error');
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const displayItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? items.filter((item) => {
          const haystack = [
            item.id,
            item.name,
            item.description,
            item.type,
            item.rarity,
            item.image_url,
            item.buy_price,
            item.sell_price,
          ]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' ');
          return haystack.includes(q);
        })
      : [...items];

    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      const aNum = Number(av);
      const bNum = Number(bv);
      let cmp = 0;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && av !== '' && bv !== '') {
        cmp = aNum - bNum;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'vi', { sensitivity: 'base' });
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, searchTerm, sortConfig]);

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return <div className="admin-npc-boss"><div className="access-denied"><h2>Access Denied</h2></div></div>;

  return (
    <div className="admin-npc-boss">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý Items</h1>
          <p>Chỉnh sửa bảng items, tải/upload CSV và liên kết nhanh tới Equipment Stats / Item Effects.</p>
        </div>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && <div className="message success">Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.</div>}

      <div className="section-card">
        <h3>Bảng items</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'add', row: {} })}>Thêm</button>
          <button className="btn btn-secondary" onClick={downloadCSV}>Tải CSV</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCSV(f); e.target.value = ''; }} />
          </label>
          <input
            type="text"
            placeholder="Search item..."
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
                <th>Ảnh</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>name{sortIndicator('name')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('description')}>description{sortIndicator('description')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('type')}>type{sortIndicator('type')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('rarity')}>rarity{sortIndicator('rarity')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('buy_price')}>buy_price{sortIndicator('buy_price')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sell_price')}>sell_price{sortIndicator('sell_price')}</th>
                <th>Liên kết</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>
                    <img
                      src={item.image_url?.startsWith('/') || item.image_url?.startsWith('http') ? item.image_url : `/images/equipments/${item.image_url}`}
                      alt=""
                      className="boss-thumb"
                      onError={(e) => { e.target.src = '/images/equipments/placeholder.png'; e.target.onerror = null; }}
                    />
                  </td>
                  <td>{item.name}</td>
                  <td title={item.description}>{String(item.description || '').slice(0, 50)}{String(item.description || '').length > 50 ? '…' : ''}</td>
                  <td>{item.type}</td>
                  <td>{item.rarity}</td>
                  <td>{item.buy_price ?? 0}</td>
                  <td>{item.sell_price ?? 0}</td>
                  <td>
                    <div className="cell-actions">
                      {item.type === 'equipment' && <Link className="btn-edit" to={`/admin/edit-equipment-stats?item_id=${item.id}`}>Equipment</Link>}
                      {(item.type === 'booster' || item.type === 'consumable') && <Link className="btn-edit" to={`/admin/edit-item-effects?item_id=${item.id}`}>Effects</Link>}
                    </div>
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn-edit" onClick={() => setModal({ mode: 'edit', row: item })}>Sửa</button>
                      <button className="btn-delete" onClick={() => deleteItem(item.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: '#6c757d' }}>Không có item phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ItemModal mode={modal.mode} row={modal.row} onClose={() => setModal(null)} onSave={saveItem} />}
    </div>
  );
}

function ItemModal({ mode, row, onClose, onSave }) {
  const [form, setForm] = useState({
    name: row.name ?? '',
    description: row.description ?? '',
    type: row.type ?? 'misc',
    rarity: row.rarity ?? 'common',
    image_url: row.image_url ?? '',
    buy_price: row.buy_price ?? 0,
    sell_price: row.sell_price ?? 0,
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      buy_price: Number(form.buy_price) || 0,
      sell_price: Number(form.sell_price) || 0,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h4>{mode === 'edit' ? 'Sửa' : 'Thêm'} item</h4>
        <form onSubmit={submit}>
          <div className="form-row"><label>name *</label><input value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
          <div className="form-row"><label>description</label><textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} /></div>
          <div className="form-row"><label>type *</label>
            <select value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="food">food</option><option value="equipment">equipment</option><option value="consumable">consumable</option><option value="booster">booster</option><option value="evolve">evolve</option><option value="misc">misc</option>
            </select>
          </div>
          <div className="form-row"><label>rarity *</label>
            <select value={form.rarity} onChange={(e) => update('rarity', e.target.value)}>
              <option value="common">common</option><option value="rare">rare</option><option value="epic">epic</option><option value="legendary">legendary</option>
            </select>
          </div>
          <div className="form-row"><label>image_url *</label><input value={form.image_url} onChange={(e) => update('image_url', e.target.value)} required /></div>
          <div className="form-row"><label>buy_price</label><input type="number" min="0" value={form.buy_price} onChange={(e) => update('buy_price', e.target.value)} /></div>
          <div className="form-row"><label>sell_price</label><input type="number" min="0" value={form.sell_price} onChange={(e) => update('sell_price', e.target.value)} /></div>
          <div className="form-actions">
            <button type="submit" className="btn-save">Lưu</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditItems;
