// Updated ItemDetailModal.js with support for unequip
import React, { useEffect, useState } from 'react';
import './ItemDetailModal.css';

function ItemDetailModal({ item, onClose, onBuy, mode = 'default', onUpdateItem }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [userPets, setUserPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    if (item?.type === 'equipment') {
      const token = localStorage.getItem('token');
      if (!token) return;
      const userId = JSON.parse(atob(token.split('.')[1])).userId;

      fetch(`${API_BASE_URL}/users/${userId}/pets`)
        .then(res => res.json())
        .then(data => setUserPets(data))
        .catch(err => console.error('Error fetching pets:', err));
    }
  }, [item]);

  const handleEquipItem = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/pets/${selectedPetId}/equip-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_id: item.id })
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Trang bị thành công!');
        if (typeof onUpdateItem === 'function') {
          onUpdateItem({ ...item, is_equipped: 1, equipped_pet_id: selectedPetId });
        }
        onClose();
      } else {
        alert(result.message || 'Trang bị thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi API equip:', err);
      alert('Lỗi khi trang bị.');
    }
  };

  const handleUnequipItem = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/unequip`, {
        method: 'POST'
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Đã gỡ vật phẩm khỏi thú cưng!');
        if (typeof onUpdateItem === 'function') {
          onUpdateItem({ ...item, is_equipped: 0, equipped_pet_id: null, pet_name: null });
        }
        onClose();
      } else {
        alert(result.message || 'Không thể gỡ vật phẩm.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi API unequip:', err);
      alert('Lỗi khi gỡ vật phẩm.');
    }
  };

  const handleSubmit = () => {
    if (action === 'equip' && item.type === 'equipment') return;
    if (action === 'remove' && item.is_equipped) {
      handleUnequipItem();
      return;
    }
    alert(`Action "${action}" triggered on ${item.name}`);
    onClose();
  };

  if (!item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">{item.name}</h2>
        <img src={`/images/equipments/${item.image_url}`} alt={item.name} className="modal-image" />
        <p className="modal-desc">{item.description}</p>

        {mode === 'shop' ? (
          <button onClick={() => onBuy(item)}>
            Mua với giá {item.price.toLocaleString()} {item.currency_type === 'gem' ? 'petaGold' : 'peta'}
          </button>
        ) : (
          <>
            <div className="modal-action">
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">Choose an Action</option>
                <option value="use">Use</option>
                <option value="equip">Equip</option>
                {item.is_equipped && <option value="remove">Remove</option>}
                <option value="sell">Sell</option>
              </select>
              <button
                onClick={handleSubmit}
                disabled={!action || (action === 'equip' && item.type === 'equipment')}
              >
                Submit
              </button>
            </div>

            {action === 'equip' && item.type === 'equipment' && (
              <div className="equip-section">
                <label>Chọn thú cưng để trang bị:</label>
                <select value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
                  <option value="">-- Chọn thú cưng --</option>
                  {userPets.map(pet => (
                    <option key={pet.uuid} value={pet.id}>
                      {pet.name} (Lv {pet.level})
                    </option>
                  ))}
                </select>
                <button disabled={!selectedPetId} onClick={handleEquipItem}>Trang bị</button>
              </div>
            )}

            <div className="modal-info">
              <div><strong>Type:</strong> {item.type}</div>
              <div><strong>Rarity:</strong> {item.rarity}</div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default ItemDetailModal;
