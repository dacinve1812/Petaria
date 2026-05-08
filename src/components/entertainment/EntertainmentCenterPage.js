import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import { GameCenterConfigProvider } from './GameCenterConfigContext';
import './EntertainmentCenter.css';

function EntertainmentCenterPage() {
  const location = useLocation();
  const onHub = location.pathname.replace(/\/$/, '') === '/game-center';

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <GameCenterConfigProvider>
      <div className="entertainment-center">
        {!onHub && (
          <div className="ec-header">
            <Link to="/game-center" className="ec-back">
              ← Trở lại Trung tâm giải trí
            </Link>
          </div>
        )}
        <Outlet />
      </div>
      </GameCenterConfigProvider>
    </TemplatePage>
  );
}

export default EntertainmentCenterPage;
