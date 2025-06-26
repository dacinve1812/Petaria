// BattlePage.js - Giao diện tổng quan các chế độ chiến đấu
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import '../css/BattlePage.css';

function BattlePage() {
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
            <h2>Chế độ chiến đấu</h2>
            <div className="battle-background-img"></div>
          </div>
          <div className="battle-mode-grid">
            <div className="battle-mode-card" onClick={() => navigate('/battle/pve')}>
              <img src="/images/icons/arena_icon.png" alt="Arena" />
              <h3>Solo Arena</h3>
              <p>Chiến đấu với quái NPC</p>
            </div>
            <div className="battle-mode-card" onClick={() => alert('Versus PvP - Coming soon')}> 
              <img src="/images/icons/versus_icon.png" alt="PvP" />
              <h3>Versus PvP</h3>
              <p>Thách đấu người chơi khác</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BattlePage;
