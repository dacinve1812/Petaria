import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminNpcBossManagement.css';
import './EditPetTypes.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

/** Parse evolve_to từ DB (JSON string hoặc array) */
function parseEvolveIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Quản lý tiến hóa: loài → cấp tối thiểu, item, danh sách loài đích + ảnh xem trước.
 */
function AdminPetEvolutionManagement() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [species, setSpecies] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  const load = async () => {
    if (!user?.token) return;
    try {
      const [rs, ri] = await Promise.all([
        fetch(`${API_BASE}/api/admin/pet-species`, { headers: authHeaders(user.token) }),
        fetch(`${API_BASE}/api/admin/items`, { headers: authHeaders(user.token) }),
      ]);
      const d1 = await rs.json();
      const d2 = await ri.json();
      setSpecies(Array.isArray(d1) ? d1 : []);
      setItems(Array.isArray(d2) ? d2 : []);
    } catch (e) {
      setMessage('Lỗi tải: ' + e.message);
      setMessageType('error');
    }
  };

  useEffect(() => {
    if (user?.isAdmin && user?.token) load();
  }, [user?.isAdmin, user?.token]);

  const speciesById = useMemo(() => {
    const m = new Map();
    species.forEach((s) => m.set(s.id, s));
    return m;
  }, [species]);

  const itemsById = useMemo(() => {
    const m = new Map();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  const showMsg = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
  };

  const saveModal = async (payload) => {
    try {
      const body = { ...payload };
      if (body.evolve_to !== undefined && body.evolve_to !== null && body.evolve_to !== '') {
        try {
          body.evolve_to = typeof body.evolve_to === 'string' ? JSON.parse(body.evolve_to) : body.evolve_to;
        } catch (_) {
          body.evolve_to = null;
        }
      } else body.evolve_to = null;
      const id = payload.id;
      delete body.id;
      delete body.created_at;
      const r = await fetch(`${API_BASE}/api/admin/pet-species/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi lưu');
      showMsg('Đã cập nhật tiến hóa.');
      setModal(null);
      load();
    } catch (e) {
      showMsg(e.message || 'Lỗi lưu', 'error');
    }
  };

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return null;

  return (
    <div className="admin-npc-boss admin-pet-species">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý tiến hóa</h1>
          <p>
            Gán <strong>evolve_min_level</strong>, <strong>evolve_item_id</strong> và mảng <strong>evolve_to</strong> (id loài đích).
            Ảnh cột phải là loài đích (chọn từ pet_species).
          </p>
        </div>
        <button className="back-admin-btn" type="button" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      <div className="section-card">
        <div className="section-actions" style={{ marginBottom: 12 }}>
          <Link to="/admin/edit-pet-types" className="btn btn-secondary" style={{ display: 'inline-block', padding: '8px 14px', textDecoration: 'none' }}>
            ← Quản lý Pet Species (đầy đủ)
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Loài hiện tại</th>
                <th>Cấp tối thiểu</th>
                <th>Vật phẩm tiến hóa</th>
                <th>evolve_to</th>
                <th>Hình tiến hóa (preview)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {species.map((s) => {
                const ids = parseEvolveIds(s.evolve_to);
                const firstTarget = ids.length ? speciesById.get(ids[0]) : null;
                const reqItem = s.evolve_item_id != null ? itemsById.get(Number(s.evolve_item_id)) : null;
                return (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.image ? (
                          <img
                            src={`/images/pets/${s.image}`}
                            alt=""
                            style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6 }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : null}
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td>{s.evolve_min_level ?? 1}</td>
                    <td>
                      {reqItem ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img
                            src={`/images/equipments/${reqItem.image_url}`}
                            alt=""
                            style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6 }}
                            onError={(e) => {
                              e.target.src = '/images/equipments/placeholder.png';
                              e.target.onerror = null;
                            }}
                          />
                          <div style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{reqItem.name}</div>
                            <div style={{ color: '#64748b' }}>#{s.evolve_item_id}</div>
                          </div>
                        </div>
                      ) : s.evolve_item_id != null ? (
                        <span title="Không tìm thấy item trong DB">#{s.evolve_item_id}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td title={typeof s.evolve_to === 'string' ? s.evolve_to : JSON.stringify(s.evolve_to)}>
                      {ids.length ? `[${ids.join(', ')}]` : '—'}
                    </td>
                    <td>
                      {firstTarget?.image ? (
                        <img
                          src={`/images/pets/${firstTarget.image}`}
                          alt={firstTarget.name}
                          style={{ maxHeight: 56, objectFit: 'contain' }}
                          onError={(e) => { e.target.src = '/images/pets/default.png'; }}
                        />
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                      {firstTarget && (
                        <div style={{ fontSize: 11, color: '#64748b' }}>{firstTarget.name}</div>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn-edit" onClick={() => setModal({ row: s })}>
                        Sửa tiến hóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ModalEvolution
          row={modal.row}
          items={items}
          onClose={() => setModal(null)}
          onSave={saveModal}
        />
      )}
    </div>
  );
}

function ModalEvolution({ row, items, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    evolve_min_level: row.evolve_min_level ?? 1,
    evolve_item_id: row.evolve_item_id != null ? String(row.evolve_item_id) : '',
    evolve_to:
      row.evolve_to != null
        ? typeof row.evolve_to === 'string'
          ? row.evolve_to
          : JSON.stringify(row.evolve_to)
        : '',
  }));

  const evolveItemsOnly = useMemo(() => {
    const list = items.filter((it) => String(it.type || '').toLowerCase() === 'evolve');
    return [...list].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' })
    );
  }, [items]);

  const selectedId =
    form.evolve_item_id !== '' && form.evolve_item_id != null
      ? parseInt(form.evolve_item_id, 10)
      : null;
  const selectedInEvolveList =
    selectedId != null &&
    Number.isFinite(selectedId) &&
    evolveItemsOnly.some((it) => it.id === selectedId);
  const legacySelectedItem =
    selectedId != null &&
    Number.isFinite(selectedId) &&
    !selectedInEvolveList
      ? items.find((it) => it.id === selectedId)
      : null;

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    let eItem = null;
    if (form.evolve_item_id != null && String(form.evolve_item_id).trim() !== '') {
      const n = parseInt(form.evolve_item_id, 10);
      if (Number.isFinite(n) && n > 0) eItem = n;
    }
    const payload = {
      ...row,
      evolve_min_level: parseInt(form.evolve_min_level, 10) || 1,
      evolve_item_id: eItem,
      evolve_to: form.evolve_to,
    };
    onSave(payload);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 480 }}>
        <h4>Tiến hóa — {row.name}</h4>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Cấp tối thiểu (evolve_min_level)</label>
            <input
              type="number"
              min={1}
              value={form.evolve_min_level}
              onChange={(e) => update('evolve_min_level', e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Vật phẩm tiến hóa (chỉ loại &quot;evolve&quot;, sắp xếp A→Z)</label>
            <select
              value={form.evolve_item_id === '' ? '' : form.evolve_item_id}
              onChange={(e) => update('evolve_item_id', e.target.value)}
            >
              <option value="">— Không bắt buộc —</option>
              {legacySelectedItem && (
                <option value={String(legacySelectedItem.id)}>
                  #{legacySelectedItem.id} — {legacySelectedItem.name} (hiện tại: loại {legacySelectedItem.type || '?'})
                </option>
              )}
              {evolveItemsOnly.map((it) => (
                <option key={it.id} value={String(it.id)}>
                  #{it.id} — {it.name}
                </option>
              ))}
            </select>
            {legacySelectedItem && String(legacySelectedItem.type || '').toLowerCase() !== 'evolve' && (
              <p style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>
                Gợi ý: chọn một vật phẩm có type <code>evolve</code> để đồng bộ với game.
              </p>
            )}
          </div>
          <div className="form-row">
            <label>evolve_to — JSON mảng id loài đích, VD [12]</label>
            <input
              value={form.evolve_to}
              onChange={(e) => update('evolve_to', e.target.value)}
              placeholder="[12]"
            />
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
            Người chơi dùng nút Tiến hóa trên hồ sơ pet: hệ thống trừ đúng item và đổi <code>pet_species_id</code>.
            IV giữ nguyên; chỉ số base mới lấy theo loài đích (refresh intrinsic stats).
          </p>
          <div className="form-actions">
            <button type="submit" className="btn-save">Lưu</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminPetEvolutionManagement;
