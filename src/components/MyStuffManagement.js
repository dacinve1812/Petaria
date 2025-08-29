import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MyStuffManagement.css';

function MyStuffManagement() {
  const navigate = useNavigate();

  const managementItems = [
    {
      id: 'shop',
      title: 'My Shop',
      icon: '🏪',
      path: '/shop',
      description: 'Quản lý cửa hàng và mua bán'
    },
    {
      id: 'buddies',
      title: 'My Buddies',
      icon: '👥',
      path: '/buddies',
      description: 'Quản lý bạn bè và liên lạc'
    },
    {
      id: 'club',
      title: 'My Club',
      icon: '🏆',
      path: '/club',
      description: 'Quản lý câu lạc bộ và nhóm'
    },
    {
      id: 'inventory',
      title: 'My Inventory',
      icon: '📦',
      path: '/inventory',
      description: 'Quản lý kho đồ và vật phẩm'
    },
    {
      id: 'pets',
      title: 'My Pets',
      icon: '🐾',
      path: '/pets',
      description: 'Quản lý thú cưng của bạn'
    },
    {
      id: 'profile',
      title: 'My Profile',
      icon: '👤',
      path: '/profile',
      description: 'Thông tin cá nhân và cài đặt'
    },
    {
      id: 'scheduled-jobs',
      title: 'My Scheduled Jobs',
      icon: '📅',
      path: '/scheduled-jobs',
      description: 'Quản lý công việc đã lên lịch'
    },
    {
      id: 'arena',
      title: 'Arena',
      icon: '⚔️',
      path: '/arena',
      description: 'Đấu trường và PvP'
    },
    {
      id: 'hunting',
      title: 'Hunting',
      icon: '🎯',
      path: '/hunting',
      description: 'Săn bắt và khám phá'
    }
  ];

  const handleItemClick = (item) => {
    navigate(item.path);
  };

  return (
    <div className="my-stuff-management">
      <div className="management-header">
        <h1>My Stuff Management Panel</h1>
        <p>Quản lý tất cả các tính năng và dịch vụ của bạn</p>
      </div>

      <div className="management-grid">
        {managementItems.map(item => (
          <div 
            key={item.id}
            className="management-item"
            onClick={() => handleItemClick(item)}
          >
            <div className="item-icon">
              {item.icon}
            </div>
            <div className="item-title">
              {item.title}
            </div>
            <div className="item-description">
              {item.description}
            </div>
          </div>
        ))}
      </div>

      <div className="management-footer">
        <button 
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          ← Quay lại
        </button>
      </div>
    </div>
  );
}

export default MyStuffManagement;
