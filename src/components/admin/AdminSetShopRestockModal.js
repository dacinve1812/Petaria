// File: AdminSetShopRestockModal.js
import React, { useState, useEffect } from 'react';
import { useUser } from '../../UserContext';

function AdminSetShopRestockModal({ shop, onClose, onRestockUpdated }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user } = useUser();

  const [restockInterval, setRestockInterval] = useState('none');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shop) {
      setRestockInterval(shop.shop_restock_interval || 'none');
    }
  }, [shop]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!shop) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/${shop.id}/restock-interval`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          shop_restock_interval: restockInterval
        })
      });

      if (response.ok) {
        alert('Đã cập nhật restock interval thành công!');
        onRestockUpdated();
        onClose();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.message || 'Không thể cập nhật restock interval'}`);
      }
    } catch (error) {
      console.error('Error updating restock interval:', error);
      alert('Lỗi khi cập nhật restock interval');
    } finally {
      setIsLoading(false);
    }
  };

  const restockOptions = [
    { value: 'none', label: 'Không restock' },
    { value: 'daily', label: 'Hàng ngày (Daily)' },
    { value: 'weekly', label: 'Hàng tuần (Weekly)' },
    { value: 'monthly', label: 'Hàng tháng (Monthly)' }
  ];

  if (!shop) return null;

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>Set Restock Interval - {shop.name}</h3>
          <button 
            className="admin-close-btn" 
            onClick={onClose}
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label htmlFor="restock-interval">Restock Interval:</label>
            <select
              id="restock-interval"
              value={restockInterval}
              onChange={(e) => setRestockInterval(e.target.value)}
              disabled={isLoading}
              className="admin-form-control"
            >
              {restockOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="admin-form-text">
              Restock cycle này sẽ áp dụng cho tất cả items trong shop "{shop.name}".
              <br/>• <strong>Daily</strong>: Reset mỗi ngày theo Global Reset Time
              <br/>• <strong>Weekly</strong>: Reset mỗi tuần (ví dụ: Chủ nhật)
              <br/>• <strong>Monthly</strong>: Reset mỗi tháng (ngày 1)
              <br/>• <strong>Không restock</strong>: Shop timer sẽ không hiển thị
            </small>
          </div>

          <div className="admin-form-actions">
            <button 
              type="button" 
              className="admin-btn-secondary" 
              onClick={onClose}
              disabled={isLoading}
            >
              Hủy
            </button>
            <button 
              type="submit" 
              className="admin-btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Đang cập nhật...' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminSetShopRestockModal;
