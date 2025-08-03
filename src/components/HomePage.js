import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import './HomePage.css';

function HomePage({ isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);

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

  const handleLogout = () => {
    onLogoutSuccess();
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div>
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
      {/* <div className="footer">
        <p>WebGame Thú ảo Online được phát triển bởi BaoNguyen</p>
        <p>05:45:23 AM | Terms/Rules | Privacy</p>
      </div> */}
    </div>
  );
}

export default HomePage;