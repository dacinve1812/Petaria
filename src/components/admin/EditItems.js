import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import '../HomePage.css';
import { UserContext } from '../../UserContext';

function EditItems() {
    const user = useContext(UserContext);
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [showItems, setShowItems] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
      name: '',
      description: '',
      type: '',
      rarity: '',
      image_url: '',
      buy_price: 0,
      sell_price: 0,
    });
  
    useEffect(() => {
      if (!user || !user.isAdmin) {
        navigate('/login');
      }
    }, [navigate, user]);
  
    const fetchItems = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/items`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        if (!res.ok) throw new Error('Failed to fetch items');
        const data = await res.json();
        setItems(data);
      } catch (err) {
        setError(err.message);
      }
    };
  
    useEffect(() => {
      if (showItems) {
        fetchItems();
      }
    }, [showItems]);
  
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify(formData),
        });
  
        if (!res.ok) throw new Error('Failed to create item');
        alert('Vật phẩm được tạo thành công!');
        setFormData({
          name: '',
          description: '',
          type: '',
          rarity: '',
          image_url: '',
          buy_price: 0,
          sell_price: 0,
        });
        setShowItems(true);
        fetchItems();
  
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
      <header>
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>

      <div className="content">
      <Sidebar userId={user?.userId} isAdmin={user?.isAdmin} handleLogout={handleLogout} />
        <div className="main-content">
          <Navbar />
          <h1>Quản lý Vật phẩm</h1>

          <h2>Tạo vật phẩm mới</h2>
          <form className="admin-pet-form-container" onSubmit={handleSubmit}>
            <input className="admin-pet-form-input" type="text" name="name" placeholder="Tên vật phẩm" value={formData.name} onChange={handleChange} required />
            <textarea className="admin-pet-form-input" name="description" placeholder="Mô tả" value={formData.description} onChange={handleChange} required />
            <select className="admin-pet-form-input" name="type" value={formData.type} onChange={handleChange} required>
              <option value="">Chọn loại</option>
              <option value="food">Food</option>
              <option value="consumable">Consumable</option>
              <option value="equipment">Equipment</option>
              <option value="booster">Booster</option>
              <option value="evolve">Evolve</option>
              <option value="misc">Misc</option>
            </select>
            <select className="admin-pet-form-input" name="rarity" value={formData.rarity} onChange={handleChange} required>
              <option value="">Chọn độ hiếm</option>
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
            <input className="admin-pet-form-input" type="text" name="image_url" placeholder="URL ảnh" value={formData.image_url} onChange={handleChange} required />
            <input className="admin-pet-form-input" type="number" name="buy_price" placeholder="Giá mua" value={formData.buy_price} onChange={handleChange} required />
            <input className="admin-pet-form-input" type="number" name="sell_price" placeholder="Giá bán" value={formData.sell_price} onChange={handleChange} required />

            <button type="submit" className="admin-pet-form-button">Tạo vật phẩm</button>
          </form>
          <h2>Danh sách vật phẩm</h2>
            <button onClick={() => setShowItems(!showItems)}>
            {showItems ? 'Ẩn danh sách vật phẩm' : 'Hiện danh sách vật phẩm'}
            </button>

            {showItems && (
            <>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <table>
                <thead>
                    <tr>
                    <th>ID</th>
                    <th>Tên</th>
                    <th>Loại</th>
                    <th>Rarity</th>
                    <th>Hình ảnh</th>
                    <th>Giá mua</th>
                    <th>Giá bán</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                    <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.name}</td>
                        <td>{item.type}</td>
                        <td>{item.rarity}</td>
                        <td><img src={`/images/pets/${item.image_url}`} alt={item.name} width="50" /></td>
                        <td>{item.buy_price}</td>
                        <td>{item.sell_price}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </>
            )}
        </div>
      </div>
    </div>
  );
}

export default EditItems;
