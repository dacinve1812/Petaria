// PveSelectPage.js - Trang chọn chế độ PvE
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import '../css/BattlePage.css';
import { useChapter0 } from '../story/Chapter0/Chapter0Context';

function PveSelectPage() {
  const { user, isLoading } = React.useContext(UserContext);
  const { story } = useChapter0();
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
          <div
            className="battle-mode-card"
            data-story-target={story?.guidance?.lock === 'arena-mode' ? 'arena-mode' : undefined}
            onClick={() => navigate('/battle/arena')}
          >
            <img src="/images/icons/arena.png" alt="Arena" />
            <h3>Arena</h3>
            <p>Đấu từng quái vật NPC</p>
          </div>

          <div className="battle-mode-card" onClick={() => navigate('/battle/champion')}>
            <img src="/images/icons/champion_icon.png" alt="Champion Challenge" />
            <h3>Champion Challenge</h3>
            <p>Thách Đấu Elite 3vs3 · Thách Đấu Champion 5vs5</p>
          </div>

          <div className="battle-mode-card" onClick={() => navigate('/battle/training')}>
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
