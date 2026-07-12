import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import { GameCenterConfigProvider } from './GameCenterConfigContext';
import './EntertainmentCenter.css';

function EntertainmentCenterPage() {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '');
  const onHub = path === '/game-center';
  /** beggar-king tự có nút back trong narrative actions */
  const hideTopBack = onHub || path === '/game-center/beggar-king';

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <GameCenterConfigProvider>
      <div className="entertainment-center">
        {!hideTopBack && (
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
