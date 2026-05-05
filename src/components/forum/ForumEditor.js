import React, { useMemo, useRef } from 'react';

export default function ForumEditor({
  value,
  onChange,
  onUploadImage,
  placeholder = 'Viết nội dung (Markdown đơn giản).',
  disabled = false,
}) {
  const textareaRef = useRef(null);

  const toolbar = useMemo(
    () => [
      { id: 'bold', label: 'B', wrap: ['**', '**'] },
      { id: 'italic', label: 'I', wrap: ['*', '*'] },
      { id: 'underline', label: 'U', wrap: ['++', '++'] },
      { id: 'code', label: '</>', wrap: ['`', '`'] },
      { id: 'quote', label: '❝', prefix: '> ' },
      { id: 'h3', label: 'H', prefix: '### ' },
      { id: 'link', label: 'Link' },
    ],
    []
  );

  const insertAtCursor = (snippet) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const raw = String(value || '');
    const next = raw.slice(0, start) + snippet + raw.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + String(snippet).length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const applyWrap = (before, after) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const raw = String(value || '');
    const selected = raw.slice(start, end) || '';
    const next = raw.slice(0, start) + before + selected + after + raw.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const applyPrefix = (prefix) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const raw = String(value || '');
    const lineStart = raw.lastIndexOf('\n', start - 1) + 1;
    const next = raw.slice(0, lineStart) + prefix + raw.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + prefix.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handlePickImage = async (file) => {
    if (!file || typeof onUploadImage !== 'function') return;
    const url = await onUploadImage(file);
    if (!url) return;
    insertAtCursor(`![](${url})`);
  };

  const handlePaste = async (e) => {
    if (disabled || typeof onUploadImage !== 'function') return;
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const imageFiles = [];
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      if (!it || it.kind !== 'file') continue;
      const f = it.getAsFile();
      if (!f) continue;
      if (!/^image\//i.test(f.type)) continue;
      imageFiles.push(f);
    }
    if (!imageFiles.length) return;

    e.preventDefault();
    for (const file of imageFiles) {
      const url = await onUploadImage(file);
      if (!url) continue;
      insertAtCursor(`![](${url})`);
    }
  };

  const handleToolbarButton = (b) => {
    if (b.id === 'link') {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const raw = String(value || '');
      const selected = raw.slice(start, end);
      if (selected) {
        return applyWrap('[', '](https://)');
      }
      return insertAtCursor('[tiêu đề](https://)');
    }
    if (b.wrap) return applyWrap(b.wrap[0], b.wrap[1]);
    if (b.prefix) return applyPrefix(b.prefix);
    return undefined;
  };

  const insertUnorderedListBlock = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const raw = String(value || '');
    const selected = raw.slice(start, end);

    const lines = selected.length ? selected.split('\n') : [''];
    const bulleted = lines
      .map((ln) => {
        const t = String(ln);
        const trimmed = t.replace(/^\s+/, '');
        if (/^-\s+/.test(trimmed)) return t;
        return t.length ? `- ${t}` : '- ';
      })
      .join('\n');

    const needsLeadingNewline = start > 0 && raw[start - 1] !== '\n';
    const snippet = `${needsLeadingNewline ? '\n' : ''}${bulleted}\n`;

    const next = raw.slice(0, start) + snippet + raw.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const applyBbWrap = (openTag, closeTag) => applyWrap(openTag, closeTag);

  return (
    <div className="forumEditor">
      <div className="forumToolbar" role="toolbar" aria-label="Định dạng nội dung">
        <select
          className="forumToolbarSelect"
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (!v) return;
            applyBbWrap(`[size=${v}]`, '[/size]');
          }}
          aria-label="Font size"
          title="Font size"
        >
          <option value="">Size</option>
          <option value="12">12</option>
          <option value="13">13</option>
          <option value="14">14</option>
          <option value="15">15</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="24">24</option>
        </select>

        <select
          className="forumToolbarSelect"
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (!v) return;
            applyBbWrap(`[color=${v}]`, '[/color]');
          }}
          aria-label="Text color"
          title="Text color"
        >
          <option value="">Color</option>
          <option value="#e9f2f8">Light</option>
          <option value="#9bd6ff">Blue</option>
          <option value="#a4e03f">Green</option>
          <option value="#ffb24d">Orange</option>
          <option value="#ff6b6b">Red</option>
          <option value="#ffd43b">Yellow</option>
          <option value="#d0bfff">Purple</option>
        </select>

        <select
          className="forumToolbarSelect"
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (!v) return;
            const map = {
              left: ['[left]', '[/left]'],
              center: ['[center]', '[/center]'],
              right: ['[right]', '[/right]'],
            };
            const pair = map[v];
            if (!pair) return;
            applyBbWrap(pair[0], pair[1]);
          }}
          aria-label="Alignment"
          title="Alignment"
        >
          <option value="">Align</option>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>

        <button
          type="button"
          className="forumToolBtn"
          disabled={disabled}
          onClick={insertUnorderedListBlock}
          title="unordered list"
        >
          • List
        </button>

        {toolbar.map((b) => (
          <button
            key={b.id}
            type="button"
            className="forumToolBtn"
            disabled={disabled}
            onClick={() => handleToolbarButton(b)}
            title={b.id}
          >
            {b.label}
          </button>
        ))}

        <label className={`forumToolBtn forumToolBtnFile ${disabled ? 'isDisabled' : ''}`}>
          Ảnh
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = '';
              handlePickImage(f);
            }}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <textarea
        ref={textareaRef}
        className="forumTextarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
      />
    </div>
  );
}
