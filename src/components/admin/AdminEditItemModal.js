// File: AdminEditItemModal.js
import React, { useState, useEffect } from 'react';
import { useUser } from '../../UserContext';

function AdminEditItemModal({ item, onClose, onItemUpdated }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user } = useUser();

  // Debug: Log item object only when it changes
  useEffect(() => {
    // Only log when item.id changes
  }, [item.id]); // Only log when item.id changes

  const [formData, setFormData] = useState({
    custom_price: item.custom_price || item.price || '',
    currency_type: item.currency_type || 'peta',
    stock_limit: item.stock_limit && item.stock_limit !== 9999 ? item.stock_limit : '', // Show empty if unlimited
    restock_interval: item.restock_interval || 'none',
    available_from: item.available_from ? item.available_from.slice(0, 16) : '',
    available_until: item.available_until ? item.available_until.slice(0, 16) : ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Currency options
  const currencyOptions = {
    'peta': 'Peta',
    'petagold': 'PetaGold',
    'arena': 'Arena Points',
    'honor': 'Honor Points',
    'guild': 'Guild Points',
    'guildwar': 'Guild War Points',
    'ruby': 'Ruby'
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate custom price
    if (formData.custom_price && (parseInt(formData.custom_price) < 0 || parseInt(formData.custom_price) > 999999)) {
      alert('Giá tùy chỉnh phải từ 0 đến 999,999');
      return;
    }

    // Validate stock limit
    if (formData.stock_limit && (parseInt(formData.stock_limit) < 0 || parseInt(formData.stock_limit) > 999999)) {
      alert('Stock limit phải từ 0 đến 999,999');
      return;
    }

    setIsLoading(true);
    try {
      // Process form data before sending
      const processedData = {
        ...formData,
        custom_price: formData.custom_price ? parseInt(formData.custom_price) : null,
        stock_limit: formData.stock_limit ? parseInt(formData.stock_limit) : null, // Send null for unlimited, backend will handle it
        available_from: formData.available_from || null,
        available_until: formData.available_until || null
      };

      const response = await fetch(`${API_BASE_URL}/api/admin/shop-items/${item.shop_id}/${item.item_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(processedData)
      });

      if (response.ok) {
        const result = await response.json();
        alert('Đã cập nhật item thành công!');
        onItemUpdated();
      } else {
        const error = await response.json();
        console.error('❌ Update failed:', error);
        alert(`Lỗi: ${error.message || 'Không thể cập nhật item'}`);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Lỗi khi cập nhật item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${item.name}" khỏi shop?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shop-items/${item.shop_id}/${item.item_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert('Đã xóa item thành công!');
        onItemUpdated();
      } else {
        const error = await response.json();
        console.error('❌ Delete failed:', error);
        alert(`Lỗi: ${error.message || 'Không thể xóa item'}`);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Lỗi khi xóa item');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="admin-modal-content admin-modal">
        <div className="admin-modal-header">
          <h2>Chỉnh sửa Item</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="item-preview">
          <img 
            src={`/images/equipments/${item.image_url}`} 
            alt={item.name}
            onError={(e) => {
              e.target.src = '/images/placeholder.png';
            }}
          />
          <div>
            <h3>{item.name}</h3>
            <p>Giá gốc: {item.price}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>Giá tùy chỉnh:</label>
            <input
              type="number"
              name="custom_price"
              value={formData.custom_price}
              onChange={handleInputChange}
              placeholder="Để trống để dùng giá gốc"
              min="0"
              max="999999"
            />
          </div>

          <div className="form-group">
            <label>Loại tiền tệ:</label>
            <select 
              name="currency_type"
              value={formData.currency_type} 
              onChange={handleInputChange}
            >
              {Object.entries(currencyOptions).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Stock limit:</label>
            <input
              type="number"
              name="stock_limit"
              value={formData.stock_limit}
              onChange={handleInputChange}
              placeholder="Để trống để không giới hạn"
              min="0"
              max="999999"
            />
          </div>

          <div className="form-group">
            <label>Restock interval:</label>
            <select 
              name="restock_interval"
              value={formData.restock_interval} 
              onChange={handleInputChange}
            >
              <option value="none">Không tự động</option>
              <option value="daily">Hàng ngày</option>
              <option value="weekly">Hàng tuần</option>
              <option value="monthly">Hàng tháng</option>
            </select>
          </div>

          <div className="form-group">
            <label>Available from:</label>
            <input
              type="datetime-local"
              name="available_from"
              value={formData.available_from}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Available until:</label>
            <input
              type="datetime-local"
              name="available_until"
              value={formData.available_until}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={isLoading} className="btn-primary">
              {isLoading ? 'Đang cập nhật...' : 'Cập nhật'}
            </button>
            <button 
              type="button" 
              onClick={handleDelete} 
              disabled={isLoading}
              className="btn-danger"
            >
              {isLoading ? 'Đang xóa...' : 'Xóa Item'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminEditItemModal;
