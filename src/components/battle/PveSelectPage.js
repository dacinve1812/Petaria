// PveSelectPage.js - Trang chọn chế độ PvE
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import '../css/BattlePage.css';

function PveSelectPage() {
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
      console.error('Token decode failed:', err);
      navigate('/login');
    }
  }, [navigate]);

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
          <div className="battle-header">
            <h2>Solo (PvE) - Chọn chế độ</h2>
          </div>
          <div className="battle-mode-grid">
            <div className="battle-mode-card" onClick={() => navigate('/battle/pve/arena')}>
              <img src="/images/icons/arena.png" alt="Arena" />
              <h3>Arena</h3>
              <p>Đấu từng quái vật NPC</p>
            </div>
            <div className="battle-mode-card" onClick={() => alert('Champion - Coming soon')}>
              <img src="/images/icons/champion_icon.png" alt="Champion" />
              <h3>Champion Challenge</h3>
              <p>Đánh theo tổ đội (3v3, 2v2...)</p>
            </div>
            <div className="battle-mode-card" onClick={() => alert('Training Camp - Coming soon')}>
              <img src="/images/icons/training_icon.png" alt="Training" />
              <h3>Training Camp</h3>
              <p>Gửi pet nhận EXP theo thời gian</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PveSelectPage;
