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
      // Đối thủ Arena = Boss (bảng boss_templates)
      const enemyDetailResponse = await fetch(`${API_BASE_URL}/api/bosses/${enemy.id}`);
      if (!enemyDetailResponse.ok) {
        console.error('Failed to fetch boss details');
        return;
      }
      const enemyDetail = await enemyDetailResponse.json();

      const userPetsResponse = await fetch(`${API_BASE_URL}/users/${user.userId}/pets`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const userPets = await userPetsResponse.json();
      setUserPets(userPets);

      setSelectedEnemy({ ...enemyDetail, userPets });
    } catch (err) {
      console.error('Error fetching boss details or user pets:', err);
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

  const imageSrc = (img) => {
    if (!img) return '';
    if (img.startsWith('http') || img.startsWith('/')) return img;
    return `/images/pets/${img}`;
  };

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="arena-page-container">
        <div className="arena-header">
          <h2>Đấu Trường Arena</h2>
          <p>Chọn một đối thủ để bắt đầu trận chiến</p>
        </div>

        <div className="arena-grid">
          {enemies.length === 0 ? (
            <p className="arena-empty">Không có đối thủ nào hiện tại.</p>
          ) : (
            enemies.map(enemy => (
              <article key={enemy.id} className="arena-card">
                <div className="arena-card-image-wrap">
                  <img src={imageSrc(enemy.image)} alt={enemy.name} className="arena-card-image" />
                </div>
                <h3 className="arena-card-name">{enemy.name}</h3>
                <div className="arena-card-stats">
                  <p>Đẳng cấp: {enemy.level}</p>
                  <p>Thắng: {enemy.wins ?? 0}</p>
                  <p>Thua: {enemy.losses ?? 0}</p>
                </div>
                <button
                  type="button"
                  className="arena-card-challenge"
                  onClick={() => handleOpenEnemyModal(enemy)}
                >
                  Thách đấu
                </button>
              </article>
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
