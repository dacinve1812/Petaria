import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminHuntingCatchRates.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function AdminHuntingCatchRates() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [saving, setSaving] = useState(false);
  const [failText, setFailText] = useState('');
  const [feedText, setFeedText] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user?.token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/admin/hunting-catch-config`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || r.statusText);
        setCfg(data);
        setFailText((data.failMessages || []).join('\n'));
        setFeedText((data.feedMessages || []).join('\n'));
      } catch (e) {
        setMsg(e.message || String(e));
        setMsgType('error');
      }
    })();
  }, [user?.token]);

  if (isLoading) return <div className="hcatch-admin">Loading…</div>;
  if (!user?.isAdmin) return null;
  if (!cfg) {
    return (
      <div className="hcatch-admin">
        <p>{msg || 'Đang tải cấu hình…'}</p>
        <Link to="/admin">← Admin</Link>
      </div>
    );
  }

  const show = (text, type = 'info') => {
    setMsg(text);
    setMsgType(type);
  };

  const updateNet = (code, field, value) => {
    setCfg((prev) => ({
      ...prev,
      nets: {
        ...prev.nets,
        [code]: { ...prev.nets[code], [field]: value },
      },
    }));
  };

  const updateFood = (rarity, value) => {
    setCfg((prev) => ({
      ...prev,
      foodBonusByRarity: { ...prev.foodBonusByRarity, [rarity]: Number(value) },
    }));
  };

  const updateCatchPenalty = (rarity, value) => {
    setCfg((prev) => ({
      ...prev,
      catchPenaltyByRarity: {
        ...(prev.catchPenaltyByRarity || {}),
        [rarity]: Number(value),
      },
    }));
  };

  const updateFleeRow = (idx, field, value) => {
    setCfg((prev) => {
      const rows = [...(prev.fleeByFeedCount || [])];
      rows[idx] = { ...rows[idx], [field]: Number(value) };
      return { ...prev, fleeByFeedCount: rows };
    });
  };

  const addFleeRow = () => {
    setCfg((prev) => ({
      ...prev,
      fleeByFeedCount: [...(prev.fleeByFeedCount || []), { minFeeds: 0, rate: 5 }],
    }));
  };

  const removeFleeRow = (idx) => {
    setCfg((prev) => ({
      ...prev,
      fleeByFeedCount: (prev.fleeByFeedCount || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...cfg,
        failMessages: failText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        feedMessages: feedText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      };
      const r = await fetch(`${API_BASE}/api/admin/hunting-catch-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || r.statusText);
      setCfg(data);
      setFailText((data.failMessages || []).join('\n'));
      setFeedText((data.feedMessages || []).join('\n'));
      show('Đã lưu cấu hình bắt pet.', 'success');
    } catch (e) {
      show(e.message || String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset về mặc định?')) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/hunting-catch-config/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || r.statusText);
      setCfg(data);
      setFailText((data.failMessages || []).join('\n'));
      setFeedText((data.feedMessages || []).join('\n'));
      show('Đã reset mặc định.', 'success');
    } catch (e) {
      show(e.message || String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const netCodes = Object.keys(cfg.nets || {}).sort();

  return (
    <div className="hcatch-admin">
      <header className="hcatch-header">
        <h1>Quản lý tỉ lệ bắt pet</h1>
        <div className="hcatch-nav">
          <Link to="/admin/hunting-maps">Map săn</Link>
          <Link to="/admin">Admin</Link>
        </div>
      </header>

      {msg && <p className={`hcatch-msg ${msgType}`}>{msg}</p>}

      <section className="hcatch-section">
        <h2>Tỉ lệ lưới (success %)</h2>
        <table className="hcatch-table">
          <thead>
            <tr>
              <th>item_code</th>
              <th>Key</th>
              <th>Label</th>
              <th>Success %</th>
            </tr>
          </thead>
          <tbody>
            {netCodes.map((code) => (
              <tr key={code}>
                <td>
                  <code>{code}</code>
                </td>
                <td>
                  <input
                    value={cfg.nets[code].key || ''}
                    onChange={(e) => updateNet(code, 'key', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={cfg.nets[code].label || ''}
                    onChange={(e) => updateNet(code, 'label', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={cfg.nets[code].successRate}
                    onChange={(e) => updateNet(code, 'successRate', Number(e.target.value))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="hcatch-section">
        <h2>Bonus thức ăn theo rarity (%)</h2>
        <div className="hcatch-grid">
          {['common', 'uncommon', 'rare', 'epic', 'legendary'].map((r) => (
            <label key={r}>
              {r}
              <input
                type="number"
                min={0}
                step={0.1}
                value={cfg.foodBonusByRarity?.[r] ?? 0}
                onChange={(e) => updateFood(r, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="hcatch-section">
        <h2>Trừ tỉ lệ bắt theo rarity pet (%)</h2>
        <p className="hcatch-hint">
          Trừ khỏi tỉ lệ lưới trước khi cộng bonus thức ăn. Common = 0 (giữ nguyên). Ví dụ rare −10% → lưới
          30% còn 20% + food bonus.
        </p>
        <div className="hcatch-grid">
          {['common', 'uncommon', 'rare', 'epic', 'legendary'].map((r) => (
            <label key={r}>
              {r}
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={cfg.catchPenaltyByRarity?.[r] ?? 0}
                onChange={(e) => updateCatchPenalty(r, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="hcatch-section">
        <h2>Rủi ro chạy khi cho ăn</h2>
        <p className="hcatch-hint">
          Theo số lần đã cho ăn. Thêm: mỗi lần ném lưới thất bại +{' '}
          <strong>fleePerFailedCatch</strong>%.
        </p>
        <table className="hcatch-table">
          <thead>
            <tr>
              <th>min feeds</th>
              <th>flee %</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(cfg.fleeByFeedCount || []).map((row, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.minFeeds}
                    onChange={(e) => updateFleeRow(i, 'minFeeds', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.rate}
                    onChange={(e) => updateFleeRow(i, 'rate', e.target.value)}
                  />
                </td>
                <td>
                  <button type="button" className="hcatch-btn danger" onClick={() => removeFleeRow(i)}>
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="hcatch-btn" onClick={addFleeRow}>
          + Thêm mốc
        </button>
        <div className="hcatch-grid" style={{ marginTop: 12 }}>
          <label>
            fleePerFailedCatch (%)
            <input
              type="number"
              min={0}
              value={cfg.fleePerFailedCatch ?? 0}
              onChange={(e) =>
                setCfg((p) => ({ ...p, fleePerFailedCatch: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            maxFleeRate (%)
            <input
              type="number"
              min={0}
              max={100}
              value={cfg.maxFleeRate ?? 50}
              onChange={(e) => setCfg((p) => ({ ...p, maxFleeRate: Number(e.target.value) }))}
            />
          </label>
          <label>
            maxCatchChance (%)
            <input
              type="number"
              min={1}
              max={100}
              value={cfg.maxCatchChance ?? 95}
              onChange={(e) => setCfg((p) => ({ ...p, maxCatchChance: Number(e.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="hcatch-section">
        <h2>Text thất bại (mỗi dòng 1 câu, dùng {'{petName}'})</h2>
        <textarea
          className="hcatch-textarea"
          rows={12}
          value={failText}
          onChange={(e) => setFailText(e.target.value)}
        />
      </section>

      <section className="hcatch-section">
        <h2>Text cho ăn thành công (mỗi dòng 1 câu, dùng {'{petName}'})</h2>
        <textarea
          className="hcatch-textarea"
          rows={8}
          value={feedText}
          onChange={(e) => setFeedText(e.target.value)}
        />
      </section>

      <div className="hcatch-actions">
        <button type="button" className="hcatch-btn primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
        <button type="button" className="hcatch-btn" disabled={saving} onClick={handleReset}>
          Reset mặc định
        </button>
      </div>
    </div>
  );
}

export default AdminHuntingCatchRates;
