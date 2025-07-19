import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNavbar.css';

const BottomNavbar = ({ onToggleSidebar, sidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'town', label: 'Thị trấn', icon: '🏘️', path: '/', hasNotification: false },
    { id: 'shop', label: 'Cửa hàng', icon: '🛒', path: '/shop', hasNotification: true },
    { id: 'pokedex', label: 'Petadex', icon: '📖', path: '/pokedex', hasNotification: true },
    { id: 'cultivate', label: 'Huấn luyện', icon: '⭐', path: '/cultivate', hasNotification: true },
    { id: 'inventory', label: 'Túi đồ', icon: '🎒', path: '/inventory', hasNotification: true },
    { id: 'tasks', label: 'Nhiệm vụ', icon: '✅', path: '/tasks', hasNotification: true },
    { id: 'pokemon', label: 'Thú cưng', icon: '⚡', path: '/myhome', hasNotification: true },
    { id: 'team', label: 'Đội hình', icon: '🏁', path: '/team', hasNotification: true }
  ];

  const handleNavClick = (path) => {
    navigate(path);
  };

  return (
    <div className="bottom-navbar">
      {/* Sidebar toggle button */}
      <div className="nav-item sidebar-toggle" onClick={onToggleSidebar}>
        <div className="nav-icon">
          {sidebarOpen ? '✕' : '☰'}
        </div>
        <span className="nav-label">Menu</span>
      </div>
      
      {navItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => handleNavClick(item.path)}
        >
          <div className="nav-icon">
            {item.icon}
            {item.hasNotification && <div className="notification-dot"></div>}
          </div>
          <span className="nav-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default BottomNavbar; 