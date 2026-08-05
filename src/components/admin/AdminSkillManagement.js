import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import {
  BATTLE_FX_ADMIN_PATH,
  DEFAULT_SKILL_ANIMATION_ID,
  listBattleFxOptions,
  loadBattleFxCatalogAsync,
} from '../../data/battleFxCatalog';
import './AdminNpcBossManagement.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

function AdminSkillManagement() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [skills, setSkills] = useState([]);
  const [fxOptions, setFxOptions] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [modal, setModal] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.isAdmin && user?.token) {
      loadSkills();
      loadFxOptions();
    }
  }, [user?.isAdmin, user?.token]);

  const fxLabelById = useMemo(() => {
    const map = {};
    fxOptions.forEach((o) => {
      map[o.numId] = o.label;
    });
    return map;
  }, [fxOptions]);

  const loadFxOptions = async () => {
    try {
      const catalog = await loadBattleFxCatalogAsync();
      setFxOptions(listBattleFxOptions(catalog));
    } catch {
      setFxOptions(listBattleFxOptions());
    }
  };

  const loadSkills = async () => {
    if (!user?.token) return;
    try {
      const s = await fetch(`${API_BASE}/api/admin/skills`, {
        headers: authHeaders(user.token),
      }).then((r) => r.json());
      setSkills(Array.isArray(s) ? s : []);
    } catch (e) {
      setMessage('Lỗi tải skills: ' + e.message);
      setMessageType('error');
    }
  };

  const showMsg = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setUploadResult(null);
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa skill này?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/skills/${id}`, {
        method: 'DELETE',
        headers: authHeaders(user.token),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi xóa');
      showMsg('Đã xóa skill.');
      loadSkills();
    } catch (e) {
      showMsg(e.message || 'Lỗi xóa', 'error');
    }
  };

  const downloadCSV = () => {
    const url = `${API_BASE}/api/admin/skills/csv`;
    const link = document.createElement('a');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    fetch(url, { headers: authHeaders(user.token) })
      .then((r) => {
        if (!r.ok) throw new Error('Lỗi tải');
        return r.blob();
      })
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        link.href = u;
        link.download = 'skills.csv';
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
      const r = await fetch(`${API_BASE}/api/admin/skills/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi upload');
      setUploadResult(data);
      showMsg(`CSV: ${data.inserted || 0} thêm, ${data.updated || 0} cập nhật.`);
      loadSkills();
    } catch (e) {
      showMsg(e.message || 'Lỗi upload CSV', 'error');
    }
  };

  const saveModal = async (payload) => {
    const { mode, row } = modal;
    try {
      const url =
        mode === 'edit' ? `${API_BASE}/api/admin/skills/${row.id}` : `${API_BASE}/api/admin/skills`;
      const r = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi');
      showMsg(mode === 'edit' ? 'Đã cập nhật skill.' : 'Đã thêm skill.');
      setModal(null);
      loadSkills();
    } catch (e) {
      showMsg(e.message || 'Lỗi lưu', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="admin-npc-boss">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }
  if (!user || !user.isAdmin) {
    return (
      <div className="admin-npc-boss">
        <div className="access-denied">
          <h2>Access Denied</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-npc-boss">
      <div className="admin-header">
        <div className="header-text">
          <h1>Hệ thống Skill</h1>
          <p>
            Quản lý bảng skills. Mỗi skill chọn animation (mặc định #{DEFAULT_SKILL_ANIMATION_ID}).
            Quản lý sprite tại{' '}
            <Link to={BATTLE_FX_ADMIN_PATH}>Battle FX</Link>.
          </p>
        </div>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && (
        <div className="message success">
          Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.
        </div>
      )}

      <div className="section-card">
        <h3>Bảng skills</h3>
        <div className="section-actions">
          <button
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'add', row: {} })}
          >
            Thêm
          </button>
          <button className="btn btn-secondary" onClick={downloadCSV}>
            Tải CSV
          </button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV{' '}
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCSV(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>id</th>
                <th>name</th>
                <th>type</th>
                <th>power_min</th>
                <th>power_max</th>
                <th>accuracy</th>
                <th>power_multiplier</th>
                <th>effect_type</th>
                <th>mana_cost</th>
                <th>animation_id</th>
                <th>created_at</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((r) => {
                const animId = r.animation_id != null ? Number(r.animation_id) : DEFAULT_SKILL_ANIMATION_ID;
                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.type ?? '-'}</td>
                    <td>{r.power_min ?? '-'}</td>
                    <td>{r.power_max ?? '-'}</td>
                    <td>{r.accuracy ?? '-'}</td>
                    <td>{r.power_multiplier}</td>
                    <td>{r.effect_type}</td>
                    <td>{r.mana_cost}</td>
                    <td title={fxLabelById[animId] || ''}>
                      {animId}
                      {fxLabelById[animId] ? (
                        <span style={{ display: 'block', fontSize: 11, color: '#666' }}>
                          {fxLabelById[animId]}
                        </span>
                      ) : null}
                    </td>
                    <td>{r.created_at ? String(r.created_at).slice(0, 19) : ''}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          className="btn-edit"
                          onClick={() => setModal({ mode: 'edit', row: r })}
                        >
                          Sửa
                        </button>
                        <button className="btn-delete" onClick={() => deleteRow(r.id)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <SkillModal
          modal={modal}
          fxOptions={fxOptions}
          onClose={() => setModal(null)}
          onSave={saveModal}
        />
      )}
    </div>
  );
}

