// File: EditEquipmentStats.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import { UserContext } from '../../UserContext';

function EditEquipmentStats() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const location = useLocation();
  const user = useContext(UserContext);

  const [equipmentItems, setEquipmentItems] = useState([]);
  const [equipmentStats, setEquipmentStats] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [power, setPower] = useState(0);
  const [durability, setDurability] = useState(0);
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    if (user === undefined) return; // đợi UserContext load xong
    if (!user || !user.isAdmin) navigate('/login');
    else {
      fetchEquipmentItems();
      fetchEquipmentStats();
    }
  }, [navigate, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get('item_id');
    if (itemId) {
      setSelectedItemId(itemId);
    }
  }, [location.search]);

  const fetchEquipmentItems = async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/items`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const data = await res.json();
    setEquipmentItems(data.filter(item => item.type === 'equipment'));
  };

  const fetchEquipmentStats = async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/equipment-stats`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const data = await res.json();
    setEquipmentStats(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editId ? 'PUT' : 'POST';
    const endpoint = editId
      ? `${API_BASE_URL}/api/admin/equipment-stats/${editId}`
      : `${API_BASE_URL}/api/admin/equipment-stats`;

    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({ item_id: selectedItemId, power, durability })
    });

    if (res.ok) {
      fetchEquipmentStats();
      setSelectedItemId('');
      setPower(0);
      setDurability(0);
      setEditId(null);
      alert('Lưu thành công!');
    } else {
      alert('Có lỗi xảy ra');
    }
  };

  const handleEdit = (stat) => {
    setSelectedItemId(stat.item_id);
    setPower(stat.power);
    setDurability(stat.durability);
    setEditId(stat.id);
  };

  return (
    <div className="container">
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="content">
        <Sidebar userId={user?.userId} isAdmin={user?.isAdmin} handleLogout={() => navigate('/login')} />
        <div className="main-content">
          <Navbar />
          <h1>Quản lý chỉ số Equipment</h1>
            
          <form onSubmit={handleSubmit} className="admin-form-container">
            
            <select className="admin-pet-form-input" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} required>
              <option value="">Chọn item</option>
              {equipmentItems.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input className="admin-pet-form-input" type="number" value={power} onChange={(e) => setPower(e.target.value)} placeholder="Power" required />
            <input className="admin-pet-form-input" type="number" value={durability} onChange={(e) => setDurability(e.target.value)} placeholder="Durability" required />
            <button className="admin-pet-form-button" type="submit">{editId ? 'Cập nhật' : 'Tạo mới'}</button>
          </form>

          <h2>Danh sách Equipment đã cấu hình</h2>
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Picture</th>
                <th>Power</th>
                <th>Durability</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {equipmentStats.map(stat => {
                const item = equipmentItems.find(i => i.id === stat.item_id);
                return (
                  <tr key={stat.id}>
                    <td>{item ? item.name : 'Không tìm thấy'}</td>
                    <td><img src= {`/images/equipments/${item.image_url}`} alt={item.name} width="30" /></td>
                    <td>{stat.power}</td>
                    <td>{stat.durability}</td>
                    <td><button onClick={() => handleEdit(stat)}>Sửa</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EditEquipmentStats;
