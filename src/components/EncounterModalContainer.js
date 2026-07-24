import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EncounterModal from './EncounterModal';
import CatchWildPetModal from './CatchWildPetModal';
import GameAlertModal from './ui/GameAlertModal';
import SimpleFlashOverlay from './SimpleFlashOverlay';
import { UserContext } from '../UserContext';
import { getActiveHuntingMap } from '../utils/huntingSessionStorage';

/** Hunting encounters → modal / catch / battle select page */
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
        const bossRes = await fetch(
          `${API_BASE_URL}/api/bosses/${bossId}?level=${encounterLevel}`
        );
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
        const returnPath = mapId
          ? `/hunting-world/map/${encodeURIComponent(String(mapId))}`
          : '/hunting-world';

        handleClose();
        navigate('/battle/arena/select', {
          state: {
            enemy: {
              ...boss,
              level: encounterLevel,
              statsScaled: true,
              isBoss: true,
              mapId,
            },
            battleMode: '1v1',
            battleSource: 'hunting',
            returnPath,
            huntingMapId: mapId,
            bossLevel: encounterLevel,
          },
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
            if (result?.destination === 'mail') {
              showAlert(
                result?.message ||
                  `Kho pet đã đầy. ${name} đã được gửi vào hộp thư.`,
                {
                  title: 'Bắt thành công',
                  tone: 'success',
                  afterClose: handleClose,
                }
              );
              return;
            }
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
