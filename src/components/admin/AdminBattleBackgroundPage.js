import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import {
  BATTLE_BG_ADMIN_PATH,
  BATTLE_BG_CONTEXTS,
  BATTLE_BG_PUBLIC_DIR,
  DEFAULT_ENTRIES,
  loadBattleBackgroundCatalogAsync,
  saveBattleBackgroundCatalog,
  resetBattleBackgroundCatalog,
  exportBattleBackgroundCatalogJson,
  sceneBackgroundStyle,
  getBackgroundById,
  normalizeEntry,
  isNoneBackgroundUrl,
  toColorInputValue,
} from '../../data/battleBackgroundCatalog';
import './AdminConfigPage.css';
import './AdminBattleBackgroundPage.css';

function displayBgUrl(url) {
  return isNoneBackgroundUrl(url) ? 'none' : String(url || '');
}

function MiniPreview({ entry, viewport }) {
  const style = sceneBackgroundStyle(entry);
  const isMobile = viewport === 'mobile';
  const bgImage = isMobile
    ? style['--arena-bg-image-mobile']
    : style['--arena-bg-image'];
  const bgPos = isMobile ? style['--arena-bg-pos-mobile'] : style['--arena-bg-pos'];
  const bgColor = style['--arena-bg-color'] || '#0f172a';
  const isNone = bgImage === 'none';
  return (
    <div className={`abbg-mini abbg-mini--${viewport}`} aria-hidden>
      <div className="abbg-mini__label">
        {isMobile ? 'Mobile' : 'Desktop'}
        {isNone ? ' · none' : ''}
      </div>
      <div
        className="abbg-mini__frame"
        style={{
          backgroundImage: bgImage,
          backgroundPosition: bgPos,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundColor: bgColor,
        }}
      >
        <div className="abbg-mini__chrome">
          <span className="abbg-mini__bar" />
          <span className="abbg-mini__field" />
          <span className="abbg-mini__log" />
        </div>
      </div>
    </div>
  );
}

