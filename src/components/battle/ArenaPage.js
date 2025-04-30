// ArenaPage.js - Trang hiển thị danh sách đối thủ đấu trường
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Navbar';
import Sidebar from '../Sidebar';
import '../css/ArenaPage.css';
import EnemyInfoModal from './EnemyInfoModal';

function ArenaPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [enemies, setEnemies] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const [selectedEnemy, setSelectedEnemy] = useState(null);
  const [userPets, setUserPets] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      setUserId(decodedToken.userId);
      setIsAdmin(localStorage.getItem('isAdmin') === 'true');
    } catch (err) {
      console.error('Lỗi giải mã token:', err);
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/arena/enemies`)
      .then(res => res.json())
      .then(data => setEnemies(data))
      .catch(err => console.error('Lỗi khi tải danh sách enemy:', err));
  }, [API_BASE_URL]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };
  const handleOpenEnemyModal = async (enemy) => {
    try {
      const token = localStorage.getItem('token');
  
      // Fetch chi tiết enemy pet
      const enemyDetailResponse = await fetch(`${API_BASE_URL}/api/pets/${enemy.uuid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const enemyDetail = await enemyDetailResponse.json();
  
      // Fetch user pets
      const userPetsResponse = await fetch(`${API_BASE_URL}/users/${userId}/pets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userPets = await userPetsResponse.json();
  
      setUserPets(userPets);
  
      // Set enemyDetail vào modal
      setSelectedEnemy({ ...enemyDetail, userPets: userPets });
    } catch (err) {
      console.error('Error fetching enemy details or user pets:', err);
    }
  };

  return (
    <div className="arena-container container">
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="arena-content content">
        <Sidebar userId={userId} handleLogout={handleLogout} isAdmin={isAdmin} />
        <div className="arena-main">
          <Navbar />
          <div className="arena-header">
            <h2>Đấu Trường Arena</h2>
            <p>Chọn một đối thủ để bắt đầu trận chiến</p>
          </div>

          <div className="enemy-scroll-list">
            {enemies.length === 0 ? (
              <p>Không có đối thủ nào hiện tại.</p>
            ) : (
              enemies.map(enemy => (
                <div key={enemy.id} className="enemy-card" onClick={() => handleOpenEnemyModal(enemy)}>
                  <div className="enemy-card-left">
                    <span></span>
                    <img src={`/images/pets/${enemy.image}`} alt={enemy.name} />
                  </div>
                  <div className="enemy-card-right">
                    <h3>{enemy.name}</h3>
                    <p>Level: {enemy.level}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {selectedEnemy && (
                <EnemyInfoModal
                    enemy={selectedEnemy}
                    onClose={() => setSelectedEnemy(null)}
                    onSelectPet={(pet) => {
                      console.log('Chọn pet này để đấu:', pet);
                      // Xử lý bắt đầu trận đấu sau này
                    }}
                  />
                )}
        </div>
      </div>
    </div>
    
  );
}

export default ArenaPage;
