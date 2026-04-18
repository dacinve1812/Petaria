import React from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import './MyStuffManagement.css';

function MyStuffManagement() {
  const navigate = useNavigate();

  const managementItems = [
    
    {
      id: 'myshop',
      title: 'My Shop',
      backgroundImage: '/images/background/myshop.jpg',
      path: '/myshop',
      description: 'Quản lý cửa hàng'
    },
    {
      id: 'buddies',
      title: 'My Buddies',
      backgroundImage: '/images/background/mybuddies.jpg',
      path: '/buddies',
      description: 'Quản lý bạn bè và liên lạc'
    },
    {
      id: 'club',
      title: 'My Guild',
      backgroundImage: '/images/background/myclub.jpg',
      path: '/guild',
      description: 'Quản lý câu lạc bộ và nhóm'
    },
    {
      id: 'inventory',
      title: 'My Inventory',
      backgroundImage: '/images/background/inventory3.jpg',
      path: '/inventory',
      description: 'Quản lý kho đồ và vật phẩm'
    },
    {
      id: 'pets',
      title: 'My Pets',
      backgroundImage: '/images/background/mypet2.jpg',
      path: '/myhome',
      description: 'Quản lý thú cưng của bạn'
    },
    {
      id: 'profile',
      title: 'My Profile',
      backgroundImage: '/images/background/myprofile.jpg',
      path: '/profile',
      description: 'Thông tin cá nhân và cài đặt'
    },
    {
      id: 'scheduled-jobs',
      title: 'My Scheduled Jobs',
      backgroundImage: '/images/background/myschedule.jpg',
      path: '/scheduled-jobs',
      description: 'Quản lý công việc đã lên lịch'
    },
    {
      id: 'arena',
      title: 'Arena',
      backgroundImage: '/images/background/myarena.jpg',
      path: '/battle',
      description: 'Đấu trường và PvP'
    },
    {
      id: 'hunting',
      title: 'Hunting',
      backgroundImage: '/images/background/myhunting.jpg',
      path: '/hunting-world',
      description: 'Săn bắt và khám phá'
    },
    {
      id: 'shop',
      title: 'vShop',
      backgroundImage: '/images/background/myshop2.jpg',
      path: '/shop',
      description: 'Cửa hàng mua bán'
    }
  ];

  const handleItemClick = (item) => {
    navigate(item.path);
  };

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="my-stuff-management">
        {/* Main content */}
        <div className="management-main">
        <div className="management-grid">
          {managementItems.map(item => (
            <div 
              key={item.id}
              className="management-item"
              onClick={() => handleItemClick(item)}
              style={{
                backgroundImage: `url(${item.backgroundImage})`
              }}
            >
              <div className="item-overlay">
                <div className="item-title">
                  {item.title}
                </div>
                <div className="item-description">
                  {item.description}
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default MyStuffManagement;
