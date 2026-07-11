import React from 'react';
import GameDialogModal from './GameDialogModal';
import './GameAlertModal.css';

/**
 * Alert tái sử dụng — cùng design với GameDialogModal (mode alert).
 * @param {{
 *   isOpen?: boolean,
 *   title?: string,
 *   message: React.ReactNode,
 *   confirmLabel?: string,
 *   onClose: () => void,
 *   tone?: 'default'|'info'|'warning'|'error'|'success',
 *   closeOnOverlayClick?: boolean,
 *   className?: string,
 * }} props
 */
function GameAlertModal({
  isOpen = true,
  title = 'Thông báo',
  message,
  confirmLabel = 'Xác nhận',
  onClose,
  tone = 'default',
  closeOnOverlayClick = true,
  className = '',
}) {
  const open = Boolean(isOpen) && (message != null && message !== '');

  return (
    <GameDialogModal
      isOpen={open}
      onClose={onClose}
      title={title || 'Thông báo'}
      mode="alert"
      tone={tone}
      confirmLabel={confirmLabel}
      onConfirm={onClose}
      closeOnOverlayClick={closeOnOverlayClick}
      overlayClassName="game-alert-modal-overlay"
      className={`game-alert-modal ${className}`.trim()}
      contentClassName="game-alert-modal__body"
    >
      {typeof message === 'string' || typeof message === 'number' ? (
        <p className="game-alert-modal__message">{message}</p>
      ) : (
        message
      )}
    </GameDialogModal>
  );
}

export default GameAlertModal;
