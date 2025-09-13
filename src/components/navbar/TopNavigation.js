import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';

const TopNavigation = () => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { user, isLoading, logout } = useUser();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

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
    <nav id="sgw-top-navigation" className="sgw-top-navigation">
      <div className="sgw-top-nav-container">
        {/* Logo */}
        <div className="sgw-nav-logo">
          <Link to="/">
            <img src="/images/icons/logo2.png" alt="Petaria Logo" className="sgw-logo-img" />
          </Link>
          <Link to="/home-ver2">
            <span className="sgw-logo-text">Petaria</span>
          </Link>
        </div>

         {/* Navigation Links */}
         <div className="sgw-nav-links">
           {/* Quản lý Link */}
           <Link to="/management" className="sgw-nav-link">
                BẢNG QUẢN LÝ
           </Link>

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
                     <span className="gnb-user-hello">Hello,</span>
                     <span className="gnb-user-name">{user.username}</span>
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
                       <Link to="/support-ticket" className="sgw-dropdown-item">
                         <span className="sgw-dropdown-icon"><img className="sgw-dropdown-icon-img" src="/images/icons/3.png" alt="support"/></span>
                         Send Support Ticket
                       </Link>
                       <Link to="/faq" className="sgw-dropdown-item">
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
