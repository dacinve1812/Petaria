import React from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import './MyStuffManagement.css';

function MyStuffManagement() {
  const navigate = useNavigate();

  const managementItems = [
    {
      id: 'profile',
      name: 'My Profile',
      backgroundImage: '/images/buttons/my_profile.png',
      path: '/profile',
    },
    {
      id: 'pets',
      name: 'My Pets',
      backgroundImage: '/images/buttons/my_pet.png',
      path: '/myhome',
    },
    {
      id: 'spirits',
      name: 'My Spirits',
      backgroundImage: '/images/buttons/my_spirit.png',
      path: '/myhome/spirits',
    },
    {
      id: 'inventory',
      name: 'My Inventory',
      backgroundImage: '/images/buttons/my_item.png',
      path: '/inventory',
    },
    {
      id: 'exhibition',
      name: 'Exhibition',
      backgroundImage: '/images/buttons/my_exhibition.png',
      path: '/exhibition',
    },
    {
      id: 'storage-box',
      name: 'Storage Box',
      backgroundImage: '/images/buttons/my_storage_box.png',
      path: '/exhibition',
    },
    {
      id: 'my-shop',
      name: 'My Shop',
      backgroundImage: '/images/buttons/my_shop.png',
      path: '/myshop',
    },
    {
      id: 'buddies',
      name: 'My Buddies',
      backgroundImage: '/images/buttons/my_friend.png',
      path: '/buddies',
    },

    {
      id: 'club',
      name: 'My Guild',
      backgroundImage: '/images/buttons/my_club.png',
      path: '/guild',
    },
    
    
    {
      id: 'scheduled-jobs',
      name: 'Scheduled Jobs',
      backgroundImage: '/images/buttons/my_scheduledjobs.png',
      path: '/scheduled-jobs',
    },
    // {
    //   id: 'arena',
    //   title: 'Arena',
    //   backgroundImage: '/images/background/myarena.jpg',
    //   path: '/battle',
    //   description: 'Đấu trường và PvP'
    // },
    // {
    //   id: 'hunting',
    //   title: 'Hunting',
    //   backgroundImage: '/images/background/myhunting.jpg',
    //   path: '/hunting-world',
    //   description: 'Săn bắt và khám phá'
    // },
    // {
    //   id: 'shop',
    //   title: 'vShop',
    //   backgroundImage: '/images/background/myshop2.jpg',
    //   path: '/shop',
    //   description: 'Cửa hàng mua bán'
    // },
    {
      id: 'title',
      name: 'Danh hiệu',
      backgroundImage: '/images/buttons/my_title.png',
      path: '/title',
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
          {managementItems.map((item, index) => (
            <div 
              key={item.id || `${item.path}-${index}`}
              className="management-item"
              onClick={() => handleItemClick(item)}
            >
              <img
                className="management-item-image"
                src={item.backgroundImage}
                alt={item.name || 'Management box'}
              />
              {/* {item.name ? <div className="management-item-name">{item.name}</div> : null} */}
            </div>
          ))}
        </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default MyStuffManagement;
