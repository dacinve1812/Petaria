import React from 'react';
import { useNavigate } from 'react-router-dom';
import './FloatingActionButtons.css';

function FloatingActionButtons() {
  const navigate = useNavigate();

  const handleArenaClick = () => {
    navigate('/battle/pve');
  };

  const handleHuntingClick = () => {
    navigate('/hunting-world');
  };

  return (
    <div className="floating-action-buttons">
      <div className="fab-button hunting-button" onClick={handleHuntingClick}>
        <div className="fab-icon">
          <img src="/images/icons/hunting.gif" alt="Hunting" />
        </div>
        <span className="fab-label">Đi săn</span>
      </div>
      
      <div className="fab-button arena-button" onClick={handleArenaClick}>
        <div className="fab-icon">
          <img src="/images/icons/arena.png" alt="Arena" />
        </div>
        <span className="fab-label">Arena</span>
      </div>
    </div>
  );
}

export default FloatingActionButtons; 