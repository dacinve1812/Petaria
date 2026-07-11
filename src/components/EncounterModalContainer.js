import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EncounterModal from './EncounterModal';
import CatchWildPetModal from './CatchWildPetModal';
import GameAlertModal from './ui/GameAlertModal';
import EnemyInfoModal from './battle/EnemyInfoModal';
import SimpleFlashOverlay from './SimpleFlashOverlay';
import { UserContext } from '../UserContext';
import { getActiveHuntingMap } from '../utils/huntingSessionStorage';

function EncounterModalContainer() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const { user } = useContext(UserContext) || {};

  const [payload, setPayload] = useState(null);
  /** @type {'species'|'item'|'boss'|null} */
  const [encounterType, setEncounterType] = useState(null);
  const [huntingMapId, setHuntingMapId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCatchUi, setShowCatchUi] = useState(false);
  const [showScreenFlash, setShowScreenFlash] = useState(false);
  const isProcessingRef = useRef(false);
  /** @type {[{ title?: string, message: string, confirmLabel?: string, afterClose?: () => void }|null, Function]} */
  const [alertModal, setAlertModal] = useState(null);

  const [bossBattleEnemy, setBossBattleEnemy] = useState(null);
  const [matchStarting, setMatchStarting] = useState(false);
  const [claimingItem, setClaimingItem] = useState(false);

  const showAlert = useCallback((message, opts = {}) => {
    setAlertModal({
      title: opts.title,
      message: String(message || ''),
      confirmLabel: opts.confirmLabel || 'OK',
      tone: opts.tone || 'default',
      afterClose: opts.afterClose,
    });
  }, []);

  useEffect(() => {
    const handleEncounter = (event) => {
      if (isProcessingRef.current) return;

      const detail = event.detail || {};
      const type =
        detail.encounterType === 'item'
          ? 'item'
          : detail.encounterType === 'boss'
            ? 'boss'
            : 'species';

      let nextPayload = null;
      if (type === 'item') {
        nextPayload = detail.itemEncounter || null;
      } else if (type === 'boss') {
        nextPayload = detail.bossEncounter || null;
      } else {
        nextPayload = detail.wildPet || null;
      }

      if (!nextPayload) {
        console.warn('[encounter] Missing payload for type:', type, detail);
        return;
      }

      const mapId =
        detail.mapId ||
        nextPayload.mapId ||
        getActiveHuntingMap()?.mapId ||
        null;

      isProcessingRef.current = true;
      setShowScreenFlash(true);
      setEncounterType(type);
      setHuntingMapId(mapId ? String(mapId) : null);
      setPayload(mapId ? { ...nextPayload, mapId } : nextPayload);
      setBossBattleEnemy(null);
      setShowCatchUi(false);
      setClaimingItem(false);
    };

    window.addEventListener('wildPetEncounter', handleEncounter);
    return () => window.removeEventListener('wildPetEncounter', handleEncounter);
  }, []);

  const handleScreenFlashComplete = () => {
    setIsModalOpen(true);
    setShowScreenFlash(false);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setShowCatchUi(false);
    setPayload(null);
    setEncounterType(null);
    setHuntingMapId(null);
    setBossBattleEnemy(null);
    setClaimingItem(false);
    isProcessingRef.current = false;
    window.dispatchEvent(new CustomEvent('encounterModalClosed'));
  };

  const handleClaimItem = async (data) => {
    if (!user?.token || !user?.userId) {
      showAlert('Vui lòng đăng nhập để nhận vật phẩm.');
      return;
    }
    const itemId = parseInt(data?.item_id ?? data?.itemId, 10);
    const quantity = Math.max(1, Math.min(99, parseInt(data?.qty ?? data?.quantity, 10) || 1));
    if (!Number.isFinite(itemId) || itemId <= 0) {
      showAlert('Vật phẩm không hợp lệ.');
      return;
    }
    setClaimingItem(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/hunting/claim-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          itemId,
          quantity,
          mapId: data?.mapId ?? data?.map_id ?? null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || 'Không nhận được vật phẩm');
      }
      handleClose();
      showAlert(body.message || `Đã nhận ${data?.name || 'vật phẩm'} ×${quantity} vào túi đồ.`, {
        title: 'Nhận thành công',
      });
    } catch (e) {
      setClaimingItem(false);
      showAlert(e.message || 'Lỗi khi nhận vật phẩm.');
    }
  };

  const handleCatch = (data) => {
    if (!user?.token || !user?.userId) {
      showAlert('Vui lòng đăng nhập để bắt pet.');
      return;
    }
    if (!(data?.species_id ?? data?.speciesId)) {
      showAlert('Encounter thiếu species_id — không bắt được.');
      return;
    }
    setIsModalOpen(false);
    setShowCatchUi(true);
  };

  const startBossMatch = async (pet, enemy) => {
    if (!user?.token || !pet?.id || !enemy?.id) return;
    setMatchStarting(true);
    const bossLevel = Math.max(
      1,
      Number(enemy.level) || Number(payload?.level) || 1
    );
    const mapId =
      enemy.mapId ||
      payload?.mapId ||
      huntingMapId ||
      getActiveHuntingMap()?.mapId ||
      null;
    const returnPath = mapId
      ? `/hunting-world/map/${encodeURIComponent(String(mapId))}`
      : '/hunting-world';
    try {
      const res = await fetch(`${API_BASE_URL}/api/arena/match/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
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
        handleClose();
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
      showAlert(data.message || 'Không thể bắt đầu trận đấu.');
    } catch (err) {
      showAlert(err.message || 'Lỗi kết nối.');
    } finally {
      setMatchStarting(false);
    }
  };

  const handleBattle = async (data) => {
    if (encounterType === 'boss') {
      if (!user?.token || !user?.userId) {
        showAlert('Vui lòng đăng nhập để chiến đấu.');
        return;
      }
      const bossId = data?.id;
      const encounterLevel = Math.max(1, Number(data?.level) || 1);
      if (!bossId) {
        showAlert('Boss không hợp lệ.');
        return;
      }
      try {
        const [bossRes, petsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/bosses/${bossId}?level=${encounterLevel}`),
          fetch(`${API_BASE_URL}/users/${user.userId}/pets`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);
        const petsJson = petsRes.ok ? await petsRes.json() : [];
        const pets = Array.isArray(petsJson) ? petsJson : [];
        let boss;
        if (bossRes.ok) {
          boss = await bossRes.json();
        } else {
          boss = {
            id: bossId,
            name: data.name || `Boss #${bossId}`,
            image: data.image,
            level: encounterLevel,
            isBoss: true,
          };
        }
        const mapId =
          data?.mapId || huntingMapId || getActiveHuntingMap()?.mapId || null;
        setIsModalOpen(false);
        setBossBattleEnemy({
          ...boss,
          level: encounterLevel,
          statsScaled: true,
          userPets: pets,
          isBoss: true,
          mapId,
        });
      } catch (e) {
        showAlert(e.message || 'Không tải được thông tin Boss.');
      }
      return;
    }

    console.log('[encounter] Battle pet:', data?.name);
    showAlert(`Chiến đấu với ${data?.name || ''} — sẽ bổ sung sau.`);
  };

  return (
    <>
      <SimpleFlashOverlay
        isActive={showScreenFlash}
        onAnimationComplete={handleScreenFlashComplete}
        flashCount={3}
        duration={800}
      />

      {isModalOpen && encounterType && payload && (
        <EncounterModal
          type={encounterType}
          data={payload}
          onClose={handleClose}
          onCatch={handleCatch}
          onBattle={handleBattle}
          onClaimItem={handleClaimItem}
          claimingItem={claimingItem}
        />
      )}

      {showCatchUi && payload && user?.token && (
        <CatchWildPetModal
          wildPet={payload}
          token={user.token}
          userId={user.userId}
          apiBase={API_BASE_URL}
          onClose={() => {
            setShowCatchUi(false);
            setIsModalOpen(true);
          }}
          onCaught={(result) => {
            setShowCatchUi(false);
            const name = result?.name || payload?.name || 'Pet';
            const level = result?.level ?? payload?.level ?? '?';
            showAlert(`Chúc mừng bạn đã bắt thành công ${name} level ${level} !`, {
              title: 'Bắt thành công',
              tone: 'success',
              afterClose: handleClose,
            });
          }}
          onFled={() => {
            setShowCatchUi(false);
            const name = payload?.name || 'Pet';
            showAlert(`${name} đã chạy mất !`, {
              title: 'Bắt thất bại',
              tone: 'error',
              afterClose: handleClose,
            });
          }}
        />
      )}

      {bossBattleEnemy && (
        <EnemyInfoModal
          enemy={bossBattleEnemy}
          onClose={handleClose}
          onSelectPet={(pet) => startBossMatch(pet, bossBattleEnemy)}
          matchStarting={matchStarting}
        />
      )}

      {alertModal && (
        <GameAlertModal
          isOpen
          title={alertModal.title || 'Thông báo'}
          message={alertModal.message}
          confirmLabel={alertModal.confirmLabel || 'OK'}
          tone={alertModal.tone || 'default'}
          onClose={() => {
            const after = alertModal.afterClose;
            setAlertModal(null);
            if (typeof after === 'function') after();
          }}
        />
      )}
    </>
  );
}

export default EncounterModalContainer;
