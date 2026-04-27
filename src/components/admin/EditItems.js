import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../UserContext';
import TaxonomyFilterModal, { filterByTaxonomySelection } from '../filters/TaxonomyFilterModal';
import './AdminNpcBossManagement.css';
import './EditItems.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

/** Đồng bộ với backend `normalizeItemRarity`: chỉ common | rare | epic | legendary */
function normalizeRarityForItem(value) {
  const k = String(value ?? '').trim().toLowerCase();
  if (['common', 'rare', 'epic', 'legendary'].includes(k)) return k;
  if (['legend', 'mythic', 'unique', 'artifact'].includes(k)) return 'legendary';
  if (k === 'uncommon') return 'rare';
  return 'common';
}

function rarityTableLabel(value) {
  const v = normalizeRarityForItem(value);
  return v === 'legendary' ? 'Legend' : v;
}

function EditItems() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [uploadResult, setUploadResult] = useState(null);
  const [modal, setModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'item_code', direction: 'asc' });
  const [taxonomyFilterOpen, setTaxonomyFilterOpen] = useState(false);
  const [taxonomyFilter, setTaxonomyFilter] = useState({ type: [], category: [], subtype: [] });

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

  const uniqSorted = (arr) => [...new Set(arr.filter((v) => v != null && String(v).trim() !== ''))].sort((a, b) =>
    String(a).localeCompare(String(b), 'vi', { sensitivity: 'base' })
  );

  const filterSections = useMemo(
    () => [
      {
        id: 'type',
        title: 'Type',
        options: uniqSorted(items.map((i) => i.type)).map((v) => ({ value: v, label: v })),
      },
      {
        id: 'category',
        title: 'Category',
        options: uniqSorted(items.map((i) => i.category)).map((v) => ({ value: v, label: v })),
      },
      {
        id: 'subtype',
        title: 'Subtype',
        options: uniqSorted(items.map((i) => i.subtype)).map((v) => ({ value: v, label: v })),
      },
    ],
    [items]
  );

  const taxonomyActiveCount =
    (taxonomyFilter.type?.length || 0) +
    (taxonomyFilter.category?.length || 0) +
    (taxonomyFilter.subtype?.length || 0);

  const displayItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let filtered = q
      ? items.filter((item) => {
          const haystack = [
            item.id,
            item.item_code,
            item.name,
            item.description,
            item.type,
            item.category,
            item.subtype,
            item.rarity,
            item.image_url,
            item.buy_price,
            item.sell_price,
            item.price_currency,
            item.magic_value,
            item.stackable,
            item.max_stack,
            item.consume_policy,
            item.pet_scope,
          ]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' ');
          return haystack.includes(q);
        })
      : [...items];

    filtered = filterByTaxonomySelection(filtered, taxonomyFilter, {
      type: 'type',
      category: 'category',
      subtype: 'subtype',
    });

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
  }, [items, searchTerm, sortConfig, taxonomyFilter]);

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return <div className="admin-npc-boss"><div className="access-denied"><h2>Access Denied</h2></div></div>;

  const tableColCount = 16;

  return (
    <div className="admin-npc-boss">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý Items</h1>
          <p>Chỉnh sửa bảng items, tải/upload CSV (đủ cột) và liên kết tới Equipment Stats / Item Effects.</p>
        </div>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && <div className="message success">Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.</div>}

      <div className="section-card">
        <h3>Bảng items</h3>
        <div className="section-actions edit-items-toolbar">
          <div className="edit-items-toolbar-left">
            <button className="btn btn-primary" onClick={() => setModal({ mode: 'add', row: {} })}>Thêm</button>
            <button className="btn btn-secondary" onClick={downloadCSV}>Tải CSV</button>
            <label className="btn btn-secondary" style={{ margin: 0 }}>
              Upload CSV
              <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCSV(f); e.target.value = ''; }} />
            </label>
          </div>
          <div className="edit-items-toolbar-right">
            <input
              type="text"
              className="edit-items-search-input"
              placeholder="Search (id, item_code, name, subtype...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="button"
              className={`btn btn-secondary edit-items-filter-btn ${taxonomyActiveCount > 0 ? 'is-active' : ''}`}
              onClick={() => setTaxonomyFilterOpen(true)}
            >
              Bộ lọc
              {taxonomyActiveCount > 0 ? ` (${taxonomyActiveCount})` : ''}
            </button>
          </div>
        </div>
        <div className="table-wrap edit-items-scroll">
          <table className="data-table edit-items-table">
            <thead>
              <tr>
                <th className="edit-items-sticky edit-items-sticky-1" style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>id{sortIndicator('id')}</th>
                <th className="edit-items-sticky edit-items-sticky-2" style={{ cursor: 'pointer' }} onClick={() => handleSort('item_code')}>item_code{sortIndicator('item_code')}</th>
                <th className="edit-items-sticky edit-items-sticky-3">Ảnh</th>
                <th className="edit-items-sticky edit-items-sticky-4" style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>name{sortIndicator('name')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('description')}>description{sortIndicator('description')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('type')}>type{sortIndicator('type')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>category{sortIndicator('category')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('subtype')}>subtype{sortIndicator('subtype')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('rarity')}>rarity{sortIndicator('rarity')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('magic_value')}>magic{sortIndicator('magic_value')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('max_stack')}>max_st{sortIndicator('max_stack')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('buy_price')}>buy{sortIndicator('buy_price')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sell_price')}>sell{sortIndicator('sell_price')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('price_currency')}>currency{sortIndicator('price_currency')}</th>
                <th>Liên kết</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => (
                <tr key={item.id}>
                  <td className="edit-items-sticky edit-items-sticky-1">{item.id}</td>
                  <td className="edit-items-sticky edit-items-sticky-2">{item.item_code ?? ''}</td>
                  <td className="edit-items-sticky edit-items-sticky-3">
                    <img
                      src={item.image_url?.startsWith('/') || item.image_url?.startsWith('http') ? item.image_url : `/images/equipments/${item.image_url}`}
                      alt=""
                      className="boss-thumb"
                      onError={(e) => { e.target.src = '/images/equipments/placeholder.png'; e.target.onerror = null; }}
                    />
                  </td>
                  <td className="edit-items-sticky edit-items-sticky-4">{item.name}</td>
                  <td title={item.description}>{String(item.description || '').slice(0, 40)}{String(item.description || '').length > 40 ? '…' : ''}</td>
                  <td>{item.type}</td>
                  <td>{item.category ?? ''}</td>
                  <td>{item.subtype ?? ''}</td>
                  <td title={String(item.rarity)}>{rarityTableLabel(item.rarity)}</td>
                  <td>{item.magic_value ?? ''}</td>
                  <td>{item.max_stack ?? ''}</td>
                  <td>{item.buy_price ?? 0}</td>
                  <td>{item.sell_price ?? 0}</td>
                  <td>{item.price_currency ?? 'peta'}</td>
                  <td>
                    <div className="cell-actions">
                      {item.type === 'equipment' ? (
                        <Link className="btn-edit" to={`/admin/edit-equipment-stats?item_id=${item.id}`}>Equipment</Link>
                      ) : item.type === 'evolve' ? null : (
                        <Link className="btn-edit" to={`/admin/edit-item-effects?item_id=${item.id}`}>Effects</Link>
                      )}
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
                  <td colSpan={tableColCount} style={{ textAlign: 'center', color: '#6c757d' }}>Không có item phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ItemModal mode={modal.mode} row={modal.row} onClose={() => setModal(null)} onSave={saveItem} />}

      <TaxonomyFilterModal
        open={taxonomyFilterOpen}
        onClose={() => setTaxonomyFilterOpen(false)}
        title="Lọc taxonomy"
        sections={filterSections}
        value={taxonomyFilter}
        onApply={setTaxonomyFilter}
      />
    </div>
  );
}

