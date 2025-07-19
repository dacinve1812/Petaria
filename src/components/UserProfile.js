import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './UserProfile.css'; // Tạo file UserProfile.css
import Navbar from './Navbar';

function UserProfile() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState(null); // Thêm state currentUserId
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(decodedToken.userId); // Set currentUserId
        // Nếu userId không được cung cấp trong URL, sử dụng currentUserId
        const idToFetch = userId ? userId : decodedToken.userId;
        fetch(`${API_BASE_URL}/users/${idToFetch}`)
          .then((response) => response.json())
          .then((data) => setUser(data))
          .catch((error) => console.error('Error fetching user:', error));
      } catch (err) {
        console.error('Error decoding token:', err);
        navigate('/login');
      }
    }
  }, [userId, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <header>
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>
      <div className="content">
        {/* <Sidebar userId={currentUserId} handleLogout={handleLogout} isAdmin={isAdmin} /> */}
        <div className="main-content">
          <Navbar />
          <div className="header-free">
            <p>•❅──────✧❅•๖ۣۜŤOP✮VŇ•✦❅✧──────❅ </p>
          </div>
          <div className="user-profile">
          <div className="profile-details">
                <p>
                <strong>Tài Khoản:</strong> { '⭐⭐'+user.username +'⭐⭐'|| 'Chưa cập nhật'}
              </p>
              <p>
                <strong>Tên thật:</strong> {user.real_name || 'Chưa cập nhật'}
              </p>
              <p>
                <strong>Gold:</strong> {user.gold}
              </p>
              <p>
                <strong>PetaGold:</strong> {user.petagold}
              </p>
              <p>
                <strong>Bang hội:</strong> {user.guild || 'Chưa có'}
              </p>
              <p>
                <strong>Danh hiệu:</strong> {user.title || 'Chưa có'}
              </p>
              <p>
                <strong>Hạng:</strong> {user.ranking || 'Chưa có'}
              </p>
              <p>
                <strong>Tình trạng:</strong> {user.online_status ? 'Online' : 'Offline'}
              </p>
              <p>
                <strong>Ngày sinh:</strong> {user.birthday || 'Chưa cập nhật'}
              </p>
            </div>
            <div className="profile-header">
              <img
                src="/images/character/knight_warrior.jpg"
                alt="Profile"
                className="profile-picture"
              />
              <h2>{user.username}</h2>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;