import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import {
  BATTLE_FX_ADMIN_PATH,
  BATTLE_FX_ATTACK_ANIM_ID,
  BATTLE_FX_DEFEND_ANIM_ID,
  BATTLE_FX_PUBLIC_DIR,
  FX_NAME_SUGGESTIONS,
  loadBattleFxCatalogAsync,
  saveBattleFxCatalogAsync,
  resetBattleFxCatalogAsync,
  createEmptyFxEntry,
  sanitizeFxEntry,
  suggestFxNames,
  buildSearchLinks,
  resolveBattleFxImageUrl,
  cssBackgroundUrl,
  isBattleFxPublicPath,
  slugify,
  idbDeleteFxImage,
  getNextBattleFxNumId,
} from '../../data/battleFxCatalog';
import './AdminConfigPage.css';
import './AdminBattleFxPage.css';

const CATEGORIES = Object.keys(FX_NAME_SUGGESTIONS);

function frameGridPositions(cols, rows, frameCount) {
  const cells = [];
  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (row >= rows) break;
    cells.push({
      index: i,
      col,
      row,
      label: `F${i + 1}`,
      // CSS background-position for sprite sheets (n-1 formula)
      posX: cols <= 1 ? 0 : (col / (cols - 1)) * 100,
      posY: rows <= 1 ? 0 : (row / (rows - 1)) * 100,
    });
  }
  return cells;
}

