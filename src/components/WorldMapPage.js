import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorldMapPage.css';
import zonePointsData from '../config/worldmap-zone-points.json';
import { useRegionMapsConfig } from '../hooks/useRegionMapsConfig';
import useIsMobile from '../hooks/useIsMobile';
import { useChapter0 } from './story/Chapter0/Chapter0Context';

function getOverlayPath(area) {
  return `/worldmap/${area.row}-${area.col}.png`;
}

function WorldMapPage() {
  const navigate = useNavigate();
  const MAP_WIDTH = zonePointsData.width || 2100;
  const MAP_HEIGHT = zonePointsData.height || 1399;
  const isMobile = useIsMobile(600);
  const mobileMap = zonePointsData.mobile || {};
  const frameWidth = isMobile ? (mobileMap.width || 1086) : MAP_WIDTH;
  const frameHeight = isMobile ? (mobileMap.height || 1448) : MAP_HEIGHT;
  const mapAspect = frameWidth / frameHeight;
  const mapImageSrc = isMobile
    ? (mobileMap.imageSrc || '/worldmap/worldmap_mobile.png')
    : (zonePointsData.baseImage || '/worldmap/worldmap.png');
  const { regions } = useRegionMapsConfig();
  const { story } = useChapter0();
  const zoneMeta = useMemo(() => {
    const map = {};
    (regions || []).forEach((region) => {
      map[region.id] = {
        name: region.name || `Zone ${region.id}`,
        to: `/region/${region.id}`,
      };
    });
    return map;
  }, [regions]);

  const areas = useMemo(
    () =>
      ((isMobile ? mobileMap.zones : zonePointsData.zones) || []).map((z) => ({
        id: z.id,
        row: z.row,
        col: z.col,
        points: z.pointsString,
        box: Array.isArray(z.box) ? z.box : null,
        name: z.name || zoneMeta[z.id]?.name || `Zone ${z.id}`,
        to: z.to || zoneMeta[z.id]?.to || null,
      })),
    [isMobile, mobileMap.zones, zoneMeta]
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

  // useEffect(() => {
  //   const root = document.documentElement;
  //   const prevRoot = root.style.overscrollBehaviorX;
  //   const prevBody = document.body.style.overscrollBehaviorX;
  //   root.style.overscrollBehaviorX = 'none';
  //   document.body.style.overscrollBehaviorX = 'none';
  //   return () => {
  //     root.style.overscrollBehaviorX = prevRoot;
  //     document.body.style.overscrollBehaviorX = prevBody;
  //   };
  // }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const recalcLayout = () => {
      const rect = el.getBoundingClientRect();
      const available = Math.max(220, Math.floor(window.innerHeight - rect.top - 2));
      const nextWidth = Math.max(360, Math.round(available * mapAspect));
      setViewHeight(available);
      setRenderWidth(nextWidth);

      if (window.matchMedia('(max-width: 599px)').matches) return;
      el.scrollLeft = 0;
    };
    recalcLayout();
    window.addEventListener('resize', recalcLayout);
    window.addEventListener('orientationchange', recalcLayout);
    return () => {
      window.removeEventListener('resize', recalcLayout);
      window.removeEventListener('orientationchange', recalcLayout);
    };
  }, [mapAspect]);

  useEffect(() => {
    if (!isMobile) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;
    const center = () => {
      el.scrollLeft = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / 2));
    };
    center();
    const frame = window.requestAnimationFrame(center);
    return () => window.cancelAnimationFrame(frame);
  }, [isMobile, frameWidth, frameHeight]);

  const worldLocked = story?.enrolled
    && !story?.completed
    && !story?.flags?.LETTER_QUEST_ACCEPTED
    && (story?.flags?.HEAL_SERVICE_USED || story?.flags?.LETTER_DECLINED);

  if (worldLocked) {
    return (
      <div className="worldmap-page" style={{ padding: 24, textAlign: 'center' }}>
        <p>Biển vẫn chưa mở. Hãy nhận lá thư của Rowan trước khi ra khơi.</p>
        <button type="button" onClick={() => navigate('/home-ver2')}>Về Kinh thành</button>
      </div>
    );
  }

  return (
    <div
      className={isMobile ? 'worldmap-page worldmap-page--mobile' : 'worldmap-page'}
      style={{
        '--worldmap-view-height': `${viewHeight}px`,
        '--worldmap-render-width': `${renderWidth}px`,
        '--worldmap-natural-w': frameWidth,
        '--worldmap-natural-h': frameHeight,
      }}
    >

      <div ref={scrollRef} className="worldmap-scroll-x">
        <div className="worldmap-canvas-wrap">
          <img
            className="worldmap-base-image"
            src={mapImageSrc}
            alt="Petaria world map"
            draggable={false}
          />
          {!isMobile && activeArea && isOverlayAvailable && (
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
            viewBox={`0 0 ${frameWidth} ${frameHeight}`}
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
            {areas.map((area) => {
              const className =
                'worldmap-area ' +
                (area.box ? 'worldmap-area--box ' : '') +
                (story?.guidance?.worldRegion === area.id ? 'worldmap-area--story ' : '') +
                (activeId === area.id ? 'worldmap-area--active' : '');
              const handlers = {
                onMouseEnter: () => setHoveredId(area.id),
                onTouchStart: () => setHoveredId(area.id),
                onClick: () => handleAreaClick(area),
              };
              if (area.box) {
                const [x1, y1, x2, y2] = area.box;
                return (
                  <rect
                    key={area.id}
                    x={Math.min(x1, x2)}
                    y={Math.min(y1, y2)}
                    width={Math.abs(x2 - x1)}
                    height={Math.abs(y2 - y1)}
                    className={className}
                    {...handlers}
                  >
                    <title>{area.name}</title>
                  </rect>
                );
              }
              return (
                <polygon
                  key={area.id}
                  points={area.points}
                  className={className}
                  {...handlers}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

export default WorldMapPage;
