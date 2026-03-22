import React from 'react';

/**
 * Nút pill kiểu game (Cancel / Confirm / primary / danger).
 * Dùng chung trong GameDialogModal và các chỗ khác.
 */
function GameModalButton({
  variant = 'primary',
  children,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`game-modal-btn game-modal-btn--${variant} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      <span className="game-modal-btn__deco game-modal-btn__deco--left" aria-hidden />
      <span className="game-modal-btn__icon" aria-hidden>
        {variant === 'cancel' && <span className="game-modal-btn__x">✕</span>}
        {(variant === 'confirm' || variant === 'primary') && (
          <span className="game-modal-btn__ring" />
        )}
        {variant === 'danger' && <span className="game-modal-btn__bang">!</span>}
      </span>
      <span className="game-modal-btn__label">{children}</span>
      <span className="game-modal-btn__deco game-modal-btn__deco--right" aria-hidden />
    </button>
  );
}

export default GameModalButton;
