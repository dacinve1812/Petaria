import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import PetNotice from './PetNotice';
import './HomePage.css';
import GlobalBanner from './GlobalBanner';
import { resolveAssetPath } from '../utils/pathUtils';
import castleMapPreset from '../config/homepage-castle-map.json';

function HomePage({ isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapScrollRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [mapScale, setMapScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const originalHeight = Number(castleMapPreset.originalHeight) || 640;
  const mapName = castleMapPreset.mapName || 'petaria-map';
  const mapImageSrc = castleMapPreset.imageSrc || '/castle.jpg';

  const originalCoordinates = Array.isArray(castleMapPreset.originalCoordinates)
    ? castleMapPreset.originalCoordinates
    : [];

  // Ưu tiên mapButtons từ JSON preset; nếu thiếu thì tự tính từ tọa độ.
  const mapButtons = Array.isArray(castleMapPreset.mapButtons) && castleMapPreset.mapButtons.length
    ? castleMapPreset.mapButtons
    : originalCoordinates.map((area) => ({
        id: area.id,
        x: Math.round((area.coords[0] + area.coords[2]) / 2),
        y: Math.round((area.coords[1] + area.coords[3]) / 2),
        path: area.path,
        label: area.name,
      }));

  // Tính toán tọa độ scale
  const getScaledCoordinates = (originalCoords) => {
    return originalCoords.map(coord => Math.round(coord * mapScale));
  };

  // Cập nhật scale khi image load hoặc resize
  const updateMapScale = () => {
    if (mapRef.current) {
      const img = mapRef.current;
      const currentHeight = img.offsetHeight;
      const newScale = currentHeight / originalHeight;
      setMapScale(newScale);
      setMapOffset({
        x: img.offsetLeft || 0,
        y: img.offsetTop || 0,
      });
    }
    if (mapScrollRef.current) {
      const scroller = mapScrollRef.current;
      const canScrollX = scroller.scrollWidth > scroller.clientWidth + 1;
      if (canScrollX) {
        scroller.scrollLeft = Math.max(
          0,
          Math.round((scroller.scrollWidth - scroller.clientWidth) / 2)
        );
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        setUserId(decodedToken.userId);
      } catch (err) {
        console.error('Error decoding token:', err);
        navigate('/login');
      }
    }
  }, [navigate]);

  // Effect để theo dõi thay đổi kích thước
  useEffect(() => {
    const handleResize = () => {
      updateMapScale();
    };

    // Cập nhật scale khi component mount
    updateMapScale();

    // Theo dõi resize
    window.addEventListener('resize', handleResize);
    
    // Theo dõi thay đổi CSS media queries
    const mediaQuery = window.matchMedia('(max-height: 760px)');
    const handleMediaChange = () => {
      setTimeout(updateMapScale, 100); // Delay để CSS apply
    };
    
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);


  const handleAreaClick = (path) => {
    console.log(`Navigating to: ${path}`);
    navigate(path);
  };

  return (
    <div>
      
      
      {/* Interactive Map Container */}
      <div className="map-interactive-container">
        <div className="kinh-thanh-intro">
          <h2 className="kinh-thanh-title">KINH THÀNH PETARIA</h2>
          <p className="kinh-thanh-desc">
            Chào mừng các bạn đến với Kinh thành của Vương quốc Petaria. Bạn sẽ tiến hành hầu hết các hoạt động trên Petaria tại đây, trong Kinh thành có các địa điểm như sau: Nhà (Bảng điều khiển cá nhân), Trung tâm mua sắm, Đấu giá, Sông Healia, Ngân hàng, Nhà hàng, Viện mồ côi, Bưu điện, Trại huấn luyện, Bảng quảng cáo, Phòng chat, Diễn đàn và các liên kết đến: Trung tâm giải trí, Bản đồ Thế giới...
          </p>
        </div>
      {/* Navigation Menu */}
      <PetNotice />
        {/* Map with HTML map tag */}
        <div ref={mapScrollRef} className="map-scroll-container">
          <div className="map-wrapper">
            <img 
              ref={mapRef}
              src={mapImageSrc}
              alt="Bản đồ Petaria" 
              className="map-img"
              useMap={`#${mapName}`}
              onLoad={updateMapScale}
            />
            
            {/* HTML Map with clickable areas */}
            <map name={mapName} id={mapName}>
              {originalCoordinates.map((area) => {
                const scaledCoords = getScaledCoordinates(area.coords);
                return (
                  <area 
                    key={area.id}
                    shape="rect" 
                    coords={scaledCoords.join(', ')} 
                    alt={area.name} 
                    title={`${area.name} - Click để vào`}
                    onClick={() => handleAreaClick(area.path)}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </map>

            {/* Overlay buttons: click nhanh giống button trong map */}
            <div className="castle-map-buttons" aria-hidden="false">
              {mapButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  className="castle-map-button"
                  style={{
                    left: `${mapOffset.x + btn.x * mapScale}px`,
                    top: `${mapOffset.y + btn.y * mapScale}px`,
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
  );
}

export default HomePage;