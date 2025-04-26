// AdminAddPetForBattle.js - Tạo pet từ species dùng cho NPC, Arena, Champion, Boss, v.v.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/AdminCreatePet.css';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';

function AdminAddPetForBattle() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [speciesList, setSpeciesList] = useState([]);
  const [form, setForm] = useState({
    pet_species_id: '',
    level: 10,
    custom_name: ''
  });
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      setUserId(decoded.userId);
      setIsAdmin(localStorage.getItem('isAdmin') === 'true');
    } catch (err) {
      console.error('Token decode error:', err);
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/pet-species`)
      .then(res => res.json())
      .then(data => setSpeciesList(data))
      .catch(err => console.error('Lỗi khi tải pet species:', err));
  }, [API_BASE_URL]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/arena-pet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) setMessage(data.message || 'Tạo pet thành công!');
      else setMessage(data.message || 'Không thể tạo pet.');
    } catch (err) {
      console.error('Lỗi khi gọi API:', err);
      setMessage('Lỗi khi gửi yêu cầu tạo pet.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="container">
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="content">
        <Sidebar userId={userId} handleLogout={handleLogout} isAdmin={isAdmin} />
        <div className="main-content">
          <Navbar />
          <div className="admin-create-pet">
            <h2>Tạo Pet từ Species (NPC/Arena/Boss)</h2>
            {message && <p className="message">{message}</p>}
            <label>Chọn loài thú cưng:</label>
            <select name="pet_species_id" value={form.pet_species_id} onChange={handleChange}>
              <option value="">-- Chọn loài --</option>
              {speciesList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select><br />

            <label>Level: <input type="number" name="level" value={form.level} onChange={handleChange} /></label><br />
            <label>Tên tùy chỉnh: <input type="text" name="custom_name" value={form.custom_name} onChange={handleChange} /></label><br />
            <button onClick={handleSubmit}>Tạo Pet NPC</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAddPetForBattle;
