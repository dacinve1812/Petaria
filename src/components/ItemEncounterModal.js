import React from 'react';
import './EncounterModal.css';

function itemImageSrc(imageUrl) {
  if (!imageUrl) return '/images/equipments/placeholder.png';
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/images/equipments/${imageUrl}`;
}

/** @param {{ item: { name: string, image_url?: string, qty: number, item_id: number }, onClose: () => void }} props */
function ItemEncounterModal({ item, onClose }) {
  if (!item) return null;

  return (
    <div className="encounter-modal-overlay">
      <div className="encounter-modal-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="encounter-modal-close" onClick={onClose}>
          ✕
        </button>
        <div className="encounter-header">
          <h2 className="encounter-title">📦 Tìm thấy vật phẩm</h2>
        </div>
        <div className="encounter-pet-info">
          <div className="pet-sprite-placeholder">
            <img
              src={itemImageSrc(item.image_url)}
              alt=""
              className="hmap-item-enc-img"
              onError={(e) => {
                e.target.src = '/images/equipments/placeholder.png';
              }}
            />
          </div>
          <div className="pet-details">
            <h3 className="pet-name">{item.name}</h3>
            <p className="pet-description">Số lượng: {item.qty}</p>
            <p className="pet-description" style={{ opacity: 0.75 }}>
              (Nhận vào túi — API sẽ bổ sung sau)
            </p>
          </div>
        </div>
        <div className="encounter-actions">
          <button type="button" className="action-button catch-button" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default ItemEncounterModal;
