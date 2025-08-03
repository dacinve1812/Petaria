import React, { useState } from 'react';
import './MailDetailModal.css';

const MailDetailModal = ({ isOpen, onClose, mail, onClaim, userId }) => {
  const [claiming, setClaiming] = useState(false);

  if (!isOpen || !mail) return null;

  // Parse rewards
  const parseRewards = (rewardsJson) => {
    try {
      if (!rewardsJson) return {};
      
      // Handle case where rewardsJson is already an object
      if (typeof rewardsJson === 'object') {
        return rewardsJson;
      }
      
      // Handle case where rewardsJson is a string
      if (typeof rewardsJson === 'string') {
        return JSON.parse(rewardsJson);
      }
      
      return {};
    } catch (error) {
      console.error('Error parsing rewards:', error);
      return {};
    }
  };

  const rewards = parseRewards(mail.attached_rewards);
  const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
  const isUnclaimed = hasRewards && !mail.is_claimed;
  
  // Debug info
  console.log('MailDetailModal Debug:', {
    mailId: mail.id,
    subject: mail.subject,
    attached_rewards: mail.attached_rewards,
    parsed_rewards: rewards,
    hasRewards,
    isUnclaimed,
    is_claimed: mail.is_claimed
  });

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle claim
  const handleClaim = async () => {
    if (!isUnclaimed || claiming) return;
    
    setClaiming(true);
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/mails/claim/${mail.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Đã nhận phần thưởng thành công! ${result.message}`);
        onClaim(); // Refresh parent component
        onClose();
      } else {
        const error = await response.json();
        alert(`Lỗi khi nhận phần thưởng: ${error.error}`);
      }
    } catch (error) {
      console.error('Lỗi khi claim:', error);
      alert('Lỗi khi nhận phần thưởng');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mail-detail-modal-overlay">
      <div className="mail-detail-modal">
        <div className="mail-detail-header">
          <h2>Chi tiết thư</h2>
          <button className="mail-detail-close" onClick={onClose}>×</button>
        </div>

        <div className="mail-detail-content">
          {/* Mail Info */}
          <div className="mail-detail-info">
            <div className="mail-detail-subject">{mail.subject}</div>
            <div className="mail-detail-sender">
              <span className="sender-label">Từ:</span>
              <span className="sender-name">{mail.sender_name}</span>
            </div>
            <div className="mail-detail-date">
              <span className="date-label">Ngày:</span>
              <span className="date-value">{formatDate(mail.created_at)}</span>
            </div>
          </div>

          {/* Mail Message */}
          <div className="mail-detail-message">
            <div className="message-label">Nội dung:</div>
            <div className="message-content">{mail.message}</div>
          </div>

          {/* Rewards Section */}
          <div className="mail-detail-rewards">
            <div className="rewards-label">
              Phần thưởng: {hasRewards ? 'Có' : 'Không có'}
            </div>
            {hasRewards ? (
              <div className="rewards-list">
                {rewards.peta && (
                  <div className="reward-item">
                    <span className="reward-icon">💰</span>
                    <span className="reward-name">Peta</span>
                    <span className="reward-amount">+{rewards.peta}</span>
                  </div>
                )}
                {rewards.peta_gold && (
                  <div className="reward-item">
                    <span className="reward-icon">💎</span>
                    <span className="reward-name">Peta Gold</span>
                    <span className="reward-amount">+{rewards.peta_gold}</span>
                  </div>
                )}
                {rewards.items && rewards.items.map((item, index) => (
                  <div key={index} className="reward-item">
                    <span className="reward-icon">📦</span>
                    <span className="reward-name">Item #{item.item_id}</span>
                    <span className="reward-amount">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-rewards">
                <span>Không có phần thưởng đính kèm</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="mail-detail-status">
            <div className="status-item">
              <span className="status-label">Đã đọc:</span>
              <span className={`status-value ${mail.is_read ? 'read' : 'unread'}`}>
                {mail.is_read ? '✓' : '✗'}
              </span>
            </div>
            {hasRewards && (
              <div className="status-item">
                <span className="status-label">Đã nhận:</span>
                <span className={`status-value ${mail.is_claimed ? 'claimed' : 'unclaimed'}`}>
                  {mail.is_claimed ? '✓' : '✗'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mail-detail-actions">
          <button className="mail-detail-btn close-btn" onClick={onClose}>
            Đóng
          </button>
          {hasRewards && !mail.is_claimed && (
            <button 
              className="mail-detail-btn claim-btn"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? 'Đang nhận...' : 'Nhận phần thưởng'}
            </button>
          )}
          {hasRewards && mail.is_claimed && (
            <div className="claimed-notice">
              ✅ Đã nhận phần thưởng
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MailDetailModal; 