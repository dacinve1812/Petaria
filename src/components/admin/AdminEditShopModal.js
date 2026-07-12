// File: AdminEditShopModal.js
import React, { useState } from 'react';
import { useUser } from '../../UserContext';
import { resolveShopImage } from '../../config/generalShops';

function AdminEditShopModal({ shop, onClose, onShopUpdated, onShopDeleted }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user } = useUser();

  const [formData, setFormData] = useState({
    name: shop?.name || '',
    description: shop?.description || '',
    type_filter: shop?.type_filter || 'all',
    currency_type: shop?.currency_type || 'peta',
    sort_order: shop?.sort_order ?? 1,
    image_url: shop?.image_url || resolveShopImage(shop) || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currencyOptions = {
    peta: 'Peta',
    petagold: 'PetaGold',
    arena: 'Arena Points',
    honor: 'Honor Points',
    guild: 'Guild Points',
    guildwar: 'Guild War Points',
    ruby: 'Ruby',
  };

  const typeFilterOptions = {
    all: 'Tất cả',
    food: 'Thức ăn',
    consumable: 'Thuốc phục hồi',
    equipment: 'Trang bị',
    booster: 'Vật phẩm bổ trợ',
    misc: 'Khác',
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shop?.id) {
      alert('Thiếu shop id');
      return;
    }
    if (!formData.name) {
      alert('Vui lòng nhập tên shop');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/${shop.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type_filter: formData.type_filter,
          currency_type: formData.currency_type,
          sort_order: Number(formData.sort_order) || 0,
          image_url: formData.image_url,
          parent_category: shop.parent_category || 'general',
        }),
      });

      if (response.ok) {
        alert('Đã cập nhật shop!');
        onShopUpdated?.();
      } else {
        const error = await response.json().catch(() => ({}));
        alert(`Lỗi: ${error.error || error.message || 'Không thể cập nhật shop'}`);
      }
    } catch (error) {
      console.error('Error updating shop:', error);
      alert('Lỗi khi cập nhật shop');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shop?.id) {
      alert('Thiếu shop id');
      return;
    }
    const ok = window.confirm(
      `Xóa cửa hàng "${shop.name || shop.code}"?\nToàn bộ item trong shop cũng sẽ bị xóa.`
    );
    if (!ok) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/${shop.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (response.ok) {
        alert('Đã xóa cửa hàng');
        onShopDeleted?.(shop);
      } else {
        const error = await response.json().catch(() => ({}));
        alert(`Lỗi: ${error.error || error.message || 'Không thể xóa shop'}`);
      }
    } catch (error) {
      console.error('Error deleting shop:', error);
      alert('Lỗi khi xóa shop');
    } finally {
      setIsDeleting(false);
    }
  };

  const previewSrc = String(formData.image_url || '').trim();
  const busy = isLoading || isDeleting;

  return (
    <div className="modal-overlay">
      <div className="modal-content admin-modal">
        <div className="modal-header">
          <h2>Sửa shop: {shop?.code}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>Tên Shop:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              disabled={busy}
            />
          </div>

          <div className="form-group">
            <label>Mô tả:</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="3"
              disabled={busy}
            />
          </div>

          <div className="form-group">
            <label>Đường dẫn ảnh (image_url):</label>
            <input
              type="text"
              name="image_url"
              value={formData.image_url}
              onChange={handleInputChange}
              placeholder="/images/shops/food.png hoặc https://..."
              disabled={busy}
            />
            <small>Nhập path public (vd: /images/shops/food.png) hoặc URL đầy đủ</small>
            {previewSrc ? (
              <div className="shop-image-preview">
                <img
                  src={previewSrc}
                  alt="preview"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0.3';
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="form-group">
            <label>Loại Item:</label>
            <select
              name="type_filter"
              value={formData.type_filter}
              onChange={handleInputChange}
              disabled={busy}
            >
              {Object.entries(typeFilterOptions).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Loại tiền tệ:</label>
            <select
              name="currency_type"
              value={formData.currency_type}
              onChange={handleInputChange}
              disabled={busy}
            >
              {Object.entries(currencyOptions).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
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
              min="0"
              disabled={busy}
            />
          </div>

          <div className="form-actions form-actions--shop-edit">
            <button type="button" className="btn-danger" disabled={busy} onClick={handleDelete}>
              {isDeleting ? 'Đang xóa...' : '🗑 Xóa cửa hàng'}
            </button>
            <div className="form-actions-right">
              <button type="submit" disabled={busy} className="btn-primary">
                {isLoading ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
                Hủy
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminEditShopModal;
