import React, { useEffect, useState  } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import './HomePage.css'; // Tạo file HomePage.css
import Sidebar from './Sidebar';


function HomePage({isLoggedIn, onLogoutSuccess }) {
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
        setUserId(decodedToken.userId); //set userId here
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


  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  return (
    <div className="container">
      <header>
      <img
          src="/images/buttons/banner.jpeg"
          alt="Banner Petaria"
        />
        {/* <h1>Petaria - Vương quốc thú ảo</h1> */}
      </header>
      <div className="content">
      <Sidebar
          userId={userId}
          handleLogout={handleLogout}
          isAdmin={isAdmin}
        />
      
        <div className="main-content">
          <Outlet />
          <div className="notice">
            <p>Thông báo: Bạn chưa có thú cưng nào cả!</p>
            <p>Bạn có thể đến Trại mồ côi để nhận nuôi thú cưng!!!</p>
          </div>
          <div className="map">
            <img src="map.jpg" alt="Bản đồ Petaria" />
          </div>
          <div className="links">
            <a href="#">Auction</a>
            <a href="#">Sông Jordan</a>
            <a href="#">Bưu điện</a>
            <a href="#">Club</a>
            <a href="#">Cửa hàng</a>
            <a href="#">Ngân hàng</a>
            <a href="/orphanage">Trại mồ côi</a>
            <a href="#">Game Center</a>
            <a href="/myhome">My Home</a>
            <a href="#">Đấu trường</a>
            <a href="#">Penny Shop</a>
          </div>
          <div className="footer">
            <p>WebGame Thú ảo Online được phát triển bởi BaoNguyen</p>
            <p>05:45:23 AM | Terms/Rules | Privacy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;