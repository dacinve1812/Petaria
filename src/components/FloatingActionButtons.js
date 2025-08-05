import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FloatingActionButtons.css';

function FloatingActionButtons({ userId, onOpenMail }) {
  const navigate = useNavigate();
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  // Fetch unclaimed mail count
  useEffect(() => {
    if (!userId) return;
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const fetchUnclaimedCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/mails/${userId}/unread-count`);
        if (response.ok) {
          const data = await response.json();
          setUnclaimedCount(data.unclaimed_count);
        }
      } catch (error) {
        // ignore
      }
    };
    fetchUnclaimedCount();
    const interval = setInterval(fetchUnclaimedCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleArenaClick = () => {
    navigate('/battle/pve');
  };

  const handleHuntingClick = () => {
    navigate('/hunting-world');
  };

  const handleMailClick = () => {
    if (onOpenMail) onOpenMail();
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

      <div className="fab-button mail-fab-button" onClick={handleMailClick}>
        <div className="fab-icon mail-icon">
        <img src="/images/icons/mail.png" alt="Mail" />
          {unclaimedCount > 0 && (
            <span className="fab-mail-notification-dot">
              {unclaimedCount > 99 ? '99+' : unclaimedCount}
            </span>
          )}
        </div>
        <span className="fab-label">Mail</span>
      </div>
    </div>
  );
}

export default FloatingActionButtons; 