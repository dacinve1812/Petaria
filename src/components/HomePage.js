import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import './HomePage.css';
import Sidebar from './Sidebar';

function HomePage({ isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 800);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        setUserId(decodedToken.userId);
      } catch (err) {
        console.error('Error decoding token:', err);
        navigate('/login');
      }
    }
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 800);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    onLogoutSuccess();
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  return (
    <div className="container">
      <header>
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>
      <div className="content">
        {/* Sidebar: desktop luôn hiện, mobile chỉ hiện khi sidebarOpen */}
        {(!isMobile || (isMobile && sidebarOpen)) && (
          <div className={`sidebar-v2 ${!isMobile || sidebarOpen ? 'open' : ''} ${!isMobile ? 'always-show' : ''}`}>
            <Sidebar
              userId={userId}
              handleLogout={handleLogout}
              isAdmin={isAdmin}
            />
          </div>
        )}
        {/* Overlay khi sidebar mở ở mobile */}
        {sidebarOpen && isMobile && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
        )}
        <div className="main-content">
          <Outlet />
          <div className="notice">
            <p>Thông báo: Bạn chưa có thú cưng nào cả!</p>
            <p>Bạn có thể đến Trại mồ côi để nhận nuôi thú cưng!!!</p>
          </div>
          {/* Map panorama scrollable - native scroll only */}
          <div className="map-scroll-container">
            <img src="map.jpg" alt="Bản đồ Petaria" className="map-img" />
          </div>
          <div className="links">
            <a href="/shop">Cửa hàng</a>
            <a href="/orphanage">Trại mồ côi</a>
            <a href="/myhome">My Home</a>
            <a href="/battle">Đấu trường</a>
          </div>
          <div className="footer">
            <p>WebGame Thú ảo Online được phát triển bởi BaoNguyen</p>
            <p>05:45:23 AM | Terms/Rules | Privacy</p>
          </div>
        </div>
        {/* Burger menu - bottom left, chỉ hiện ở mobile */}
        {isMobile && (
          <button className="burger-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <span style={{ fontSize: 32 }}>&lt;</span> : <span style={{ fontSize: 32 }}>&gt;</span>}
          </button>
        )}
      </div>
    </div>
  );
}

export default HomePage;