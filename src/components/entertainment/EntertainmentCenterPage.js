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
        <div className="ec-header">
          {!onHub && (
            <Link to="/game-center" className="ec-back">
              ← Trở lại Trung tâm giải trí
            </Link>
          )}
          <div className="ec-title-block">
            <h1 className="ec-title">Trung tâm giải trí</h1>
            {onHub && (
              <p className="ec-subtitle">
                Mini-game, xổ số và phần thưởng — giao diện sẵn sàng; API sẽ được nối sau.
              </p>
            )}
          </div>
        </div>
        <Outlet />
      </div>
      </GameCenterConfigProvider>
    </TemplatePage>
  );
}

export default EntertainmentCenterPage;
