import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import {
  loadAllCustomMaps,
  upsertCustomMap,
  deleteCustomMap,
  exportCustomMapsJson,
  importCustomMapsJson,
} from '../../utils/huntingMapsStorage';
import { layoutRowsToTiles, tilesToLayoutRows, LAYOUT_LEGEND } from '../../game/map/layoutCodec';
import { mergeRemoteAndLocalHuntingCatalog } from '../../game/map/huntingMapCatalog';
import {
  fetchAdminHuntingMaps,
  createAdminHuntingMap,
  upsertAdminHuntingMap,
  deleteAdminHuntingMap,
} from '../../api/huntingMapsApi';
import { normalizeEncounterPool, encounterPoolToJson } from '../../utils/huntingEncounterPool';
import HuntingEncounterPoolModal from './HuntingEncounterPoolModal';
import './AdminHuntingMapManagement.css';

const DEFAULT_W = 30;
const DEFAULT_H = 20;
const DEFAULT_TILE = 16;

function createRows(w, h, fill = '.') {
  const row = fill.repeat(w);
  return Array.from({ length: h }, () => row);
}

function paintChar(tool) {
  if (tool === 'wall') return '#';
  if (tool === 'encounter') return '*';
  if (tool === 'start') return 'S';
  return '.';
}

function clearOtherStarts(rows, keepX, keepY) {
  return rows.map((line, y) =>
    line
      .split('')
      .map((c, x) => (c === 'S' && !(x === keepX && y === keepY) ? '.' : c))
      .join('')
  );
}

