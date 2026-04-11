import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import { BUILTIN_FOREST_ENTRY, mergeRemoteAndLocalHuntingCatalog, getHuntingMapCatalog } from '../game/map/huntingMapCatalog';
import { fetchPublicHuntingMapList } from '../api/huntingMapsApi';
import { loadAllCustomMaps } from '../utils/huntingMapsStorage';
import GameDialogModal from './ui/GameDialogModal';
import './HuntingWorldPage.css';

function HuntingWorldPage() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState([BUILTIN_FOREST_ENTRY]);
  const [loadError, setLoadError] = useState(false);
  const [pendingMap, setPendingMap] = useState(null);

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

  const openConfirm = (mapItem) => setPendingMap(mapItem);
  const closeConfirm = () => setPendingMap(null);
  const confirmEnter = () => {
    if (!pendingMap) return;
    navigate(`/hunting-world/map/${encodeURIComponent(pendingMap.id)}`);
    setPendingMap(null);
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
    </TemplatePage>
  );
}

export default HuntingWorldPage;
