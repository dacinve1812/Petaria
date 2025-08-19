import React from 'react';
import './ConfirmFleeModal.css';

function ConfirmFleeModal({ onConfirm, onCancel, petName }) {
  return (
    <div className="confirm-flee-modal-overlay">
      <div className="confirm-flee-modal-content">
        <div className="confirm-header">
          <h3>⚠️ Confirm Flee</h3>
        </div>
        
        <div className="confirm-message">
          <p>Are you sure you want to flee from <strong>{petName}</strong>?</p>
          <p className="warning-text">This action cannot be undone!</p>
        </div>
        
        <div className="confirm-actions">
          <button 
            className="confirm-button flee-confirm"
            onClick={onConfirm}
          >
            🏃‍♂️ Yes, Flee
          </button>
          
          <button 
            className="confirm-button cancel-button"
            onClick={onCancel}
          >
            ❌ Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmFleeModal;
