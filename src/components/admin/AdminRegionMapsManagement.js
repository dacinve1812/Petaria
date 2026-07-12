import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import { fetchAdminHuntingMaps } from '../../api/huntingMapsApi';
import './AdminConfigPage.css';
import './AdminRegionMapsManagement.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const PATH_PRESETS = [
  { value: '/', label: '/ — Confirm săn (mặc định)' },
  { value: '/game-center/beggar-king', label: '/game-center/beggar-king — Làng Phú Gia / Vua ăn mày' },
  { value: '/game-center/daily-free', label: '/game-center/daily-free — Làng Nhân Ái / Quà miễn phí' },
  { value: '/game-center/guess-number', label: '/game-center/guess-number — Làng Trẻ Con / Đoán số' },
  { value: '/game-center/slot-machine', label: '/game-center/slot-machine — Làng Đỏ Đen / Máy đánh bạc' },
  { value: '/game-center', label: '/game-center — Trung tâm giải trí' },
  { value: '/tasks/spirit-fusion', label: '/tasks/spirit-fusion' },
  { value: '/tasks/item-hunt', label: '/tasks/item-hunt' },
  { value: '/tasks/monster-hunt', label: '/tasks/monster-hunt' },
];

function syncSpotFields(region, spotId, patch) {
  const id = String(spotId);
  const touch = (list, nameKey) => {
    if (!Array.isArray(list)) return list;
    return list.map((item) => {
      if (String(item.id) !== id) return item;
      const next = { ...item, ...patch };
      if (patch.name != null && nameKey === 'label' && next.label == null) {
        next.label = patch.name;
      }
      if (patch.label != null && nameKey === 'name' && next.name == null) {
        next.name = patch.label;
      }
      return next;
    });
  };
  region.originalCoordinates = touch(region.originalCoordinates, 'name');
  region.mapButtons = touch(region.mapButtons, 'label');
}

