import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const NavigationMenu = () => {
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const navRef = useRef(null);

  // Check if user is admin
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setActiveDropdown(null);
        // Remove show class and reset width
        const dropdown = document.querySelector('.dropdown-menu');
        if (dropdown) {
          dropdown.classList.remove('show');
          dropdown.style.width = ''; // Reset width to default
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
        { title: 'Đấu giá', path: '/auction' },
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
        { title: 'Hệ thống kinh nghiệm', path: '/system/experience' },
        // Chỉ hiển thị Dev Dashboard cho admin
        ...(isAdmin ? [{ title: 'Dev Dashboard', path: '/dev-dashboard' }] : [])
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
            const viewportHeight = window.innerHeight;
            
            // Get actual dropdown dimensions
            const dropdownRect = dropdown.getBoundingClientRect();
            let dropdownWidth = dropdownRect.width || 200; // fallback to min-width
            const dropdownHeight = dropdownRect.height || 200; // fallback height
            
            // Adjust width for mobile devices
            if (viewportWidth <= 480) {
              dropdownWidth = Math.max(dropdownWidth, 120); // min-width for mobile
            } else if (viewportWidth <= 768) {
              dropdownWidth = Math.max(dropdownWidth, 150); // min-width for tablet
            }
            
            // Calculate center position relative to nav item
            let left = rect.left + rect.width / 2 - dropdownWidth / 2;
            let top = rect.bottom + 5;
            
            // Keep dropdown within viewport horizontally
            const margin = 10;
            if (left < margin) {
              left = margin;
            } else if (left + dropdownWidth > viewportWidth - margin) {
              left = viewportWidth - dropdownWidth - margin;
            }
            
            // If dropdown is still too wide for viewport, adjust width
            if (dropdownWidth > viewportWidth - (margin * 2)) {
              dropdownWidth = viewportWidth - (margin * 2);
              dropdown.style.width = `${dropdownWidth}px`;
              // Recalculate left position with new width
              left = rect.left + rect.width / 2 - dropdownWidth / 2;
              if (left < margin) left = margin;
              if (left + dropdownWidth > viewportWidth - margin) {
                left = viewportWidth - dropdownWidth - margin;
              }
            }
            
            // Keep dropdown within viewport vertically
            if (top + dropdownHeight > viewportHeight - margin) {
              // Position above the nav item if not enough space below
              top = rect.top - dropdownHeight - 5;
            }
            
            dropdown.style.left = `${left}px`;
            dropdown.style.top = `${top}px`;
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
    // Remove show class and reset width
    const dropdown = document.querySelector('.dropdown-menu');
    if (dropdown) {
      dropdown.classList.remove('show');
      dropdown.style.width = ''; // Reset width to default
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
