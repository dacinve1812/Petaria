// ArenaPage.js - Trang hiển thị danh sách đối thủ đấu trường
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import '../css/ArenaPage.css';
import EnemyInfoModal from './EnemyInfoModal';

function ArenaPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user, isLoading } = React.useContext(UserContext);
  const navigate = useNavigate();
  const [enemies, setEnemies] = useState([]);
  const [selectedEnemy, setSelectedEnemy] = useState(null);
  const [userPets, setUserPets] = useState([]);

  useEffect(() => {
    if (isLoading) return; // Wait for user context to load
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user, isLoading]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/arena/enemies`)
      .then(res => res.json())
      .then(data => setEnemies(data))
      .catch(err => console.error('Lỗi khi tải danh sách enemy:', err));
  }, [API_BASE_URL]);

  const handleOpenEnemyModal = async (enemy) => {
    if (!user || !user.token || !user.userId) return;
    
    try {
      // Fetch chi tiết enemy pet
      const enemyDetailResponse = await fetch(`${API_BASE_URL}/api/pets/${enemy.uuid}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const enemyDetail = await enemyDetailResponse.json();
  
      // Fetch user pets
      const userPetsResponse = await fetch(`${API_BASE_URL}/users/${user.userId}/pets`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const userPets = await userPetsResponse.json();
  
      setUserPets(userPets);
  
      // Set enemyDetail vào modal
      setSelectedEnemy({ ...enemyDetail, userPets: userPets });
    } catch (err) {
      console.error('Error fetching enemy details or user pets:', err);
    }
  };

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="arena-page-container">
          <div className="loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="arena-page-container">
          <div className="error">Vui lòng đăng nhập</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="arena-page-container">
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
              navigate('/battle/arena/arenabattle', {
                state: {
                  playerPet: pet,
                  enemyPet: selectedEnemy
                }
              });
            }}
          />
        )}
      </div>
    </TemplatePage>
  );
}

export default ArenaPage;
