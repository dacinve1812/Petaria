// Updated ItemCard.js to display like ShopPage with rarity border colors
import React from 'react';
import './ItemCard.css';

function ItemCard({ item, onClick, note, icon, style }) {
  const rarityColors = {
    common: '#ccc', // xám
    uncommon: '#6cc27c', // xanh lá cây
    rare: '#3b82f6', // blue
    epic: '#a855f7', // tím
    legendary: '#facc15', // vàng
  };

  const getRarityColor = (rarity) => {
    return rarityColors[rarity] || '#ccc';
  };

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
