import React, { useState } from 'react';
import './ItemDetailModal.css';

function ItemDetailModal({ item, onClose }) {
  const [action, setAction] = useState('');

  const handleSubmit = () => {
    alert(`Action "${action}" triggered on ${item.name}`);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">{item.name}</h2>
        <img src={item.image_url} alt={item.name} className="modal-image" />
        <p className="modal-desc">{item.description}</p>

        <div className="modal-action">
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Choose an Action</option>
            <option value="use">Use</option>
            <option value="equip">Equip</option>
            <option value="sell">Sell</option>
          </select>
          <button onClick={handleSubmit} disabled={!action}>Submit</button>
        </div>

        <div className="modal-info">
          <div><strong>Type:</strong> {item.type}</div>
          <div><strong>Rarity:</strong> {item.rarity}</div>
          {/* Bạn có thể thêm weight, value, etc nếu muốn */}
        </div>
      </div>
    </div>
  );
}

export default ItemDetailModal;
