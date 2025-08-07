// Updated ItemDetailModal.js with support for unequip and use item for pets
import React, { useEffect, useState } from 'react';
import './ItemDetailModal.css';

function ItemDetailModal({ item, onClose, onBuy, mode = 'default', onUpdateItem }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [userPets, setUserPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch user pets for both equipment and use actions
    if (item?.type === 'equipment' || item?.type === 'food' || item?.type === 'consumable' || item?.type === 'booster') {
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

  const handleUseItem = async () => {
    if (!selectedPetId) {
      alert('Vui lòng chọn thú cưng để sử dụng vật phẩm!');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const userId = JSON.parse(atob(token.split('.')[1])).userId;

      const res = await fetch(`${API_BASE_URL}/api/pets/${selectedPetId}/use-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          item_id: item.item_id, 
          quantity: 1, 
          userId: userId 
        })
      });
      
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Sử dụng vật phẩm thành công!');
        
        // Update item quantity or remove if quantity becomes 0
        if (typeof onUpdateItem === 'function') {
          const newQuantity = item.quantity - 1;
          if (newQuantity <= 0) {
            // Item will be removed from inventory
            onUpdateItem(null); // Signal to remove item
          } else {
            onUpdateItem({ ...item, quantity: newQuantity });
          }
        }
        onClose();
      } else {
        alert(result.message || 'Sử dụng vật phẩm thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi sử dụng vật phẩm:', err);
      alert('Lỗi khi sử dụng vật phẩm.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (action === 'equip' && item.type === 'equipment') {
      handleEquipItem();
      return;
    }
    if (action === 'use' && (item.type === 'food' || item.type === 'consumable' || item.type === 'booster')) {
      handleUseItem();
      return;
    }
    if (action === 'remove' && item.is_equipped) {
      handleUnequipItem();
      return;
    }
    alert(`Action "${action}" triggered on ${item.name}`);
    onClose();
  };

  // Check if item is sold out
  const isSoldOut = item.stock_limit === 0 || item.stock_limit === null;

  if (!item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">{item.name}</h2>
        <img src={`/images/equipments/${item.image_url}`} alt={item.name} className="modal-image" />
        <p className="modal-desc">{item.description}</p>

        {mode === 'shop' ? (
          <button 
            className={`buy-button ${isSoldOut ? 'sold-out' : ''}`}
            onClick={isSoldOut ? undefined : () => onBuy(item)}
            disabled={isSoldOut}
          >
            {isSoldOut ? 'Vật phẩm đã bán hết' : `Mua với giá ${item.price.toLocaleString()} ${item.currency_type === 'gem' ? 'petaGold' : 'peta'}`}
          </button>
        ) : (
          <>
            <div className="modal-action">
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">Chọn hành động</option>
                {(item.type === 'food' || item.type === 'consumable' || item.type === 'booster') && (
                  <option value="use">Sử dụng</option>
                )}
                {item.type === 'equipment' && (
                  <option value="equip">Trang bị</option>
                )}
                {item.is_equipped && <option value="remove">Gỡ bỏ</option>}
                <option value="sell">Bán</option>
              </select>
              <button
                onClick={handleSubmit}
                disabled={!action || loading || 
                  (action === 'equip' && item.type === 'equipment' && !selectedPetId) ||
                  (action === 'use' && (item.type === 'food' || item.type === 'consumable' || item.type === 'booster') && !selectedPetId)
                }
              >
                {loading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>

            {/* Pet selection for equip action */}
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
              </div>
            )}

            {/* Pet selection for use action */}
            {action === 'use' && (item.type === 'food' || item.type === 'consumable' || item.type === 'booster') && (
              <div className="use-section">
                <label>Chọn thú cưng để sử dụng:</label>
                <select value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
                  <option value="">-- Chọn thú cưng --</option>
                  {userPets.map(pet => (
                    <option key={pet.uuid} value={pet.id}>
                      {pet.name} (Lv {pet.level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-info">
              <div><strong>Loại:</strong> {item.type}</div>
              <div><strong>Độ hiếm:</strong> {item.rarity}</div>
              {item.quantity && <div><strong>Số lượng:</strong> {item.quantity}</div>}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default ItemDetailModal;
