import React, { useState, useEffect } from 'react';
import './MailModal.css';
import MailDetailModal from './MailDetailModal';

const MailModal = ({ isOpen, onClose, userId, onCurrencyUpdate }) => {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('system');
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [selectedMail, setSelectedMail] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  // Fetch mails
  const fetchMails = async (filter = 'system') => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mails/${userId}?filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        // console.log('fetchMails Debug:', {
        //   filter,
        //   mailCount: data.length,
        //   mails: data.map(mail => ({
        //     id: mail.id,
        //     subject: mail.subject,
        //     is_read: mail.is_read,
        //     is_claimed: mail.is_claimed,
        //     attached_rewards: mail.attached_rewards
        //   }))
        // });
        setMails(data);
      } else {
        console.error('Failed to fetch mails:', response.status);
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
        
        // After claiming, mark all claimed mails as read
        const claimedMails = mails.filter(mail => {
          const rewards = parseRewards(mail.attached_rewards);
          const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
          return hasRewards && !mail.is_read;
        });
        
        // Mark each claimed mail as read
        for (const mail of claimedMails) {
          try {
            await fetch(`${API_BASE_URL}/api/mails/${mail.id}/read`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userId }),
            });
          } catch (error) {
            console.error(`Error marking mail ${mail.id} as read:`, error);
          }
        }
        
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
      
      // // Debug: Log mail status
      // console.log('Mail status:', mails.map(mail => {
      //   const rewards = parseRewards(mail.attached_rewards);
      //   const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
      //   return {
      //     id: mail.id,
      //     subject: mail.subject,
      //     is_read: mail.is_read,
      //     is_claimed: mail.is_claimed,
      //     hasRewards,
      //     canDelete: mail.is_read && (!hasRewards || mail.is_claimed)
      //   };
      // }));
      
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
    // console.log('parseRewards input:', rewardsJson, typeof rewardsJson);
    
    // If it's already an object, return it
    if (typeof rewardsJson === 'object' && rewardsJson !== null) {
      // console.log('parseRewards result (object):', rewardsJson);
      return rewardsJson;
    }
    
    // If it's a string, try to parse it
    if (typeof rewardsJson === 'string') {
      try {
        const result = JSON.parse(rewardsJson || '{}');
        // console.log('parseRewards result (parsed):', result);
        return result;
      } catch (error) {
        console.error('parseRewards error:', error);
        return {};
      }
    }
    
    // Default case
      // console.log('parseRewards result (default):', {});
    return {};
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
    { value: 'notification', label: 'Thông báo' },
    { value: 'system', label: 'Hệ thống' },
  ];

  // Handle filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    fetchMails(filter);
  };

  // Handle mail item click
  const handleMailClick = async (mail) => {
    // Parse rewards to check if mail has items
    const rewards = parseRewards(mail.attached_rewards);
    const hasItems = rewards.items && rewards.items.length > 0;
    const hasRewards = rewards.peta || rewards.peta_gold || hasItems;
    const isUnclaimed = hasRewards && !mail.is_claimed;
    
    // // Debug log
    // console.log('handleMailClick Debug:', {
    //   mailId: mail.id,
    //   subject: mail.subject,
    //   is_read: mail.is_read,
    //   attached_rewards: mail.attached_rewards,
    //   parsed_rewards: rewards,
    //   hasItems,
    //   hasRewards,
    //   isUnclaimed,
    //   shouldMarkAsRead: !mail.is_read && (!hasItems || !isUnclaimed)
    // });
    
    // Mark as read if:
    // 1. Mail chưa đọc VÀ không có items, HOẶC
    // 2. Mail chưa đọc VÀ có items nhưng đã claim
    if (!mail.is_read && (!hasItems || !isUnclaimed)) {
      try {
        // console.log('Marking mail as read...');
        const response = await fetch(`${API_BASE_URL}/api/mails/${mail.id}/read`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
        
        // console.log('API Response:', response.status, response.statusText);
        
        if (response.ok) {
          const result = await response.json();
          // console.log('API Result:', result);
          
          // Update local mail data
          mail.is_read = true;
          // console.log('Updated mail.is_read to true');
          
          // Refresh mails to update UI
          fetchMails(activeFilter);
        } else {
          console.error('API Error:', await response.text());
        }
      } catch (error) {
        console.error('Error marking mail as read:', error);
      }
    } else {
      //  console.log('Skipping mark as read - conditions not met');
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
  const handleDetailClaim = async () => {
    // Fetch updated mails first
    await fetchMails(activeFilter);
    
    // Update selectedMail with the updated mail data
    if (selectedMail) {
      const updatedMail = mails.find(mail => mail.id === selectedMail.id);
      if (updatedMail) {
        setSelectedMail(updatedMail);
      }
    }
    
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

  // Update selectedMail when mails change
  useEffect(() => {
    if (selectedMail && mails.length > 0) {
      const updatedMail = mails.find(mail => mail.id === selectedMail.id);
      if (updatedMail && updatedMail.is_claimed !== selectedMail.is_claimed) {
        setSelectedMail(updatedMail);
      }
    }
  }, [mails, selectedMail]);

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

          {/* Filter tabs with mail count */}
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
            <div className="mail-count-info">
              <span>Thư: {mails.length}/60</span>
              <div className="mail-count-icon">i</div>
            </div>
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
                const hasItems = rewards.items && rewards.items.length > 0;
                const isUnclaimed = hasRewards && !mail.is_claimed;
                
                // New logic for determining if mail should show as unread
                // Mail is unread if:
                // 1. It has items and they are unclaimed (ignore is_read), OR
                // 2. It has no items and is marked as unread
                const isUnread = hasItems ? !mail.is_claimed : !mail.is_read;
                
                // // Debug log
                // console.log('Mail Debug:', {
                //   id: mail.id,
                //   subject: mail.subject,
                //   is_read: mail.is_read,
                //   is_claimed: mail.is_claimed,
                //   hasItems,
                //   hasRewards,
                //   isUnclaimed,
                //   isUnread,
                //   rewards: rewards
                // });
                
                return (
                  <div 
                    key={mail.id} 
                    className={`mail-item ${isUnread ? 'mail-unread' : ''} ${isUnclaimed ? 'mail-unclaimed' : 'mail-claimed'}`}
                    onClick={() => handleMailClick(mail)}
                  >
                    <div className="mail-content">
                      <div className="mail-icon-container">
                        <img 
                          src={isUnread ? '/images/icons/unread-mail.png' : '/images/icons/read-mail.png'}
                          alt="Mail"
                          className="mail-envelope"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                          }}
                        />
                        {/* {isUnclaimed && (
                          <div className="mail-notification">!</div>
                        )} */}
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
              Xóa đã đọc
            </button>
            <button 
              className="mail-action-btn claim-all-btn"
              onClick={claimAllMails}
              disabled={unclaimedCount === 0}
            >
              Tất cả nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MailModal;