function SkillModal({ modal, fxOptions, onClose, onSave }) {
  const { mode, row } = modal;
  const [form, setForm] = useState(() => ({
    name: row.name ?? '',
    description: row.description ?? '',
    power_multiplier: row.power_multiplier ?? 1,
    effect_type: row.effect_type ?? '',
    mana_cost: row.mana_cost ?? 0,
    type: row.type ?? 'attack',
    power_min: row.power_min ?? 80,
    power_max: row.power_max ?? 100,
    accuracy: row.accuracy ?? 100,
    animation_id:
      row.animation_id != null && row.animation_id !== ''
        ? Number(row.animation_id)
        : DEFAULT_SKILL_ANIMATION_ID,
  }));

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      power_multiplier: Number(form.power_multiplier),
      mana_cost: Number(form.mana_cost),
      power_min: form.power_min !== '' && form.power_min != null ? Number(form.power_min) : undefined,
      power_max: form.power_max !== '' && form.power_max != null ? Number(form.power_max) : undefined,
      accuracy: form.accuracy !== '' && form.accuracy != null ? Number(form.accuracy) : undefined,
      animation_id: Math.max(
        1,
        Number(form.animation_id) || DEFAULT_SKILL_ANIMATION_ID
      ),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h4>
          {mode === 'edit' ? 'Sửa' : 'Thêm'} Skill
        </h4>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>name *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="form-row">
            <label>description</label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
            />
          </div>
          <div className="form-row">
            <label>type (Boss: attack / defend)</label>
            <select value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="attack">attack</option>
              <option value="defend">defend</option>
            </select>
          </div>
          <div className="form-row">
            <label>power_min, power_max</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                placeholder="power_min"
                value={form.power_min}
                onChange={(e) => update('power_min', e.target.value)}
                style={{ width: '80px' }}
              />
              <input
                type="number"
                placeholder="power_max"
                value={form.power_max}
                onChange={(e) => update('power_max', e.target.value)}
                style={{ width: '80px' }}
              />
            </div>
          </div>
          <div className="form-row">
            <label>accuracy (0-100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.accuracy}
              onChange={(e) => update('accuracy', e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>power_multiplier</label>
            <input
              type="number"
              step="0.01"
              value={form.power_multiplier}
              onChange={(e) => update('power_multiplier', e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>effect_type</label>
            <input
              value={form.effect_type}
              onChange={(e) => update('effect_type', e.target.value)}
              placeholder="Stun, Poison, Burn, Heal..."
            />
          </div>
          <div className="form-row">
            <label>mana_cost</label>
            <input
              type="number"
              value={form.mana_cost}
              onChange={(e) => update('mana_cost', e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>animation (Battle FX)</label>
            <select
              value={form.animation_id}
              onChange={(e) => update('animation_id', Number(e.target.value))}
            >
              {fxOptions.length === 0 ? (
                <option value={DEFAULT_SKILL_ANIMATION_ID}>
                  #{DEFAULT_SKILL_ANIMATION_ID} — mặc định
                </option>
              ) : (
                fxOptions.map((o) => (
                  <option key={o.numId} value={o.numId}>
                    {o.label}
                  </option>
                ))
              )}
            </select>
            <span className="form-hint">
              Mặc định #{DEFAULT_SKILL_ANIMATION_ID}. Thêm animation tại{' '}
              <Link to={BATTLE_FX_ADMIN_PATH}>/admin/battle-fx</Link>.
            </span>
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

export default AdminSkillManagement;
