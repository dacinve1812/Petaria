import React, { useState, useEffect } from 'react';
import './MailModal.css';
import MailDetailModal from './MailDetailModal';

const MailModal = ({ isOpen, onClose, userId, onCurrencyUpdate }) => {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [selectedMail, setSelectedMail] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  // Fetch mails
  const fetchMails = async (filter = 'all') => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mails/${userId}?filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setMails(data);
      } else {
        console.error('Failed to fetch mails');
      }
    } catch (error) {
      console.error('Error fetching mails:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unclaimed count
  const fetchUnclaimedCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mails/${userId}/unread-count`);
      if (response.ok) {
        const data = await response.json();
        setUnclaimedCount(data.unclaimed_count);
      }
    } catch (error) {
      console.error('Error fetching unclaimed count:', error);
    }
  };

  // Claim all mails
  const claimAllMails = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mails/claim-all/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        alert(`Nhận thành công! ${result.message}`);
        // Refresh mails
        fetchMails(activeFilter);
        fetchUnclaimedCount();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.error}`);
      }
    } catch (error) {
      console.error('Lỗi khi nhận tất cả mail:', error);
      alert('Lỗi khi nhận tất cả mail');
    }
  };

  // Delete all read and claimed mails
  const deleteAllReadMails = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa tất cả mail đã đọc và đã nhận quà?')) return;
    
    try {
      // Get mails that can be deleted:
      // - Mail đã đọc VÀ (không có rewards HOẶC đã claim hết rewards)
      const deletableMails = mails.filter(mail => {
        if (!mail.is_read) return false; // Chưa đọc thì không xóa
        
        const rewards = parseRewards(mail.attached_rewards);
        const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
        
        if (!hasRewards) return true; // Không có rewards thì xóa được
        return mail.is_claimed; // Có rewards thì phải claim hết mới xóa được
      });
      
              // Debug: Log mail status
        console.log('Mail status:', mails.map(mail => {
          const rewards = parseRewards(mail.attached_rewards);
          const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
          return {
            id: mail.id,
            subject: mail.subject,
            is_read: mail.is_read,
            is_claimed: mail.is_claimed,
            hasRewards,
            canDelete: mail.is_read && (!hasRewards || mail.is_claimed)
          };
        }));
      
      if (deletableMails.length === 0) {
        alert('Không có mail nào để xóa! (Chỉ xóa mail đã đọc và đã nhận hết quà)');
        return;
      }

      // Delete each mail
      for (const mail of deletableMails) {
        const response = await fetch(`${API_BASE_URL}/api/mails/${mail.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
        
        if (!response.ok) {
          console.error(`Failed to delete mail ${mail.id}:`, await response.text());
        }
      }

      alert(`Đã xóa ${deletableMails.length} mail!`);
      // Refresh mails
      fetchMails(activeFilter);
      fetchUnclaimedCount();
    } catch (error) {
      console.error('Lỗi khi xóa mail:', error);
      alert('Lỗi khi xóa mail');
    }
  };

  // Parse rewards
  const parseRewards = (rewardsJson) => {
    try {
      return JSON.parse(rewardsJson || '{}');
    } catch {
      return {};
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Vừa xong';
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    if (diffInDays < 7) return `${diffInDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  // Get filter options
  const getFilterOptions = () => [
    { value: 'all', label: 'Tất cả' },
    { value: 'system', label: 'Hệ thống' },
  ];

  // Handle filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    fetchMails(filter);
  };

  // Handle mail item click
  const handleMailClick = async (mail) => {
    // Mark mail as read when opening detail
    if (!mail.is_read) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/mails/${mail.id}/read`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
        
        if (response.ok) {
          // Update local mail data
          mail.is_read = true;
          // Refresh mails to update UI
          fetchMails(activeFilter);
        }
      } catch (error) {
        console.error('Error marking mail as read:', error);
      }
    }
    
    setSelectedMail(mail);
    setIsDetailModalOpen(true);
  };

  // Handle detail modal close
  const handleDetailModalClose = () => {
    setIsDetailModalOpen(false);
    setSelectedMail(null);
  };

  // Handle claim from detail modal
  const handleDetailClaim = () => {
    fetchMails(activeFilter);
    fetchUnclaimedCount();
    if (onCurrencyUpdate) {
      onCurrencyUpdate();
    }
  };

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchMails(activeFilter);
      fetchUnclaimedCount();
    }
  }, [isOpen, userId, activeFilter]);

  if (!isOpen) return null;

  // Nếu detail modal đang mở, chỉ hiển thị detail modal
  if (isDetailModalOpen) {
    return (
      <MailDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleDetailModalClose}
        mail={selectedMail}
        onClaim={handleDetailClaim}
        userId={userId}
      />
    );
  }

  // Nếu không, hiển thị mail modal chính
  return (
    <div className="mail-display">
      <div className="mail-modal-overlay">
        <div className="mail-modal">
          <div className="mail-modal-header">
            <h2>Thư</h2>
            <button className="mail-modal-close" onClick={onClose}>×</button>
          </div>

          {/* Filter tabs */}
          <div className="mail-filter-tabs">
            {getFilterOptions().map(filter => (
              <button
                key={filter.value}
                className={`mail-filter-tab ${activeFilter === filter.value ? 'active' : ''}`}
                onClick={() => handleFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Mail list */}
          <div className="mail-list">
            {loading ? (
              <div className="mail-loading">Đang tải...</div>
            ) : mails.length === 0 ? (
              <div className="mail-empty">Không có mail nào</div>
            ) : (
              mails.map(mail => {
                const rewards = parseRewards(mail.attached_rewards);
                const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
                const isUnread = !mail.is_read;
                const isUnclaimed = hasRewards && !mail.is_claimed;
                
                return (
                  <div 
                    key={mail.id} 
                    className={`mail-item ${isUnread ? 'mail-unread' : ''} ${isUnclaimed ? 'mail-unclaimed' : 'mail-claimed'}`}
                    onClick={() => handleMailClick(mail)}
                  >
                    <div className="mail-content">
                      <div className="mail-icon-container">
                        <div className="mail-envelope">
                          📬
                          {isUnclaimed && (
                            <div className="mail-notification">!</div>
                          )}
                        </div>
                      </div>
                      <div className="mail-text-content">
                        <div className="mail-subject">{mail.subject}</div>
                        <div className="mail-sender">
                          {mail.sender_name}
                          <span className="mail-date">{formatDate(mail.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Action buttons */}
          <div className="mail-action-buttons">
            <button 
              className="mail-action-btn delete-all-btn"
              onClick={deleteAllReadMails}
            >
              ⭐ Xóa nhanh
            </button>
            <button 
              className="mail-action-btn claim-all-btn"
              onClick={claimAllMails}
              disabled={unclaimedCount === 0}
            >
              ⭐ Nhận nhanh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MailModal; 