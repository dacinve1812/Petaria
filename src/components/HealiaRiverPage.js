// HealiaRiverPage.js - Sông Healia (River of Health)
import React, { useState, useEffect } from 'react';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import '../styles/global.css';

function HealiaRiverPage() {
  const { user, isLoading } = useUser();
  const [status, setStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isHealing, setIsHealing] = useState(false);
  const [healResult, setHealResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // Format time for display
  const formatTime = (seconds) => {
    if (seconds <= 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${secs}s`;
    }
  };

  // Check Healia River status
  const checkStatus = async () => {
    if (!user?.token) return;

    try {
      setIsLoadingStatus(true);
      const response = await fetch(`${API_BASE_URL}/api/healia-river/status`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      const data = await response.json();
      setStatus(data);

      if (data.timeLeft > 0) {
        setTimeLeft(data.timeLeft);
      }
    } catch (error) {
      console.error('Error checking Healia River status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Use Healia River
  const useHealiaRiver = async () => {
    if (!user?.token || !status?.canUse) return;

    try {
      setIsHealing(true);
      const response = await fetch(`${API_BASE_URL}/api/healia-river/heal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setHealResult(data);
        // Refresh status after healing
        setTimeout(() => {
          checkStatus();
        }, 1000);
      } else {
        setHealResult({ error: data.error });
      }
    } catch (error) {
      console.error('Error using Healia River:', error);
      setHealResult({ error: 'Failed to use Healia River' });
    } finally {
      setIsHealing(false);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            checkStatus(); // Refresh status when timer ends
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  // Load status on mount
  useEffect(() => {
    if (user?.token && !isLoading) {
      checkStatus();
    }
  }, [user?.token, isLoading]);

  // Loading state
  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="healia-page-container">
          <div className="healia-loading">
            <div className="loading-spinner"></div>
            <p>Đang tải...</p>
          </div>
        </div>
      </TemplatePage>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="healia-page-container">
          <div className="healia-error">
            <h2>🔒 Cần đăng nhập</h2>
            <p>Bạn cần đăng nhập để sử dụng Sông Healia.</p>
          </div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>

        <div className="healia-page-card">
          {/* <div className="healia-page-header">
            <h2>Sông Healia</h2>
            <p className="healia-subtitle">Dòng sông thần thánh hồi phục sức khỏe</p>
          </div> */}

          <div>
            {/* Welcome Message */}
            <div className="healia-welcome">
              <div className="healia-welcome-text">
                <h3>Chào mừng đến với Sông Healia</h3>
                <p>
                  Bằng cách uống nước thần thánh từ dòng sông này, 
                  nó sẽ giúp hồi phục sức khỏe cho tất cả thú cưng của bạn. 
                  
                </p>
              </div>
            </div>

            {/* Status Section */}
            <div className="healia-status-section">
              {isLoadingStatus ? (
                <div className="healia-loading">
                  <div className="loading-spinner"></div>
                  <p>Đang kiểm tra trạng thái...</p>
                </div>
              ) : status ? (
                <div className="healia-status">
                  {status.canUse ? (
                    <div className="healia-status-available">
                      <div className="status-text">
                        <h4>Sẵn sàng sử dụng</h4>
                        <p>Bạn có thể uống nước từ sông ngay bây giờ để hồi phục sức khỏe cho thú cưng!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="healia-status-cooldown">
                     
                      <div className="status-text">
                        <h4>Đang trong thời gian chờ</h4>
                        <p>{status.message} <span className="timer-value">{formatTime(timeLeft)}</span> </p>
                      
                        {status.reason === 'battle' && (
                          <div className="battle-warning">
                            <span>⚠️ Bạn đang trong trận chiến</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Action Button - Only show when available */}
            {status?.canUse && (
              <div className="healia-action-section">
                <button
                  className={`healia-drink-btn ${isHealing ? 'disabled' : ''}`}
                  onClick={useHealiaRiver}
                  disabled={isHealing}
                >
                  {isHealing ? (
                    <>
                      <div className="loading-spinner"></div>
                      <span>Đang uống nước...</span>
                    </>
                  ) : (
                    <>
                      <span>Uống nước thần thánh!</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Heal Result */}
            {healResult && (
              <div className={`healia-result ${healResult.error ? 'error' : 'success'}`}>
                {healResult.error ? (
                  <div className="result-error">
                    <div className="result-icon">❌</div>
                    <div className="result-text">
                      <h4>Lỗi</h4>
                      <p>{healResult.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="result-success">
                    <div className="result-icon">✨</div>
                    <div className="result-text">
                    
                      <h4 className="result-message">{healResult.message}</h4>

                      {/* {healResult.nextAvailable && (
                        <div className="next-available">
                          <p>Lần sử dụng tiếp theo: {new Date(healResult.nextAvailable).toLocaleString('vi-VN')}</p>
                        </div>
                      )} */}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info Section */}
            {/* <div className="healia-info-section">
              <div className="info-card">
                <h4>Thông tin về Sông Healia</h4>
                <ul>
                  <li><strong>Cooldown:</strong> VIP: 15 phút, Normal: 30 phút</li>
                  <li><strong>Hiệu quả:</strong> 80% cơ hội hồi 85% maxHP, 20% cơ hội hồi phục hoàn toàn</li>
                  <li><strong>Phạm vi:</strong> Tất cả thú cưng của bạn</li>
                  <li><strong>Miễn phí:</strong> Không tốn bất kỳ tài nguyên nào</li>
                  <li><strong>Hạn chế:</strong> Không thể sử dụng khi đang chiến đấu</li>
                </ul>
              </div>
            </div> */}
          </div>
        </div>
   
    </TemplatePage>
  );
}

export default HealiaRiverPage;
