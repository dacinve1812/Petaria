import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import PetNotice from './PetNotice';
import './HomePage.css';
import GlobalBanner from './GlobalBanner';
import NavigationMenu from './NavigationMenu';
import { resolveAssetPath } from '../utils/pathUtils';

function HomePage({ isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [mapScale, setMapScale] = useState(1);
  const [originalHeight] = useState(640); // Height gốc để tính tọa độ

  // Tọa độ gốc (ở height 640px)
  const originalCoordinates = [
    { id: 1, coords: [53, 83, 143, 134], path: '/shop', name: 'shop' },
    { id: 2, coords: [168, 42, 253, 75], path: '/auction', name: 'auction' },
    { id: 3, coords: [378, 29, 456, 69], path: '/river', name: 'river' },
    { id: 4, coords: [578, 58, 652, 92], path: '/guild', name: 'guild' },
    { id: 5, coords: [763, 27, 852, 58], path: '/', name: 'post-office' },
    { id: 6, coords: [421, 125, 550, 233], path: '/orphanage', name: 'orphanage' },
    { id: 7, coords: [1, 254, 91, 288], path: '/news', name: 'Latest-News' },
    { id: 8, coords: [225, 109, 336, 217], path: '/bank', name: 'bank' },
    { id: 9, coords: [800, 262, 868, 295], path: '/', name: 'Notice' },
    { id: 10, coords: [656, 539, 738, 576], path: '/logout', name: 'Logout' },
    { id: 11, coords: [297, 317, 476, 426], path: '/myhome', name: 'MyHome' },
    { id: 12, coords: [11, 309, 168, 432], path: '/game', name: 'Game' },
    { id: 13, coords: [212, 448, 326, 523], path: '/inventory', name: 'Inventory' },
    { id: 14, coords: [349, 508, 478, 579], path: '/', name: 'chưa biết' },
    { id: 15, coords: [2, 546, 84, 581], path: '/quest', name: 'chưa biết' }
];

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

  const handleLogout = () => {
    onLogoutSuccess();
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleAreaClick = (path) => {
    console.log(`Navigating to: ${path}`);
    navigate(path);
  };

  return (
    <div>
      {/* Banner section */}
      <GlobalBanner
        backgroundImage={resolveAssetPath('/images/background/banner-1.jpeg')}
        className="small"
        overlay={false}
      />

      {/* Navigation Menu */}
      <NavigationMenu />
      <PetNotice />
      
      {/* Interactive Map Container */}
      <div className="map-interactive-container">
        {/* Map with HTML map tag */}
        <div className="map-scroll-container">
          <div className="map-wrapper">
            <img 
              ref={mapRef}
              src="map-night.png" 
              alt="Bản đồ Petaria" 
              className="map-img"
              useMap="#petaria-map"
              onLoad={updateMapScale}
            />
            
            {/* HTML Map with clickable areas */}
            <map name="petaria-map" id="petaria-map">
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;