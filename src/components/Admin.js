import React, { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './HomePage.css';
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
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <div className="admin-actions">
          <button className="back-home-btn" onClick={() => navigate('/')}>
            ← Về Home
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-section">
          <h2>Quản lý Thú cưng</h2>
          <ul>
            <li><Link to="/admin/edit-pet-types">Quản lý Chủng loại Thú cưng</Link></li>
            <li><Link to="/admin/create-pet">Tạo Pet (Admin)</Link></li>
            <li><Link to="/admin/create-arena-pet">Thêm NPC cho đấu trường</Link></li>
          </ul>
        </div>

        <div className="admin-section">
          <h2>Quản lý Vật phẩm</h2>
          <ul>
            <li><Link to="/admin/edit-items">Quản lý tất cả vật phẩm</Link></li>
            <li><Link to="/admin/edit-equipment-stats">Quản lý vật phẩm chiến đấu</Link></li>
            <li><Link to="/admin/edit-item-effects">Quản lý vật phẩm tăng stats</Link></li>
            <li><Link to="/admin/edit-shop-items">Quản lý cửa hàng vật phẩm</Link></li>
          </ul>
        </div>

        <div className="admin-section">
          <h2>Quản lý Linh Thú</h2>
          <ul>
            <li><Link to="/admin/spirits">Quản lý Linh Thú</Link></li>
          </ul>
        </div>

        <div className="admin-section">
          <h2>Hệ thống Mail</h2>
          <ul>
            <li><Link to="/admin/mail-test">Gửi Test Mail</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Admin;
