import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import { getDisplayName } from '../../utils/userDisplay';
import { useChapter0 } from '../story/Chapter0/Chapter0Context';

function formatGrouped(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  const sign = amount < 0 ? '-' : '';
  return sign + Math.trunc(Math.abs(amount)).toLocaleString('en-US');
}

function formatPetagold(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const compact = (unit, suffix) => {
    const scaled = Math.round((abs / unit) * 10) / 10;
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace('.', ',');
    return `${sign}${text}${suffix}`;
  };
  if (abs >= 1000000000) return compact(1000000000, 'B');
  if (abs >= 1000000) return compact(1000000, 'M');
  return formatGrouped(amount);
}

const TopNavigation = ({ className = '', onOpenSidebar, sidebarOpen = false }) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { user, isLoading, logout } = useUser();
  const navigate = useNavigate();
  const { story } = useChapter0();
  const dropdownRef = useRef(null);
  const effectiveName = getDisplayName(user, 'Người chơi');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  return (
    <nav id="sgw-top-navigation" className={`sgw-top-navigation ${className}`}>
      <div className="sgw-top-nav-container">
        {/* Logo - click mở Sidebar menu */}
        <div className="sgw-nav-logo">
          <button type="button" className="sgw-logo-btn" onClick={() => onOpenSidebar?.()} aria-label="Mở menu">
            <img src="/images/icons/logo2.png" alt="Petaria Logo" className="sgw-logo-img" />
          </button>
          <Link
            to="/home-ver2"
            data-story-target={story?.guidance?.lock === 'logo' ? 'logo' : undefined}
          >
            <span className="sgw-logo-text">Petaria</span>
          </Link>
        </div>

         {/* Navigation Links */}
         <div className="sgw-nav-links">
          

           {/* Login/Signup or User Menu */}
           {!isLoading && (
             <>
               {user ? (
                 <div 
                   ref={dropdownRef}
                   className={`sgw-nav-dropdown ${showUserDropdown ? 'show' : ''}`}
                   onMouseLeave={() => setShowUserDropdown(false)}
                 >
                   <span 
                     className="sgw-nav-link sgw-dropdown-trigger"
                     onClick={() => setShowUserDropdown(!showUserDropdown)}
                   >
                     <span className="sgw-nav-account">
                       <span className="sgw-nav-hello-row">
                         <span className="gnb-user-hello">Hello,</span>
                         <span className="gnb-user-name">{effectiveName}</span>
                       </span>
                       {!sidebarOpen && (
                         <span className="user-info-currency sgw-nav-currency" aria-label="Số dư">
                           <span className="user-info-currency-item">
                             <img src="/images/icons/peta.png" alt="Peta" />
                             <span className="user-info-currency-value">{formatGrouped(user.peta)}</span>
                           </span>
                           <span className="user-info-currency-item">
                             <img src="/images/icons/petagold.png" alt="Petagold" />
                             <span className="user-info-currency-value">{formatPetagold(user.petagold)}</span>
                           </span>
                         </span>
                       )}
                     </span>
                     <span className="sgw-dropdown-arrow"></span>
                   </span>
                   
                   <div className={`sgw-user-dropdown-menu ${showUserDropdown ? 'show' : ''}`}>
                       <Link to="/profile" className="sgw-dropdown-item">
                         <span className="sgw-dropdown-icon"><img className="sgw-dropdown-icon-img" src="/images/icons/2.png" alt="user"/></span>
                         My Account
                       </Link>
                        {/* Admin Board Link - Only for admin users */}
                        {!isLoading && user && user.role === 'admin' && (
                            <Link to="/admin" className="sgw-dropdown-item">
                                <span className="sgw-dropdown-icon"><img className="sgw-dropdown-icon-img" src="/images/icons/6.png" alt="user"/></span>
                                Admin Board
                            </Link>
                        )}
                       <Link to="/management" className="sgw-dropdown-item">
                         <span className="sgw-dropdown-icon"><img className="sgw-dropdown-icon-img" src="/images/icons/3.png" alt="support"/></span>
                         Bảng Quản lý
                       </Link>
                       <Link to="/management" className="sgw-dropdown-item">
                         <span className="sgw-dropdown-icon"><img className="sgw-dropdown-icon-img" src="/images/icons/4.png" alt="faq"/></span>
                         FAQ
                       </Link>
                       <button onClick={handleLogout} className="sgw-dropdown-item">
                         <span className="sgw-dropdown-icon"><img className="sgw-dropdown-icon-img" src="/images/icons/5.png" alt="logout"/></span>
                         Log Out
                       </button>
                   </div>
                 </div>
               ) : (
                 <>
                   <Link to="/login" className="sgw-nav-link">
                     Log In
                   </Link>
                   <Link to="/register" className="sgw-nav-link">
                     Sign Up
                   </Link>
                 </>
               )}
             </>
           )}
         </div>
      </div>
    </nav>
  );
};

export default TopNavigation;
