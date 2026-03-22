import React, { useEffect, useId } from 'react';
import GameModalButton from './GameModalButton';
import './GameDialogModal.css';

/**
 * Modal dialog kiểu gacha/game: header + body + footer tối với Cancel/Confirm.
 * - mode="confirm": 2 nút (Cancel + Confirm)
 * - mode="alert" | "info": chỉ 1 nút OK (Confirm)
 *
 * children: nội dung tuỳ biến (vd. form chọn pet trong PetSelectionModal).
 * Đóng: Cancel / click overlay (closeOnOverlayClick) — không dùng nút (×).
 */
function GameDialogModal({
  isOpen,
  onClose,
  title,
  children,
  /** 'default' | 'info' | 'warning' | 'error' — ảnh hưởng accent nhẹ */
  tone = 'default',
  mode = 'confirm',
  closeOnOverlayClick = true,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  confirmDisabled = false,
  /** { amount: number | string, prefix?: node } hoặc React node tùy chỉnh */
  costPill = null,
  className = '',
  contentClassName = '',
  footerClassName = '',
  /** Ghi đè toàn bộ footer (vd. nút tùy chỉnh) */
  footer = null,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlay = () => {
    if (closeOnOverlayClick) onClose?.();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else onClose?.();
  };

  const handleConfirm = () => {
    onConfirm?.();
  };

  const isAlert = mode === 'alert' || mode === 'info';

  const handlePrimary = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }
    if (isAlert) onClose?.();
  };

  return (
    <div
      className="game-dialog-overlay"
      onClick={handleOverlay}
      role="presentation"
    >
      <div
        className={`game-dialog-modal game-dialog-modal--tone-${tone} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="game-dialog-modal__corner game-dialog-modal__corner--tl" aria-hidden />
        <div className="game-dialog-modal__corner game-dialog-modal__corner--tr" aria-hidden />

        <header className="game-dialog-modal__header">
          <h2 id={titleId} className="game-dialog-modal__title">
            {title}
          </h2>
          <div className="game-dialog-modal__divider" aria-hidden>
            <span className="game-dialog-modal__divider-diamond" />
          </div>
        </header>

        <div className={`game-dialog-modal__body ${contentClassName}`.trim()}>
          {children}
          {costPill != null && (
            <div className="game-dialog-modal__cost-wrap">
              {typeof costPill === 'object' &&
              costPill !== null &&
              !React.isValidElement(costPill) ? (
                <div className="game-dialog-modal__cost-pill">
                  {costPill.icon != null && (
                    <span className="game-dialog-modal__cost-icon">{costPill.icon}</span>
                  )}
                  <span className="game-dialog-modal__cost-value">
                    {costPill.prefix}
                    {costPill.amount}
                    {costPill.suffix}
                  </span>
                </div>
              ) : (
                costPill
              )}
            </div>
          )}
        </div>

        <footer
          className={`game-dialog-modal__footer${isAlert ? ' game-dialog-modal__footer--single' : ''} ${footerClassName}`.trim()}
        >
          {footer != null ? (
            footer
          ) : (
            <>
              {!isAlert && (
                <GameModalButton variant="cancel" onClick={handleCancel}>
                  {cancelLabel}
                </GameModalButton>
              )}
              <GameModalButton
                variant={isAlert ? 'primary' : 'confirm'}
                onClick={isAlert ? handlePrimary : handleConfirm}
                disabled={confirmDisabled}
              >
                {confirmLabel}
              </GameModalButton>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default GameDialogModal;
