// File: EditItems.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import './EditItems.css';

function EditItems() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const user = useContext(UserContext);

  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    rarity: '',
    image_url: '',
    buy_price: 0,
    sell_price: 0,
  });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/items`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!res.ok) throw new Error('Lỗi khi lấy danh sách items');
      const data = await res.json();
      setItems(data);
      setFilteredItems(data);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showList) {
      fetchItems();
    }
  }, [showList]);

  useEffect(() => {
    let filtered = [...items];
    if (filterType) filtered = filtered.filter(i => i.type === filterType);
    if (filterRarity) filtered = filtered.filter(i => i.rarity === filterRarity);
    if (formData.name) filtered = filtered.filter(i => i.name.toLowerCase().includes(formData.name.toLowerCase()));
    if (sortAZ) filtered.sort((a, b) => a.name.localeCompare(b.name));
    setFilteredItems(filtered);
    setCurrentPage(1);
  }, [items, filterType, filterRarity, sortAZ, formData.name]);

  if (!user || !user.isAdmin) {
    navigate('/login');
    return null;
  }

  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  const handlePageClick = (page) => {
    setCurrentPage(page);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const endpoint = editMode
      ? `${API_BASE_URL}/api/admin/items/${editId}`
      : `${API_BASE_URL}/api/admin/items`;
    const method = editMode ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Lỗi khi lưu item');

      await fetchItems();
      setFormData({ name: '', description: '', type: '', rarity: '', image_url: '', buy_price: 0, sell_price: 0 });
      setEditMode(false);
      setEditId(null);
      setMessage('✅ Item đã được lưu thành công!');
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
    setEditMode(true);
    setEditId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm('Bạn có chắc muốn xoá item này không?');
    if (!confirm) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/items/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!res.ok) throw new Error('Lỗi khi xoá item');
      await fetchItems();
      setMessage('✅ Đã xoá item thành công!');
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-items">
      <div className="edit-items-header">
        <h1>Quản lý Items</h1>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="edit-items-content">
        <div className="form-section">
          <h2>{editMode ? 'Chỉnh sửa' : 'Tạo mới'} Item</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Tên vật phẩm:</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Nhập tên vật phẩm"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Mô tả:</label>
                <textarea
                  name="description"
                  placeholder="Nhập mô tả"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  required
                />
              </div>

              <div className="form-group">
                <label>Link ảnh:</label>
                <input
                  type="text"
                  name="image_url"
                  placeholder="Tên file ảnh"
                  value={formData.image_url}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Loại vật phẩm:</label>
                <select name="type" value={formData.type} onChange={handleChange} required>
                  <option value="">-- Chọn loại --</option>
                  <option value="food">Food</option>
                  <option value="equipment">Equipment</option>
                  <option value="consumable">Consumable</option>
                  <option value="booster">Booster</option>
                  <option value="evolve">Evolve</option>
                  <option value="misc">Misc</option>
                </select>
              </div>

              <div className="form-group">
                <label>Độ hiếm:</label>
                <select name="rarity" value={formData.rarity} onChange={handleChange} required>
                  <option value="">-- Chọn độ hiếm --</option>
                  <option value="common">Common</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>

              <div className="form-group">
                <label>Giá mua:</label>
                <input
                  type="number"
                  name="buy_price"
                  placeholder="0"
                  value={formData.buy_price}
                  onChange={handleChange}
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Giá bán:</label>
                <input
                  type="number"
                  name="sell_price"
                  placeholder="0"
                  value={formData.sell_price}
                  onChange={handleChange}
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Đang xử lý...' : (editMode ? 'Cập nhật' : 'Tạo mới')}
              </button>
              {editMode && (
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setEditMode(false);
                    setEditId(null);
                    setFormData({ name: '', description: '', type: '', rarity: '', image_url: '', buy_price: 0, sell_price: 0 });
                  }}
                >
                  Hủy
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="list-section">
          <div className="list-header">
            <h2>Danh sách Items</h2>
            <button 
              className="toggle-list-btn"
              onClick={() => setShowList(!showList)}
            >
              {showList ? 'Ẩn danh sách' : 'Hiện danh sách'}
            </button>
          </div>

          {showList && (
            <div className="list-content">
              <div className="list-controls">
                <div className="search-filter">
                  <input
                    type="text"
                    name="name"
                    placeholder="Tìm theo tên..."
                    value={formData.name}
                    onChange={handleChange}
                  />
                  <select onChange={(e) => setFilterType(e.target.value)} value={filterType}>
                    <option value="">Tất cả loại</option>
                    <option value="food">Food</option>
                    <option value="equipment">Equipment</option>
                    <option value="consumable">Consumable</option>
                    <option value="booster">Booster</option>
                    <option value="evolve">Evolve</option>
                    <option value="misc">Misc</option>
                  </select>
                  <select onChange={(e) => setFilterRarity(e.target.value)} value={filterRarity}>
                    <option value="">Tất cả độ hiếm</option>
                    <option value="common">Common</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                  <label className="sort-checkbox">
                    <input 
                      type="checkbox" 
                      checked={sortAZ} 
                      onChange={(e) => setSortAZ(e.target.checked)} 
                    />
                    Sắp xếp A-Z
                  </label>
                </div>
                <p className="total-count">Tổng số: {filteredItems.length}</p>
              </div>

              {loading ? (
                <div className="loading">Đang tải...</div>
              ) : (
                <>
                  <div className="table-container">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>Ảnh</th>
                          <th>Tên</th>
                          <th>Mô tả</th>
                          <th>Loại</th>
                          <th>Độ hiếm</th>
                          <th>Giá mua</th>
                          <th>Giá bán</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map(item => (
                          <tr key={item.id}>
                            <td>
                              <img 
                                src={`/images/equipments/${item.image_url}`} 
                                alt={item.name} 
                                className="item-image"
                                onError={(e) => {
                                  e.target.src = '/images/equipments/default.png';
                                }}
                              />
                            </td>
                            <td className="item-name">{item.name}</td>
                            <td className="item-description">
                              <div className="description-text" title={item.description}>
                                {item.description}
                              </div>
                            </td>
                            <td>
                              <span className={`type-badge type-${item.type}`}>
                                {item.type}
                              </span>
                            </td>
                            <td>
                              <span className={`rarity-badge rarity-${item.rarity}`}>
                                {item.rarity}
                              </span>
                            </td>
                            <td>{item.buy_price}</td>
                            <td>{item.sell_price}</td>
                            <td>
                              <div className="action-buttons">
                                <button 
                                  className="edit-btn"
                                  onClick={() => handleEdit(item)}
                                  title="Chỉnh sửa"
                                >
                                  ✏️
                                </button>
                                <button 
                                  className="delete-btn"
                                  onClick={() => handleDelete(item.id)}
                                  title="Xóa"
                                >
                                  🗑️
                                </button>
                                {item.type === 'equipment' && (
                                  <Link 
                                    to={`/admin/edit-equipment-stats?item_id=${item.id}`}
                                    className="view-btn"
                                    title="Xem stats"
                                  >
                                    ⚔️
                                  </Link>
                                )}
                                {(item.type === 'booster' || item.type === 'consumable') && (
                                  <Link 
                                    to={`/admin/edit-item-effects?item_id=${item.id}`}
                                    className="view-btn"
                                    title="Xem effects"
                                  >
                                    ⚡
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="pagination">
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => handlePageClick(i + 1)}
                          className={currentPage === i + 1 ? 'active-page' : ''}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditItems;