function getRegionSpots(region) {
  const areas = Array.isArray(region?.originalCoordinates) ? region.originalCoordinates : [];
  const buttons = Array.isArray(region?.mapButtons) ? region.mapButtons : [];
  const byId = new Map();

  areas.forEach((a) => {
    byId.set(String(a.id), {
      id: a.id,
      name: a.name || '',
      path: a.path || '/',
      huntingMapId: a.huntingMapId || '',
      hasArea: true,
      hasButton: false,
    });
  });
  buttons.forEach((b) => {
    const key = String(b.id);
    const prev = byId.get(key) || {
      id: b.id,
      name: '',
      path: '/',
      huntingMapId: '',
      hasArea: false,
      hasButton: false,
    };
    byId.set(key, {
      ...prev,
      name: prev.name || b.label || b.name || '',
      path: b.path != null && b.path !== '' ? b.path : prev.path,
      huntingMapId: b.huntingMapId || prev.huntingMapId || '',
      hasButton: true,
    });
  });

  return Array.from(byId.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

function AdminRegionMapsManagement() {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [regionId, setRegionId] = useState('3-2');
  const [huntingMaps, setHuntingMaps] = useState([]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) navigate('/login');
  }, [user, isLoading, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/region-maps/config`);
      const data = await r.json();
      setDraft(data);
      setRegionId((prev) => {
        const regions = data?.regions || [];
        if (regions.some((x) => x.id === prev)) return prev;
        return regions[0]?.id || prev;
      });
    } catch (e) {
      setErr(e.message || 'Không tải được cấu hình');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) load();
  }, [user?.isAdmin, load]);

  useEffect(() => {
    if (!user?.token || !user?.isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await fetchAdminHuntingMaps(user.token);
        if (!cancelled) setHuntingMaps(Array.isArray(maps) ? maps : []);
      } catch {
        if (!cancelled) setHuntingMaps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.token, user?.isAdmin]);

  const save = async () => {
    if (!user?.token || !draft) return;
    setSaving(true);
    setErr('');
    setOk('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/region-maps/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(draft),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setDraft(data.config || draft);
      setOk('Đã lưu cấu hình Region maps.');
    } catch (e) {
      setErr(e.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const patch = (fn) => {
    setDraft((d) => {
      const next = JSON.parse(JSON.stringify(d));
      fn(next);
      return next;
    });
  };

  const regions = draft?.regions || [];
  const activeRegion = useMemo(
    () => regions.find((r) => r.id === regionId) || null,
    [regions, regionId],
  );
  const spots = useMemo(() => getRegionSpots(activeRegion), [activeRegion]);

  const huntingMapOptions = useMemo(() => {
    const ids = new Set(huntingMaps.map((m) => String(m.id)));
    spots.forEach((s) => {
      if (s.huntingMapId && !ids.has(s.huntingMapId)) ids.add(s.huntingMapId);
    });
    const fromApi = huntingMaps.map((m) => ({
      id: String(m.id),
      name: m.name || m.id,
    }));
    const extras = Array.from(ids)
      .filter((id) => !huntingMaps.some((m) => String(m.id) === id))
      .map((id) => ({ id, name: id }));
    return [...fromApi, ...extras].sort((a, b) => a.id.localeCompare(b.id));
  }, [huntingMaps, spots]);

  if (isLoading || loading || !draft) {
    return (
      <div className="admin-config-page rm-admin">
        <div className="admin-header">
          <div className="header-text">
            <h1>Quản lý Region maps</h1>
            <p>{isLoading || loading ? 'Đang tải...' : 'Không có dữ liệu.'}</p>
          </div>
          <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
            ← Quay lại Admin
          </button>
        </div>
        {err && <p style={{ color: 'coral' }}>{err}</p>}
      </div>
    );
  }

  return (
    <div className="admin-config-page rm-admin">
      <div className="admin-header">
        <div className="header-text">
          <h1>Quản lý Region maps</h1>
          <p>
            Chỉnh path (đi đâu khi click spot) và huntingMapId (map săn khi path = /). Ví dụ Làng Phú
            Gia → /game-center/beggar-king. Lưu vào DB; client lấy qua GET /api/region-maps/config.
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
            ← Quay lại Admin
          </button>
        </div>
      </div>

      {err && <p style={{ color: 'coral' }}>{err}</p>}
      {ok && <p style={{ color: '#15803d' }}>{ok}</p>}

      <div className="section-card">
        <div className="rm-admin__toolbar">
          <button type="button" className="gc-admin__btn gc-admin__btn--ghost" onClick={load}>
            Tải lại
          </button>
          <button type="button" className="gc-admin__btn" onClick={save} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
          <Link to="/admin/hunting-maps" className="gc-admin__btn gc-admin__btn--ghost">
            Map săn
          </Link>
        </div>

        <div className="gc-admin__row">
          <label>
            Region
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {activeRegion ? (
          <>
            <p className="gc-admin__help">
              <strong>{activeRegion.name}</strong>
              {activeRegion.description ? ` — ${activeRegion.description}` : ''}
              {' · '}
              <Link to={`/region/${activeRegion.id}`} target="_blank" rel="noreferrer">
                Xem region
              </Link>
            </p>

            {spots.length === 0 ? (
              <p className="gc-admin__help">Region này chưa có spot (coords/buttons trống).</p>
            ) : (
              <div className="rm-admin__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tên spot</th>
                      <th>Path (đi đâu)</th>
                      <th>Hunting map ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spots.map((spot) => (
                      <tr key={spot.id}>
                        <td>{spot.id}</td>
                        <td>
                          <input
                            type="text"
                            className="rm-admin__name-input"
                            value={spot.name}
                            onChange={(e) => {
                              const name = e.target.value;
                              patch((d) => {
                                const region = d.regions.find((r) => r.id === regionId);
                                if (!region) return;
                                syncSpotFields(region, spot.id, { name, label: name });
                              });
                            }}
                          />
                        </td>
                        <td>
                          <div className="rm-admin__path-cell">
                            <select
                              value={
                                PATH_PRESETS.some((p) => p.value === spot.path)
                                  ? spot.path
                                  : '__custom__'
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '__custom__') return;
                                patch((d) => {
                                  const region = d.regions.find((r) => r.id === regionId);
                                  if (!region) return;
                                  syncSpotFields(region, spot.id, { path: v });
                                });
                              }}
                            >
                              {PATH_PRESETS.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                              <option value="__custom__">Tùy chỉnh…</option>
                            </select>
                            <input
                              type="text"
                              placeholder="/game-center/beggar-king"
                              value={spot.path}
                              onChange={(e) => {
                                const path = e.target.value;
                                patch((d) => {
                                  const region = d.regions.find((r) => r.id === regionId);
                                  if (!region) return;
                                  syncSpotFields(region, spot.id, { path });
                                });
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="rm-admin__path-cell">
                            <select
                              value={spot.huntingMapId || ''}
                              onChange={(e) => {
                                const huntingMapId = e.target.value;
                                patch((d) => {
                                  const region = d.regions.find((r) => r.id === regionId);
                                  if (!region) return;
                                  syncSpotFields(region, spot.id, { huntingMapId });
                                });
                              }}
                            >
                              <option value="">— Không gán —</option>
                              {huntingMapOptions.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.id}
                                  {m.name && m.name !== m.id ? ` — ${m.name}` : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="lang_phu_gia"
                              value={spot.huntingMapId}
                              onChange={(e) => {
                                const huntingMapId = e.target.value;
                                patch((d) => {
                                  const region = d.regions.find((r) => r.id === regionId);
                                  if (!region) return;
                                  syncSpotFields(region, spot.id, { huntingMapId });
                                });
                              }}
                            />
                          </div>
                          {spot.path === '/' || !spot.path ? (
                            <span className="rm-admin__hint">Dùng khi path = / (confirm săn)</span>
                          ) : (
                            <span className="rm-admin__hint">
                              Path trực tiếp — huntingMapId không dùng cho navigate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default AdminRegionMapsManagement;
