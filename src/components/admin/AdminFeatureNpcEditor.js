import React from 'react';

/**
 * Admin fields for FeatureNpcIntro narrative:
 * speaker, portraitSrc (stage), lorePortraitSrc (modal), greeting, lines.
 * Pass `extras` for game-specific fields (claimLabel, rewardLine, …).
 */
function AdminFeatureNpcEditor({
  narrative = {},
  patchNarrative,
  uploadFile,
  onUploadError,
  tokensHelp = '',
  extras = null,
}) {
  const n = narrative || {};

  const setField = (key, value) => {
    patchNarrative((nar) => {
      nar[key] = value;
    });
  };

  const renderImageField = (key, label, placeholder) => (
    <label style={{ gridColumn: '1 / -1' }}>
      {label}
      <div className="gc-admin__reward-row">
        {n[key] ? (
          <img src={n[key]} alt="" className="gc-admin__thumb" />
        ) : (
          <span className="gc-admin__thumb-placeholder">?</span>
        )}
        <input
          type="text"
          style={{ flex: 1 }}
          placeholder={placeholder}
          value={n[key] ?? ''}
          onChange={(e) => setField(key, e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await uploadFile(f, (url) => setField(key, url));
            } catch (err) {
              onUploadError?.(err.message || 'Upload thất bại');
            }
          }}
        />
        {n[key] ? (
          <button
            type="button"
            className="gc-admin__btn gc-admin__btn--ghost"
            onClick={() => setField(key, '')}
          >
            Xóa
          </button>
        ) : null}
      </div>
    </label>
  );

  return (
    <>
      <h3 style={{ marginTop: 20 }}>Hội thoại nhân vật (trang)</h3>
      <p className="gc-admin__help">
        Pattern Mystery Box: ảnh trên trang (nút) + câu chào ngắn; bấm ảnh / <code>?</code> mở modal
        lore (có thể dùng ảnh khác). Không còn overlay NarrativeHost.
        {tokensHelp ? (
          <>
            {' '}
            Token: {tokensHelp}
          </>
        ) : null}
      </p>

      <div className="gc-admin__row">
        <label>
          Tên nhân vật (nameplate)
          <input
            type="text"
            value={n.speaker ?? ''}
            onChange={(e) => setField('speaker', e.target.value)}
          />
        </label>
      </div>

      <div className="gc-admin__row" style={{ alignItems: 'start' }}>
        {renderImageField(
          'portraitSrc',
          'Ảnh trên trang (nút — ec-feature-portrait-btn)',
          '/images/character/…',
        )}
        {renderImageField(
          'lorePortraitSrc',
          'Ảnh trong modal lore (ec-feature-lore__img) — để trống = dùng ảnh trên trang',
          '/images/character/…',
        )}
      </div>

      <div className="gc-admin__row" style={{ gridTemplateColumns: '1fr' }}>
        <label>
          Câu chào ngắn trên trang (1 dòng). Để trống = dùng dòng đầu của lore.
          <input
            type="text"
            value={n.greeting ?? ''}
            onChange={(e) => setField('greeting', e.target.value)}
            placeholder="Xin chào…"
          />
        </label>
        <label>
          Lore đầy đủ trong modal (mỗi dòng = 1 đoạn)
          <textarea
            rows={5}
            value={(n.lines || []).join('\n')}
            onChange={(e) =>
              setField(
                'lines',
                e.target.value
                  .split('\n')
                  .map((s) => s.trimEnd())
                  .filter((s) => s.trim().length > 0),
              )
            }
          />
        </label>
      </div>

      {extras}
    </>
  );
}

export default AdminFeatureNpcEditor;