function ItemModal({ mode, row, onClose, onSave }) {
  const [form, setForm] = useState({
    item_code: row.item_code ?? '',
    name: row.name ?? '',
    description: row.description ?? '',
    type: row.type ?? 'misc',
    category: row.category ?? 'misc',
    subtype: row.subtype ?? '',
    rarity: normalizeRarityForItem(row.rarity ?? 'common'),
    image_url: row.image_url ?? '',
    buy_price: row.buy_price ?? 0,
    sell_price: row.sell_price ?? 0,
    price_currency: row.price_currency ?? 'peta',
    magic_value: row.magic_value ?? '',
    stackable: row.stackable === 0 || row.stackable === false ? false : true,
    max_stack: row.max_stack ?? 999,
    consume_policy: row.consume_policy ?? 'single_use',
    pet_scope: row.pet_scope ?? 'all',
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      item_code: (() => {
        const v = String(form.item_code ?? '').trim();
        if (!v) return null;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
      })(),
      name: form.name,
      description: form.description,
      type: form.type,
      category: form.category,
      subtype: form.subtype || null,
      rarity: form.rarity,
      image_url: form.image_url,
      buy_price: Number(form.buy_price) || 0,
      sell_price: Number(form.sell_price) || 0,
      price_currency: form.price_currency,
      magic_value: form.magic_value === '' ? null : Number(form.magic_value),
      stackable: form.stackable ? 1 : 0,
      max_stack: Number(form.max_stack) || 999,
      consume_policy: form.consume_policy,
      pet_scope: form.pet_scope,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h4>{mode === 'edit' ? 'Sửa' : 'Thêm'} item</h4>
        <form onSubmit={submit}>
          <div className="form-row"><label>item_code</label><input type="number" value={form.item_code} onChange={(e) => update('item_code', e.target.value)} placeholder="Mã nghiệp vụ (tuỳ chọn)" /></div>
          <div className="form-row"><label>name *</label><input value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
          <div className="form-row"><label>description</label><textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} /></div>
          <div className="form-row"><label>type *</label>
            <select value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="consumable">consumable</option>
              <option value="food">food</option>
              <option value="booster">booster</option>
              <option value="equipment">equipment</option>
              <option value="evolve">evolve</option>
              <option value="quest">quest</option>
              <option value="repair_kit">repair_kit</option>
              <option value="misc">misc</option>
            </select>
          </div>
          <div className="form-row"><label>category *</label>
            <select value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="stat_boost">stat_boost</option>
              <option value="medicine">medicine</option>
              <option value="food">food</option>
              <option value="toy">toy</option>
              <option value="equipment">equipment</option>
              <option value="transform">transform</option>
              <option value="quest">quest</option>
              <option value="misc">misc</option>
            </select>
          </div>
          <div className="form-row"><label>subtype</label><input value={form.subtype} onChange={(e) => update('subtype', e.target.value)} /></div>
          <div className="form-row"><label>rarity *</label>
            <select value={form.rarity} onChange={(e) => update('rarity', e.target.value)}>
              <option value="common">common</option>
              <option value="rare">rare</option>
              <option value="epic">epic</option>
              <option value="legendary">Legend (legendary)</option>
            </select>
          </div>
          <div className="form-row"><label>magic_value</label><input type="number" value={form.magic_value} onChange={(e) => update('magic_value', e.target.value)} placeholder="Để trống = null" /></div>
          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.stackable} onChange={(e) => update('stackable', e.target.checked)} />
              stackable
            </label>
          </div>
          <div className="form-row"><label>max_stack</label><input type="number" min="1" value={form.max_stack} onChange={(e) => update('max_stack', e.target.value)} /></div>
          <div className="form-row"><label>consume_policy</label>
            <select value={form.consume_policy} onChange={(e) => update('consume_policy', e.target.value)}>
              <option value="single_use">single_use</option>
              <option value="on_battle_only">on_battle_only</option>
            </select>
          </div>
          <div className="form-row"><label>pet_scope</label>
            <select value={form.pet_scope} onChange={(e) => update('pet_scope', e.target.value)}>
              <option value="all">all</option>
              <option value="domestic_only">domestic_only</option>
            </select>
          </div>
          <div className="form-row"><label>image_url *</label><input value={form.image_url} onChange={(e) => update('image_url', e.target.value)} required /></div>
          <div className="form-row"><label>buy_price</label><input type="number" min="0" value={form.buy_price} onChange={(e) => update('buy_price', e.target.value)} /></div>
          <div className="form-row"><label>sell_price</label><input type="number" min="0" value={form.sell_price} onChange={(e) => update('sell_price', e.target.value)} /></div>
          <div className="form-row"><label>price_currency</label>
            <select value={form.price_currency} onChange={(e) => update('price_currency', e.target.value)}>
              <option value="peta">peta</option>
              <option value="petagold">petagold</option>
            </select>
          </div>
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
