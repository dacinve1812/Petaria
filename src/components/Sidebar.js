import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import { getDisplayName } from '../utils/userDisplay';
import './Sidebar.css';

function Sidebar({ userId, handleLogout, isAdmin: isAdminProp, className = 'sidebar', onCurrencyUpdate }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [displayName, setDisplayName] = useState('');
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [gold, setGold] = useState(0);
  const [petagold, setPetagold] = useState(0);

  /* Cùng cách check admin như sgw-user-dropdown-menu: user.role === 'admin' */
  const isAdmin = !isLoading && user && user.role === 'admin';

  const fetchUserData = () => {
    if (!userId) return;
    fetch(`${API_BASE_URL}/users/${userId}`)
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        setDisplayName(getDisplayName(data, ''));
        setOnlineStatus(data.online_status);
        // Backend (server.js) GET /users/:userId trả về peta, petagold (không có gold)
        setGold(Number(data.peta ?? 0));
        setPetagold(Number(data.petagold ?? 0));
      })
      .catch((error) => console.error('Error fetching user data:', error));
  };

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  useEffect(() => {
    if (onCurrencyUpdate != null) fetchUserData();
  }, [onCurrencyUpdate]);

  useEffect(() => {
    if (!displayName) {
      setDisplayName(getDisplayName(user, ''));
    }
  }, [displayName, user]);

  return (
    <div className={className}>
      <div className="sidebar-inner">
        <nav>
          <ul>
            <li><a href="/" onClick={handleLogout}><img src="/images/buttons/exit.png" alt="exit"/></a></li>
            {isAdmin && (
              <li><a href="/admin"><img src="/images/buttons/admin.png" alt="Admin"/></a></li>
            )}
            <li><a href="/"><img src="/images/buttons/mainpage.png" alt="mainpage"/></a></li>
            <li><a href="/world-map"><img src="/images/buttons/world.png" alt="world"/></a></li>
            <li><a href="/home-ver2"><img src="/images/buttons/homepage.png" alt="homepage"/></a></li>
            <li><a href="/management"><img src="/images/buttons/management.png" alt="management"/></a></li>
            <li><a href="/"><img src="/images/buttons/analyze.png" alt="analysis"/></a></li>
          </ul>
        </nav>
        <div className="user-info">
          <p>{displayName}</p>
          
          <div className="user-info-currency">
            <div className="user-info-currency-item">
              <div className="user-info-currency-label">
                <img src="/images/icons/peta.png" alt="Peta" />
                <span>peta:</span>
              </div>
              <span className="user-info-currency-value">{gold.toLocaleString()}</span>
            </div>
            <div className="user-info-currency-item">
              <div className="user-info-currency-label">
                <img src="/images/icons/petagold.png" alt="PetaGold" />
                <span>petaGold:</span>
              </div>
              <span className="user-info-currency-value">{petagold.toLocaleString()}</span>
            </div>
          </div>
          {/* <button>Tìm kiếm</button> */}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;