function AdminHuntingMapManagement() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [newMapId, setNewMapId] = useState('');
  const [newMapName, setNewMapName] = useState('');
  const [duplicateTargetId, setDuplicateTargetId] = useState('');

  const [editorName, setEditorName] = useState('');
  const [editorEntryFee, setEditorEntryFee] = useState(0);
  const [editorCurrency, setEditorCurrency] = useState('peta');
  const [editorMaxSteps, setEditorMaxSteps] = useState(100);
  const [editorThumb, setEditorThumb] = useState('');
  const [editorBg, setEditorBg] = useState('/hunting/maps/forest-map.png');
  const [editorFg, setEditorFg] = useState('');
  const [editorTileSize, setEditorTileSize] = useState(DEFAULT_TILE);
  const [editorGridW, setEditorGridW] = useState(DEFAULT_W);
  const [editorGridH, setEditorGridH] = useState(DEFAULT_H);
  const [rows, setRows] = useState(() => createRows(DEFAULT_W, DEFAULT_H));
  const [tool, setTool] = useState('path');
  const [layoutJson, setLayoutJson] = useState('{}');
  const [encounterPoolJson, setEncounterPoolJson] = useState('[]');
  const [encounterPoolModalOpen, setEncounterPoolModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  /** @type {Record<string, import('../../utils/huntingMapsStorage').HuntingMapRecord>} */
  const [serverMapsById, setServerMapsById] = useState({});
  const [serverMapsLoading, setServerMapsLoading] = useState(false);
  const [serverMapsError, setServerMapsError] = useState('');

  const localMaps = useMemo(() => {
    void catalogVersion;
    return loadAllCustomMaps();
  }, [catalogVersion]);
  const mergedMaps = useMemo(() => {
    const out = { ...localMaps };
    for (const [id, m] of Object.entries(serverMapsById)) {
      if (m && id) out[id] = m;
    }
    return out;
  }, [localMaps, serverMapsById]);

  const catalog = useMemo(() => {
    const remoteRows = Object.values(serverMapsById);
    return mergeRemoteAndLocalHuntingCatalog(remoteRows, localMaps);
  }, [serverMapsById, localMaps]);

  const refreshServerMaps = useCallback(async () => {
    const t = user?.token;
    if (!t) {
      setServerMapsById({});
      setServerMapsError('');
      return;
    }
    setServerMapsLoading(true);
    setServerMapsError('');
    try {
      const list = await fetchAdminHuntingMaps(t);
      const byId = {};
      for (const m of list) {
        if (m && m.id) byId[m.id] = m;
      }
      setServerMapsById(byId);
    } catch (e) {
      setServerMapsById({});
      setServerMapsError(e.message || String(e));
    } finally {
      setServerMapsLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.isAdmin && user?.token) {
      refreshServerMaps();
    } else {
      setServerMapsById({});
      setServerMapsError('');
    }
  }, [user?.isAdmin, user?.token, refreshServerMaps]);

  useEffect(() => {
    const onChange = () => setCatalogVersion((v) => v + 1);
    window.addEventListener('petaria-hunting-maps-changed', onChange);
    return () => window.removeEventListener('petaria-hunting-maps-changed', onChange);
  }, []);

  const showMsg = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  function syncLayoutJsonFromState(
    id,
    name,
    entryFee,
    currency,
    maxSteps,
    thumb,
    width,
    height,
    tileSize,
    start,
    assets,
    tiles,
    encounterPoolOverride = null
  ) {
    let encounterPool;
    if (encounterPoolOverride != null) {
      encounterPool = normalizeEncounterPool(encounterPoolOverride);
    } else {
      try {
        encounterPool = normalizeEncounterPool(JSON.parse(encounterPoolJson.trim() || '[]'));
      } catch {
        encounterPool = [];
      }
    }
    const json = {
      id,
      name,
      entryFee,
      currency,
      maxSteps,
      thumb,
      width,
      height,
      tileSize,
      start,
      assets,
      tiles: tiles instanceof Uint8Array ? Array.from(tiles) : tiles,
      encounterPool,
      legend: LAYOUT_LEGEND,
    };
    setLayoutJson(JSON.stringify(json, null, 2));
  }

  function loadEditorFromRecord(rec) {
    const tilesArr = rec.tiles instanceof Uint8Array ? rec.tiles : new Uint8Array(rec.tiles);
    setEditorName(rec.name || rec.id);
    setEditorEntryFee(Number(rec.entryFee) || 0);
    setEditorCurrency(rec.currency || 'peta');
    setEditorMaxSteps(
      rec.maxSteps == null || rec.maxSteps === '' ? 0 : Number(rec.maxSteps) || 100
    );
    setEditorThumb(rec.thumb || '');
    setEditorBg(rec.assets?.background || '');
    setEditorFg(rec.assets?.foreground || '');
    setEditorTileSize(Number(rec.tileSize) || DEFAULT_TILE);
    setEditorGridW(rec.width);
    setEditorGridH(rec.height);
    setRows(tilesToLayoutRows(rec.width, rec.height, tilesArr, rec.start));
    const pool = normalizeEncounterPool(rec.encounterPool);
    setEncounterPoolJson(encounterPoolToJson(pool));
    syncLayoutJsonFromState(
      rec.id,
      rec.name,
      rec.entryFee,
      rec.currency,
      rec.maxSteps,
      rec.thumb,
      rec.width,
      rec.height,
      rec.tileSize,
      rec.start,
      rec.assets,
      tilesArr,
      pool
    );
  }

  function handleSyncLayout() {
    try {
      const parsed = layoutRowsToTiles(rows);
      if (parsed.startCount !== 1) {
        showMsg('Cần đúng 1 ô S (xuất phát). Hiện có: ' + parsed.startCount, 'error');
        return;
      }
      const id = selectedId;
      if (!id || id === 'forest') {
        showMsg('Chọn map custom để sync (forest là built-in).', 'error');
        return;
      }
      const tiles = parsed.tiles;
      const assets = { background: editorBg, foreground: editorFg || undefined };
      syncLayoutJsonFromState(
        id,
        editorName,
        editorEntryFee,
        editorCurrency,
        editorMaxSteps > 0 ? editorMaxSteps : null,
        editorThumb,
        parsed.width,
        parsed.height,
        editorTileSize,
        parsed.start,
        assets,
        tiles
      );
      setEditorGridW(parsed.width);
      setEditorGridH(parsed.height);
      showMsg('Đã sync Layout → JSON. Kiểm tra và bấm Lưu map.', 'success');
    } catch (e) {
      showMsg(e.message || String(e), 'error');
    }
  }

  function handleSaveMap() {
    if (!selectedId || selectedId === 'forest') {
      showMsg('Không thể ghi đè map built-in `forest` từ đây.', 'error');
      return;
    }
    let data;
    try {
      data = JSON.parse(layoutJson);
    } catch (e) {
      showMsg('JSON không hợp lệ: ' + e.message, 'error');
      return;
    }
    let encounterPoolSave;
    try {
      if (data.encounterPool != null) {
        encounterPoolSave = normalizeEncounterPool(data.encounterPool);
      } else {
        encounterPoolSave = normalizeEncounterPool(JSON.parse(encounterPoolJson.trim() || '[]'));
      }
    } catch (e) {
      showMsg('encounterPool JSON không hợp lệ: ' + e.message, 'error');
      return;
    }

    const rawMax = data.maxSteps ?? editorMaxSteps;
    const maxSteps =
      rawMax == null || rawMax === '' || Number(rawMax) <= 0 ? null : Number(rawMax);

    const rec = {
      id: selectedId,
      name: data.name ?? editorName,
      entryFee: Number(data.entryFee ?? editorEntryFee) || 0,
      currency: data.currency || editorCurrency,
      maxSteps,
      thumb: data.thumb ?? editorThumb,
      width: data.width,
      height: data.height,
      tileSize: Number(data.tileSize ?? editorTileSize) || DEFAULT_TILE,
      start: data.start,
      assets: data.assets,
      tiles: data.tiles,
      encounterPool: encounterPoolSave,
    };
    if (!rec.assets?.background) {
      showMsg('Thiếu URL ảnh nền (assets.background).', 'error');
      return;
    }
    if (!Array.isArray(rec.tiles) || rec.tiles.length !== rec.width * rec.height) {
      showMsg('Mảng tiles phải có độ dài width × height.', 'error');
      return;
    }
    try {
      const check = layoutRowsToTiles(rows);
      if (check.startCount !== 1) {
        showMsg('Lưới cần đúng 1 ô S trước khi lưu.', 'error');
        return;
      }
    } catch (e) {
      showMsg(e.message, 'error');
      return;
    }
    const token = user?.token;
    if (token) {
      (async () => {
        try {
          await upsertAdminHuntingMap(token, selectedId, rec);
          upsertCustomMap(rec);
          setEncounterPoolJson(encounterPoolToJson(encounterPoolSave));
          await refreshServerMaps();
          window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
          showMsg('Đã lưu map `' + selectedId + '` lên server (và đồng bộ local).', 'success');
          setCatalogVersion((v) => v + 1);
        } catch (e) {
          upsertCustomMap(rec);
          setEncounterPoolJson(encounterPoolToJson(encounterPoolSave));
          window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
          showMsg(
            'Server lỗi — đã lưu localStorage: ' + (e.message || String(e)),
            'error'
          );
          setCatalogVersion((v) => v + 1);
        }
      })();
      return;
    }
    upsertCustomMap(rec);
    setEncounterPoolJson(encounterPoolToJson(encounterPoolSave));
    window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
    showMsg('Đã lưu map `' + selectedId + '` (localStorage, chưa đăng nhập API).', 'success');
    setCatalogVersion((v) => v + 1);
  }

  const handleCreateMap = () => {
    const id = newMapId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!id || !/^[_a-z0-9]+$/.test(id)) {
      showMsg('map_id chỉ gồm chữ thường, số, gạch dưới (vd: map_normal).', 'error');
      return;
    }
    if (id === 'forest') {
      showMsg('Không dùng id `forest` (reserved).', 'error');
      return;
    }
    if (mergedMaps[id]) {
      showMsg('Map id đã tồn tại (server hoặc local).', 'error');
      return;
    }
    const w = DEFAULT_W;
    const h = DEFAULT_H;
    const newRows = createRows(w, h);
    const sx = Math.floor(w / 2);
    const sy = Math.floor(h / 2);
    const line = newRows[sy].split('');
    line[sx] = 'S';
    newRows[sy] = line.join('');
    const parsed = layoutRowsToTiles(newRows);
    const rec = {
      id,
      name: newMapName.trim() || id,
      entryFee: 0,
      currency: 'peta',
      maxSteps: 100,
      thumb: '',
      width: parsed.width,
      height: parsed.height,
      tileSize: DEFAULT_TILE,
      start: parsed.start,
      assets: { background: '/hunting/maps/forest-map.png' },
      tiles: Array.from(parsed.tiles),
      encounterPool: [],
    };
    const token = user?.token;
    if (token) {
      (async () => {
        try {
          await createAdminHuntingMap(token, rec);
          upsertCustomMap(rec);
          await refreshServerMaps();
          window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
          setNewMapId('');
          setNewMapName('');
          setSelectedId(id);
          loadEditorFromRecord(rec);
          showMsg('Đã tạo map mới trên server. Chỉnh ảnh + lưới rồi Sync & Lưu.', 'success');
          setCatalogVersion((v) => v + 1);
        } catch (e) {
          upsertCustomMap(rec);
          window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
          setNewMapId('');
          setNewMapName('');
          setSelectedId(id);
          loadEditorFromRecord(rec);
          showMsg(
            'Server lỗi — đã tạo chỉ trên localStorage: ' + (e.message || String(e)),
            'error'
          );
          setCatalogVersion((v) => v + 1);
        }
      })();
      return;
    }
    upsertCustomMap(rec);
    window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
    setNewMapId('');
    setNewMapName('');
    setSelectedId(id);
    loadEditorFromRecord(rec);
    showMsg('Đã tạo map mới (localStorage).', 'success');
    setCatalogVersion((v) => v + 1);
  };

  const handleSelectForEdit = (id) => {
    setMessage('');
    setSelectedId(id);
    if (id === 'forest') {
      showMsg(
        'Map `forest` được định nghĩa trong code (`map/forest/`). Để sửa: chỉnh collisions/battleZones/mapData hoặc tạo map custom id khác.',
        'info'
      );
      return;
    }
    const rec = mergedMaps[id];
    if (!rec) {
      showMsg('Không tìm thấy map.', 'error');
      return;
    }
    loadEditorFromRecord(rec);
  };

  const handleDelete = (id) => {
    if (id === 'forest') return;
    if (!window.confirm('Xóa map `' + id + '`? (server nếu có, và local)')) return;
    const token = user?.token;
    const onServer = Boolean(serverMapsById[id]);
    (async () => {
      let serverErr = '';
      if (onServer && token) {
        try {
          await deleteAdminHuntingMap(token, id);
        } catch (e) {
          serverErr = e.message || String(e);
        }
      }
      deleteCustomMap(id);
      await refreshServerMaps();
      window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
      if (selectedId === id) {
        setSelectedId(null);
        setRows(createRows(DEFAULT_W, DEFAULT_H));
        setLayoutJson('{}');
        setEncounterPoolJson('[]');
      }
      setCatalogVersion((v) => v + 1);
      if (serverErr) {
        showMsg('Đã xóa trên máy; xóa server thất bại: ' + serverErr, 'error');
      } else {
        showMsg('Đã xóa.', 'success');
      }
    })();
  };

  const handleDuplicate = () => {
    const nid = duplicateTargetId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!nid || !/^[_a-z0-9]+$/.test(nid)) {
      showMsg('Id đích không hợp lệ.', 'error');
      return;
    }
    if (!selectedId || selectedId === 'forest') {
      showMsg('Chọn map custom để duplicate.', 'error');
      return;
    }
    const src = mergedMaps[selectedId];
    if (!src) return;
    if (mergedMaps[nid]) {
      showMsg('Id đích đã tồn tại.', 'error');
      return;
    }
    const clone = {
      ...JSON.parse(JSON.stringify(src)),
      id: nid,
      name: (src.name || src.id) + ' (copy)',
    };
    const token = user?.token;
    if (token) {
      (async () => {
        try {
          await createAdminHuntingMap(token, clone);
          upsertCustomMap(clone);
          await refreshServerMaps();
          window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
          setDuplicateTargetId('');
          setSelectedId(nid);
          loadEditorFromRecord(clone);
          setCatalogVersion((v) => v + 1);
          showMsg('Đã duplicate sang `' + nid + '` trên server.', 'success');
        } catch (e) {
          upsertCustomMap(clone);
          window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
          setDuplicateTargetId('');
          setSelectedId(nid);
          loadEditorFromRecord(clone);
          setCatalogVersion((v) => v + 1);
          showMsg(
            'Server lỗi — duplicate chỉ local: ' + (e.message || String(e)),
            'error'
          );
        }
      })();
      return;
    }
    upsertCustomMap(clone);
    window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
    setDuplicateTargetId('');
    setSelectedId(nid);
    loadEditorFromRecord(clone);
    setCatalogVersion((v) => v + 1);
    showMsg('Đã duplicate sang `' + nid + '` (local).', 'success');
  };

  const applyResize = () => {
    let w = Math.max(5, Math.min(120, editorGridW));
    let h = Math.max(5, Math.min(120, editorGridH));
    setEditorGridW(w);
    setEditorGridH(h);
    setRows((prev) => {
      const next = [];
      for (let y = 0; y < h; y++) {
        let line = prev[y] || '.'.repeat(w);
        if (line.length > w) line = line.slice(0, w);
        if (line.length < w) line = line + '.'.repeat(w - line.length);
        next.push(line);
      }
      let joined = next.join('');
      if (!joined.includes('S')) {
        next[0] = next[0].slice(0, -1) + 'S';
      }
      return next;
    });
  };

  const onCellClick = (x, y) => {
    if (selectedId === 'forest') return;
    const ch = paintChar(tool);
    const w = editorGridW;
    setRows((prev) => {
      let next = [...prev];
      while (next.length <= y) next.push('.'.repeat(w));
      let line = next[y] || '.'.repeat(w);
      if (line.length < w) line = line + '.'.repeat(w - line.length);
      if (line.length > w) line = line.slice(0, w);
      next[y] = line;
      if (tool === 'start') {
        next = clearOtherStarts(next, x, y);
        line = next[y];
      }
      const chars = line.split('');
      chars[x] = ch;
      next[y] = chars.join('');
      return next;
    });
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importCustomMapsJson(String(reader.result));
        window.dispatchEvent(new CustomEvent('petaria-hunting-maps-changed'));
        setCatalogVersion((v) => v + 1);
        showMsg('Đã import toàn bộ map từ file.', 'success');
      } catch (err) {
        showMsg('Import lỗi: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) return <div className="hmap-admin-loading">Loading…</div>;
  if (!user?.isAdmin) return null;

  const previewUrl = editorThumb || editorBg;

  return (
    <div className="hmap-admin">
      <header className="hmap-admin-header">
        <h1>Admin — Quản lý Map săn</h1>
        <div className="hmap-admin-nav">
          <Link to="/hunting-world">Trang chọn map</Link>
          <Link to="/admin">Về Admin</Link>
          {user?.token && (
            <button type="button" className="hmap-btn sm" disabled={serverMapsLoading} onClick={() => refreshServerMaps()}>
              {serverMapsLoading ? 'Đang tải…' : 'Tải lại từ server'}
            </button>
          )}
        </div>
        {user?.token && serverMapsError && (
          <p className="hmap-server-error" role="alert">
            Không tải được map từ DB: {serverMapsError}. Danh sách hiển thị map local + forest.
          </p>
        )}
      </header>

      <div className="hmap-admin-columns">
        <section className="hmap-admin-list">
          <h2>Danh sách map</h2>
          <div className="hmap-admin-create-row">
            <input
              placeholder="map_id (vd: map_normal)"
              value={newMapId}
              onChange={(e) => setNewMapId(e.target.value)}
            />
            <input
              placeholder="Tên map"
              value={newMapName}
              onChange={(e) => setNewMapName(e.target.value)}
            />
            <button type="button" className="hmap-btn primary" onClick={handleCreateMap}>
              + Tạo map
            </button>
          </div>
          <p className="hmap-hint">
            Ảnh nền mặc định gợi ý: đặt file dưới <code>public/hunting/maps/</code> và nhập URL{' '}
            <code>/hunting/maps/&lt;id&gt;.png</code>. Kích thước ảnh nên = <code>width×tileSize</code> ×{' '}
            <code>height×tileSize</code> px.
          </p>
          <table className="hmap-table">
            <thead>
              <tr>
                <th>Map ID</th>
                <th>Tên</th>
                <th>Vé vào</th>
                <th>Max steps</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code>{row.id}</code>{' '}
                    {row.builtIn && <span className="hmap-badge">built-in</span>}
                    {row._localOnly && <span className="hmap-badge hmap-badge--local">chỉ local</span>}
                  </td>
                  <td>{row.name}</td>
                  <td>
                    {row.entryFee} {row.currency}
                  </td>
                  <td>
                    {row.builtIn ? '—' : row.maxSteps == null ? '∞' : row.maxSteps}
                  </td>
                  <td>
                    <button type="button" className="hmap-btn sm" onClick={() => handleSelectForEdit(row.id)}>
                      Sửa
                    </button>
                    {!row.builtIn && (
                      <button type="button" className="hmap-btn sm danger" onClick={() => handleDelete(row.id)}>
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="hmap-admin-editor">
          <h2>{selectedId ? `Sửa map: ${selectedId}` : 'Chọn map để sửa'}</h2>

          {selectedId === 'forest' && (
            <p className="hmap-note">
              Built-in: dữ liệu lưới lấy từ <code>src/game/map/forest/</code>. Xem tài liệu{' '}
              <code>petaria/HUNTING_MAP_ADMIN_WORKFLOW.md</code>.
            </p>
          )}

          {selectedId && selectedId !== 'forest' && (
            <>
              <div className="hmap-duplicate">
                <input
                  placeholder="map_id mới khi duplicate"
                  value={duplicateTargetId}
                  onChange={(e) => setDuplicateTargetId(e.target.value)}
                />
                <button type="button" className="hmap-btn" onClick={handleDuplicate}>
                  Duplicate
                </button>
              </div>

              <div className="hmap-form-grid">
                <label>
                  Tên map
                  <input value={editorName} onChange={(e) => setEditorName(e.target.value)} />
                </label>
                <label>
                  Vé vào
                  <input
                    type="number"
                    value={editorEntryFee}
                    onChange={(e) => setEditorEntryFee(Number(e.target.value))}
                  />
                </label>
                <label>
                  Loại tiền
                  <select value={editorCurrency} onChange={(e) => setEditorCurrency(e.target.value)}>
                    <option value="peta">peta</option>
                    <option value="petagold">petagold</option>
                  </select>
                </label>
                <label>
                  Max steps (0 = không giới hạn)
                  <input
                    type="number"
                    min={0}
                    value={editorMaxSteps}
                    onChange={(e) => setEditorMaxSteps(Number(e.target.value))}
                  />
                </label>
                <label>
                  thumb (tùy chọn, preview)
                  <input value={editorThumb} onChange={(e) => setEditorThumb(e.target.value)} placeholder="/hunting/maps/thumb.png" />
                </label>
                <label>
                  tileSize (px)
                  <input
                    type="number"
                    value={editorTileSize}
                    onChange={(e) => setEditorTileSize(Number(e.target.value))}
                  />
                </label>
                <label>
                  Ảnh nền (URL public)
                  <input value={editorBg} onChange={(e) => setEditorBg(e.target.value)} />
                </label>
                <label>
                  Ảnh foreground (tùy chọn)
                  <input
                    value={editorFg}
                    onChange={(e) => setEditorFg(e.target.value)}
                    placeholder="trống = dùng chung nền"
                  />
                </label>
              </div>

              <div className="hmap-resize">
                <label>
                  width (ô)
                  <input type="number" value={editorGridW} onChange={(e) => setEditorGridW(Number(e.target.value))} />
                </label>
                <label>
                  height (ô)
                  <input type="number" value={editorGridH} onChange={(e) => setEditorGridH(Number(e.target.value))} />
                </label>
                <button type="button" className="hmap-btn" onClick={applyResize}>
                  Áp kích thước lưới
                </button>
              </div>

              <div className="hmap-tools">
                <span>Công cụ:</span>
                <button type="button" className={tool === 'path' ? 'active' : ''} onClick={() => setTool('path')}>
                  Đường (.)
                </button>
                <button type="button" className={tool === 'wall' ? 'active' : ''} onClick={() => setTool('wall')}>
                  Tường (#)
                </button>
                <button type="button" className={tool === 'encounter' ? 'active' : ''} onClick={() => setTool('encounter')}>
                  Gặp pet (*)
                </button>
                <button type="button" className={tool === 'start' ? 'active' : ''} onClick={() => setTool('start')}>
                  Start (S)
                </button>
                <button type="button" className="hmap-btn primary" onClick={handleSyncLayout}>
                  Sync → Layout JSON
                </button>
                <button type="button" className="hmap-btn success" onClick={handleSaveMap}>
                  Lưu map
                </button>
              </div>
              <p className="hmap-legend">{LAYOUT_LEGEND}</p>

              <div className="hmap-visual-wrap">
                <div
                  className={'hmap-visual' + (previewUrl ? '' : ' no-bg')}
                  style={{
                    backgroundImage: previewUrl ? `url(${previewUrl})` : undefined,
                    aspectRatio: `${editorGridW} / ${editorGridH}`,
                    width: `max(100%, ${Math.max(editorGridW * 14, 280)}px)`,
                  }}
                >
                  <div
                    className="hmap-cell-grid"
                    style={{
                      gridTemplateColumns: `repeat(${editorGridW}, 1fr)`,
                      gridTemplateRows: `repeat(${editorGridH}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: editorGridH }, (_, y) =>
                      Array.from({ length: editorGridW }, (_, x) => {
                        const line = rows[y] ?? '';
                        const cell = line[x] ?? '.';
                        return (
                          <button
                            type="button"
                            key={`${x}-${y}`}
                            className={
                              'hmap-cell ' +
                              (cell === '#'
                                ? 'wall'
                                : cell === '*'
                                ? 'encounter'
                                : cell === 'S'
                                ? 'start'
                                : 'path')
                            }
                            title={`${x},${y} = ${cell}`}
                            onClick={() => onCellClick(x, y)}
                          />
                        );
                      })
                    ).flat()}
                  </div>
                </div>
                <div className="hmap-visual-caption">
                  {previewUrl ? previewUrl : 'Nhập URL ảnh nền để lưới khớp hình (hoặc vẽ trên nền xám)'}
                </div>
              </div>

              <div className="hmap-encounter-section">
                <h3 className="hmap-encounter-title">Bảng gặp gỡ (ô *)</h3>
                <p className="hmap-hint">
                  Pet species + item theo trọng số <code>rate</code> (giống drop Boss). Để <code>[]</code> = encounter mặc định
                  (WILD_PETS / forest). JSON nằm trong Layout khi bấm Sync; có thể sửa riêng ô dưới hoặc mở modal.
                </p>
                <div className="hmap-encounter-actions">
                  <button type="button" className="hmap-btn primary" onClick={() => setEncounterPoolModalOpen(true)}>
                    Thêm / sửa encounter (modal)
                  </button>
                </div>
                <label className="hmap-json-label">
                  encounterPool JSON
                  <textarea
                    value={encounterPoolJson}
                    onChange={(e) => setEncounterPoolJson(e.target.value)}
                    spellCheck={false}
                    rows={8}
                    placeholder='[{"kind":"species","species_id":1,"name":"...","image":"a.png","rarity":"common","description":"","rate":50}]'
                  />
                </label>
              </div>

              <label className="hmap-json-label">
                Layout JSON (auto / chỉnh tay)
                <textarea value={layoutJson} onChange={(e) => setLayoutJson(e.target.value)} spellCheck={false} rows={14} />
              </label>

              <div className="hmap-io">
                <button
                  type="button"
                  className="hmap-btn"
                  onClick={() => {
                    const blob = new Blob([exportCustomMapsJson()], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'petaria-hunting-maps.json';
                    a.click();
                  }}
                >
                  Export tất cả map (JSON)
                </button>
                <label className="hmap-file">
                  Import JSON
                  <input type="file" accept=".json,application/json" onChange={handleImportFile} />
                </label>
              </div>
            </>
          )}
        </section>
      </div>

      {message && <div className={'hmap-toast ' + messageType}>{message}</div>}

      <HuntingEncounterPoolModal
        open={encounterPoolModalOpen}
        currentJson={encounterPoolJson}
        onClose={() => setEncounterPoolModalOpen(false)}
        onApply={(json) => setEncounterPoolJson(json)}
        token={user?.token}
      />
    </div>
  );
}

export default AdminHuntingMapManagement;
