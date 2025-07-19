import React, { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './HomePage.css';
// import './Admin.css';
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
    <div>
      <h1>Admin Page</h1>
      <ul>
        <li><Link to="/admin/edit-pet-types">Quản lý Chủng loại Thú cưng</Link></li>
        <li><Link to="/admin/create-pet">Tạo Pet (Admin)</Link></li>
        <li><Link to="/admin/edit-items">Quản lý tất cả vật phẩm</Link></li>
        <li><Link to="/admin/edit-equipment-stats">Quản lý vật phẩm chiến đấu</Link></li>
        <li><Link to="/admin/edit-item-effects">Quản lý vật phẩm tăng stats</Link></li>
        <li><Link to="/admin/edit-shop-items">Quản lý cửa hàng vật phẩm</Link></li>
        <li><Link to="/admin/create-arena-pet">Thêm NPC cho đấu trường và các vùng khác</Link></li>
      </ul>
    </div>
  );
}

export default Admin;