function FxPreview({ entry, playing, onDone }) {
  const url = resolveBattleFxImageUrl(entry);
  const cells = frameGridPositions(entry.cols, entry.rows, entry.frameCount);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!playing || !entry || cells.length === 0) {
      setFrame(0);
      return undefined;
    }
    const per = Math.max(16, Math.round(entry.durationMs / cells.length));
    let i = 0;
    let intervalId = null;
    setFrame(0);

    const delayId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        i += 1;
        if (i >= cells.length) {
          window.clearInterval(intervalId);
          intervalId = null;
          setFrame(cells.length - 1);
          onDone?.();
          return;
        }
        setFrame(i);
      }, per);
    }, entry.delayMs || 0);

    return () => {
      window.clearTimeout(delayId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [
    playing,
    entry?.id,
    entry?.durationMs,
    entry?.delayMs,
    entry?.frameCount,
    entry?.cols,
    entry?.rows,
    cells.length,
    onDone,
  ]);

  if (!url) {
    return <div className="abfx-preview__empty">Chưa có ảnh — upload PNG/WebP sprite sheet</div>;
  }

  const cell = cells[Math.min(frame, cells.length - 1)] || cells[0];
  const style = {
    backgroundImage: cssBackgroundUrl(url),
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${entry.cols * 100}% ${entry.rows * 100}%`,
    backgroundPosition: `${cell.posX}% ${cell.posY}%`,
    mixBlendMode: entry.blendMode === 'normal' ? 'normal' : entry.blendMode,
  };

  return (
    <div className="abfx-preview__stage">
      <div className="abfx-preview__pet" aria-hidden />
      <div className="abfx-preview__fx" style={style} />
      <div className="abfx-preview__meta">
        Frame {cell.index + 1}/{entry.frameCount} · {entry.durationMs}ms
        {entry.delayMs ? ` · delay ${entry.delayMs}ms` : ''}
      </div>
    </div>
  );
}

function SpriteSheetGridViewer({ entry }) {
  const url = resolveBattleFxImageUrl(entry);
  const cols = Math.max(1, Number(entry?.cols) || 1);
  const rows = Math.max(1, Number(entry?.rows) || 1);
  const frameCount = Math.max(1, Math.min(cols * rows, Number(entry?.frameCount) || cols * rows));
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setNatural({ w: 0, h: 0 });
  }, [url]);

  if (!url) {
    return (
      <div className="abfx-sheet__empty">Upload sprite sheet để xem lưới chia frame (như đường đỏ).</div>
    );
  }

  const cellW = natural.w > 0 ? Math.round(natural.w / cols) : null;
  const cellH = natural.h > 0 ? Math.round(natural.h / rows) : null;

  return (
    <div className="abfx-sheet">
      <div className="abfx-sheet__wrap">
        <img
          src={url}
          alt="Sprite sheet"
          className="abfx-sheet__img"
          onLoad={(e) =>
            setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
        />
        <div
          className="abfx-sheet__grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {Array.from({ length: cols * rows }).map((_, i) => {
            const active = i < frameCount;
            const col = i % cols;
            const row = Math.floor(i / cols);
            return (
              <div
                key={i}
                className={`abfx-sheet__cell${active ? ' abfx-sheet__cell--on' : ' abfx-sheet__cell--off'}`}
                style={{
                  borderLeft: col === 0 ? '2px solid #ef4444' : undefined,
                  borderTop: row === 0 ? '2px solid #ef4444' : undefined,
                }}
              >
                <span className="abfx-sheet__label">{active ? `F${i + 1}` : '·'}</span>
                <span className="abfx-sheet__coord">
                  {col},{row}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="abfx-sheet__info">
        {natural.w > 0 ? (
          <>
            Ảnh <strong>{natural.w}×{natural.h}</strong>
            {cellW && cellH ? (
              <>
                {' '}
                · mỗi frame ~<strong>{cellW}×{cellH}px</strong>
              </>
            ) : null}
            {' '}
            · lưới <strong>{cols}×{rows}</strong> · dùng <strong>{frameCount}</strong> frame
          </>
        ) : (
          <>Đang đo kích thước ảnh…</>
        )}
      </p>
    </div>
  );
}

function AdminBattleFxPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useUser();
  const [catalog, setCatalog] = useState({ version: 1, animations: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(() => createEmptyFxEntry());
  const [playing, setPlaying] = useState(false);
  const [flash, setFlash] = useState('');
  const [suggestCat, setSuggestCat] = useState('electric');
  const [suggestSeed, setSuggestSeed] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.isAdmin) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Clear any bloated localStorage left from older builds
        try {
          const raw = localStorage.getItem('petaria-battle-fx-catalog');
          if (raw && raw.length > 1_500_000) {
            localStorage.removeItem('petaria-battle-fx-catalog');
          }
        } catch {
          /* ignore */
        }
        const loaded = await loadBattleFxCatalogAsync();
        if (cancelled) return;
        setCatalog(loaded);
        if (loaded.animations[0]) {
          setSelectedId(loaded.animations[0].id);
          setDraft({ ...loaded.animations[0] });
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => catalog.animations.find((a) => a.id === selectedId) || null,
    [catalog, selectedId]
  );

  const gridCells = useMemo(
    () => frameGridPositions(draft.cols, draft.rows, draft.frameCount),
    [draft.cols, draft.rows, draft.frameCount]
  );

  const suggestions = useMemo(
    () => suggestFxNames(suggestCat, suggestSeed),
    [suggestCat, suggestSeed]
  );

  const searchLinks = useMemo(
    () => buildSearchLinks(suggestSeed || draft.name || draft.id || 'vfx sprite sheet'),
    [suggestSeed, draft.name, draft.id]
  );

  const showFlash = (msg) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 2600);
  };

  const selectAnim = (id) => {
    const found = catalog.animations.find((a) => a.id === id);
    if (!found) return;
    setSelectedId(id);
    setDraft({ ...found });
    setPlaying(false);
  };

  const updateDraft = (patch) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      // keep frameCount in bounds when grid changes
      if (patch.cols != null || patch.rows != null || patch.frameCount != null) {
        const cols = Math.max(1, Number(next.cols) || 1);
        const rows = Math.max(1, Number(next.rows) || 1);
        const max = cols * rows;
        next.cols = cols;
        next.rows = rows;
        next.frameCount = Math.max(1, Math.min(max, Number(next.frameCount) || max));
      }
      return next;
    });
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|webp|gif|jpeg|jpg)$/i.test(file.type) && !/\.(png|webp|gif|jpe?g)$/i.test(file.name)) {
      showFlash('Chỉ hỗ trợ PNG / WebP / GIF / JPG');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateDraft({
        imageUrl: String(reader.result || ''),
        builtInAssetKey: null,
        hasIdbImage: false,
      });
      showFlash(
        `Đã load ảnh: ${file.name}. Save → IndexedDB. Nên copy vào ${BATTLE_FX_PUBLIC_DIR}/ và dán path bên dưới để battle ổn định.`
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveOne = async () => {
    try {
      const cleaned = sanitizeFxEntry(
        {
          ...draft,
          numId:
            draft.numId != null && Number(draft.numId) >= 1
              ? Math.round(Number(draft.numId))
              : catalog.animations.find((a) => a.id === selectedId)?.numId ??
                undefined,
          updatedAt: new Date().toISOString(),
        },
        draft.id
      );
      const nextAnims = [...catalog.animations];
      if (selectedId && selectedId !== cleaned.id) {
        const oldIdx = nextAnims.findIndex((a) => a.id === selectedId);
        if (oldIdx >= 0) nextAnims.splice(oldIdx, 1);
        await idbDeleteFxImage(selectedId);
      }
      // Nếu numId trùng animation khác → đổi chỗ (swap) để battle #1/#7 không bị lệch
      const conflictIdx = nextAnims.findIndex(
        (a) => a.id !== cleaned.id && Number(a.numId) === Number(cleaned.numId)
      );
      if (conflictIdx >= 0) {
        const prevNum =
          catalog.animations.find((a) => a.id === (selectedId || cleaned.id))?.numId ??
          getNextBattleFxNumId({ animations: nextAnims.filter((a) => a.id !== cleaned.id) });
        nextAnims[conflictIdx] = { ...nextAnims[conflictIdx], numId: prevNum };
      }
      const existing = nextAnims.findIndex((a) => a.id === cleaned.id);
      if (existing >= 0) nextAnims[existing] = cleaned;
      else nextAnims.push(cleaned);

      const saved = await saveBattleFxCatalogAsync({ ...catalog, animations: nextAnims });
      setCatalog(saved);
      const savedEntry = saved.animations.find((a) => a.id === cleaned.id) || cleaned;
      setSelectedId(cleaned.id);
      setDraft({ ...savedEntry });
      const viaPublic = isBattleFxPublicPath(savedEntry.imageUrl);
      showFlash(
        viaPublic
          ? `Đã lưu #${savedEntry.numId} — ảnh public path: ${savedEntry.imageUrl}`
          : `Đã lưu #${savedEntry.numId} \`${cleaned.id}\` (ảnh IndexedDB — nên dùng path ${BATTLE_FX_PUBLIC_DIR}/…)`
      );
    } catch (err) {
      console.error(err);
      showFlash(err?.message || 'Lưu thất bại. Hard refresh rồi thử lại.');
    }
  };

  const handleAddNew = () => {
    const empty = createEmptyFxEntry(catalog);
    setDraft(empty);
    setSelectedId(null);
    setPlaying(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm(`Xóa animation "${selectedId}"?`)) return;
    await idbDeleteFxImage(selectedId);
    const next = catalog.animations.filter((a) => a.id !== selectedId);
    const saved = await saveBattleFxCatalogAsync({ ...catalog, animations: next });
    setCatalog(saved);
    if (saved.animations[0]) selectAnim(saved.animations[0].id);
    else {
      setSelectedId(null);
      setDraft(createEmptyFxEntry(saved));
    }
    showFlash('Đã xóa');
  };

  const handleResetAll = async () => {
    if (!window.confirm('Reset toàn bộ catalog về mặc định repo?')) return;
    const fresh = await resetBattleFxCatalogAsync();
    setCatalog(fresh);
    if (fresh.animations[0]) selectAnim(fresh.animations[0].id);
    showFlash('Đã reset catalog');
  };

  const handleExport = () => {
    // Export metadata; omit huge data URLs to keep file small
    const light = {
      ...catalog,
      animations: (catalog.animations || []).map((a) => ({
        ...a,
        imageUrl:
          a.imageUrl && String(a.imageUrl).startsWith('data:')
            ? null
            : a.imageUrl,
        hasIdbImage: Boolean(a.hasIdbImage || (a.imageUrl && String(a.imageUrl).startsWith('data:'))),
      })),
    };
    const blob = new Blob([JSON.stringify(light, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'battle-fx-catalog.json';
    a.click();
    URL.revokeObjectURL(url);
    showFlash('Export metadata (ảnh data-URL không nhét vào JSON)');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const saved = await saveBattleFxCatalogAsync(parsed);
        setCatalog(saved);
        if (saved.animations[0]) selectAnim(saved.animations[0].id);
        showFlash('Đã import catalog');
      } catch {
        showFlash('JSON không hợp lệ');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applySuggestion = (s) => {
    updateDraft({
      id: s.id,
      name: s.name,
      nameVi: s.nameVi || '',
      tags: Array.from(new Set([...(draft.tags || []), suggestCat])),
    });
  };

  const onPreviewDone = useCallback(() => setPlaying(false), []);

  if (authLoading || loadingCatalog) return <div className="admin-config-page">Loading...</div>;
  if (!user?.isAdmin) return null;

  return (
    <div className="admin-config-page abfx-page">
      <div className="admin-header">
        <div className="header-text">
          <h1>Battle FX / Skill Animations</h1>
          <p>
            Quản lý sprite-sheet (PNG/WebP). Battle chọn theo <strong>Num ID</strong> (tấn công #
            {BATTLE_FX_ATTACK_ANIM_ID}, phòng thủ #{BATTLE_FX_DEFEND_ANIM_ID}).
            <br />
            <strong>Save trong admin chỉ lưu trình duyệt này.</strong> Để lên server không mất: Export
            JSON → ghi đè <code>{BATTLE_FX_PUBLIC_DIR}/catalog.json</code> rồi commit/deploy.
          </p>
        </div>
        <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Admin
        </button>
      </div>

      <div className="abfx-layout">
        <aside className="abfx-list">
          <div className="abfx-list__head">
            <h2>Animations</h2>
            <button type="button" className="abfx-btn abfx-btn--sm" onClick={handleAddNew}>
              + Thêm
            </button>
          </div>
          <ul className="abfx-list__ul">
            {catalog.animations.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`abfx-list__item${selectedId === a.id ? ' abfx-list__item--on' : ''}`}
                  onClick={() => selectAnim(a.id)}
                >
                  <strong>#{a.numId} {a.name}</strong>
                  <span>{a.id}</span>
                  {!a.enabled ? <em>off</em> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="abfx-list__actions">
            <button type="button" className="abfx-btn" onClick={handleExport}>
              Export JSON
            </button>
            <label className="abfx-btn abfx-btn--file">
              Import JSON
              <input type="file" accept="application/json,.json" hidden onChange={handleImport} />
            </label>
            <button type="button" className="abfx-btn abfx-btn--danger" onClick={handleResetAll}>
              Reset mặc định
            </button>
          </div>
        </aside>

        <section className="abfx-editor">
          <div className="abfx-editor__grid">
            <div className="abfx-fields">
              <h2>{selected ? `Sửa: #${selected.numId} ${selected.id}` : 'Animation mới'}</h2>

              <label className="abfx-field">
                <span>Num ID (battle / skills.animation_id)</span>
                <input
                  type="number"
                  min={1}
                  value={draft.numId ?? ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    updateDraft({ numId: Number.isFinite(n) && n >= 1 ? n : draft.numId });
                  }}
                  title="Battle: tấn công/weapon = #1, khiên/phòng thủ = #7"
                />
              </label>
              <p className="abfx-hint">
                Battle luôn gọi theo số: tấn công / weapon → <strong>#{BATTLE_FX_ATTACK_ANIM_ID}</strong>,
                khiên / phòng thủ → <strong>#{BATTLE_FX_DEFEND_ANIM_ID}</strong> (không theo slug).
                Đổi Lightning sang #9 thì đánh thường dùng animation đang là #{BATTLE_FX_ATTACK_ANIM_ID}.
                Trùng numId khi Save sẽ swap với animation kia.
              </p>
              <label className="abfx-field">
                <span>Slug ID (nội bộ catalog)</span>
                <input
                  value={draft.id}
                  onChange={(e) => updateDraft({ id: slugify(e.target.value) || draft.id })}
                />
              </label>
              <div className="abfx-row">
                <label className="abfx-field">
                  <span>Name</span>
                  <input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} />
                </label>
                <label className="abfx-field">
                  <span>Tên VI</span>
                  <input
                    value={draft.nameVi}
                    onChange={(e) => updateDraft({ nameVi: e.target.value })}
                  />
                </label>
              </div>

              <label className="abfx-field">
                <span>Tags (comma)</span>
                <input
                  value={(draft.tags || []).join(', ')}
                  onChange={(e) =>
                    updateDraft({
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim().toLowerCase())
                        .filter(Boolean),
                    })
                  }
                />
              </label>

              <label className="abfx-field">
                <span>Sprite sheet — Upload (lưu IndexedDB)</span>
                <input type="file" accept="image/png,image/webp,image/gif,image/jpeg" onChange={handleUpload} />
              </label>
              <label className="abfx-field">
                <span>Hoặc đường dẫn public (khuyến nghị cho battle)</span>
                <input
                  type="text"
                  placeholder={`${BATTLE_FX_PUBLIC_DIR}/ten-file.png`}
                  value={isBattleFxPublicPath(draft.imageUrl) ? draft.imageUrl : ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    updateDraft({
                      imageUrl: v || null,
                      builtInAssetKey: null,
                      hasIdbImage: false,
                    });
                  }}
                />
              </label>
              <p className="abfx-hint">
                Chỉ đặt file vào <code>public{BATTLE_FX_PUBLIC_DIR}</code> là chưa đủ — phải dán path vào ô
                trên (vd <code>{BATTLE_FX_PUBLIC_DIR}/sword-slash.png</code>) rồi Save. Path public ổn định hơn
                IndexedDB khi đánh trận.
              </p>
              {draft.builtInAssetKey ? (
                <p className="abfx-hint">Đang dùng asset built-in: {draft.builtInAssetKey}</p>
              ) : null}
              {!isBattleFxPublicPath(draft.imageUrl) && resolveBattleFxImageUrl(draft) ? (
                <p className="abfx-hint">Đang có ảnh IndexedDB/data-URL trong bộ nhớ — preview OK.</p>
              ) : null}

              <div className="abfx-row abfx-row--4">
                <label className="abfx-field">
                  <span>Cols</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={draft.cols}
                    onChange={(e) => updateDraft({ cols: Number(e.target.value) })}
                  />
                </label>
                <label className="abfx-field">
                  <span>Rows</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={draft.rows}
                    onChange={(e) => updateDraft({ rows: Number(e.target.value) })}
                  />
                </label>
                <label className="abfx-field">
                  <span>Frames</span>
                  <input
                    type="number"
                    min={1}
                    max={draft.cols * draft.rows}
                    value={draft.frameCount}
                    onChange={(e) => updateDraft({ frameCount: Number(e.target.value) })}
                  />
                </label>
                <label className="abfx-field">
                  <span>Duration (ms)</span>
                  <input
                    type="number"
                    min={80}
                    max={5000}
                    step={10}
                    value={draft.durationMs}
                    onChange={(e) => updateDraft({ durationMs: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="abfx-row">
                <label className="abfx-field">
                  <span>Delay trước khi chạy (ms)</span>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    step={10}
                    value={draft.delayMs}
                    onChange={(e) => updateDraft({ delayMs: Number(e.target.value) })}
                  />
                </label>
                <label className="abfx-field">
                  <span>Blend mode</span>
                  <select
                    value={draft.blendMode}
                    onChange={(e) => updateDraft({ blendMode: e.target.value })}
                  >
                    <option value="normal">normal (PNG trong suốt)</option>
                    <option value="screen">screen (nền đen)</option>
                    <option value="plus-lighter">plus-lighter</option>
                    <option value="lighten">lighten</option>
                  </select>
                </label>
              </div>
              <p className="abfx-hint">
                <code>screen</code>/<code>lighten</code> trên sàn battle tối không đủ xóa nền đen (đen blend ra
                vẫn tối). Battle tự chuyển pixel gần đen → trong suốt; nên dùng PNG có alpha nếu có.
              </p>

              <label className="abfx-field abfx-field--check">
                <input
                  type="checkbox"
                  checked={draft.enabled !== false}
                  onChange={(e) => updateDraft({ enabled: e.target.checked })}
                />
                <span>Enabled (skill/item có thể dùng)</span>
              </label>

              <label className="abfx-field">
                <span>Ghi chú</span>
                <textarea
                  rows={2}
                  value={draft.notes || ''}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                />
              </label>

              <div className="abfx-editor__actions">
                <button type="button" className="abfx-btn abfx-btn--primary" onClick={handleSaveOne}>
                  Save animation
                </button>
                <button
                  type="button"
                  className="abfx-btn"
                  onClick={() => {
                    setPlaying(false);
                    window.requestAnimationFrame(() => setPlaying(true));
                  }}
                >
                  ▶ Preview
                </button>
                {selectedId ? (
                  <button type="button" className="abfx-btn abfx-btn--danger" onClick={handleDelete}>
                    Xóa
                  </button>
                ) : null}
              </div>
              {flash ? <p className="abfx-flash">{flash}</p> : null}
            </div>

            <div className="abfx-right">
              <h3>Lưới chia frame (trên ảnh)</h3>
              <p className="abfx-hint">
                Đường đỏ = biên frame theo Cols×Rows. Đổi số cols/rows để khớp sprite (vd 5 cột 1 hàng).
                Ô mờ = frame không dùng (ngoài Frame count).
              </p>
              <SpriteSheetGridViewer entry={draft} />

              <h3>Preview animation</h3>
              <FxPreview entry={draft} playing={playing} onDone={onPreviewDone} />

              <h3>Chọn số frame nhanh</h3>
              <p className="abfx-hint">
                Bấm ô F1…Fn để đặt frameCount. Frame chạy trái → phải, trên → dưới.
              </p>
              <div
                className="abfx-frame-grid"
                style={{
                  gridTemplateColumns: `repeat(${draft.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${draft.rows}, auto)`,
                }}
              >
                {Array.from({ length: draft.cols * draft.rows }).map((_, i) => {
                  const active = i < draft.frameCount;
                  const cell = gridCells.find((c) => c.index === i);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`abfx-frame-cell${active ? ' abfx-frame-cell--on' : ''}`}
                      title={
                        active
                          ? `Frame ${i + 1} · col ${cell?.col} row ${cell?.row}`
                          : 'Không dùng'
                      }
                      onClick={() => updateDraft({ frameCount: i + 1 })}
                    >
                      {active ? `F${i + 1}` : '—'}
                      {active ? (
                        <small>
                          {cell?.col},{cell?.row}
                        </small>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <h3>Gợi ý tên / tìm nguồn</h3>
              <div className="abfx-row">
                <label className="abfx-field">
                  <span>Nhóm</span>
                  <select value={suggestCat} onChange={(e) => setSuggestCat(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="abfx-field">
                  <span>Từ khóa</span>
                  <input
                    value={suggestSeed}
                    placeholder="vd: fire slash, ice hit..."
                    onChange={(e) => setSuggestSeed(e.target.value)}
                  />
                </label>
              </div>
              <div className="abfx-suggests">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="abfx-chip"
                    onClick={() => applySuggestion(s)}
                  >
                    {s.name}
                    <span>{s.id}</span>
                  </button>
                ))}
              </div>
              <div className="abfx-links">
                {searchLinks.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="abfx-link">
                    🔎 {l.label}
                  </a>
                ))}
              </div>
              <p className="abfx-hint">
                Gợi ý tên là bộ preset theo nhóm (electric/fire/…). Link mở OpenGameArt / Kenney /
                itch / Google để tìm sprite sheet. Sau này có thể gắn API AI nếu bạn muốn.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminBattleFxPage;
