import React from 'react';
import { Link } from 'react-router-dom';
import { AlertExclamationBadge } from '../ui/AlertExclamationBadge';
import { useGameCenterConfig } from './GameCenterConfigContext';
import { useGameCenterAlerts } from './GameCenterAlertsContext';

function EntertainmentHub() {
  const { hubGames, loading } = useGameCenterConfig();
  const { showFeatureAlert } = useGameCenterAlerts();

  if (loading) {
    return (
      <div className="ec-hub">
        <p className="ec-game__lead">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="ec-hub">
      <ul className="ec-hub-grid">
        {hubGames.map((game) => (
          <li key={game.id}>
            <Link
              to={game.path}
              state={{ from: 'game-center' }}
              className="ec-hub-card"
            >
              {showFeatureAlert(game.id) && (
                <AlertExclamationBadge
                  size={18}
                  title="Còn lượt chơi"
                  ariaLabel={`${game.title}: còn lượt chơi`}
                />
              )}
              <span className="ec-hub-card__img-wrap">
                <img src={game.imgSrc} alt="" className="ec-hub-card__img" width={120} height={120} />
              </span>
              <span className="ec-hub-card__title">{game.title}</span>
              <span className="ec-hub-card__desc">{game.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default EntertainmentHub;
