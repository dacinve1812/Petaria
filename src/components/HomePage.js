import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PetNotice from './PetNotice';
import './HomePage.css';
import './RegionMapPage.css';
import castleMapPreset from '../config/homepage-castle-map.json';

function buildMapButtons() {
  const originalCoordinates = Array.isArray(castleMapPreset.originalCoordinates)
    ? castleMapPreset.originalCoordinates
    : [];
  if (Array.isArray(castleMapPreset.mapButtons) && castleMapPreset.mapButtons.length) {
    return castleMapPreset.mapButtons;
  }
  return originalCoordinates.map((area) => ({
    id: area.id,
    x: Math.round((area.coords[0] + area.coords[2]) / 2),
    y: Math.round((area.coords[1] + area.coords[3]) / 2),
    path: area.path,
    label: area.name,
  }));
}

function HomePage() {
  const navigate = useNavigate();
  const mapScrollRef = useRef(null);
  const imageRef = useRef(null);
  const [loadedNaturalSize, setLoadedNaturalSize] = useState({ width: 0, height: 0 });
  const [renderWidth, setRenderWidth] = useState(780);
  const [slotHeight, setSlotHeight] = useState(520);

  const mapImageSrc = castleMapPreset.imageSrc || '/castle2.png';

  const originalCoordinates = useMemo(
    () => (Array.isArray(castleMapPreset.originalCoordinates) ? castleMapPreset.originalCoordinates : []),
    []
  );
  const mapButtons = useMemo(() => buildMapButtons(), []);

  const naturalWidth =
    Number(castleMapPreset?.naturalSize?.width) || Number(loadedNaturalSize.width) || 1632;
  const naturalHeight =
    Number(castleMapPreset?.naturalSize?.height) ||
    Number(castleMapPreset.originalHeight) ||
    Number(loadedNaturalSize.height) ||
    1200;
  const mapAspect = naturalWidth / naturalHeight;

  useEffect(() => {
    const el = mapScrollRef.current;
    if (!el) return;

    const recalcLayout = () => {
      const vv = window.visualViewport;
      const layoutHeight = vv && vv.height ? vv.height : window.innerHeight;
      const rect = el.getBoundingClientRect();
      const measured = Math.max(220, Math.floor(layoutHeight - rect.top - 2));
      /** Giống desktop: bù khi intro + PetNotice đẩy map xuống (mobile không còn chỉ ~220px chiều cao). */
      const REGION_LIKE_MAP_TOP = 200;
      const syntheticAvailable = Math.max(220, Math.floor(layoutHeight - REGION_LIKE_MAP_TOP - 2));
      const available = Math.max(measured, syntheticAvailable);

      const isDesktop = window.matchMedia('(min-width: 901px)').matches;
      const isNarrow = window.matchMedia('(max-width: 499px)').matches;

      let nextW = Math.max(360, Math.round(available * mapAspect));

      if (isDesktop) {
        const gutter = 40;
        const maxByViewport = Math.max(360, window.innerWidth - gutter);
        const minDesktopMapWidth = Math.min(920, maxByViewport);
        nextW = Math.max(nextW, minDesktopMapWidth);
        nextW = Math.min(nextW, maxByViewport);
      }

      if (isNarrow) {
        nextW = Math.max(280, Math.round(available * mapAspect));
      }

      setRenderWidth(nextW);
      setSlotHeight(Math.round(nextW / mapAspect));

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
    const visualVp = window.visualViewport;
    if (visualVp) visualVp.addEventListener('resize', recalcLayout);
    return () => {
      window.removeEventListener('resize', recalcLayout);
      window.removeEventListener('orientationchange', recalcLayout);
      if (visualVp) visualVp.removeEventListener('resize', recalcLayout);
    };
  }, [mapAspect]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      try {
        JSON.parse(atob(token.split('.')[1]));
      } catch (err) {
        console.error('Error decoding token:', err);
        navigate('/login');
      }
    }
  }, [navigate]);

  const handleAreaClick = (path) => {
    navigate(path);
  };

  return (
    <div>
      <div className="map-interactive-container">
        <div className="kinh-thanh-intro">
          <h2 className="kinh-thanh-title">KINH THÀNH PETARIA</h2>
          <p className="kinh-thanh-desc">
            Chào mừng các bạn đến với Kinh thành của Vương quốc Petaria. Bạn sẽ tiến hành hầu hết các hoạt động trên Petaria tại đây, trong Kinh thành có các địa điểm như sau: Nhà (Bảng điều khiển cá nhân), Trung tâm mua sắm, Đấu giá, Sông Healia, Ngân hàng, Nhà hàng, Viện mồ côi, Bưu điện, Trại huấn luyện, Bảng quảng cáo, Phòng chat, Diễn đàn và các liên kết đến: Trung tâm giải trí, Bản đồ Thế giới...
          </p>
        </div>
        <PetNotice />
        <div
          className="castle-map-region-root regionmap-mobile-slot"
          style={{
            '--regionmap-render-width': `${renderWidth}px`,
            '--regionmap-natural-w': naturalWidth,
            '--regionmap-natural-h': naturalHeight,
            '--regionmap-slot-height': `${slotHeight}px`,
          }}
        >
          <div ref={mapScrollRef} className="regionmap-scroll-x">
            <div className="regionmap-canvas-wrap">
              <img
                ref={imageRef}
                className="regionmap-base-image"
                src={mapImageSrc}
                alt="Bản đồ Petaria"
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
                {originalCoordinates.map((area, idx) => {
                  const coords = Array.isArray(area.coords) ? area.coords : null;
                  if (!coords || coords.length !== 4 || naturalWidth <= 0 || naturalHeight <= 0) return null;
                  const left = (coords[0] / naturalWidth) * 100;
                  const top = (coords[1] / naturalHeight) * 100;
                  const width = ((coords[2] - coords[0]) / naturalWidth) * 100;
                  const height = ((coords[3] - coords[1]) / naturalHeight) * 100;
                  return (
                    <button
                      key={`area-${area.id}-${idx}`}
                      type="button"
                      className="regionmap-area-hit"
                      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                      onClick={() => handleAreaClick(area.path)}
                      title={area.name || `Area ${idx + 1}`}
                    />
                  );
                })}
              </div>

              <div className="regionmap-buttons-layer">
                {mapButtons.map((btn, idx) => (
                  <button
                    key={`btn-${btn.id}-${idx}`}
                    type="button"
                    className="regionmap-button"
                    style={{
                      left: `${(Number(btn.x) / naturalWidth) * 100}%`,
                      top: `${(Number(btn.y) / naturalHeight) * 100}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAreaClick(btn.path);
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
