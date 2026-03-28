import React, { useState } from 'react';
import './EncounterModal.css';
import ConfirmFleeModal from './ConfirmFleeModal';

function EncounterModal({ wildPet, onClose, onCatch, onBattle }) {
  const [showConfirmFlee, setShowConfirmFlee] = useState(false);

  if (!wildPet) return null;

  const handleCatch = () => {
    if (onCatch) {
      onCatch(wildPet);
    }
    onClose();
  };

  const handleBattle = () => {
    if (onBattle) {
      onBattle(wildPet);
    }
    onClose();
  };

  const handleFlee = () => {
    onClose();
  };

  const handleCloseClick = () => {
    setShowConfirmFlee(true);
  };

  const handleConfirmFlee = () => {
    setShowConfirmFlee(false);
    handleFlee();
  };

  const handleCancelFlee = () => {
    setShowConfirmFlee(false);
  };

  return (
    <>
      <div className="encounter-modal-overlay">
        <div className="encounter-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="encounter-modal-close" onClick={handleCloseClick}>✕</button>
          
          <div className="encounter-header">
            <h2 className="encounter-title">🎯 WILD PET ENCOUNTER!</h2>
            <div className="encounter-rarity-badge">{wildPet.rarity}</div>
          </div>

          <div className="encounter-pet-info">
            <div className="pet-sprite-placeholder">
              {wildPet.image ? (
                <img
                  src={`/images/pets/${wildPet.image}`}
                  alt=""
                  className="encounter-species-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/images/pets/default.png';
                  }}
                />
              ) : (
                <div className="pet-sprite-icon">🐾</div>
              )}
            </div>
            
            <div className="pet-details">
              <h3 className="pet-name">{wildPet.name}</h3>
              <p className="pet-description">{wildPet.description}</p>
              
              <div className="pet-stats">
                <div className="stat-item">
                  <span className="stat-label">Rarity:</span>
                  <span className={`stat-value rarity-${wildPet.rarity.toLowerCase()}`}>
                    {wildPet.rarity}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Type:</span>
                  <span className="stat-value">Wild Pet</span>
                </div>
              </div>
            </div>
          </div>

          <div className="encounter-actions">
            <button 
              className="action-button catch-button"
              onClick={handleCatch}
            >
              🎣 Catch Pet
            </button>
            
            <button 
              className="action-button battle-button"
              onClick={handleBattle}
            >
              ⚔️ Battle
            </button>
            
            <button 
              className="action-button flee-button"
              onClick={handleFlee}
            >
              🏃‍♂️ Flee
            </button>
          </div>

          <div className="encounter-tip">
            <p>💡 Tip: Higher rarity pets are harder to catch but more valuable!</p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Flee */}
      {showConfirmFlee && (
        <ConfirmFleeModal
          petName={wildPet.name}
          onConfirm={handleConfirmFlee}
          onCancel={handleCancelFlee}
        />
      )}
    </>
  );
}

export default EncounterModal;
