import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './NavigationMenu.css';

const NavigationMenu = () => {
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const navRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setActiveDropdown(null);
        // Remove show class
        const dropdown = document.querySelector('.dropdown-menu');
        if (dropdown) {
          dropdown.classList.remove('show');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const menuItems = [
    {
      id: 'home',
      title: 'Trang chủ',
      path: '/',
      submenu: [
        { title: 'Trang Chủ', path: '/' },
        { title: 'Kinh Thành', path: '/home-ver2' }
      ]
    },
    {
      id: 'features',
      title: 'Đặc trưng',
      submenu: [
        { title: 'Trang bị', path: '/inventory' },
        { title: 'Thú cưng', path: '/myhome' },
        { title: 'Ngân Hàng', path: '/bank' },
        { title: 'Mua sắm', path: '/shop' },
        { title: 'Đấu giá', path: '/' },
        { title: 'Nhà hàng', path: '/' },
        { title: 'Bưu điện', path: '/' },
        { title: 'Viện mồ côi', path: '/orphanage' },
        { title: 'Sông Healia', path: '/' },
        { title: 'Đấu trường', path: '/battle/pve' },
        { title: 'Đi săn', path: '/hunting-world' },
        { title: 'Bang hội', path: '/guild' },
        { title: 'Nhiệm vụ', path: '/quest' },
      ]
    },
    {
      id: 'system',
      title: 'Hệ thống',
      submenu: [
        { title: 'Hệ thống người dùng', path: '/system/users' },
        { title: 'Hệ thống vật phẩm', path: '/system/items' },
        { title: 'Hệ thống kinh nghiệm', path: '/system/experience' }
      ]
    },
    {
      id: 'guide',
      title: 'Hướng dẫn',
      submenu: [
        { title: 'Hướng dẫn mới bắt đầu', path: '/guide/beginner' },
        { title: 'Hướng dẫn nâng cao', path: '/guide/advanced' },
        { title: 'FAQ', path: '/guide/faq' }
      ]
    },
    {
      id: 'rules',
      title: 'Quy định',
      submenu: [
        { title: 'Điều khoản sử dụng', path: '/rules/terms' },
        { title: 'Quy tắc cộng đồng', path: '/rules/community' },
        { title: 'Chính sách bảo mật', path: '/rules/privacy' }
      ]
    },
    {
      id: 'community',
      title: 'Cộng đồng',
      submenu: [
        { title: 'Diễn đàn', path: '/community/forum' },
        { title: 'Thảo luận', path: '/community/discussions' },
        { title: 'Hỗ trợ', path: '/community/support' }
      ]
    }
  ];

  const handleItemClick = (item, event) => {
    if (item.submenu) {
      // Toggle dropdown
      const newActiveDropdown = activeDropdown === item.id ? null : item.id;
      setActiveDropdown(newActiveDropdown);
      
      // Position dropdown
      if (newActiveDropdown) {
        // Store the rect immediately to avoid null reference
        const rect = event.currentTarget.getBoundingClientRect();
        
        setTimeout(() => {
          const dropdown = document.querySelector('.dropdown-menu');
          if (dropdown) {
            // Calculate position
            const viewportWidth = window.innerWidth;
            const dropdownWidth = 200; // min-width
            let left = rect.left + rect.width / 2 - dropdownWidth / 2;
            
            // Keep dropdown within viewport
            if (left < 10) left = 10;
            if (left + dropdownWidth > viewportWidth - 10) {
              left = viewportWidth - dropdownWidth - 10;
            }
            
            dropdown.style.left = `${left}px`;
            dropdown.style.top = `${rect.bottom + 5}px`;
            dropdown.classList.add('show');
          }
        }, 10);
      }
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const handleSubmenuClick = (submenuItem) => {
    navigate(submenuItem.path);
    setActiveDropdown(null);
    // Remove show class
    const dropdown = document.querySelector('.dropdown-menu');
    if (dropdown) {
      dropdown.classList.remove('show');
    }
  };

  return (
    <nav className="navigation-menu" ref={navRef}>
      <div className="nav-container">
        {menuItems.map(item => (
                     <div 
             key={item.id}
             className={`nav-item ${activeDropdown === item.id ? 'active' : ''}`}
           >
            <div 
              className="nav-link"
              onClick={(e) => handleItemClick(item, e)}
            >
              <span className="nav-icon"></span>
              <span className="nav-title">{item.title}</span>
              <span className="nav-arrow">∨</span>
            </div>
            
            {item.submenu && activeDropdown === item.id && (
              <div className="dropdown-menu">
                {item.submenu.map((submenuItem, index) => (
                  <div
                    key={index}
                    className="dropdown-item"
                    onClick={() => handleSubmenuClick(submenuItem)}
                  >
                    {submenuItem.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
};

export default NavigationMenu;
