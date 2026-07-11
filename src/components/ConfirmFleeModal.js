import React from 'react';
import './ConfirmFleeModal.css';

function ConfirmFleeModal({ onConfirm, onCancel, petName }) {
  return (
    <div className="confirm-flee-modal-overlay">
      <div className="confirm-flee-modal-content">
        <div className="confirm-header">
          <h3>Bỏ chạy?</h3>
        </div>

        <div className="confirm-message">
          <p>
            Bạn chắc muốn bỏ chạy khỏi <strong>{petName}</strong>?
          </p>
          <p className="warning-text">Lượt gặp này sẽ kết thúc.</p>
        </div>

        <div className="confirm-actions">
          <button type="button" className="confirm-button flee-confirm" onClick={onConfirm}>
            Bỏ chạy
          </button>
          <button type="button" className="confirm-button cancel-button" onClick={onCancel}>
            Ở lại
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmFleeModal;
