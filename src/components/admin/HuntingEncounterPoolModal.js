import React, { useEffect, useState, useMemo } from 'react';
import { normalizeEncounterPool, encounterPoolToJson } from '../../utils/huntingEncounterPool';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function itemImageSrc(imageUrl) {
  if (!imageUrl) return '/images/equipments/placeholder.png';
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/images/equipments/${imageUrl}`;
}

function speciesImageSrc(imageFile) {
  if (!imageFile) return '/images/pets/default.png';
  return `/images/pets/${imageFile}`;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.currentJson
 * @param {() => void} props.onClose
 * @param {(json: string) => void} props.onApply
 * @param {string} [props.token]
 */
export default function HuntingEncounterPoolModal({ open, currentJson, onClose, onApply, token }) {
  const [rows, setRows] = useState([]);
  const [jsonText, setJsonText] = useState('[]');
  const [speciesList, setSpeciesList] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(null);
  const [searchPick, setSearchPick] = useState('');

  useEffect(() => {
    if (!open) return;
    const r = normalizeEncounterPool(currentJson);
    setRows(r);
    setJsonText(encounterPoolToJson(r));
    setPicker(null);
    setSearchPick('');
  }, [open, currentJson]);

  useEffect(() => {
    if (!open) return;
    setJsonText(encounterPoolToJson(rows));
  }, [rows, open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/admin/pet-species`, { headers: authHeaders(token) }).then((r) => r.json()),
      fetch(`${API_BASE}/api/admin/items`, { headers: authHeaders(token) }).then((r) => r.json()),
    ])
      .then(([sp, it]) => {
        setSpeciesList(Array.isArray(sp) ? sp : []);
        setItemsList(Array.isArray(it) ? it : []);
      })
      .catch(() => {
        setSpeciesList([]);
        setItemsList([]);
      })
      .finally(() => setLoading(false));
  }, [open, token]);

  const filteredSpecies = useMemo(() => {
    const q = searchPick.trim().toLowerCase();
    if (!q) return speciesList;
    return speciesList.filter(
      (s) =>
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.id).includes(q) ||
        String(s.type || '').toLowerCase().includes(q)
    );
  }, [speciesList, searchPick]);

  const filteredItems = useMemo(() => {
    const q = searchPick.trim().toLowerCase();
    if (!q) return itemsList;
    return itemsList.filter(
      (it) => String(it.name || '').toLowerCase().includes(q) || String(it.id).includes(q)
    );
  }, [itemsList, searchPick]);

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

  const addSpecies = (s) => {
    setRows((prev) => [
      ...prev,
      {
        kind: 'species',
        species_id: s.id,
        name: s.name || `Species ${s.id}`,
        image: s.image || '',
        rarity: (s.rarity || 'common').toString(),
        description: (s.description || '').toString(),
        rate: 10,
      },
    ]);
    setPicker(null);
  };

  const addItem = (it) => {
    setRows((prev) => [
      ...prev,
      {
        kind: 'item',
        item_id: it.id,
        name: it.name || `Item ${it.id}`,
        image_url: it.image_url || '',
        rate: 10,
        min_qty: 1,
        max_qty: 1,
      },
    ]);
    setPicker(null);
  };

  const handleJsonSyncToRows = () => {
    try {
      setRows(normalizeEncounterPool(jsonText));
    } catch {
      setRows(normalizeEncounterPool('[]'));
    }
  };

  const handleApply = () => {
    const normalized = normalizeEncounterPool(jsonText);
    onApply(encounterPoolToJson(normalized));
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay hmap-enc-overlay" onClick={onClose}>
      <div className="modal-box hmap-enc-modal" onClick={(e) => e.stopPropagation()}>
        <h4>Bảng gặp gỡ (ô *) — Species &amp; Item</h4>
        <p className="hmap-enc-hint">
          Rate: trọng số tương đối (giống drop Boss). Mảng rỗng <code>[]</code> → game dùng encounter mặc định zone forest.
        </p>

        <div className="hmap-enc-toolbar">
          <button type="button" className="hmap-btn primary sm" onClick={() => setPicker('species')} disabled={loading}>
            + Thêm species
          </button>
          <button type="button" className="hmap-btn primary sm" onClick={() => setPicker('item')} disabled={loading}>
            + Thêm item
          </button>
          <button type="button" className="hmap-btn success sm" onClick={handleApply}>
            Áp dụng → JSON
          </button>
          <button type="button" className="hmap-btn sm" onClick={onClose}>
            Đóng
          </button>
        </div>

        {loading && <p className="hmap-enc-loading">Đang tải danh sách từ API…</p>}

        <div className="hmap-enc-table-wrap">
          <table className="hmap-enc-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Ảnh</th>
                <th>Tên / id</th>
                <th>Rate</th>
                <th>min–max qty</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="hmap-enc-empty">
                    Chưa có dòng — thêm từ API hoặc dán JSON rồi &quot;Đồng bộ JSON → bảng&quot;.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.kind}-${i}`}>
                    <td>
                      {r.kind === 'species' ? (
                        <span className="hmap-enc-badge sp">Pet</span>
                      ) : (
                        <span className="hmap-enc-badge it">Item</span>
                      )}
                    </td>
                    <td>
                      <img
                        src={r.kind === 'species' ? speciesImageSrc(r.image) : itemImageSrc(r.image_url)}
                        alt=""
                        className="hmap-enc-thumb"
                        onError={(e) => {
                          e.target.src =
                            r.kind === 'species' ? '/images/pets/default.png' : '/images/equipments/placeholder.png';
                        }}
                      />
                    </td>
                    <td>
                      <div className="hmap-enc-name">{r.name}</div>
                      <div className="hmap-enc-id">
                        {r.kind === 'species' ? `species_id ${r.species_id}` : `item_id ${r.item_id}`}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className="hmap-enc-num"
                        value={r.rate}
                        onChange={(e) => updateRow(i, 'rate', e.target.value)}
                      />
                    </td>
                    <td>
                      {r.kind === 'item' ? (
                        <span className="hmap-enc-qty">
                          <input
                            type="number"
                            min="1"
                            className="hmap-enc-num sm"
                            value={r.min_qty}
                            onChange={(e) => updateRow(i, 'min_qty', e.target.value)}
                          />
                          <span>–</span>
                          <input
                            type="number"
                            min="1"
                            className="hmap-enc-num sm"
                            value={r.max_qty}
                            onChange={(e) => updateRow(i, 'max_qty', e.target.value)}
                          />
                        </span>
                      ) : (
                        <span className="hmap-enc-dash">—</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="hmap-btn danger sm" onClick={() => removeRow(i)}>
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <label className="hmap-enc-json-label">
          JSON (chỉnh tay / paste file — sau đó đồng bộ hoặc Áp dụng)
          <textarea
            rows={8}
            spellCheck={false}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="hmap-enc-json"
          />
        </label>
        <button type="button" className="hmap-btn sm" onClick={handleJsonSyncToRows}>
          Đồng bộ JSON → bảng
        </button>

        {picker && (
          <div className="hmap-enc-picker-overlay" onClick={() => setPicker(null)}>
            <div className="hmap-enc-picker" onClick={(ev) => ev.stopPropagation()}>
              <div className="hmap-enc-picker-head">
                <h5>{picker === 'species' ? 'Chọn Pet Species' : 'Chọn Item'}</h5>
                <input
                  type="search"
                  placeholder="Tìm…"
                  value={searchPick}
                  onChange={(e) => setSearchPick(e.target.value)}
                  className="hmap-enc-search"
                />
                <button type="button" className="hmap-btn sm" onClick={() => setPicker(null)}>
                  Đóng
                </button>
              </div>
              <div className="hmap-enc-picker-grid">
                {picker === 'species'
                  ? filteredSpecies.map((s) => (
                      <button key={s.id} type="button" className="hmap-enc-pick-card" onClick={() => addSpecies(s)}>
                        <img
                          src={speciesImageSrc(s.image)}
                          alt=""
                          onError={(e) => {
                            e.target.src = '/images/pets/default.png';
                          }}
                        />
                        <span>{s.name}</span>
                        <small>#{s.id}</small>
                      </button>
                    ))
                  : filteredItems.map((it) => (
                      <button key={it.id} type="button" className="hmap-enc-pick-card" onClick={() => addItem(it)}>
                        <img src={itemImageSrc(it.image_url)} alt="" />
                        <span>{it.name}</span>
                        <small>#{it.id}</small>
                      </button>
                    ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
