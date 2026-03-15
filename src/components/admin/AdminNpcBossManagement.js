import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminNpcBossManagement.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  ...(token ? {} : {}),
});

function AdminNpcBossManagement() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [skills, setSkills] = useState([]);
  const [bossTemplates, setBossTemplates] = useState([]);
  const [bossSkills, setBossSkills] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [modal, setModal] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.isAdmin && user?.token) loadAll();
  }, [user?.isAdmin, user?.token]);

  const loadAll = async () => {
    if (!user?.token) return;
    try {
      const [s, b, bs] = await Promise.all([
        fetch(`${API_BASE}/api/admin/skills`, { headers: authHeaders(user.token) }).then(r => r.json()),
        fetch(`${API_BASE}/api/admin/boss-templates`, { headers: authHeaders(user.token) }).then(r => r.json()),
        fetch(`${API_BASE}/api/admin/boss-skills`, { headers: authHeaders(user.token) }).then(r => r.json()),
      ]);
      setSkills(Array.isArray(s) ? s : []);
      setBossTemplates(Array.isArray(b) ? b : []);
      setBossSkills(Array.isArray(bs) ? bs : []);
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

  const deleteRow = async (table, id) => {
    if (!window.confirm('Bạn có chắc muốn xóa?')) return;
    const url = table === 'skills' ? `${API_BASE}/api/admin/skills/${id}` : table === 'boss_templates' ? `${API_BASE}/api/admin/boss-templates/${id}` : `${API_BASE}/api/admin/boss-skills/${id}`;
    try {
      const r = await fetch(url, { method: 'DELETE', headers: authHeaders(user.token) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Lỗi xóa');
      showMsg('Đã xóa.');
      loadAll();
    } catch (e) {
      showMsg(e.message || 'Lỗi xóa', 'error');
    }
  };

  const downloadCSV = (table) => {
    const url = table === 'skills' ? `${API_BASE}/api/admin/skills/csv` : table === 'boss_templates' ? `${API_BASE}/api/admin/boss-templates/csv` : `${API_BASE}/api/admin/boss-skills/csv`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${table}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    fetch(url, { headers: authHeaders(user.token) })
      .then(r => { if (!r.ok) throw new Error('Lỗi tải'); return r.blob(); })
      .then(blob => {
        const u = URL.createObjectURL(blob);
        link.href = u;
        link.download = `${table}.csv`;
        link.click();
        URL.revokeObjectURL(u);
      })
      .catch(() => showMsg('Lỗi tải CSV', 'error'))
      .finally(() => link.remove());
  };

  const uploadCSV = async (table, file) => {
    if (!file) return;
    const url = table === 'skills' ? `${API_BASE}/api/admin/skills/csv` : table === 'boss_templates' ? `${API_BASE}/api/admin/boss-templates/csv` : `${API_BASE}/api/admin/boss-skills/csv`;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${user.token}` }, body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Lỗi upload');
      setUploadResult(data);
      showMsg(`CSV: ${data.inserted || 0} thêm, ${data.updated || 0} cập nhật.`);
      loadAll();
    } catch (e) {
      showMsg(e.message || 'Lỗi upload CSV', 'error');
    }
  };

  const saveModal = async (payload) => {
    const { type, mode, row } = modal;
    try {
      if (type === 'skills') {
        const url = mode === 'edit' ? `${API_BASE}/api/admin/skills/${row.id}` : `${API_BASE}/api/admin/skills`;
        const r = await fetch(url, {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Lỗi');
        showMsg(mode === 'edit' ? 'Đã cập nhật skill.' : 'Đã thêm skill.');
      } else if (type === 'boss_templates') {
        const url = mode === 'edit' ? `${API_BASE}/api/admin/boss-templates/${row.id}` : `${API_BASE}/api/admin/boss-templates`;
        const r = await fetch(url, {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Lỗi');
        showMsg(mode === 'edit' ? 'Đã cập nhật boss.' : 'Đã thêm boss.');
      } else if (type === 'boss_skills') {
        const url = mode === 'edit' ? `${API_BASE}/api/admin/boss-skills/${row.id}` : `${API_BASE}/api/admin/boss-skills`;
        const r = await fetch(url, {
          method: mode === 'edit' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(user.token) },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Lỗi');
        showMsg(mode === 'edit' ? 'Đã cập nhật boss_skill.' : 'Đã thêm boss_skill.');
      }
      setModal(null);
      loadAll();
    } catch (e) {
      showMsg(e.message || 'Lỗi lưu', 'error');
    }
  };

  if (isLoading) return <div className="admin-npc-boss"><div className="loading">Đang tải...</div></div>;
  if (!user || !user.isAdmin) return <div className="admin-npc-boss"><div className="access-denied"><h2>Access Denied</h2></div></div>;

  return (
    <div className="admin-npc-boss">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý NPC/Boss</h1>
          <p>Chỉnh sửa bảng skills, boss_templates, boss_skills. Tải / upload CSV theo cấu trúc bảng.</p>
        </div>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>← Quay lại Admin</button>
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}
      {uploadResult && <div className="message success">Kết quả CSV: thêm {uploadResult.inserted || 0}, cập nhật {uploadResult.updated || 0}.</div>}

      {/* Skills */}
      <div className="section-card">
        <h3>Bảng skills</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ type: 'skills', mode: 'add', row: {} })}>Thêm</button>
          <button className="btn btn-secondary" onClick={() => downloadCSV('skills')}>Tải CSV</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV <input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCSV('skills', f); e.target.value = ''; }} />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>id</th><th>name</th><th>type</th><th>power_min</th><th>power_max</th><th>accuracy</th><th>power_multiplier</th><th>effect_type</th><th>mana_cost</th><th>created_at</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {skills.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.name}</td><td>{r.type ?? '-'}</td><td>{r.power_min ?? '-'}</td><td>{r.power_max ?? '-'}</td><td>{r.accuracy ?? '-'}</td><td>{r.power_multiplier}</td><td>{r.effect_type}</td><td>{r.mana_cost}</td><td>{r.created_at ? String(r.created_at).slice(0, 19) : ''}</td>
                  <td><div className="cell-actions"><button className="btn-edit" onClick={() => setModal({ type: 'skills', mode: 'edit', row: r })}>Sửa</button><button className="btn-delete" onClick={() => deleteRow('skills', r.id)}>Xóa</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Boss templates */}
      <div className="section-card">
        <h3>Bảng boss_templates</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ type: 'boss_templates', mode: 'add', row: {} })}>Thêm</button>
          <button className="btn btn-secondary" onClick={() => downloadCSV('boss_templates')}>Tải CSV</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV <input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCSV('boss_templates', f); e.target.value = ''; }} />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>id</th><th>Hình</th><th>name</th><th>image_url</th><th>level</th><th>base_hp</th><th>base_mp</th><th>base_str</th><th>base_def</th><th>base_intelligence</th><th>base_spd</th><th>accuracy</th><th>location_id</th><th>drop_table</th><th>respawn_minutes</th><th>action_pattern</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {bossTemplates.map(r => {
                const actionPatternStr = typeof r.action_pattern === 'string' ? r.action_pattern : (r.action_pattern != null ? JSON.stringify(r.action_pattern) : '');
                const bossImgSrc = r.image_url ? (r.image_url.startsWith('http') || r.image_url.startsWith('/') ? r.image_url : `/images/pets/${r.image_url}`) : '';
                return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td className="boss-thumb-cell">
                    {bossImgSrc ? (
                      <img src={bossImgSrc} alt="" className="boss-thumb" onError={(e) => { e.target.src = '/images/pets/default.png'; e.target.onerror = null; }} />
                    ) : (
                      <span className="boss-thumb-empty">—</span>
                    )}
                  </td>
                  <td>{r.name}</td><td>{r.image_url}</td><td>{r.level}</td><td>{r.base_hp}</td><td>{r.base_mp}</td><td>{r.base_str}</td><td>{r.base_def}</td><td>{r.base_intelligence}</td><td>{r.base_spd}</td><td>{r.accuracy}</td><td>{r.location_id != null ? r.location_id : ''}</td><td>{typeof r.drop_table === 'string' ? r.drop_table.slice(0, 30) : r.drop_table ? JSON.stringify(r.drop_table).slice(0, 30) : ''}</td><td>{r.respawn_minutes != null ? r.respawn_minutes : ''}</td><td title={actionPatternStr}>{actionPatternStr.slice(0, 20)}{actionPatternStr.length > 20 ? '…' : ''}</td>
                  <td><div className="cell-actions"><button className="btn-edit" onClick={() => setModal({ type: 'boss_templates', mode: 'edit', row: r })}>Sửa</button><button className="btn-delete" onClick={() => deleteRow('boss_templates', r.id)}>Xóa</button></div></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Boss skills */}
      <div className="section-card">
        <h3>Bảng boss_skills</h3>
        <div className="section-actions">
          <button className="btn btn-primary" onClick={() => setModal({ type: 'boss_skills', mode: 'add', row: {} })}>Thêm</button>
          <button className="btn btn-secondary" onClick={() => downloadCSV('boss_skills')}>Tải CSV</button>
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV <input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCSV('boss_skills', f); e.target.value = ''; }} />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>id</th><th>boss_template_id</th><th>skill_id</th><th>sort_order</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {bossSkills.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.boss_template_id}</td><td>{r.skill_id}</td><td>{r.sort_order}</td>
                  <td><div className="cell-actions"><button className="btn-edit" onClick={() => setModal({ type: 'boss_skills', mode: 'edit', row: r })}>Sửa</button><button className="btn-delete" onClick={() => deleteRow('boss_skills', r.id)}>Xóa</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ModalEdit modal={modal} onClose={() => setModal(null)} onSave={saveModal} token={user?.token} />}
    </div>
  );
}

const DEFAULT_DROP_ROW = { item_id: 0, name: 'Vàng (Peta)', rate: 100, min_qty: 50, max_qty: 200 };

function parseDropTableToRows(jsonStr) {
  if (!jsonStr || !String(jsonStr).trim()) return [DEFAULT_DROP_ROW];
  try {
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr) || arr.length === 0) return [DEFAULT_DROP_ROW];
    return arr.map((e) => ({
      item_id: e.item_id != null ? parseInt(e.item_id, 10) : 0,
      name: String(e.name ?? (e.item_id === 0 ? 'Vàng (Peta)' : 'Item')),
      rate: Number(e.rate) || 0,
      min_qty: Math.max(0, parseInt(e.min_qty, 10) || 0),
      max_qty: Math.max(0, parseInt(e.max_qty, 10) || 0),
    }));
  } catch (_) {
    return [DEFAULT_DROP_ROW];
  }
}

function rowsToDropTableJson(rows) {
  const arr = rows.map((r) => ({
    item_id: r.item_id,
    name: r.name,
    rate: Number(r.rate) || 0,
    min_qty: Math.max(0, parseInt(r.min_qty, 10) || 0),
    max_qty: Math.max(0, parseInt(r.max_qty, 10) || 0),
  }));
  return JSON.stringify(arr, null, 2);
}

function itemImageSrc(imageUrl, apiBase) {
  if (!imageUrl) return '/images/equipments/placeholder.png';
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/images/equipments/${imageUrl}`;
}

function DropTableEditorModal({ open, currentJson, onClose, onApply, apiBase, token }) {
  const [rows, setRows] = useState([]);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemsList, setItemsList] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(parseDropTableToRows(currentJson));
    setItemPickerOpen(false);
  }, [open, currentJson]);

  useEffect(() => {
    if (!open) return;
    setLoadingItems(true);
    fetch(`${apiBase}/api/admin/items`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((data) => setItemsList(Array.isArray(data) ? data : []))
      .catch(() => setItemsList([]))
      .finally(() => setLoadingItems(false));
  }, [open, apiBase, token]);

  const updateRow = (index, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = (item) => {
    const row = {
      item_id: item.id,
      name: item.name || `Item ${item.id}`,
      rate: 10,
      min_qty: 1,
      max_qty: 1,
    };
    setRows((prev) => [...prev, row]);
    setItemPickerOpen(false);
  };

  const handleApply = () => {
    onApply(rowsToDropTableJson(rows));
    onClose();
  };

  if (!open) return null;
  return (
    <div className="modal-overlay drop-editor-overlay" onClick={onClose}>
      <div className="modal-box drop-editor-modal" onClick={(e) => e.stopPropagation()}>
        <h4>Quản lý Drop Item</h4>
        <div className="drop-editor-toolbar">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setItemPickerOpen(true)}>
            + Thêm item
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleApply}>Áp dụng vào JSON</button>
          <button type="button" className="btn btn-cancel btn-sm" onClick={onClose}>Đóng</button>
        </div>
        <div className="drop-editor-table-wrap">
          <table className="drop-editor-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Tên</th>
                <th>Rate (%)</th>
                <th>Min qty</th>
                <th>Max qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.item_id === 0 ? (
                      <span className="drop-item-icon drop-item-gold">P</span>
                    ) : (
                      <img
                        src={itemImageSrc(itemsList.find((it) => it.id === r.item_id)?.image_url)}
                        alt=""
                        className="drop-item-thumb"
                      />
                    )}
                  </td>
                  <td>
                    {r.item_id === 0 ? (
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => updateRow(i, 'name', e.target.value)}
                        className="drop-cell-input"
                      />
                    ) : (
                      <span title={r.name}>{r.name}</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={r.rate}
                      onChange={(e) => updateRow(i, 'rate', e.target.value)}
                      className="drop-cell-input drop-cell-num"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={r.min_qty}
                      onChange={(e) => updateRow(i, 'min_qty', e.target.value)}
                      className="drop-cell-input drop-cell-num"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={r.max_qty}
                      onChange={(e) => updateRow(i, 'max_qty', e.target.value)}
                      className="drop-cell-input drop-cell-num"
                    />
                  </td>
                  <td>
                    <button type="button" className="btn-delete-row" onClick={() => removeRow(i)} title="Xóa">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {itemPickerOpen && (
          <div className="drop-item-picker-overlay" onClick={() => setItemPickerOpen(false)}>
            <div className="drop-item-picker" onClick={(e) => e.stopPropagation()}>
              <h5>Chọn item thêm vào bảng drop</h5>
              {loadingItems ? (
                <p>Đang tải...</p>
              ) : (
                <div className="drop-item-picker-grid">
                  {itemsList.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="drop-item-picker-cell"
                      onClick={() => addRow(item)}
                      title={`${item.name} (ID: ${item.id})`}
                    >
                      <img
                        src={itemImageSrc(item.image_url)}
                        alt=""
                        className="drop-item-picker-img"
                      />
                      <span className="drop-item-picker-name">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItemPickerOpen(false)}>Hủy</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalEdit({ modal, onClose, onSave, token }) {
  const { type, mode, row } = modal;
  const [form, setForm] = useState(() => ({
    skills: { name: row.name ?? '', description: row.description ?? '', power_multiplier: row.power_multiplier ?? 1, effect_type: row.effect_type ?? '', mana_cost: row.mana_cost ?? 0, type: row.type ?? 'attack', power_min: row.power_min ?? 0, power_max: row.power_max ?? 100, accuracy: row.accuracy ?? 100 },
    boss_templates: {
      name: row.name ?? '',
      image_url: row.image_url ?? '',
      level: row.level ?? 1,
      base_hp: row.base_hp ?? 10,
      base_mp: row.base_mp ?? 10,
      base_str: row.base_str ?? 10,
      base_def: row.base_def ?? 10,
      base_intelligence: row.base_intelligence ?? 10,
      base_spd: row.base_spd ?? 10,
      accuracy: row.accuracy ?? 100,
      location_id: row.location_id ?? '',
      drop_table: (() => {
        const raw = row.drop_table;
        if (!raw) return '';
        const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
        try {
          return JSON.stringify(JSON.parse(str), null, 2);
        } catch (_) {
          return str;
        }
      })(),
      respawn_minutes: row.respawn_minutes ?? '',
      action_pattern: row.action_pattern != null ? (typeof row.action_pattern === 'string' ? row.action_pattern : JSON.stringify(row.action_pattern)) : '',
    },
    boss_skills: { boss_template_id: row.boss_template_id ?? '', skill_id: row.skill_id ?? '', sort_order: row.sort_order ?? 0 },
  }[type]));

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const [validationError, setValidationError] = useState('');
  const [dropEditorOpen, setDropEditorOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');
    const payload = { ...form };
    if (type === 'boss_templates') {
      payload.location_id = payload.location_id === '' ? null : Number(payload.location_id);
      payload.respawn_minutes = payload.respawn_minutes === '' ? null : Number(payload.respawn_minutes);
      if (payload.drop_table && payload.drop_table.trim()) {
        try {
          const parsed = JSON.parse(payload.drop_table);
          if (!Array.isArray(parsed)) {
            setValidationError('drop_table phải là mảng JSON (ví dụ: [ {...}, {...} ])');
            return;
          }
          payload.drop_table = parsed;
        } catch (_) {
          setValidationError('drop_table không đúng định dạng JSON. Kiểm tra dấu phẩy, ngoặc.');
          return;
        }
      } else payload.drop_table = null;
      payload.action_pattern = (payload.action_pattern != null && String(payload.action_pattern).trim() !== '') ? String(payload.action_pattern).trim() : null;
    }
    if (type === 'boss_skills') {
      payload.boss_template_id = Number(payload.boss_template_id);
      payload.skill_id = Number(payload.skill_id);
      payload.sort_order = Number(payload.sort_order);
    }
    if (type === 'skills') {
      payload.power_multiplier = Number(payload.power_multiplier);
      payload.mana_cost = Number(payload.mana_cost);
      payload.power_min = payload.power_min !== '' && payload.power_min != null ? Number(payload.power_min) : undefined;
      payload.power_max = payload.power_max !== '' && payload.power_max != null ? Number(payload.power_max) : undefined;
      payload.accuracy = payload.accuracy !== '' && payload.accuracy != null ? Number(payload.accuracy) : undefined;
    }
    onSave(payload);
  };

  const title = type === 'skills' ? 'Skill' : type === 'boss_templates' ? 'Boss template' : 'Boss skill';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h4>{mode === 'edit' ? 'Sửa' : 'Thêm'} {title}</h4>
        <form onSubmit={handleSubmit}>
          {type === 'skills' && (
            <>
              <div className="form-row"><label>name *</label><input value={form.name} onChange={e => update('name', e.target.value)} required /></div>
              <div className="form-row"><label>description</label><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} /></div>
              <div className="form-row"><label>type (Boss: attack / defend)</label>
                <select value={form.type} onChange={e => update('type', e.target.value)}>
                  <option value="attack">attack</option>
                  <option value="defend">defend</option>
                </select>
              </div>
              <div className="form-row"><label>power_min, power_max (ma thuật ảo sàn/trần)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="power_min" value={form.power_min} onChange={e => update('power_min', e.target.value)} style={{ width: '80px' }} />
                  <input type="number" placeholder="power_max" value={form.power_max} onChange={e => update('power_max', e.target.value)} style={{ width: '80px' }} />
                </div>
              </div>
              <div className="form-row"><label>accuracy (0-100)</label><input type="number" min="0" max="100" value={form.accuracy} onChange={e => update('accuracy', e.target.value)} /></div>
              <div className="form-row"><label>power_multiplier</label><input type="number" step="0.01" value={form.power_multiplier} onChange={e => update('power_multiplier', e.target.value)} /></div>
              <div className="form-row"><label>effect_type</label><input value={form.effect_type} onChange={e => update('effect_type', e.target.value)} placeholder="Stun, Poison, Burn, Heal..." /></div>
              <div className="form-row"><label>mana_cost</label><input type="number" value={form.mana_cost} onChange={e => update('mana_cost', e.target.value)} /></div>
            </>
          )}
          {type === 'boss_templates' && (
            <>
              <div className="form-row"><label>name *</label><input value={form.name} onChange={e => update('name', e.target.value)} required /></div>
              <div className="form-row"><label>image_url *</label><input value={form.image_url} onChange={e => update('image_url', e.target.value)} required /></div>
              <div className="form-row"><label>level</label><input type="number" value={form.level} onChange={e => update('level', e.target.value)} /></div>
              <div className="form-row"><label>base_hp, base_mp, base_str, base_def, base_intelligence, base_spd</label></div>
              <div className="form-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input type="number" placeholder="base_hp" value={form.base_hp} onChange={e => update('base_hp', e.target.value)} style={{ width: '70px' }} />
                <input type="number" placeholder="base_mp" value={form.base_mp} onChange={e => update('base_mp', e.target.value)} style={{ width: '70px' }} />
                <input type="number" placeholder="base_str" value={form.base_str} onChange={e => update('base_str', e.target.value)} style={{ width: '70px' }} />
                <input type="number" placeholder="base_def" value={form.base_def} onChange={e => update('base_def', e.target.value)} style={{ width: '70px' }} />
                <input type="number" placeholder="base_int" value={form.base_intelligence} onChange={e => update('base_intelligence', e.target.value)} style={{ width: '70px' }} />
                <input type="number" placeholder="base_spd" value={form.base_spd} onChange={e => update('base_spd', e.target.value)} style={{ width: '70px' }} />
              </div>
              <div className="form-row"><label>accuracy (0-100)</label><input type="number" min="0" max="100" value={form.accuracy} onChange={e => update('accuracy', e.target.value)} /></div>
              <div className="form-row"><label>location_id (1=Arena, trống=null)</label><input type="number" value={form.location_id} onChange={e => update('location_id', e.target.value)} /></div>
              <div className="form-row">
                <label>drop_table (JSON)</label>
                <div className="drop-table-row">
                  <textarea
                    value={form.drop_table}
                    onChange={e => update('drop_table', e.target.value)}
                    placeholder={`Ví dụ:
[
  { "item_id": 101, "name": "Kiếm Gỗ", "rate": 45.5, "min_qty": 1, "max_qty": 1 },
  { "item_id": 0, "name": "Peta", "rate": 100, "min_qty": 50, "max_qty": 200 }
]
item_id = 0 là tiền Peta. rate = % rơi (0–100), min_qty/max_qty = số lượng.`}
                    rows={12}
                    className="form-input-drop-table"
                    spellCheck={false}
                  />
                  <button type="button" className="btn btn-primary btn-drop-editor" onClick={() => setDropEditorOpen(true)}>
                    Thêm / sửa drop item
                  </button>
                </div>
                <span className="form-hint">Mỗi dòng: item_id, name, rate (%), min_qty, max_qty. Có thể chỉnh JSON trực tiếp hoặc dùng nút trên.</span>
                {validationError && <span className="form-validation-error">{validationError}</span>}
              </div>
              {dropEditorOpen && (
                <DropTableEditorModal
                  open={dropEditorOpen}
                  currentJson={form.drop_table}
                  onClose={() => setDropEditorOpen(false)}
                  onApply={(newJson) => { update('drop_table', newJson); setDropEditorOpen(false); }}
                  apiBase={API_BASE}
                  token={token}
                />
              )}
              <div className="form-row"><label>respawn_minutes</label><input type="number" value={form.respawn_minutes} onChange={e => update('respawn_minutes', e.target.value)} /></div>
              <div className="form-row"><label>action_pattern (JSON mảng ID skill theo lượt)</label><input value={form.action_pattern} onChange={e => update('action_pattern', e.target.value)} placeholder="[10, 10, 11]" /></div>
            </>
          )}
          {type === 'boss_skills' && (
            <>
              <div className="form-row"><label>boss_template_id *</label><input type="number" value={form.boss_template_id} onChange={e => update('boss_template_id', e.target.value)} required /></div>
              <div className="form-row"><label>skill_id *</label><input type="number" value={form.skill_id} onChange={e => update('skill_id', e.target.value)} required /></div>
              <div className="form-row"><label>sort_order</label><input type="number" value={form.sort_order} onChange={e => update('sort_order', e.target.value)} /></div>
            </>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-save">Lưu</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminNpcBossManagement;
