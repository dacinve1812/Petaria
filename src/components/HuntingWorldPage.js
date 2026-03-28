import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import { BUILTIN_FOREST_ENTRY, mergeRemoteAndLocalHuntingCatalog, getHuntingMapCatalog } from '../game/map/huntingMapCatalog';
import { fetchPublicHuntingMapList } from '../api/huntingMapsApi';
import { loadAllCustomMaps } from '../utils/huntingMapsStorage';
import './HuntingWorldPage.css';

function HuntingWorldPage() {
  const [maps, setMaps] = useState([BUILTIN_FOREST_ENTRY]);
  const [loadError, setLoadError] = useState(false);

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

  const stepLabel = (m) => {
    if (m.builtIn) return null;
    if (m.maxSteps == null || m.maxSteps === 0) {
      return `Vé: ${m.entryFee} ${m.currency} · không giới hạn bước`;
    }
    return `Vé: ${m.entryFee} ${m.currency} · tối đa ${m.maxSteps} bước`;
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
            {maps.map((m) => (
              <Link key={m.id} to={`/hunting-world/map/${encodeURIComponent(m.id)}`} className="hunting-card">
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
                    {m.builtIn
                      ? 'Map gốc · bước không giới hạn'
                      : stepLabel(m)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default HuntingWorldPage;
