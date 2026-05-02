import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminNpcBossManagement.css';
import './EditItems.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const METRIC_OPTIONS = [
  { value: 'peta_earned', label: 'Kiếm được Peta (tổng)' },
  { value: 'peta_spent', label: 'Tiêu phí Peta (tổng)' },
  { value: 'pets_caught', label: 'Bắt pet thành công' },
  { value: 'pet_evolutions', label: 'Tiến hóa pet' },
  { value: 'hunt_wins', label: 'Thắng quái (đấu / săn)' },
];

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

function AdminTitlesManagement() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.token && user?.isAdmin) loadRows();
  }, [user?.token, user?.isAdmin]);

  const loadRows = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/titles`, { headers: authHeaders(user.token) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi tải');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e.message || 'Lỗi');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Xóa danh hiệu này? Người chơi sẽ mất unlock tương ứng.')) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/titles/${id}`, {
        method: 'DELETE',
        headers: authHeaders(user.token),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi xóa');
      setMessage('Đã xóa.');
      loadRows();
    } catch (e) {
      setMessage(e.message || 'Lỗi');
    }
  };

  const save = async (payload, mode, id) => {
    try {
      const url =
        mode === 'edit' ? `${API_BASE}/api/admin/titles/${id}` : `${API_BASE}/api/admin/titles`;
      const r = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi lưu');
      setModal(null);
      setMessage(mode === 'edit' ? 'Đã cập nhật.' : 'Đã tạo.');
      loadRows();
    } catch (e) {
      setMessage(e.message || 'Lỗi');
    }
  };

  if (isLoading || !user?.isAdmin) {
    return (
      <div className="admin-npc-page">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="admin-npc-page">
      <div className="admin-npc-toolbar">
        <Link to="/admin" className="hmap-btn ghost sm">
          ← Admin
        </Link>
        <h1>Hệ thống Title</h1>
        <button type="button" className="hmap-btn primary sm" onClick={() => setModal({ mode: 'create' })}>
          + Thêm title
        </button>
      </div>

      {message && <p className="edit-items-msg">{message}</p>}

      <div className="edit-items-table-wrap">
        <table className="edit-items-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Slug</th>
              <th>Tên</th>
              <th>Ảnh</th>
              <th>Chỉ số</th>
              <th>Ngưỡng</th>
              <th>Sort</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.slug}</td>
                <td>{r.name}</td>
                <td>
                  <code>{r.image_key}</code>
                </td>
                <td>{r.metric_type}</td>
                <td>{Number(r.threshold).toLocaleString()}</td>
                <td>{r.sort_order}</td>
                <td>{r.is_active ? '✓' : '—'}</td>
                <td>
                  <button type="button" className="hmap-btn ghost sm" onClick={() => setModal({ mode: 'edit', row: r })}>
                    Sửa
                  </button>{' '}
                  <button type="button" className="hmap-btn ghost sm" onClick={() => remove(r.id)}>
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <TitleModal
          modal={modal}
          onClose={() => setModal(null)}
          onSave={save}
          metricOptions={METRIC_OPTIONS}
        />
      )}
    </div>
  );
}

function TitleModal({ modal, onClose, onSave, metricOptions }) {
  const row = modal.row || {};
  const [form, setForm] = useState({
    slug: row.slug || '',
    name: row.name || '',
    image_key: row.image_key || 't1',
    metric_type: row.metric_type || 'peta_earned',
    threshold: row.threshold != null ? String(row.threshold) : '0',
    sort_order: row.sort_order != null ? String(row.sort_order) : '0',
    is_active: row.is_active !== 0 && row.is_active !== false,
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSave(
      {
        slug: form.slug.trim(),
        name: form.name.trim(),
        image_key: form.image_key.trim() || 't1',
        metric_type: form.metric_type,
        threshold: parseInt(form.threshold, 10) || 0,
        sort_order: parseInt(form.sort_order, 10) || 0,
        is_active: form.is_active,
      },
      modal.mode,
      row.id
    );
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal-box" role="dialog" onClick={(ev) => ev.stopPropagation()}>
        <h3>{modal.mode === 'edit' ? 'Sửa title' : 'Thêm title'}</h3>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>slug</label>
            <input value={form.slug} onChange={(e) => update('slug', e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Tên hiển thị</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="form-row">
            <label>image_key (file trong public/images/title/*.png)</label>
            <input value={form.image_key} onChange={(e) => update('image_key', e.target.value)} placeholder="t1" />
          </div>
          <div className="form-row">
            <label>Điều kiện</label>
            <select value={form.metric_type} onChange={(e) => update('metric_type', e.target.value)}>
              {metricOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Ngưỡng</label>
            <input value={form.threshold} onChange={(e) => update('threshold', e.target.value)} />
          </div>
          <div className="form-row">
            <label>sort_order</label>
            <input value={form.sort_order} onChange={(e) => update('sort_order', e.target.value)} />
          </div>
          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => update('is_active', e.target.checked)}
              />{' '}
              Đang kích hoạt
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-save">
              Lưu
            </button>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminTitlesManagement;
