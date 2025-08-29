import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNavbar.css';

const BottomNavbar = ({ onToggleSidebar, sidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSubmenu, setShowSubmenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });
  const navItemRefs = useRef({});
  const [navbarConfig, setNavbarConfig] = useState({
    bottomNavbar: { visible: true, showMenuOnly: false },
    floatingButtons: { visible: true }
  });

  // Fetch initial navbar config and listen for updates
  React.useEffect(() => {
    const fetchNavbarConfig = async () => {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${API_BASE_URL}/api/site-config/navbar`);
        if (response.ok) {
          const config = await response.json();
          setNavbarConfig(config);
        }
      } catch (error) {
        console.error('Error fetching navbar config:', error);
      }
    };

    const handleNavbarConfigUpdate = (event) => {
      setNavbarConfig(event.detail);
    };

    // Fetch initial config
    fetchNavbarConfig();

    // Listen for updates from admin panel
    window.addEventListener('navbarConfigUpdated', handleNavbarConfigUpdate);
    
    return () => {
      window.removeEventListener('navbarConfigUpdated', handleNavbarConfigUpdate);
    };
  }, []);

  // Check if current page is home page (where BottomNavbar should be shown)
  const isHomePage = () => {
    const homePaths = ['/', '/home', '/home-ver2'];
    return homePaths.includes(location.pathname);
  };

  // Don't render BottomNavbar if not on home page or if hidden by admin
  if (!isHomePage() || !navbarConfig.bottomNavbar.visible) {
    return null;
  }

  // Bottom navbar height based on screen size
  const getBottomNavbarHeight = () => {
    if (window.innerWidth <= 480) {
      return 70; // Mobile height
    } else if (window.innerWidth <= 768) {
      return 80; // Tablet height
    } else {
      return 90; // Desktop height
    }
  };

  // Submenu height based on screen size
  const getSubmenuHeight = () => {
    if (window.innerWidth <= 480) {
      return 120; // Mobile submenu height (2 rows * 60px each)
    } else {
      return 140; // Desktop/tablet submenu height (2 rows * 70px each)
    }
  };

  const navItems = [
    // { id: 'town', label: 'Thị trấn', icon: '/images/icons/placeholder.png', path: '/home-ver2', hasNotification: false },
    { id: 'shop', label: 'Cửa hàng', icon: '/images/icons/shop.png', path: '/shop', hasNotification: true },
    // { id: 'pokedex', label: 'Petadex', icon: '/images/icons/Pokedex.png', path: '/pokedex', hasNotification: true },
    { 
      id: 'cultivate', 
      label: 'Huấn luyện', 
      icon: '/images/icons/training.png', 
      path: '/cultivate', 
      hasNotification: true,
      hasSubmenu: true,
      submenuItems: [
        { id: 'license', label: 'Pokedex', icon: '/images/icons/Pokedex.png', path: '/pokedex', hasNotification: true },
        { id: 'rune', label: 'Rune', icon: '/images/icons/pet.png', path: '/rune', hasNotification: true },
        { id: 'badge', label: 'Badge', icon: '/images/icons/pet.png', path: '/badge', hasNotification: true },
        { id: 'title', label: 'Danh Hiệu', icon: '/images/icons/pet.png', path: '/title', hasNotification: true }
        
      ]
    },
    { id: 'inventory', label: 'Túi đồ', icon: '/images/icons/inventory-2.png', path: '/inventory', hasNotification: true },
    // { id: 'tasks', label: 'Nhiệm vụ', icon: '/images/icons/mission.png', path: '/tasks', hasNotification: true },
    { id: 'pokemon', label: 'Thú cưng', icon: '/images/icons/pet.png', path: '/myhome', hasNotification: true },
    { id: 'team', label: 'Đội hình', icon: '/images/icons/team.png', path: '/team', hasNotification: true }
  ];

  const closeSubmenu = () => {
    setShowSubmenu(false);
    setActiveSubmenu(null);
  };

  const handleNavClick = (item) => {
    if (item.hasSubmenu) {
      const navItem = navItemRefs.current[item.id];
      
      if (navItem) {
        const navRect = navItem.getBoundingClientRect();
        const bottomNavbarHeight = getBottomNavbarHeight();
        const submenuHeight = getSubmenuHeight();
        
        setSubmenuPosition({
          x: navRect.left + navRect.width / 2,
          y: window.innerHeight - bottomNavbarHeight - submenuHeight - 25 // Position above bottom navbar minus submenu height
        });
      }
      
      // Toggle submenu
      if (activeSubmenu === item.id) {
        // If clicking the same item, close submenu
        closeSubmenu();
      } else {
        // If clicking different item, open new submenu
        setActiveSubmenu(item.id);
        setShowSubmenu(true);
      }
    } else {
      navigate(item.path);
      closeSubmenu();
    }
  };

  const handleSubmenuClick = (submenuItem) => {
    navigate(submenuItem.path);
    closeSubmenu();
  };

  const handleOverlayClick = () => {
    closeSubmenu();
  };

  return (
    <>
      <div className="bottom-navbar">
        {/* Sidebar toggle button */}
        <div className="nav-item sidebar-toggle" onClick={onToggleSidebar}>
          <div className="nav-icon">
            {sidebarOpen ? '✕' : '☰'}
          </div>
          <span className="nav-label">Menu</span>
        </div>
        
        {!navbarConfig.bottomNavbar.showMenuOnly && navItems.map((item) => (
          <div
            key={item.id}
            ref={(el) => (navItemRefs.current[item.id] = el)}
            className={`nav-item ${location.pathname === item.path ? '' : ''} ${activeSubmenu === item.id ? 'submenu-active' : ''}`}
            onClick={() => handleNavClick(item)}
          >
            <div className="nav-icon">
              <img src={item.icon} alt={item.label} />
              {item.hasNotification && <div className="notification-dot"></div>}
            </div>
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Submenu */}
      {showSubmenu && activeSubmenu && (
        <div className="submenu-overlay" onClick={handleOverlayClick}>
          <div 
            className="submenu-container" 
            onClick={(e) => e.stopPropagation()}
            style={{
              left: `${submenuPosition.x}px`,
              top: `${submenuPosition.y}px`
            }}
          >
            {navItems.find(item => item.id === activeSubmenu)?.submenuItems?.map((submenuItem) => (
              <div
                key={submenuItem.id}
                className="submenu-item"
                onClick={() => handleSubmenuClick(submenuItem)}
              >
                <div className="submenu-icon">
                  <img src={submenuItem.icon} alt={submenuItem.label} />
                  {submenuItem.hasNotification && <div className="notification-dot"></div>}
                </div>
                <span className="submenu-label">{submenuItem.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default BottomNavbar; 