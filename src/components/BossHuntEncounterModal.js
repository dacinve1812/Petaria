// Gặp boss trên map săn — chọn pet và vào trận Arena (Redis) giống trang Đấu trường
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import EnemyInfoModal from './battle/EnemyInfoModal';
import { getActiveHuntingMap } from '../utils/huntingSessionStorage';

/** @param {{ bossPreview: { id: number, name?: string, image?: string, level?: number, mapId?: string }, onClose: () => void }} props */
function BossHuntEncounterModal({ bossPreview, onClose }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const { user } = useContext(UserContext) || {};
  const [enemyForModal, setEnemyForModal] = useState(null);
  const [matchStarting, setMatchStarting] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  const encounterLevel = Math.max(1, Number(bossPreview?.level) || 1);
  const mapId = bossPreview?.mapId || getActiveHuntingMap()?.mapId || null;

  useEffect(() => {
    if (!bossPreview?.id) return;
    let cancelled = false;
    setEnemyForModal(null);
    setLoadErr('');
    if (!user?.token || !user?.userId) {
      setLoadErr('Vui lòng đăng nhập để chiến đấu.');
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const [bossRes, petsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/bosses/${bossPreview.id}?level=${encounterLevel}`),
          fetch(`${API_BASE_URL}/users/${user.userId}/pets`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);
        if (cancelled) return;
        const petsJson = petsRes.ok ? await petsRes.json() : [];
        const pets = Array.isArray(petsJson) ? petsJson : [];
        if (!bossRes.ok) {
          setEnemyForModal({
            id: bossPreview.id,
            name: bossPreview.name || `Boss #${bossPreview.id}`,
            image: bossPreview.image,
            level: encounterLevel,
            userPets: pets,
            isBoss: true,
            statsScaled: true,
            mapId,
          });
          return;
        }
        const boss = await bossRes.json();
        setEnemyForModal({
          ...boss,
          level: encounterLevel,
          userPets: pets,
          isBoss: true,
          statsScaled: true,
          mapId,
        });
      } catch (e) {
        if (!cancelled) setLoadErr(e.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    bossPreview?.id,
    bossPreview?.name,
    bossPreview?.image,
    encounterLevel,
    mapId,
    API_BASE_URL,
    user?.token,
    user?.userId,
  ]);

  const startMatchAndNavigate = async (pet, enemy) => {
    if (!user?.token || !pet?.id || !enemy?.id) return;
    setMatchStarting(true);
    const bossLevel = Math.max(1, Number(enemy.level) || encounterLevel);
    const returnPath = mapId
      ? `/hunting-world/map/${encodeURIComponent(String(mapId))}`
      : '/hunting-world';
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/match/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          petId: pet.id,
          bossId: enemy.id,
          bossLevel,
          battleSource: 'hunting',
          huntingMapId: mapId,
          returnPath,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const goBattle = (match) => {
        onClose();
        const path = returnPath;
        const patchedMatch = {
          ...match,
          battleSource: 'hunting',
          returnPath: path,
          huntingMapId: mapId || match.huntingMapId || null,
        };
        try {
          sessionStorage.setItem(
            'petaria-arena-battle-return',
            JSON.stringify({
              battleSource: 'hunting',
              returnPath: path,
              huntingMapId: patchedMatch.huntingMapId,
            })
          );
        } catch {
          /* ignore */
        }
        navigate('/battle/arena/arenabattle', {
          state: {
            matchState: patchedMatch,
            playerPet: patchedMatch.player,
            enemyPet: patchedMatch.enemy,
            useRedisMatch: true,
            fromHunting: true,
            battleSource: 'hunting',
            returnPath: path,
            huntingMapId: patchedMatch.huntingMapId,
          },
        });
      };
      if (res.ok) {
        goBattle(data);
        return;
      }
      if (res.status === 400 && data.code === 'ACTIVE_MATCH' && data.match) {
        goBattle(data.match);
        return;
      }
      window.alert(data.message || 'Không thể bắt đầu trận đấu.');
    } catch (err) {
      window.alert(err.message || 'Lỗi kết nối.');
    } finally {
      setMatchStarting(false);
    }
  };

  if (loadErr) {
    return (
      <div className="enemy-modal-overlay" onClick={onClose}>
        <div className="enemy-modal-content" onClick={(e) => e.stopPropagation()}>
          <p>{loadErr}</p>
          <button type="button" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    );
  }

  if (!enemyForModal) return null;

  return (
    <EnemyInfoModal
      enemy={enemyForModal}
      onClose={onClose}
      onSelectPet={(pet) => startMatchAndNavigate(pet, enemyForModal)}
      matchStarting={matchStarting}
    />
  );
}

export default BossHuntEncounterModal;
