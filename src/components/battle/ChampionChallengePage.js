import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import GameDialogModal from '../ui/GameDialogModal';
import { CHAMPION_NPCS, getChampionFormation } from './championNpcs';
import '../css/ArenaPage.css';
import './ChampionChallengePage.css';

function petImg(file) {
  if (!file) return '/images/pets/default.png';
  if (String(file).startsWith('/') || String(file).startsWith('http')) return file;
  return `/images/pets/${file}`;
}

/**
 * Champion Challenge — chọn NPC → pre-match 3v3 / 5v5.
 * Combat local theo đội hình NPC (không gắn Arena boss / Redis).
 */
function ChampionChallengePage() {
  const { user, isLoading } = React.useContext(UserContext);
  const navigate = useNavigate();
  const [errorModal, setErrorModal] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login');
  }, [isLoading, user, navigate]);

  const openSelect = async (npc, battleMode) => {
    if (starting) return;
    setStarting(true);
    setErrorModal('');
    try {
      const formation = getChampionFormation(npc, battleMode);
      if (!formation.length) {
        setErrorModal('NPC này chưa có đội hình cho chế độ này.');
        return;
      }

      navigate('/battle/arena/select', {
        state: {
          enemy: {
            id: `champion-${npc.npcId}`,
            name: npc.name,
            image: npc.portrait,
            level: npc.level,
            isBoss: false,
            isChampionNpc: true,
            championNpcId: npc.npcId,
            final_stats: { hp: 1, str: 1, def: 1, spd: 1 },
            current_hp: 1,
          },
          enemyFormation: formation,
          battleMode,
          battleSource: 'champion',
          returnPath: '/battle/champion',
        },
      });
    } catch (err) {
      setErrorModal(err.message || 'Không mở được màn chọn đội hình.');
    } finally {
      setStarting(false);
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
      <div className="arena-page-container champion-page">
        <h1 className="arena-title">Champion Challenge</h1>
        <p className="arena-subtitle">Chọn NPC để thử đội hình 3v3 / 5v5</p>

        <div className="champion-grid">
          {CHAMPION_NPCS.map((npc) => {
            const preview = getChampionFormation(npc, '3v3');
            return (
              <article key={npc.npcId} className="champion-card">
                <div className="champion-card__portrait-wrap">
                  <img
                    src={petImg(npc.portrait)}
                    alt={npc.name}
                    className="champion-card__portrait"
                    draggable={false}
                  />
                </div>
                <h3 className="champion-card__name">{npc.name}</h3>
                <p className="champion-card__level">Lv.{npc.level}</p>
                <p className="champion-card__desc">{npc.description}</p>

                <div className="champion-card__formation-preview" aria-label="Đội hình 3v3">
                  {preview.map((p) => (
                    <div key={p.slotKey} className="champion-mini-pet" title={`${p.name} Lv.${p.level}`}>
                      <img src={petImg(p.image)} alt={p.name} draggable={false} />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>

                <div className="champion-card__actions">
                  <button
                    type="button"
                    className="arena-card-challenge"
                    disabled={starting}
                    onClick={() => openSelect(npc, '3v3')}
                  >
                    3 vs 3
                  </button>
                  <button
                    type="button"
                    className="arena-card-challenge champion-card__btn-5v5"
                    disabled={starting}
                    onClick={() => openSelect(npc, '5v5')}
                  >
                    5 vs 5
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="champion-back-wrap">
          <button type="button" className="champion-back-btn" onClick={() => navigate('/battle')}>
            Quay lại
          </button>
        </div>

        <GameDialogModal
          isOpen={Boolean(errorModal)}
          mode="alert"
          tone="error"
          title="Không thể bắt đầu"
          onClose={() => setErrorModal('')}
          confirmLabel="Đóng"
        >
          <p>{errorModal}</p>
        </GameDialogModal>
      </div>
    </TemplatePage>
  );
}

export default ChampionChallengePage;
