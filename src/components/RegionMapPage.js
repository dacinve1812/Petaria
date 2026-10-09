import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRegionMapsConfig } from '../hooks/useRegionMapsConfig';
import { AlertExclamationBadge } from './ui/AlertExclamationBadge';
import { useGameCenterAlerts } from './entertainment/GameCenterAlertsContext';
import useIsMobile from '../hooks/useIsMobile';
import './RegionMapPage.css';

function buildButtons(mapConfig) {
  if (Array.isArray(mapConfig?.mapButtons) && mapConfig.mapButtons.length > 0) {
    return mapConfig.mapButtons;
  }

  return (Array.isArray(mapConfig?.originalCoordinates) ? mapConfig.originalCoordinates : []).map(
    (area, idx) => {
      const coords = Array.isArray(area.coords) ? area.coords : [0, 0, 0, 0];
      return {
        id: area.id || idx + 1,
        x: Math.round((coords[0] + coords[2]) / 2),
        y: Math.round((coords[1] + coords[3]) / 2),
        path: area.path || '',
        label: area.buttonLabel || area.name || `Go ${idx + 1}`,
        huntingMapId: area.huntingMapId,
      };
    }
  );
}

function RegionMapPage() {
  const { regionId } = useParams();
  const navigate = useNavigate();
  const { hasAnyAlert } = useGameCenterAlerts();
  const scrollRef = useRef(null);
  const imageRef = useRef(null);
  const { regions, loading: mapsLoading } = useRegionMapsConfig();

  const regionConfig = useMemo(
    () => (regions || []).find((item) => item.id === regionId) || null,
    [regionId, regions]
  );
  const isMobile = useIsMobile(600);
  const displayConfig = useMemo(() => {
    if (!regionConfig) return null;
    const imageSrc = String(regionConfig.imageSrc || '').replace(/zone-(\d+)\.png/i, 'zone_$1.png');
    const base = imageSrc === regionConfig.imageSrc ? regionConfig : { ...regionConfig, imageSrc };
    const mobile = base.mobile;
    if (!isMobile || !mobile?.imageSrc) return base;
    return {
      ...regionConfig,
      imageSrc: mobile.imageSrc,
      naturalSize: mobile.naturalSize || regionConfig.naturalSize,
      originalCoordinates: Array.isArray(mobile.originalCoordinates) ? mobile.originalCoordinates : [],
      mapButtons: Array.isArray(mobile.mapButtons) ? mobile.mapButtons : [],
    };
  }, [isMobile, regionConfig]);

  const [loadedNaturalSize, setLoadedNaturalSize] = useState({ width: 0, height: 0 });

  const naturalWidth =
    Number(displayConfig?.naturalSize?.width) || Number(loadedNaturalSize.width) || 2100;
  const naturalHeight =
    Number(displayConfig?.naturalSize?.height) ||
    Number(displayConfig?.originalHeight) ||
    Number(loadedNaturalSize.height) ||
    1399;

  const mapButtons = useMemo(() => buildButtons(displayConfig), [displayConfig]);
  const areaRects = useMemo(
    () => (Array.isArray(displayConfig?.originalCoordinates) ? displayConfig.originalCoordinates : []),
    [displayConfig]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !regionConfig) return undefined;
    const narrow = window.matchMedia('(max-width: 599px)').matches;
    if (!narrow) {
      el.scrollLeft = 0;
      return undefined;
    }
    const center = () => {
      el.scrollLeft = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / 2));
    };
    center();
    const frame = window.requestAnimationFrame(center);
    return () => window.cancelAnimationFrame(frame);
  }, [regionId, regionConfig]);

  if (!regionConfig) {
    return (
      <div className="regionmap-not-found">
        <h2>{mapsLoading ? 'Đang tải khu vực…' : 'Khong tim thay khu vuc'}</h2>
        {!mapsLoading ? (
          <>
            <p>Vui long kiem tra lai id khu vuc hoac cap nhat file region config.</p>
            <button type="button" onClick={() => navigate('/world-map')}>
              Quay lai World Map
            </button>
          </>
        ) : null}
      </div>
    );
  }

  const handleNavigate = (path, meta = {}) => {
    const rawPath = String(path || '').trim();
    const directMapMatch = rawPath.match(/\/hunting-world\/map\/([^/?#]+)/i);
    const directMapId = directMapMatch?.[1] ? decodeURIComponent(directMapMatch[1]) : '';

    if (rawPath && rawPath !== '/' && !directMapId) {
      navigate(rawPath, {
        state: {
          from: 'region',
          regionId: regionId || null,
          regionName: regionConfig?.name || null,
        },
      });
      return;
    }

    const params = new URLSearchParams();
    if (regionId) params.set('regionId', regionId);
    if (meta.spotId != null) params.set('spotId', String(meta.spotId));
    if (meta.spotName) params.set('spotName', String(meta.spotName));
    if (meta.huntingMapId) params.set('mapId', String(meta.huntingMapId));
    if (directMapId) params.set('mapId', directMapId);
    navigate(`/hunting-world/confirm?${params.toString()}`);
  };

  return (
    <div
      className={isMobile ? 'regionmap-page regionmap-page--mobile' : 'regionmap-page'}
      style={{
        '--regionmap-natural-w': naturalWidth,
        '--regionmap-natural-h': naturalHeight,
      }}
    >
      <div className="regionmap-header">
        <h2>{regionConfig.name}</h2>
        <p>{regionConfig.description || 'Khu vuc dang duoc cap nhat noi dung.'}</p>
      </div>

      <div className="regionmap-map-slot regionmap-mobile-slot">
        <div ref={scrollRef} className="regionmap-scroll-x">
          <div className="regionmap-canvas-wrap">
            <img
              ref={imageRef}
              className="regionmap-base-image"
              src={displayConfig.imageSrc}
              alt={regionConfig.name}
              draggable={false}
              onLoad={() => {
                if (!imageRef.current) return;
                setLoadedNaturalSize({
                  width: imageRef.current.naturalWidth || 0,
                  height: imageRef.current.naturalHeight || 0,
                });
              }}
            />

            <div className="regionmap-hit-layer">
              {areaRects.map((area, idx) => {
                const coords = Array.isArray(area.coords) ? area.coords : null;
                if (!coords || coords.length !== 4 || naturalWidth <= 0 || naturalHeight <= 0) return null;
                const left = (coords[0] / naturalWidth) * 100;
                const top = (coords[1] / naturalHeight) * 100;
                const width = ((coords[2] - coords[0]) / naturalWidth) * 100;
                const height = ((coords[3] - coords[1]) / naturalHeight) * 100;
                return (
                  <button
                    key={`${area.id || idx}-hit`}
                    type="button"
                    className="regionmap-area-hit"
                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                    onClick={() =>
                      handleNavigate(area.path, {
                        spotId: area.id,
                        spotName: area.name,
                        huntingMapId: area.huntingMapId,
                      })
                    }
                    title={area.name || `Area ${idx + 1}`}
                  />
                );
              })}
            </div>

            <div className="regionmap-buttons-layer">
              {mapButtons.map((btn, idx) => {
                const pathNorm = String(btn.path || '').replace(/\/$/, '');
                const isGameCenter =
                  pathNorm === '/game-center' ||
                  String(btn.label || '').trim() === 'Giải Trí';
                const showAlert = isGameCenter && hasAnyAlert;
                return (
                <span
                  key={`${btn.id || idx}-btn`}
                  className={`regionmap-button-wrap${showAlert ? ' regionmap-button-wrap--alert' : ''}`}
                  style={{
                    left: `${(Number(btn.x) / naturalWidth) * 100}%`,
                    top: `${(Number(btn.y) / naturalHeight) * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    className="regionmap-button"
                    onClick={() =>
                      handleNavigate(btn.path, {
                        spotId: btn.id,
                        spotName: btn.label || btn.name,
                        huntingMapId: btn.huntingMapId,
                      })
                    }
                  >
                    {btn.label || `Go ${idx + 1}`}
                  </button>
                  {showAlert && (
                    <AlertExclamationBadge
                      size={16}
                      title="Game Center còn lượt chơi"
                      ariaLabel="Game Center còn lượt chơi"
                    />
                  )}
                </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegionMapPage;
