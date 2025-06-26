import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './NavbarMobile.css';

function NavbarMobile() {
  const location = useLocation();

  const NavItem = ({ to, label, icon }) => (
    <Link to={to} className={location.pathname === to ? 'active' : ''}>
      <div className="icon" dangerouslySetInnerHTML={{ __html: icon }} />
      <span>{label}</span>
    </Link>
  );

  return (
    <div className="navbar-mobile">
      <NavItem to="/" label="Trang cá nhân" icon={icons.user} />
      <NavItem to="/inventory" label="Vật phẩm" icon={icons.bag} />
      <NavItem to="/shop" label="Cửa hàng" icon={icons.shop} />
      <NavItem to="/battle" label="Đấu trường" icon={icons.sword} />
    </div>
  );
}

const icons = {
  user: `<svg viewBox="0 0 24 24" fill="none" width="24" height="24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-3-3.87M4 21v-2a4 4 0 0 1 3-3.87M16 3.13a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/>
  </svg>`,
  bag: `<svg viewBox="0 0 24 24" fill="none" width="24" height="24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2l1 5h10l1-5M6 7v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6z"/>
  </svg>`,
  shop: `<svg viewBox="0 0 24 24" fill="none" width="24" height="24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 9h18v13H3z"/><path d="M16 9V4H8v5"/>
  </svg>`,
  sword: `<svg viewBox="0 0 24 24" fill="none" width="24" height="24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.5 17.5l-6-6"/><path d="M4 20l6-6"/><path d="M3 21l2.5-2.5"/><path d="M14.5 6.5L21 3"/>
  </svg>`
};

export default NavbarMobile;