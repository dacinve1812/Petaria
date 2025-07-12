import React, { useState } from 'react';
import BrokenEquipmentModal from './BrokenEquipmentModal';
import './RepairButton.css';

const RepairButton = ({ userId, onRepairComplete }) => {
  const [showModal, setShowModal] = useState(false);

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (onRepairComplete) {
      onRepairComplete();
    }
  };

  return (
    <>
      <button 
        className="repair-button"
        onClick={handleOpenModal}
        title="Sửa chữa equipment bị hỏng"
      >
        <span className="repair-icon">🔧</span>
        <span className="repair-text">Sửa chữa</span>
      </button>

      {showModal && (
        <BrokenEquipmentModal
          userId={userId}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default RepairButton; 