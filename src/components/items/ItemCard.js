// Updated ItemCard.js to display like ShopPage with rarity border colors
import React from 'react';
import './ItemCard.css';

function ItemCard({ item, onClick, note, icon, style }) {
  const rarityColors = {
    common: '#ccc',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#facc15',
  };

  const normalizeItemRarity = (value) => {
    const k = String(value ?? '').trim().toLowerCase();
    if (['common', 'rare', 'epic', 'legendary'].includes(k)) return k;
    if (['legend', 'mythic', 'unique', 'artifact'].includes(k)) return 'legendary';
    if (k === 'uncommon') return 'rare';
    return 'common';
  };

  const getRarityColor = (rarity) => rarityColors[normalizeItemRarity(rarity)] || '#ccc';

  return (
    <div
      className="item-card-shop-style"
      style={{ 
        borderColor: getRarityColor(item.rarity),
        position: 'relative',
        ...style
      }}
      onClick={onClick}
    >
      <img
        src={`/images/equipments/${item.image_url}`}
        alt={item.name}
        className="item-image-shop-style"
      />
      
      <div className="item-name-container">
        <strong className="item-name-shop-style">
          {item.name}
        </strong>
      </div>
      
      {/* Quantity display in card */}
      {item.quantity >= 1 && (
        <div className="item-quantity-shop-style">
          Số lượng: {item.quantity}
        </div>
      )}
      
      {/* Note for equipped items */}
      {note && (
        <div className="item-note-shop-style">
          {note}
        </div>
      )}
      
      {/* Icon cho equipped items */}
      {icon && (
        <div className="equipped-icon-shop-style">
          {icon}
        </div>
      )}
    </div>
  );
}

export default ItemCard;
