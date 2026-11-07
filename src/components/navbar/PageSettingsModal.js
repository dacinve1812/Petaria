import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isPageBackgroundEnabled, setPageBackgroundEnabled } from '../../utils/pageSettings';
import './PageSettingsModal.css';

function PageSettingsModal({ onClose }) {
  const [pageBackground, setPageBackground] = useState(isPageBackgroundEnabled);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleBackground = () => {
    const next = !pageBackground;
    setPageBackground(next);
    setPageBackgroundEnabled(next);
  };

  return createPortal(
    <div className="page-settings-overlay" onMouseDown={onClose}>
      <section
        className="page-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="page-settings-header">
          <h2 id="page-settings-title">Setting</h2>
          <button type="button" className="page-settings-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="page-settings-body">
          <label className="page-settings-row">
            <span>
              <strong>Ảnh nền trang</strong>
              <small>Tắt thì vẫn giữ ảnh nền, ẩn tiêu đề trang và kéo nội dung lên sát menu.</small>
            </span>
            <button
              type="button"
              className={`page-settings-switch${pageBackground ? ' is-on' : ''}`}
              role="switch"
              aria-checked={pageBackground}
              onClick={toggleBackground}
            >
              <i />
            </button>
          </label>
        </div>
      </section>
    </div>,
    document.body
  );
}

export default PageSettingsModal;
