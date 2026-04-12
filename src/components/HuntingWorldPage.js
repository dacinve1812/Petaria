import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import { BUILTIN_FOREST_ENTRY, mergeRemoteAndLocalHuntingCatalog, getHuntingMapCatalog } from '../game/map/huntingMapCatalog';
import { fetchPublicHuntingMapList } from '../api/huntingMapsApi';
import { loadAllCustomMaps } from '../utils/huntingMapsStorage';
import { getActiveHuntingMap } from '../utils/huntingSessionStorage';
import GameDialogModal from './ui/GameDialogModal';
import './HuntingWorldPage.css';

function HuntingWorldPage() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState([BUILTIN_FOREST_ENTRY]);
  const [loadError, setLoadError] = useState(false);
  const [pendingMap, setPendingMap] = useState(null);
  const [continueMapModalOpen, setContinueMapModalOpen] = useState(false);
  const [activeMapId, setActiveMapId] = useState('');

  const reloadCatalog = useCallback(async () => {
    try {
      const remote = await fetchPublicHuntingMapList();
      const local = loadAllCustomMaps();
      setMaps(mergeRemoteAndLocalHuntingCatalog(remote, local));
      setLoadError(false);
    } catch {
      setMaps(getHuntingMapCatalog());
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    reloadCatalog();
  }, [reloadCatalog]);

  useEffect(() => {
    const onChange = () => reloadCatalog();
    window.addEventListener('petaria-hunting-maps-changed', onChange);
    return () => window.removeEventListener('petaria-hunting-maps-changed', onChange);
  }, [reloadCatalog]);

  useEffect(() => {
    const active = getActiveHuntingMap();
    setActiveMapId(active?.mapId || '');
  }, [maps]);

  const visibleMaps = useMemo(
    () => maps.filter((m) => !m.builtIn && m.id !== 'forest'),
    [maps]
  );

  const getCardMeta = (m) => {
    const feeLine = `Vé Vào: ${m.entryFee} ${m.currency}`;
    if (m.maxSteps == null || m.maxSteps === 0) {
      return { feeLine, stepLine: 'Không giới hạn bước' };
    }
    return { feeLine, stepLine: `Tối đa ${m.maxSteps} bước` };
  };

  const openConfirm = (mapItem) => {
    if (activeMapId && String(activeMapId) !== String(mapItem.id)) {
      setContinueMapModalOpen(true);
      return;
    }
    setPendingMap(mapItem);
  };
  const closeConfirm = () => setPendingMap(null);
  const confirmEnter = () => {
    if (!pendingMap) return;
    navigate(`/hunting-world/map/${encodeURIComponent(pendingMap.id)}`);
    setPendingMap(null);
  };
  const activeMap = visibleMaps.find((m) => String(m.id) === String(activeMapId)) || null;
  const handleContinueActiveMap = () => {
    if (!activeMapId) return;
    navigate(`/hunting-world/map/${encodeURIComponent(activeMapId)}`);
    setContinueMapModalOpen(false);
  };

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="hunting-world-container">
        <div className="hunting-world-header">
          <h2>🌿 Thế Giới Săn Bắt</h2>
          <p>Khám phá và săn bắt các loài thú cưng hoang dã</p>
          {loadError && (
            <p className="hunting-world-api-hint" style={{ opacity: 0.85, fontSize: '0.9rem' }}>
              Không tải được danh sách từ server — hiển thị map local (nếu có).
            </p>
          )}
        </div>

        <div className="hunting-world-content">
          <div className="hunting-grid">
            {visibleMaps.map((m) => {
              const { feeLine, stepLine } = getCardMeta(m);
              return (
              <button
                key={m.id}
                type="button"
                className="hunting-card"
                onClick={() => openConfirm(m)}
              >
                <div className="card-thumb">
                  <img
                    src={m.thumb || '/images/icons/background.png'}
                    alt={m.name}
                    onError={(e) => {
                      e.target.src = '/images/icons/background.png';
                    }}
                  />
                </div>
                <div className="card-body">
                  <div className="card-title">{m.name}</div>
                  <div className="card-desc">
                    <div className="card-desc-line">{feeLine}</div>
                    <div className="card-desc-line">{stepLine}</div>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        </div>
      </div>

      <GameDialogModal
        isOpen={Boolean(pendingMap)}
        onClose={closeConfirm}
        title="Xác nhận vào bản đồ"
        mode="confirm"
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onConfirm={confirmEnter}
        onCancel={closeConfirm}
      >
        {pendingMap && (
          <p>
            Dùng <strong>{`${pendingMap.entryFee} ${pendingMap.currency}`}</strong> để mua vé vào{' '}
            <strong>{pendingMap.name}</strong>
          </p>
        )}
      </GameDialogModal>

      <GameDialogModal
        isOpen={continueMapModalOpen}
        onClose={() => setContinueMapModalOpen(false)}
        title="Tiếp tục đi săn"
        mode="confirm"
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onCancel={() => setContinueMapModalOpen(false)}
        onConfirm={handleContinueActiveMap}
      >
        {activeMapId && (
          <p>
            Bạn đang trong bản đồ <strong>{activeMap?.name || activeMapId}</strong>. Bạn có muốn tiếp tục?
          </p>
        )}
      </GameDialogModal>
    </TemplatePage>
  );
}

export default HuntingWorldPage;
