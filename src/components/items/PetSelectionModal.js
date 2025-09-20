import React, { useState, useEffect } from 'react';

function PetSelectionModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  userPets, 
  item, 
  action = 'equip' // 'equip', 'use', 'feed', 'heal'
}) {
  const [selectedPetId, setSelectedPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPetId('');
      setQuantity(1);
    }
  }, [isOpen]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Modal is open, disable scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Modal is closed, enable scroll
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (requiresPetSelection() && !selectedPetId) return;
    
    setLoading(true);
    try {
      await onConfirm(selectedPetId, quantity);
      onClose();
    } catch (error) {
      console.error('Error in pet selection:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionText = () => {
    switch (action) {
      case 'equip': return 'Trang bị';
      case 'sell': return 'Bán ve chai';
      case 'feed': return 'Cho ăn';
      case 'heal': return 'Chữa trị';
      case 'restore_energy': return 'Hồi phục năng lượng';
      case 'boost_stats': return 'Gia tăng chỉ số';
      case 'play': return 'Chơi đùa';
      case 'transform': return 'Thay đổi hình dạng';
      case 'sell_auction': return 'Đặt vào cửa hàng';
      case 'exhibition': return 'Mang vào phòng triển lãm';
      case 'gift': return 'Tặng cho bạn bè';
      default: return 'Sử dụng';
    }
  };

  const getActionDescription = () => {
    switch (action) {
      case 'equip': return 'Chọn thú cưng để trang bị:';
      case 'sell': return 'Xác nhận bán vật phẩm:';
      case 'feed': return 'Chọn thú cưng để cho ăn:';
      case 'heal': return 'Chọn thú cưng để chữa trị:';
      case 'restore_energy': return 'Chọn thú cưng để hồi phục năng lượng:';
      case 'boost_stats': return 'Chọn thú cưng để gia tăng chỉ số:';
      case 'play': return 'Chọn thú cưng để chơi đùa:';
      case 'transform': return 'Chọn thú cưng để thay đổi hình dạng:';
      case 'sell_auction': return 'Đặt vật phẩm vào cửa hàng:';
      case 'exhibition': return 'Mang vật phẩm vào phòng triển lãm:';
      case 'gift': return 'Chọn thú cưng để tặng vật phẩm:';
      default: return 'Chọn thú cưng để sử dụng:';
    }
  };

  const showQuantitySelector = () => {
    return action === 'use' || action === 'feed' || action === 'heal' || action === 'restore_energy' || action === 'boost_stats' || action === 'play' || action === 'transform';
  };

  const requiresPetSelection = () => {
    return !['sell', 'sell_auction', 'exhibition', 'gift'].includes(action);
  };

  const maxQuantity = item?.quantity || 1;

  if (!isOpen) return null;

  return (
    <div className="pet-selection-modal-overlay" onClick={onClose}>
      <div className="pet-selection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pet-selection-modal-header">
          <h3>{getActionText()} Item</h3>
          <button className="pet-selection-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="pet-selection-modal-content">
          <div className="pet-selection-modal-instruction">
            <p>Select the <span className="highlight">number of items</span> to {getActionText().toLowerCase()}.</p>
            <p>{getActionText()} {quantity} {item?.name || 'item'}(s).</p>
          </div>

          {/* Pet Selection - Only show if required */}
          {requiresPetSelection() && (
            <div className="pet-selection-modal-section">
              <label className="pet-selection-modal-label">
                {getActionDescription()}
              </label>
              <select
                className="pet-selection-modal-select"
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
              >
                <option value="">-- Chọn thú cưng --</option>
                {Array.isArray(userPets) && userPets.map((pet) => (
                  <option key={pet.uuid || pet.id} value={pet.id}>
                    {pet.name} (Level {pet.level})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity Selection */}
          {showQuantitySelector() && (
            <div className="pet-selection-modal-section">
              <div className="pet-selection-modal-quantity-controls">
                <button 
                  className="pet-selection-modal-qty-btn"
                  onClick={() => setQuantity(1)}
                  disabled={quantity <= 1}
                >
                  ⟨
                </button>
                <button 
                  className="pet-selection-modal-qty-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 10))}
                  disabled={quantity <= 1}
                >
                  -10
                </button>
                <button 
                  className="pet-selection-modal-qty-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                
                <div className="pet-selection-modal-qty-display">
                  {quantity}/{maxQuantity}
                </div>
                
                <button 
                  className="pet-selection-modal-qty-btn"
                  onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                  disabled={quantity >= maxQuantity}
                >
                  +
                </button>
                <button 
                  className="pet-selection-modal-qty-btn"
                  onClick={() => setQuantity(Math.min(maxQuantity, quantity + 10))}
                  disabled={quantity >= maxQuantity}
                >
                  +10
                </button>
                <button 
                  className="pet-selection-modal-qty-btn"
                  onClick={() => setQuantity(maxQuantity)}
                  disabled={quantity >= maxQuantity}
                >
                  ⟩
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pet-selection-modal-footer">
          <button 
            className="pet-selection-modal-cancel-btn"
            onClick={onClose}
          >
            ✕ Cancel
          </button>
          <button 
            className="pet-selection-modal-confirm-btn"
            onClick={handleConfirm}
            disabled={(requiresPetSelection() && !selectedPetId) || loading}
          >
            {loading ? 'Đang xử lý...' : `✓ ${getActionText()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PetSelectionModal;
