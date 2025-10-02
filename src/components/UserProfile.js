import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import './UserProfile.css'; // Tạo file UserProfile.css

function UserProfile() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 
  const { userId: urlUserId } = useParams();
  const { user: currentUser, isLoading } = React.useContext(UserContext);
  const [profileUser, setProfileUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return; // Wait for user context to load
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Nếu userId không được cung cấp trong URL, sử dụng currentUser.userId
    const idToFetch = urlUserId ? urlUserId : currentUser.userId;
    
    fetch(`${API_BASE_URL}/users/${idToFetch}`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    })
      .then((response) => response.json())
      .then((data) => setProfileUser(data))
      .catch((error) => console.error('Error fetching user:', error));
  }, [urlUserId, currentUser, isLoading, navigate, API_BASE_URL]);

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="profile-page-container">
          <div className="loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!currentUser) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="profile-page-container">
          <div className="error">Vui lòng đăng nhập</div>
        </div>
      </TemplatePage>
    );
  }

  if (!profileUser) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="profile-page-container">
          <div className="loading">Đang tải thông tin...</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="profile-page-container">
        <div className="header-free">
          <p>•❅──────✧❅•๖ۣۜŤOP✮VŇ•✦❅✧──────❅ </p>
        </div>
        <div className="user-profile">
          <div className="profile-details">
            <p>
              <strong>Tài Khoản:</strong> { '⭐⭐'+profileUser.username +'⭐⭐'|| 'Chưa cập nhật'}
            </p>
            <p>
              <strong>Tên thật:</strong> {profileUser.real_name || 'Chưa cập nhật'}
            </p>
            <p>
              <strong>Gold:</strong> {profileUser.gold}
            </p>
            <p>
              <strong>PetaGold:</strong> {profileUser.petagold}
            </p>
            <p>
              <strong>Bang hội:</strong> {profileUser.guild || 'Chưa có'}
            </p>
            <p>
              <strong>Danh hiệu:</strong> {profileUser.title || 'Chưa có'}
            </p>
            <p>
              <strong>Hạng:</strong> {profileUser.ranking || 'Chưa có'}
            </p>
            <p>
              <strong>Tình trạng:</strong> {profileUser.online_status ? 'Online' : 'Offline'}
            </p>
            <p>
              <strong>Ngày sinh:</strong> {profileUser.birthday || 'Chưa cập nhật'}
            </p>
          </div>
          <div className="profile-header">
            <img
              src="/images/character/knight_warrior.jpg"
              alt="Profile"
              className="profile-picture"
            />
            <h2>{profileUser.username}</h2>
          </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default UserProfile;