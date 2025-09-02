import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import PetNotice from './PetNotice';
import './HomePage.css';
import GlobalBanner from './GlobalBanner';
import NavigationMenu from './NavigationMenu';
import { resolveAssetPath } from '../utils/pathUtils';

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
      {/* Banner section */}
      <GlobalBanner
        backgroundImage={resolveAssetPath('/images/background/banner-1.jpeg')}
        className="small"
        overlay={false}
      />

      {/* Navigation Menu */}
      <NavigationMenu />
      <PetNotice />
      {/* Map panorama scrollable - native scroll only */}
      <div className="map-scroll-container">
        <img src="map.jpg" alt="Bản đồ Petaria" className="map-img" />
      </div>
    </div>
  );
}

export default HomePage;