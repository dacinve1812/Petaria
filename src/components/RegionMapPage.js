import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import regionMapsData from '../config/region-maps.json';
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
      };
    }
  );
}

function RegionMapPage() {
  const { regionId } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const imageRef = useRef(null);

  const regionConfig = useMemo(
    () => (regionMapsData.regions || []).find((item) => item.id === regionId) || null,
    [regionId]
  );

  const [loadedNaturalSize, setLoadedNaturalSize] = useState({ width: 0, height: 0 });
  const [viewHeight, setViewHeight] = useState(520);
  const [renderWidth, setRenderWidth] = useState(780);

  const naturalWidth =
    Number(regionConfig?.naturalSize?.width) || Number(loadedNaturalSize.width) || 2100;
  const naturalHeight =
    Number(regionConfig?.originalHeight) ||
    Number(regionConfig?.naturalSize?.height) ||
    Number(loadedNaturalSize.height) ||
    1399;
  const mapAspect = naturalWidth / naturalHeight;

  const mapButtons = useMemo(() => buildButtons(regionConfig), [regionConfig]);
  const areaRects = useMemo(
    () => (Array.isArray(regionConfig?.originalCoordinates) ? regionConfig.originalCoordinates : []),
    [regionConfig]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const recalcLayout = () => {
      const rect = el.getBoundingClientRect();
      const available = Math.max(220, Math.floor(window.innerHeight - rect.top - 2));
      const nextWidth = Math.max(360, Math.round(available * mapAspect));
      setViewHeight(available);
      setRenderWidth(nextWidth);

      window.requestAnimationFrame(() => {
        const isMobile = window.matchMedia('(max-width: 900px)').matches;
        if (isMobile) {
          const centerX = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / 2));
          el.scrollLeft = centerX;
        } else {
          el.scrollLeft = 0;
        }
      });
    };

    recalcLayout();
    window.addEventListener('resize', recalcLayout);
    window.addEventListener('orientationchange', recalcLayout);
    return () => {
      window.removeEventListener('resize', recalcLayout);
      window.removeEventListener('orientationchange', recalcLayout);
    };
  }, [mapAspect]);

  if (!regionConfig) {
    return (
      <div className="regionmap-not-found">
        <h2>Khong tim thay khu vuc</h2>
        <p>Vui long kiem tra lai id khu vuc hoac cap nhat file region config.</p>
        <button type="button" onClick={() => navigate('/world-map')}>
          Quay lai World Map
        </button>
      </div>
    );
  }

  const handleNavigate = (path, meta = {}) => {
    const rawPath = String(path || '').trim();
    const directMapMatch = rawPath.match(/\/hunting-world\/map\/([^/?#]+)/i);
    const directMapId = directMapMatch?.[1] ? decodeURIComponent(directMapMatch[1]) : '';

    if (rawPath && rawPath !== '/' && !directMapId) {
      navigate(rawPath);
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
      className="regionmap-page"
      style={{
        '--regionmap-view-height': `${viewHeight}px`,
        '--regionmap-render-width': `${renderWidth}px`,
      }}
    >
      <div className="regionmap-header">
        <h2>{regionConfig.name}</h2>
        <p>{regionConfig.description || 'Khu vuc dang duoc cap nhat noi dung.'}</p>
      </div>

      <div ref={scrollRef} className="regionmap-scroll-x">
        <div className="regionmap-canvas-wrap">
          <img
            ref={imageRef}
            className="regionmap-base-image"
            src={regionConfig.imageSrc}
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
            {mapButtons.map((btn, idx) => (
              <button
                key={`${btn.id || idx}-btn`}
                type="button"
                className="regionmap-button"
                style={{
                  left: `${(Number(btn.x) / naturalWidth) * 100}%`,
                  top: `${(Number(btn.y) / naturalHeight) * 100}%`,
                }}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegionMapPage;
