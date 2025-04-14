// File: EditItems.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import '../HomePage.css';
import { UserContext } from '../../UserContext';
import { Link } from 'react-router-dom';

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
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    if (user === undefined) return;
    if (!user || !user.isAdmin) {
      navigate('/login');
    }
  }, [navigate, user]);

  const fetchItems = async () => {
    try {
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
      setError(err.message);
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
      alert('Item đã được lưu thành công!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
    setEditMode(true);
    setEditId(item.id);
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm('Bạn có chắc muốn xoá item này không?');
    if (!confirm) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/items/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!res.ok) throw new Error('Lỗi khi xoá item');
      await fetchItems();
    } catch (err) {
      alert(err.message);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    navigate('/login');
  };

  return (
    <div className="container">
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="content">
        <Sidebar userId={user?.userId} isAdmin={user?.isAdmin} handleLogout={handleLogout} />
        <div className="main-content">
          <Navbar />
          <h1>Quản lý Items</h1>

          <form className="admin-form-container" onSubmit={handleSubmit}>
            <input className="admin-pet-form-input" type="text" name="name" placeholder="Tên vật phẩm" value={formData.name} onChange={handleChange} required />
            <textarea className="admin-pet-form-input" name="description" placeholder="Mô tả" value={formData.description} onChange={handleChange} required />
            <input className="admin-pet-form-input" type="text" name="image_url" placeholder="Link ảnh" value={formData.image_url} onChange={handleChange} required />
            <select className="admin-pet-form-input" name="type" value={formData.type} onChange={handleChange} required>
              <option value="">Loại vật phẩm</option>
              <option value="food">Food</option>
              <option value="equipment">Equipment</option>
              <option value="consumable">Consumable</option>
              <option value="booster">Booster</option>
              <option value="evolve">Evolve</option>
              <option value="misc">Misc</option>
            </select>
            <select className="admin-pet-form-input" name="rarity" value={formData.rarity} onChange={handleChange} required>
              <option value="">Độ hiếm</option>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
            <div>Giá bán<input className="admin-pet-form-input" type="number" name="buy_price" placeholder="Giá mua" value={formData.buy_price} onChange={handleChange} required /></div>
            <div>Giá Mua<input className="admin-pet-form-input" type="number" name="sell_price" placeholder="Giá bán" value={formData.sell_price} onChange={handleChange} required /></div>
            <button className="admin-pet-form-button" type="submit">{editMode ? 'Cập nhật' : 'Tạo mới'}</button>
          </form>

          <div className="item-summary">
            <h2>Danh sách Items</h2>
            <button onClick={() => setShowList(!showList)}>
              {showList ? 'Ẩn danh sách' : 'Hiện danh sách'}
            </button>

            {showList && (
              <>
                <p>Tổng số items: {filteredItems.length}</p>
                <div className="filter-controls">
                  <input type="text" name="name" placeholder="Lọc theo tên" value={formData.name} onChange={handleChange} />
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
                  <label>
                    <input type="checkbox" checked={sortAZ} onChange={(e) => setSortAZ(e.target.checked)} /> Sắp xếp A-Z
                  </label>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Loại</th>
                      <th>Độ hiếm</th>
                      <th>Ảnh</th>
                      <th>Giá mua</th>
                      <th>Giá bán</th>
                      <th>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.type}</td>
                        <td>{item.rarity}</td>
                        <td><img src= {`/images/equipments/${item.image_url}`} alt={item.name} width="40" /></td>
                        <td>{item.buy_price}</td>
                        <td>{item.sell_price}</td>
                        <td>
                          <button onClick={() => handleEdit(item)}>Sửa</button>
                          <button onClick={() => handleDelete(item.id)}>Xoá</button>
                          {item.type === 'equipment' && (
                                <button><Link to={`/admin/edit-equipment-stats?item_id=${item.id}`}>View stats</Link></button>
                                )}
                          {(item.type === 'booster' || item.type === 'consumable') && (
                            <button><Link to={`/admin/edit-item-effects?item_id=${item.id}`}>View effect</Link>
                            </button>
                            )}
                            
                        </td>
                        
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pagination">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => handlePageClick(i + 1)}
                      disabled={currentPage === i + 1}
                    >{i + 1}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditItems;
