// Updated ItemCard.js to support icon and note
import React from 'react';
import './ItemCard.css';

function ItemCard({ item, onClick, note, icon }) {
  const rarityColors = {
    common: '#ccc',
    uncommon: '#6cc27c',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#facc15',
  };

  return (
    <div
      className="item-card"
      style={{ borderColor: rarityColors[item.rarity] || '#999', position: 'relative' }}
      onClick={onClick}
    >
      <img
        src={`/images/equipments/${item.image_url}`}
        alt={item.name}
        className="item-image"
      />
      {icon && (
        <span
          className="item-icon"
        >
          {icon}
        </span>
      )}
      <div className="item-name">{item.name}</div>
      {item.quantity >= 1 && <div className="item-qty">Số lượng: {item.quantity}</div>}
      {note && <div className="item-note" style={{ fontSize: '0.85rem', color: '#666' }}>{note}</div>}
    </div>
  );
}

export default ItemCard;
