import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorldMapPage.css';
import zonePointsData from '../config/worldmap-zone-points.json';
import regionMapsData from '../config/region-maps.json';

function getOverlayPath(area) {
  return `/worldmap/${area.row}-${area.col}.png`;
}

function WorldMapPage() {
  const navigate = useNavigate();
  const MAP_WIDTH = zonePointsData.width || 2100;
  const MAP_HEIGHT = zonePointsData.height || 1399;
  const mapAspect = MAP_WIDTH / MAP_HEIGHT;
  const zoneMeta = useMemo(() => {
    const map = {};
    (regionMapsData.regions || []).forEach((region) => {
      map[region.id] = {
        name: region.name || `Zone ${region.id}`,
        to: `/region/${region.id}`,
      };
    });
    return map;
  }, []);

  const areas = useMemo(
    () =>
      (zonePointsData.zones || []).map((z) => ({
        id: z.id,
        row: z.row,
        col: z.col,
        points: z.pointsString,
        name: zoneMeta[z.id]?.name || `Zone ${z.id}`,
        to: zoneMeta[z.id]?.to || null,
      })),
    [zoneMeta]
  );

  const [hoveredId, setHoveredId] = useState(null);
  const [missingOverlayIds, setMissingOverlayIds] = useState([]);
  const scrollRef = useRef(null);
  const [viewHeight, setViewHeight] = useState(520);
  const [renderWidth, setRenderWidth] = useState(780);

  const activeId = hoveredId;
  const activeArea = useMemo(
    () => areas.find((a) => a.id === activeId) || null,
    [areas, activeId]
  );
  const isOverlayAvailable =
    activeArea != null && !missingOverlayIds.includes(activeArea.id);
  const overlaySrc = activeArea ? getOverlayPath(activeArea) : '';

  const handleAreaClick = (area) => {
    if (!area) return;
    if (area.to) {
      navigate(area.to);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const recalcLayout = () => {
      const rect = el.getBoundingClientRect();
      const available = Math.max(220, Math.floor(window.innerHeight - rect.top - 2));
      const nextWidth = Math.max(360, Math.round(available * mapAspect));
      setViewHeight(available);
      setRenderWidth(nextWidth);

      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (isMobile) {
        const centerX = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / 2));
        el.scrollLeft = centerX;
      } else {
        el.scrollLeft = 0;
      }
    };
    recalcLayout();
    window.addEventListener('resize', recalcLayout);
    window.addEventListener('orientationchange', recalcLayout);
    return () => {
      window.removeEventListener('resize', recalcLayout);
      window.removeEventListener('orientationchange', recalcLayout);
    };
  }, [mapAspect]);

  return (
    <div
      className="worldmap-page"
      style={{
        '--worldmap-view-height': `${viewHeight}px`,
        '--worldmap-render-width': `${renderWidth}px`,
      }}
    >

      <div ref={scrollRef} className="worldmap-scroll-x">
        <div className="worldmap-canvas-wrap">
          <img
            className="worldmap-base-image"
            src={zonePointsData.baseImage || '/worldmap/worldmap.png'}
            alt="Petaria world map"
            draggable={false}
          />
          {activeArea && isOverlayAvailable && (
            <img
              className="worldmap-overlay-image"
              src={overlaySrc}
              alt={`${activeArea.name} overlay`}
              draggable={false}
              onError={() => {
                setMissingOverlayIds((prev) =>
                  prev.includes(activeArea.id) ? prev : [...prev, activeArea.id]
                );
              }}
            />
          )}

          <svg
            className="worldmap-hit-layer"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="geometricPrecision"
            onMouseLeave={() => setHoveredId(null)}
          >
            <defs>
              <filter id="worldmap-gold-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.6" floodColor="#ffd77a" floodOpacity="0.95" />
                <feDropShadow dx="0" dy="0" stdDeviation="5.5" floodColor="#ffbf3f" floodOpacity="0.7" />
                <feDropShadow dx="0" dy="2" stdDeviation="4.2" floodColor="#8f5a00" floodOpacity="0.6" />
              </filter>
            </defs>
            {areas.map((area) => (
              <polygon
                key={area.id}
                points={area.points}
                className={
                  'worldmap-area ' +
                  (activeId === area.id ? 'worldmap-area--active' : '')
                }
                onMouseEnter={() => setHoveredId(area.id)}
                onTouchStart={() => setHoveredId(area.id)}
                onClick={() => handleAreaClick(area)}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

export default WorldMapPage;
