// ArenaPage.js - Trang hiển thị danh sách đối thủ đấu trường
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import GameDialogModal from '../ui/GameDialogModal';
import '../css/ArenaPage.css';
import EnemyInfoModal from './EnemyInfoModal';

function ArenaPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user, isLoading } = React.useContext(UserContext);
  const navigate = useNavigate();
  const [enemies, setEnemies] = useState([]);
  const [selectedEnemy, setSelectedEnemy] = useState(null);
  const [userPets, setUserPets] = useState([]);
  const [matchStartError, setMatchStartError] = useState('');
  const [matchStarting, setMatchStarting] = useState(false);
  /** 'loading' | 'list' | 'resume' — có trận Redis đang dở thì chặn list, chỉ hiện dialog */
  const [arenaGate, setArenaGate] = useState('loading');
  const [resumeMatch, setResumeMatch] = useState(null);

  useEffect(() => {
    if (isLoading) return; // Wait for user context to load
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user, isLoading]);

  useEffect(() => {
    if (!user?.token) {
      setArenaGate('list');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/arena/match/status`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.player) {
            setResumeMatch(data);
            setArenaGate('resume');
            return;
          }
        }
        setArenaGate('list');
      } catch {
        if (!cancelled) setArenaGate('list');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.token, API_BASE_URL]);

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

  const goToResumeBattle = () => {
    if (!resumeMatch?.player) return;
    navigate('/battle/arena/arenabattle', {
      state: {
        matchState: resumeMatch,
        playerPet: resumeMatch.player,
        enemyPet: resumeMatch.enemy,
        useRedisMatch: true,
      },
    });
  };

  const startMatchAndNavigate = async (pet, enemy) => {
    if (!user?.token || !pet?.id || !enemy?.id) return;
    setMatchStartError('');
    setMatchStarting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/match/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ petId: pet.id, bossId: enemy.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        navigate('/battle/arena/arenabattle', {
          state: { matchState: data, playerPet: data.player, enemyPet: data.enemy, useRedisMatch: true },
        });
        return;
      }
      if (res.status === 400 && data.code === 'ACTIVE_MATCH' && data.match) {
        navigate('/battle/arena/arenabattle', {
          state: { matchState: data.match, playerPet: data.match.player, enemyPet: data.match.enemy, useRedisMatch: true },
        });
        return;
      }
      setMatchStartError(data.message || 'Không thể bắt đầu trận đấu.');
    } catch (err) {
      setMatchStartError(err.message || 'Lỗi kết nối.');
    } finally {
      setMatchStarting(false);
    }
  };

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="arena-page-container">
        {arenaGate === 'loading' && (
          <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>
            Đang kiểm tra trận đấu...
          </div>
        )}

        {arenaGate === 'list' && (
          <>
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

            {matchStartError && <div className="arena-match-error">{matchStartError}</div>}
            {selectedEnemy && (
              <EnemyInfoModal
                enemy={selectedEnemy}
                onClose={() => { setSelectedEnemy(null); setMatchStartError(''); }}
                onSelectPet={(pet) => startMatchAndNavigate(pet, selectedEnemy)}
                matchStarting={matchStarting}
              />
            )}
          </>
        )}

        <GameDialogModal
          isOpen={arenaGate === 'resume'}
          onClose={() => navigate('/battle')}
          title="Match in progress"
          mode="confirm"
          cancelLabel="Cancel"
          confirmLabel="Confirm"
          onCancel={() => navigate('/battle')}
          onConfirm={() => goToResumeBattle()}
          closeOnOverlayClick={false}
        >
          <p style={{ margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
            Bạn đang trong trận đấu, tiếp tục trận đấu?
          </p>
        </GameDialogModal>
      </div>
    </TemplatePage>
  );
}

export default ArenaPage;
