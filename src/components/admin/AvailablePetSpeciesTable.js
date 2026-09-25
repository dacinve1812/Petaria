import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const ITEMS_PER_PAGE = 30;
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legend', 'mythic'];
const PET_TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];
const STAT_KEYS = ['base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd'];
const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legend: 5, mythic: 6 };
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

const emptyRow = () => ({
  key: '',
  name: '',
  image: '',
  imageUrl: '',
  previewUrl: '',
  type: '',
  description: '',
  rarity: 'common',
  base_hp: 10,
  base_mp: 10,
  base_str: 10,
  base_def: 10,
  base_intelligence: 10,
  base_spd: 10,
  evolve_to: '',
  matchedName: null,
  statSource: 'default',
  alreadyAdded: false,
});

function totalStats(row) {
  return STAT_KEYS.reduce((s, k) => s + (Number(row?.[k]) || 0), 0);
}

function typeOptions(current) {
  const extra = String(current || '').trim();
  return extra && !PET_TYPES.includes(extra) ? [extra, ...PET_TYPES] : PET_TYPES;
}

function compareValues(a, b, key, dir) {
  const mul = dir === 'asc' ? 1 : -1;
  if (key === 'total') return (totalStats(a) - totalStats(b)) * mul;
  if (key === 'rarity') return ((RARITY_RANK[a.rarity] || 0) - (RARITY_RANK[b.rarity] || 0)) * mul;
  if (STAT_KEYS.includes(key)) return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * mul;
  return String(a[key] || '').localeCompare(String(b[key] || ''), 'en', { sensitivity: 'base' }) * mul;
}

