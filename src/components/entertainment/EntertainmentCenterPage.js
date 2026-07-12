import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import TemplatePage from '../template/TemplatePage';
import { GameCenterConfigProvider } from './GameCenterConfigContext';
import { gameCenterPathSegment, useGamePageBackground } from './useGamePageBackground';
import './EntertainmentCenter.css';

function EntertainmentCenterInner() {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '');
  const onHub = path === '/game-center';
  const segment = gameCenterPathSegment(path);
  const pageBg = useGamePageBackground(segment);

  /** Narrative features tự có nút back trong actions */
  const hideTopBack =
    onHub ||
    path === '/game-center/beggar-king' ||
    path === '/game-center/daily-free' ||
    path === '/game-center/guess-number' ||
    path === '/game-center/slot-machine';

  return (
    <div className="entertainment-center">
      {!hideTopBack && (
        <div className="ec-header">
          <Link to="/game-center" className="ec-back">
            ← Trở lại Trung tâm giải trí
          </Link>
        </div>
      )}
      <div
        className={`ec-page-surface${pageBg.src ? ` ${pageBg.className}` : ''}`.trim()}
        style={pageBg.style}
      >
        <Outlet />
      </div>
    </div>
  );
}

function EntertainmentCenterPage() {
  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <GameCenterConfigProvider>
        <EntertainmentCenterInner />
      </GameCenterConfigProvider>
    </TemplatePage>
  );
}

export default EntertainmentCenterPage;
