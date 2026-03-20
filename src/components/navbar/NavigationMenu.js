import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

const NavigationMenu = ({ className = '' }) => {
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [triggerRect, setTriggerRect] = useState(null);
  const navRef = useRef(null);
  const dropdownRef = useRef(null);

  // Check if user is admin
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // Close dropdown when clicking outside (nav hoặc dropdown portal)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const inNav = navRef.current && navRef.current.contains(event.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
      if (!inNav && !inDropdown) {
        setActiveDropdown(null);
        setTriggerRect(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        { title: 'Nhà hàng', path: '/restaurant' },
        { title: 'Bưu điện', path: '/mail' },
        { title: 'Viện mồ côi', path: '/orphanage' },
        { title: 'Sông Healia', path: '/healia-river' },
        { title: 'Đấu trường', path: '/battle' },
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
      const newActiveDropdown = activeDropdown === item.id ? null : item.id;
      setActiveDropdown(newActiveDropdown);
      if (newActiveDropdown) {
        setTriggerRect(event.currentTarget.getBoundingClientRect());
      } else {
        setTriggerRect(null);
      }
    } else if (item.path) {
      navigate(item.path);
    }
  };

  // Position dropdown trong portal (tránh lỗi khi nav có transform .hidden)
  useLayoutEffect(() => {
    if (!activeDropdown || !triggerRect || !dropdownRef.current) return;
    const dropdown = dropdownRef.current;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 10;

    const dropdownRect = dropdown.getBoundingClientRect();
    let dropdownWidth = dropdownRect.width || 200;
    const dropdownHeight = dropdownRect.height || 200;

    if (viewportWidth <= 480) dropdownWidth = Math.max(dropdownWidth, 120);
    else if (viewportWidth <= 768) dropdownWidth = Math.max(dropdownWidth, 150);

    let left = triggerRect.left + triggerRect.width / 2 - dropdownWidth / 2;
    let top = triggerRect.bottom + 5;

    if (left < margin) left = margin;
    else if (left + dropdownWidth > viewportWidth - margin) left = viewportWidth - dropdownWidth - margin;

    if (dropdownWidth > viewportWidth - margin * 2) {
      dropdownWidth = viewportWidth - margin * 2;
      dropdown.style.width = `${dropdownWidth}px`;
      left = triggerRect.left + triggerRect.width / 2 - dropdownWidth / 2;
      if (left < margin) left = margin;
      if (left + dropdownWidth > viewportWidth - margin) left = viewportWidth - dropdownWidth - margin;
    }

    if (top + dropdownHeight > viewportHeight - margin) {
      top = triggerRect.top - dropdownHeight - 5;
    }

    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
    dropdown.classList.add('show');
  }, [activeDropdown, triggerRect]);

  const handleSubmenuClick = (submenuItem) => {
    navigate(submenuItem.path);
    setActiveDropdown(null);
    setTriggerRect(null);
  };

  const activeItem = activeDropdown ? menuItems.find(m => m.id === activeDropdown) : null;

  return (
    <>
      <nav className={`navigation-menu ${className}`} ref={navRef}>
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
            </div>
          ))}
        </div>
      </nav>

      {activeItem?.submenu &&
        createPortal(
          <div
            ref={dropdownRef}
            className="dropdown-menu"
            style={{ left: 0, top: 0 }}
          >
            {activeItem.submenu.map((submenuItem, index) => (
              <div
                key={index}
                className="dropdown-item"
                onClick={() => handleSubmenuClick(submenuItem)}
              >
                {submenuItem.title}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export default NavigationMenu;
