// File: AdminAddItemModal.js
import React, { useState, useEffect } from 'react';
import { useUser } from '../../UserContext';

function AdminAddItemModal({ shopCode, shopName, onClose, onItemAdded }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user } = useUser();

  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [customPrice, setCustomPrice] = useState('');
  const [stockLimit, setStockLimit] = useState('');
  const [currencyType, setCurrencyType] = useState('peta');
  const [restockInterval, setRestockInterval] = useState('none');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Currency options based on shop type
  const currencyOptions = {
    'peta': 'Peta',
    'petagold': 'PetaGold',
    'arena': 'Arena Points',
    'honor': 'Honor Points',
    'guild': 'Guild Points',
    'guildwar': 'Guild War Points',
    'ruby': 'Ruby'
  };

  useEffect(() => {
    loadAvailableItems();
  }, [shopCode]);

  const loadAvailableItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/items`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await response.json();
      setAvailableItems(data);
    } catch (error) {
      console.error('Error loading available items:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemId) {
      alert('Vui lòng chọn item');
      return;
    }

    // Validate custom price
    if (customPrice && (parseInt(customPrice) < 0 || parseInt(customPrice) > 999999)) {
      alert('Giá tùy chỉnh phải từ 0 đến 999,999');
      return;
    }

    // Validate stock limit
    if (stockLimit && (parseInt(stockLimit) < 0 || parseInt(stockLimit) > 999999)) {
      alert('Stock limit phải từ 0 đến 999,999');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shop-items/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          shop_code: shopCode,
          item_id: selectedItemId,
          custom_price: customPrice ? parseInt(customPrice) : null,
          currency_type: currencyType,
          stock_limit: stockLimit ? parseInt(stockLimit) : null, // Send null for unlimited, backend will handle it
          restock_interval: restockInterval,
          available_from: availableFrom || null,
          available_until: availableUntil || null
        })
      });

      if (response.ok) {
        alert('Đã thêm item thành công!');
        onItemAdded();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.message || 'Không thể thêm item'}`);
      }
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Lỗi khi thêm item');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedItem = availableItems.find(item => item.id === selectedItemId);

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2>Thêm Item vào {shopName}</h2>
          <button className="admin-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-group">
            <label>Chọn Item:</label>
            <div className="admin-item-selection-grid">
              {availableItems.map(item => (
                <div
                  key={item.id}
                  className={`admin-item-selection-card ${selectedItemId === item.id ? 'admin-selected' : ''}`}
                  onClick={() => setSelectedItemId(item.id)}
                >
                  <img 
                    src={`/images/equipments/${item.image_url}`} 
                    alt={item.name}
                    onError={(e) => {
                      e.target.src = '/images/placeholder.png';
                    }}
                  />
                  <div className="admin-item-name">{item.name}</div>
                  <div className="admin-item-price">Giá gốc: {item.sell_price}</div>
                </div>
              ))}
            </div>
          </div>

          {selectedItem && (
            <div className="admin-selected-item-preview">
              <img src={`/images/equipments/${selectedItem.image_url}`} alt={selectedItem.name} />
              <div>
                <h3>{selectedItem.name}</h3>
                <p>Giá gốc: {selectedItem.sell_price}</p>
              </div>
            </div>
          )}

          <div className="admin-form-group">
            <label>Loại tiền tệ:</label>
            <select 
              value={currencyType} 
              onChange={(e) => setCurrencyType(e.target.value)}
            >
              {Object.entries(currencyOptions).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          </div>

          <div className="admin-form-group">
            <label>Giá tùy chỉnh:</label>
            <input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="Để trống để dùng giá gốc"
              min="0"
              max="999999"
            />
          </div>

          <div className="admin-form-group">
            <label>Stock limit:</label>
            <input
              type="number"
              value={stockLimit}
              onChange={(e) => setStockLimit(e.target.value)}
              placeholder="Để trống để không giới hạn"
              min="0"
              max="999999"
            />
          </div>

          <div className="admin-form-group">
            <label>Restock interval:</label>
            <select 
              value={restockInterval} 
              onChange={(e) => setRestockInterval(e.target.value)}
            >
              <option value="none">Không tự động</option>
              <option value="daily">Hàng ngày</option>
              <option value="weekly">Hàng tuần</option>
              <option value="monthly">Hàng tháng</option>
            </select>
          </div>

          <div className="admin-form-group">
            <label>Available from:</label>
            <input
              type="datetime-local"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label>Available until:</label>
            <input
              type="datetime-local"
              value={availableUntil}
              onChange={(e) => setAvailableUntil(e.target.value)}
            />
          </div>

          <div className="admin-form-actions">
            <button type="submit" disabled={isLoading} className="admin-btn-primary">
              {isLoading ? 'Đang thêm...' : 'Thêm Item'}
            </button>
            <button type="button" onClick={onClose} className="admin-btn-secondary">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminAddItemModal;
