// File: AdminAddShopModal.js
import React, { useState } from 'react';
import { useUser } from '../../UserContext';

function AdminAddShopModal({ parentCategory, onClose, onShopAdded }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user } = useUser();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    type_filter: 'all',
    currency_type: 'peta',
    sort_order: 1
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

  // Type filter options
  const typeFilterOptions = {
    'all': 'Tất cả',
    'food': 'Thức ăn',
    'consumable': 'Thuốc phục hồi',
    'equipment': 'Trang bị',
    'booster': 'Vật phẩm bổ trợ',
    'misc': 'Khác'
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
    if (!formData.name || !formData.code) {
      alert('Vui lòng điền đầy đủ tên và mã shop');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          ...formData,
          parent_category: parentCategory
        })
      });

      if (response.ok) {
        alert('Đã thêm shop thành công!');
        onShopAdded();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.message || 'Không thể thêm shop'}`);
      }
    } catch (error) {
      console.error('Error adding shop:', error);
      alert('Lỗi khi thêm shop');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content admin-modal">
        <div className="modal-header">
          <h2>Thêm Shop mới vào {parentCategory}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>Tên Shop:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ví dụ: VIP Shop"
              required
            />
          </div>

          <div className="form-group">
            <label>Mã Shop (code):</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="Ví dụ: vip_shop"
              required
            />
            <small>Mã shop phải là duy nhất và không có khoảng trắng</small>
          </div>

          <div className="form-group">
            <label>Mô tả:</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Mô tả về shop này..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Loại Item:</label>
            <select 
              name="type_filter"
              value={formData.type_filter} 
              onChange={handleInputChange}
            >
              {Object.entries(typeFilterOptions).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
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
            <label>Thứ tự sắp xếp:</label>
            <input
              type="number"
              name="sort_order"
              value={formData.sort_order}
              onChange={handleInputChange}
              min="1"
              max="10"
            />
            <small>Số càng nhỏ càng hiển thị trước</small>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={isLoading} className="btn-primary">
              {isLoading ? 'Đang thêm...' : 'Thêm Shop'}
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

export default AdminAddShopModal;