function SortTh({ label, col, sortKey, sortDir, onSort }) {
  const active = sortKey === col;
  return (
    <th className={active ? 'sort-th active' : 'sort-th'} onClick={() => onSort(col)}>
      {label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

function toPayload(row) {
  return {
    name: String(row.name || '').trim(),
    image: String(row.image || '').trim(),
    type: row.type ?? '',
    description: row.description ?? '',
    rarity: row.rarity || 'common',
    base_hp: row.base_hp,
    base_mp: row.base_mp,
    base_str: row.base_str,
    base_def: row.base_def,
    base_intelligence: row.base_intelligence,
    base_spd: row.base_spd,
    evolve_to: row.evolve_to || null,
  };
}

function AvailablePetSpeciesTable({ token, existingList, onAdded, showMsg }) {
  const folderInputRef = useRef(null);
  const localFilesRef = useRef([]);
  const blobUrlsRef = useRef([]);

  const [rows, setRows] = useState([]);
  const [source, setSource] = useState('server');
  const [folderLabel, setFolderLabel] = useState('public/images/pets');
  const [excelFile, setExcelFile] = useState('');
  const [deduped, setDeduped] = useState([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [addingKey, setAddingKey] = useState('');
  const [generatingKey, setGeneratingKey] = useState('');
  const [autoGenKey, setAutoGenKey] = useState('');
  const [addingAll, setAddingAll] = useState(false);

  const revokeBlobs = () => {
    blobUrlsRef.current.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch (_) { /* ignore */ }
    });
    blobUrlsRef.current = [];
  };

  useEffect(() => () => revokeBlobs(), []);

  const existingIndex = useMemo(() => {
    const byImage = new Set();
    (existingList || []).forEach((s) => {
      if (s?.image) byImage.add(String(s.image).trim().toLowerCase());
    });
    return { byImage };
  }, [existingList]);

  const applyAlreadyAdded = useCallback(
    (list) =>
      list.map((r) => ({
        ...r,
        alreadyAdded: existingIndex.byImage.has(String(r.image || '').toLowerCase()),
      })),
    [existingIndex]
  );

  useEffect(() => {
    setRows((prev) => (prev.length ? applyAlreadyAdded(prev) : prev));
  }, [applyAlreadyAdded]);

  const ingestDrafts = (data, extra = {}) => {
    const drafts = Array.isArray(data.drafts) ? data.drafts : [];
    setExcelFile(data.excelFile || '');
    setDeduped(Array.isArray(data.deduped) ? data.deduped : []);
    setRows(applyAlreadyAdded(drafts.map((d) => ({ ...emptyRow(), ...d, ...extra[d.image] }))));
    setCurrentPage(1);
  };

  const fetchServerFolder = async () => {
    if (!token) return;
    setLoading(true);
    revokeBlobs();
    localFilesRef.current = [];
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species/local-scan?folder=images/pets`, {
        headers: authHeaders(token),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Không fetch được folder');
      setSource('server');
      setFolderLabel('public/images/pets');
      ingestDrafts(data);
      const n = (data.drafts || []).length;
      const matched = data.matched || 0;
      const dup = (data.deduped || []).length;
      showMsg(
        `Fetch ${n} pet. Khớp Excel: ${matched}. Gộp trùng tên: ${dup}.` +
          (data.excelFile ? ` File: ${data.excelFile}` : ' (không thấy file Excel)'),
        data.excelFile ? 'success' : 'error'
      );
    } catch (e) {
      showMsg(e.message || 'Lỗi fetch', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFromLocalFiles = async (fileList, label) => {
    if (!token) return;
    const files = Array.from(fileList || []).filter((f) => {
      if (!IMAGE_RE.test(f.name)) return false;
      const rel = f.webkitRelativePath || '';
      const parts = rel.split(/[/\\]/).filter(Boolean);
      return parts.length <= 2;
    });
    if (!files.length) {
      showMsg('Folder không có file ảnh (png/jpg/svg/webp/gif).', 'error');
      return;
    }
    setLoading(true);
    revokeBlobs();
    localFilesRef.current = files;
    const previewByImage = {};
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      blobUrlsRef.current.push(url);
      previewByImage[f.name] = { previewUrl: url };
    });
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species/local-drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          files: files.map((f) => ({ name: f.name, size: f.size })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Không tạo được draft');
      setSource('local');
      setFolderLabel(label || 'folder local');
      ingestDrafts(data, previewByImage);
      const n = (data.drafts || []).length;
      showMsg(`Fetch local ${n} pet. Khớp Excel: ${data.matched || 0}.`, 'success');
    } catch (e) {
      showMsg(e.message || 'Lỗi folder local', 'error');
    } finally {
      setLoading(false);
    }
  };

  const pickLocalFolder = async () => {
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker();
        const files = [];
        for await (const entry of dir.values()) {
          if (entry.kind !== 'file') continue;
          const file = await entry.getFile();
          if (IMAGE_RE.test(file.name)) files.push(file);
        }
        await fetchFromLocalFiles(files, dir.name);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    folderInputRef.current?.click();
  };

  const onFolderInput = (e) => {
    const list = e.target.files;
    if (list && list.length) {
      const first = list[0];
      const label = first.webkitRelativePath ? first.webkitRelativePath.split('/')[0] : 'folder local';
      fetchFromLocalFiles(list, label);
    }
    e.target.value = '';
  };

  const refresh = () => {
    if (source === 'local' && localFilesRef.current.length) {
      fetchFromLocalFiles(localFilesRef.current, folderLabel);
      return;
    }
    fetchServerFolder();
  };

  const updateRow = (key, patch) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const generateRow = async (row) => {
    if (!token) return;
    setGeneratingKey(row.key);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species/generate-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ name: row.name, image: row.image }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Lỗi generate');
      const g = (data.results && data.results[0]) || {};
      updateRow(row.key, {
        base_hp: g.base_hp,
        base_mp: g.base_mp,
        base_str: g.base_str,
        base_def: g.base_def,
        base_intelligence: g.base_intelligence,
        base_spd: g.base_spd,
        type: g.type || row.type,
        rarity: g.rarity || row.rarity,
        description: g.description != null && g.description !== '' ? g.description : row.description,
        matchedName: g.matchedName,
        statSource: g.statSource,
        name: g.matchedName || row.name,
      });
      showMsg(
        g.matchedName ? `Đã generate từ Excel: ${g.matchedName}` : 'Không khớp Excel — dùng stat mặc định.',
        g.matchedName ? 'success' : 'error'
      );
    } catch (e) {
      showMsg(e.message || 'Lỗi generate', 'error');
    } finally {
      setGeneratingKey('');
    }
  };

  const autoGenerateRow = async (row) => {
    if (!token) return;
    setAutoGenKey(row.key);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species/auto-generate-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ rarity: row.rarity }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Lỗi Auto generate');
      const g = (data.results && data.results[0]) || {};
      const patch = { statSource: g.statSource || 'auto' };
      STAT_KEYS.forEach((k) => { if (g[k] != null) patch[k] = g[k]; });
      updateRow(row.key, patch);
      showMsg(`Auto generate ${row.name || ''}: total ${g.targetTotal || totalStats({ ...row, ...patch })} (rarity ${row.rarity || 'common'}).`);
    } catch (e) {
      showMsg(e.message || 'Lỗi Auto generate', 'error');
    } finally {
      setAutoGenKey('');
    }
  };

  const toggleSort = (col) => {
    setCurrentPage(1);
    setSortKey((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(col === 'total' || STAT_KEYS.includes(col) || col === 'rarity' ? 'desc' : 'asc');
      return col;
    });
  };

  const addRow = async (row) => {
    const payload = toPayload(row);
    if (!payload.name || !payload.image) {
      showMsg('Thiếu name hoặc image.', 'error');
      return;
    }
    setAddingKey(row.key);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Lỗi thêm');
      updateRow(row.key, { alreadyAdded: true });
      showMsg(`Đã thêm ${payload.name}.`);
      if (onAdded) onAdded();
    } catch (e) {
      showMsg(e.message || 'Lỗi thêm', 'error');
    } finally {
      setAddingKey('');
    }
  };

  const addAll = async () => {
    const pending = rows.filter((r) => !r.alreadyAdded && String(r.name || '').trim() && String(r.image || '').trim());
    if (!pending.length) {
      showMsg('Không còn pet nào để Add all.', 'error');
      return;
    }
    if (!window.confirm(`Thêm ${pending.length} pet vào pet_species?`)) return;
    setAddingAll(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pet-species/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ species: pending.map(toPayload) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'Lỗi Add all');
      const addedImages = new Set((data.items || []).map((it) => String(it.image || '').toLowerCase()));
      setRows((prev) =>
        prev.map((row) =>
          addedImages.has(String(row.image || '').toLowerCase()) ? { ...row, alreadyAdded: true } : row
        )
      );
      const failN = (data.failed || []).length;
      showMsg(`Add all: ${data.inserted || 0} thêm${failN ? `, ${failN} lỗi` : ''}.`, failN ? 'error' : 'success');
      if (onAdded) onAdded();
    } catch (e) {
      showMsg(e.message || 'Lỗi Add all', 'error');
    } finally {
      setAddingAll(false);
    }
  };

  const filtered = rows
    .filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.image && r.image.toLowerCase().includes(q)) ||
        (r.matchedName && r.matchedName.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => compareValues(a, b, sortKey, sortDir));
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const pendingCount = rows.filter((r) => !r.alreadyAdded).length;

  return (
    <div className="section-card available-pet-card">
      <h3>Available pet species (local fetch)</h3>
      <div className="section-actions">
        <button type="button" className="btn btn-primary" onClick={fetchServerFolder} disabled={loading}>
          {loading ? 'Đang fetch...' : 'Fetch'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={pickLocalFolder} disabled={loading}>
          Chọn folder
        </button>
        <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>
          Refresh
        </button>
        <button type="button" className="btn btn-primary" onClick={addAll} disabled={addingAll || !pendingCount}>
          {addingAll ? 'Đang thêm...' : `Add all (${pendingCount})`}
        </button>
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: 'none' }}
          onChange={onFolderInput}
        />
        <span className="avail-folder-meta">
          Folder: <strong>{folderLabel}</strong>
          {excelFile ? <> · Excel: <strong>{excelFile}</strong></> : null}
        </span>
      </div>
      <p className="avail-help">
        Quét ảnh trong folder (mặc định <code>public/images/pets</code>). Trùng tên (charmander.svg / .png / .jpg) giữ file nhỏ hơn.
        Bỏ qua Excel/doc. Fetch tự điền stat từ workbook; <strong>Generate</strong> khớp Excel theo tên;
        <strong> Auto generate</strong> random stat trong min–max / total của rarity để không lệch.
      </p>
      {deduped.length > 0 && (
        <p className="avail-help avail-dedupe">
          Đã gộp {deduped.length} nhóm trùng tên, giữ file nhỏ hơn
          {deduped.slice(0, 4).map((d) => ` (${d.chosen})`).join('')}
          {deduped.length > 4 ? '…' : ''}.
        </p>
      )}
      <div className="pet-species-controls">
        <input
          type="text"
          placeholder="Tìm available pet theo tên..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pet-species-search"
        />
        <span className="pet-species-total">Tổng: {filtered.length}</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
            <thead>
              <tr>
                <th className="col-actions">Thao tác</th>
                <th>id</th>
                <th>Hình</th>
                <SortTh label="name" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="image" col="image" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="type" col="type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="rarity" col="rarity" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Total" col="total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="base_hp" col="base_hp" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="base_mp" col="base_mp" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="base_str" col="base_str" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="base_def" col="base_def" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="base_intelligence" col="base_intelligence" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="base_spd" col="base_spd" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="evolve_to" col="evolve_to" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={15} className="avail-empty">
                  {loading ? 'Đang tải...' : 'Chưa có dữ liệu. Bấm Fetch hoặc Chọn folder.'}
                </td>
              </tr>
            ) : paginated.map((r) => {
              const thumb = r.previewUrl || r.imageUrl || (r.image ? `/images/pets/${encodeURIComponent(r.image)}` : '');
              return (
                <tr key={r.key} className={r.alreadyAdded ? 'avail-row-exist' : undefined}>
                  <td className="col-actions">
                    <div className="cell-actions">
                      <button
                        type="button"
                        className="btn-add-row"
                        disabled={r.alreadyAdded || addingKey === r.key}
                        onClick={() => addRow(r)}
                      >
                        {r.alreadyAdded ? 'Đã có' : addingKey === r.key ? '...' : 'Add'}
                      </button>
                      <button
                        type="button"
                        className="btn-generate"
                        disabled={generatingKey === r.key}
                        title={r.statSource || 'Khớp stat từ Excel theo tên'}
                        onClick={() => generateRow(r)}
                      >
                        {generatingKey === r.key ? '...' : 'Generate'}
                      </button>
                      <button
                        type="button"
                        className="btn-auto-gen"
                        disabled={autoGenKey === r.key}
                        title="Random stat theo min-max / total của rarity"
                        onClick={() => autoGenerateRow(r)}
                      >
                        {autoGenKey === r.key ? '...' : 'Auto generate'}
                      </button>
                    </div>
                    {r.matchedName ? (
                      <div className="avail-source">Excel: {r.matchedName}</div>
                    ) : r.statSource === 'auto' ? (
                      <div className="avail-source">Auto generate</div>
                    ) : (
                      <div className="avail-source">Chưa khớp Excel</div>
                    )}
                  </td>
                  <td>—</td>
                  <td className="pet-species-thumb-cell">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="pet-species-thumb"
                        onError={(e) => { e.target.src = '/images/pets/default.png'; e.target.onerror = null; }}
                      />
                    ) : (
                      <span className="pet-species-thumb-empty">—</span>
                    )}
                  </td>
                  <td>
                    <input className="avail-input" value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value })} />
                  </td>
                  <td>
                    <input className="avail-input avail-input-image" value={r.image} onChange={(e) => updateRow(r.key, { image: e.target.value })} />
                  </td>
                  <td>
                    <select className="avail-input" value={r.type || ''} onChange={(e) => updateRow(r.key, { type: e.target.value })}>
                      <option value="">—</option>
                      {typeOptions(r.type).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="avail-input" value={r.rarity} onChange={(e) => updateRow(r.key, { rarity: e.target.value })}>
                      {RARITIES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="pet-species-total-cell">{totalStats(r)}</td>
                  {STAT_KEYS.map((k) => (
                    <td key={k}>
                      <input
                        className="avail-input avail-input-num"
                        type="number"
                        value={r[k]}
                        onChange={(e) => updateRow(r.key, { [k]: e.target.value })}
                      />
                    </td>
                  ))}
                  <td>
                    <input className="avail-input avail-input-sm" value={r.evolve_to} onChange={(e) => updateRow(r.key, { evolve_to: e.target.value })} placeholder="[2,3]" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination-wrap">
          <button type="button" className="btn-page" disabled={page <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Trước</button>
          <span className="pagination-info">Trang {page} / {totalPages}</span>
          <button type="button" className="btn-page" disabled={page >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Sau</button>
        </div>
      )}
    </div>
  );
}

export default AvailablePetSpeciesTable;
