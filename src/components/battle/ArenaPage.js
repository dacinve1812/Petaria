// ArenaPage.js - Trang hiển thị danh sách đối thủ đấu trường
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Navbar';
import Sidebar from '../Sidebar';
import '../css/ArenaPage.css';

function ArenaPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [enemies, setEnemies] = useState([]);
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
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      setUserId(decodedToken.userId);
      setIsAdmin(localStorage.getItem('isAdmin') === 'true');
    } catch (err) {
      console.error('Lỗi giải mã token:', err);
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/arena/enemies`)
      .then(res => res.json())
      .then(data => setEnemies(data))
      .catch(err => console.error('Lỗi khi tải danh sách enemy:', err));
  }, [API_BASE_URL]);

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
          <h2>Đấu Trường Arena</h2>
          <p>Chọn một đối thủ để bắt đầu trận chiến</p>

          <div className="enemy-list">
            {enemies.length === 0 ? (
              <p>Không có đối thủ nào hiện tại.</p>
            ) : (
              enemies.map(enemy => (
                <div key={enemy.id} className="enemy-card">
                  <img src={`/images/pets/${enemy.image}`} alt={enemy.name} />
                  <h3>{enemy.name}</h3>
                  <p>Level: {enemy.level}</p>
                  <button onClick={() => alert(`Chọn pet để đấu với ${enemy.name}`)}>
                    Chiến đấu
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArenaPage;
