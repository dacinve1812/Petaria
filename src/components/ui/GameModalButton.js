import React from 'react';
import './GameDialogModal.css';

/**
 * Nút pill kiểu game (Cancel / Confirm / primary / danger).
 * `showIcon={false}` — ẩn ô icon (ring / ✕); vẫn giữ hình thoi hai bên trừ khi tùy chỉnh CSS.
 */
function GameModalButton({
  variant = 'primary',
  children,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  showIcon = true,
  ...rest
}) {
  const noIconClass = showIcon ? '' : ' game-modal-btn--no-icon';

  return (
    <button
      type={type}
      className={`game-modal-btn game-modal-btn--${variant}${noIconClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      <span className="game-modal-btn__deco game-modal-btn__deco--left" aria-hidden />
      {showIcon ? (
        <span className="game-modal-btn__icon" aria-hidden>
          {variant === 'cancel' && <span className="game-modal-btn__x">✕</span>}
          {(variant === 'confirm' || variant === 'primary') && (
            <span className="game-modal-btn__ring" />
          )}
          {variant === 'danger' && <span className="game-modal-btn__bang">!</span>}
        </span>
      ) : null}
      <span className="game-modal-btn__label">{children}</span>
      <span className="game-modal-btn__deco game-modal-btn__deco--right" aria-hidden />
    </button>
  );
}

export default GameModalButton;
