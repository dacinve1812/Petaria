import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNavbar from './BottomNavbar';
import CurrencyDisplay from './CurrencyDisplay';
import { Outlet } from 'react-router-dom';
import '../styles/global.css';

function MainLayout() {
    const navigate = useNavigate();
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);
      const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true); // Always mobile layout



  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        navigate('/login');
        return;
    }
    try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        setUserId(decodedToken.userId);
    } catch (err) {
        console.error('Error decoding token:', err);
        setError('Invalid token');
    }
}, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    };

const isAdmin = localStorage.getItem('isAdmin') === 'true';

  return (
    <div className="container">
        <div className="content">
            {sidebarOpen && (
                <div className="sidebar-v2 open">
                <Sidebar userId={userId} handleLogout={handleLogout} isAdmin={isAdmin} />
                </div>
            )}
            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
            )}
      <div className="main-content">
        <Outlet />
      </div>
      <BottomNavbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      {userId && <CurrencyDisplay userId={userId} />}
      </div>
    </div>
  );
}

export default MainLayout; 