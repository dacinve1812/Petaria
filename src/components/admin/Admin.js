import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../UserContext';
import '../HomePage.css';

function Admin() {
  const { user, logout, isLoading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if not loading and user is not admin
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Show loading while checking authentication
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Show nothing if not admin (will redirect in useEffect)
  if (!user || !user.isAdmin) {
    return null;
  }

  const handleLogout = () => {
    logout();
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
          <h2>Quản lý User</h2>
          <ul>
            <li><Link to="/admin/user-management">Hệ thống User</Link></li>
          </ul>
        </div>

        <div className="admin-section">
          <h2>Hệ thống</h2>
          <ul>
            <li><Link to="/admin/mail-test">Gửi Test Mail</Link></li>
            <li><Link to="/admin/bank-management">Hệ thống Bank</Link></li>
          </ul>
        </div>

        <div className="admin-section">
          <h2>Quản lý Site</h2>
          <ul>
            <li><Link to="/admin/site-management">Quản lý Homepage</Link></li>
            <li><Link to="/map-tool">Map tool</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Admin;
