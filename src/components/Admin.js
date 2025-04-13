import React, { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './HomePage.css';
import Sidebar from './Sidebar';
import { UserContext } from '../UserContext';

function Admin() {
  const user = useContext(UserContext);
  const navigate = useNavigate();

  if (!user || !user.isAdmin) {
    navigate('/login');
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    navigate('/login');
  };

  return (
    <div className="container">
      <header>
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>
      <div className="content">
        <Sidebar userId={user.userId} isAdmin={user.isAdmin} handleLogout={handleLogout} />
        <div className="main-content">
          <h1>Admin Page</h1>
          <ul>
            <li><Link to="/admin/edit-pet-types">Quản lý Chủng loại Thú cưng</Link></li>
            <li><Link to="/admin/edit-items">Quản lý tất cả vật phẩm</Link></li>
            <li><Link to="/admin/edit-equipment-stats">Quản lý vật phẩm chiến đấu</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Admin;
