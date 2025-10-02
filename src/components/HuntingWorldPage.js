import React from 'react';
import { Link } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import './HuntingWorldPage.css';

function HuntingWorldPage() {
  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="hunting-world-container">
        <div className="hunting-world-header">
          <h2>🌿 Thế Giới Săn Bắt</h2>
          <p>Khám phá và săn bắt các loài thú cưng hoang dã</p>
        </div>
        
        <div className="hunting-world-content">
          <div className="hunting-grid">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Link key={idx} to={`/hunting-world/map/${idx + 1}`} className="hunting-card">
                <div className="card-thumb">
                  <img src={idx === 0 ? '/hunting/maps/forest-map.png' : '/images/icons/background.png'} alt={`Map ${idx + 1}`} />
                </div>
                <div className="card-body">
                  <div className="card-title">Map {idx + 1}</div>
                  <div className="card-desc">Khám phá khu vực {idx + 1}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default HuntingWorldPage; 