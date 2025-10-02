// PveSelectPage.js - Trang chọn chế độ PvE
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import '../css/BattlePage.css';

function PveSelectPage() {
  const { user, isLoading } = React.useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return; // Wait for user context to load
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user, isLoading]);

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="battle-page-container">
          <div className="loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="battle-page-container">
          <div className="error">Vui lòng đăng nhập</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="battle-page-container">
        <div className="battle-header">
          {/* <h2>Solo (PvE) - Chọn chế độ</h2> */}
        </div>
        <div className="battle-mode-grid">
          <div className="battle-mode-card" onClick={() => navigate('/battle/arena')}>
            <img src="/images/icons/arena.png" alt="Arena" />
            <h3>Arena</h3>
            <p>Đấu từng quái vật NPC</p>
          </div>
          <div className="battle-mode-card" onClick={() => alert('Champion - Coming soon')}>
            <img src="/images/icons/champion_icon.png" alt="Champion" />
            <h3>Champion Challenge</h3>
            <p>Đánh theo tổ đội (3v3, 2v2...)</p>
          </div>
          <div className="battle-mode-card" onClick={() => alert('Training Camp - Coming soon')}>
            <img src="/images/icons/training_icon.png" alt="Training" />
            <h3>Training Camp</h3>
            <p>Gửi pet nhận EXP theo thời gian</p>
          </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default PveSelectPage;
