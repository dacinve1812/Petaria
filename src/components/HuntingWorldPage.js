import React from 'react';
import Navbar from './Navbar';
import './HuntingWorldPage.css';

function HuntingWorldPage() {
  return (
    <div className="hunting-world-container">
      <header>
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>
      <div className="content">
        <div className="main-content">
          <Navbar />
          <div className="hunting-world-header">
            <h2>🌿 Thế Giới Săn Bắt</h2>
            <p>Khám phá và săn bắt các loài thú cưng hoang dã</p>
          </div>
          
          <div className="hunting-world-content">
            <div className="coming-soon-card">
              <div className="coming-soon-icon">🏹</div>
              <h3>Tính năng đang phát triển</h3>
              <p>Thế giới săn bắt sẽ sớm được ra mắt với nhiều tính năng thú vị:</p>
              <ul>
                <li>🔍 Khám phá các vùng đất mới</li>
                <li>🎯 Săn bắt thú cưng hoang dã</li>
                <li>📦 Thu thập tài nguyên quý hiếm</li>
                <li>🏆 Thành tích săn bắt</li>
                <li>🎮 Mini-game săn bắt</li>
              </ul>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '25%' }}></div>
              </div>
              <p className="progress-text">Tiến độ phát triển: 25%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HuntingWorldPage; 