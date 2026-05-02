import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import {
  MAIL_INBOX_VIEWED_EVENT,
  MAIL_UNREAD_REFRESH_EVENT,
} from '../../utils/mailEvents';
import { AlertExclamationBadge } from '../ui/AlertExclamationBadge';

const NavigationMenu = ({ className = '' }) => {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [triggerRect, setTriggerRect] = useState(null);
  const navRef = useRef(null);
  const dropdownRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxDismissed, setInboxDismissed] = useState(false);
  const prevUnreadRef = useRef(0);

  // Check if user is admin
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  const fetchUnread = useCallback(async () => {
    if (!user?.userId) {
      setUnreadCount(0);
      return;
    }
    const base = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    try {
      const r = await fetch(`${base}/api/mails/${user.userId}/unread-count`);
      if (!r.ok) return;
      const d = await r.json();
      const n = Math.floor(Number(d.unread_count) || 0);
      const prev = prevUnreadRef.current;
      if (n > prev) setInboxDismissed(false);
      if (n === 0) setInboxDismissed(false);
      prevUnreadRef.current = n;
      setUnreadCount(n);
    } catch {
      /* ignore */
    }
  }, [user?.userId]);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.userId) {
      setUnreadCount(0);
      prevUnreadRef.current = 0;
      return;
    }
    fetchUnread();
    const t = setInterval(fetchUnread, 45000);
    const onFocus = () => fetchUnread();
    const onInboxViewed = () => {
      setInboxDismissed(true);
      fetchUnread();
    };
    const onUnreadRefresh = () => fetchUnread();
    window.addEventListener('focus', onFocus);
    window.addEventListener(MAIL_INBOX_VIEWED_EVENT, onInboxViewed);
    window.addEventListener(MAIL_UNREAD_REFRESH_EVENT, onUnreadRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(MAIL_INBOX_VIEWED_EVENT, onInboxViewed);
      window.removeEventListener(MAIL_UNREAD_REFRESH_EVENT, onUnreadRefresh);
    };
  }, [isLoading, user?.userId, fetchUnread]);

  const showMailAlert = unreadCount > 0 && !inboxDismissed && !!user?.userId;

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
        { title: 'Nhiệm vụ', path: '/tasks' },
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
                {item.id === 'features' && showMailAlert ? (
                  <span className="nav-title-wrap">
                    <span className="nav-title">{item.title}</span>
                    <AlertExclamationBadge size={16} title="Có thư chưa đọc" />
                  </span>
                ) : (
                  <span className="nav-title">{item.title}</span>
                )}
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
                className={`dropdown-item ${
                  submenuItem.path === '/mail' ? 'dropdown-item--mail' : ''
                }`}
                onClick={() => handleSubmenuClick(submenuItem)}
              >
                <span className="dropdown-item__label">{submenuItem.title}</span>
                {submenuItem.path === '/mail' && showMailAlert ? (
                  <AlertExclamationBadge size={20} title="Có thư chưa đọc" />
                ) : null}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export default NavigationMenu;