function AdminBattleBackgroundPage() {
  const navigate = useNavigate();
  const { user } = useUser() || {};
  const [catalog, setCatalog] = useState(null);
  const [selectedId, setSelectedId] = useState(BATTLE_BG_CONTEXTS[0].id);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const cat = await loadBattleBackgroundCatalogAsync();
      setCatalog(cat);
      const entry = getBackgroundById(cat, selectedId);
      setDraft(entry);
    } catch (err) {
      console.error(err);
      setStatus('Không tải được catalog nền.');
    } finally {
      setBusy(false);
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!catalog) return;
    setDraft(getBackgroundById(catalog, selectedId));
  }, [catalog, selectedId]);

  const meta = useMemo(
    () => BATTLE_BG_CONTEXTS.find((c) => c.id === selectedId) || BATTLE_BG_CONTEXTS[0],
    [selectedId]
  );

  const patchDraft = (patch) => {
    setDraft((prev) => normalizeEntry({ ...(prev || {}), ...patch, id: selectedId }, selectedId));
  };

  const noBackground =
    draft &&
    isNoneBackgroundUrl(draft.desktopUrl) &&
    isNoneBackgroundUrl(draft.mobileUrl);

  const setNoBackground = (enabled) => {
    if (enabled) {
      patchDraft({ desktopUrl: '', mobileUrl: '' });
      return;
    }
    const def = DEFAULT_ENTRIES[selectedId] || DEFAULT_ENTRIES['arena-1v1'];
    patchDraft({
      desktopUrl: def.desktopUrl,
      mobileUrl: def.mobileUrl,
    });
  };

  const handleSave = () => {
    if (!catalog || !draft) return;
    const nextList = (catalog.backgrounds || []).map((b) =>
      b.id === selectedId ? normalizeEntry(draft, selectedId) : b
    );
    if (!nextList.some((b) => b.id === selectedId)) {
      nextList.push(normalizeEntry(draft, selectedId));
    }
    const saved = saveBattleBackgroundCatalog({ ...catalog, backgrounds: nextList });
    setCatalog(saved);
    setStatus('Đã lưu vào trình duyệt (localStorage). Export JSON để deploy lên server.');
  };

  const handleReset = () => {
    if (!window.confirm('Xóa override local và về mặc định shipped?')) return;
    const fresh = resetBattleBackgroundCatalog();
    setCatalog(fresh);
    setDraft(getBackgroundById(fresh, selectedId));
    setStatus('Đã reset về mặc định.');
  };

  const handleExport = () => {
    if (!catalog) return;
    const withDraft = {
      ...catalog,
      backgrounds: (catalog.backgrounds || []).map((b) =>
        b.id === selectedId ? normalizeEntry(draft, selectedId) : b
      ),
    };
    const text = exportBattleBackgroundCatalogJson(withDraft);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'catalog.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`Đã export — ghi đè file public${BATTLE_BG_PUBLIC_DIR}/catalog.json rồi commit.`);
  };

  if (!user) {
    return (
      <div className="admin-config-page">
        <p>Cần đăng nhập admin.</p>
        <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Admin
        </button>
      </div>
    );
  }

  return (
    <div className="admin-config-page abbg-page">
      <header className="admin-header">
        <div className="header-text">
          <h1>Battle Arena Backgrounds</h1>
          <p>
            Chỉnh nền sàn đấu theo từng context (1v1, 3v3, 5v5, hunting). Preview mini Desktop /
            Mobile. Save lưu local; Export JSON →{' '}
            <code>
              public{BATTLE_BG_PUBLIC_DIR}/catalog.json
            </code>
            .
          </p>
        </div>
        <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Admin
        </button>
      </header>

      <div className="abbg-toolbar">
        <button type="button" disabled={busy} onClick={handleSave}>
          Save
        </button>
        <button type="button" disabled={busy} onClick={handleExport}>
          Export JSON
        </button>
        <button type="button" disabled={busy} onClick={handleReset}>
          Reset local
        </button>
        <button type="button" disabled={busy} onClick={refresh}>
          Reload
        </button>
        {status ? <span className="abbg-status">{status}</span> : null}
      </div>

      <div className="abbg-layout">
        <aside className="abbg-list" aria-label="Contexts">
          {BATTLE_BG_CONTEXTS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`abbg-list__item${selectedId === c.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(c.id)}
            >
              <strong>{c.labelVi}</strong>
              <span>{c.id}</span>
            </button>
          ))}
        </aside>

        <section className="abbg-editor">
          <h2>
            {meta.labelVi} <em>({meta.id})</em>
          </h2>
          <p className="abbg-hint">{meta.hint}</p>

          {draft ? (
            <>
              <div className="abbg-previews">
                <MiniPreview entry={draft} viewport="desktop" />
                <MiniPreview entry={draft} viewport="mobile" />
              </div>

              <label className="abbg-field abbg-field--color">
                <span>Màu nền</span>
                <div className="abbg-color-row">
                  <input
                    type="color"
                    className="abbg-color-swatch"
                    value={toColorInputValue(draft.backgroundColor)}
                    onChange={(e) => patchDraft({ backgroundColor: e.target.value })}
                    aria-label="Chọn màu nền"
                  />
                  <input
                    type="text"
                    value={draft.backgroundColor || ''}
                    onChange={(e) => patchDraft({ backgroundColor: e.target.value })}
                    placeholder="#0f172a"
                    spellCheck={false}
                  />
                </div>
              </label>

              <label className="abbg-check">
                <input
                  type="checkbox"
                  checked={!!noBackground}
                  onChange={(e) => setNoBackground(e.target.checked)}
                />
                <span>Không có ảnh nền (none)</span>
              </label>

              <label className="abbg-field">
                <span>Desktop image URL</span>
                <input
                  type="text"
                  value={displayBgUrl(draft.desktopUrl)}
                  onChange={(e) => patchDraft({ desktopUrl: e.target.value })}
                  placeholder={`none hoặc ${BATTLE_BG_PUBLIC_DIR}/arena-background-landscape-1.png`}
                  disabled={!!noBackground}
                />
              </label>
              <label className="abbg-field">
                <span>Mobile image URL</span>
                <input
                  type="text"
                  value={displayBgUrl(draft.mobileUrl)}
                  onChange={(e) => patchDraft({ mobileUrl: e.target.value })}
                  placeholder={`none hoặc ${BATTLE_BG_PUBLIC_DIR}/arena-background.png`}
                  disabled={!!noBackground}
                />
              </label>
              <div className="abbg-field-row">
                <label className="abbg-field">
                  <span>Desktop position</span>
                  <input
                    type="text"
                    value={draft.desktopPosition || ''}
                    onChange={(e) => patchDraft({ desktopPosition: e.target.value })}
                    placeholder="center bottom"
                    disabled={!!noBackground}
                  />
                </label>
                <label className="abbg-field">
                  <span>Mobile position</span>
                  <input
                    type="text"
                    value={draft.mobilePosition || ''}
                    onChange={(e) => patchDraft({ mobilePosition: e.target.value })}
                    placeholder="center 120%"
                    disabled={!!noBackground}
                  />
                </label>
              </div>
              <p className="abbg-note">
                Path public bắt đầu bằng <code>/images/...</code> (file nằm trong{' '}
                <code>public/images/background/</code>). Để trống hoặc gõ{' '}
                <code>none</code> = không dùng ảnh (chỉ hiện màu nền).
              </p>
            </>
          ) : (
            <p>Đang tải…</p>
          )}
        </section>
      </div>

      <p className="abbg-path-hint">
        Admin path: <code>{BATTLE_BG_ADMIN_PATH}</code>
      </p>
    </div>
  );
}

export default AdminBattleBackgroundPage;
