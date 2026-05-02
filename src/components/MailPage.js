import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import MailDetailModal from './MailDetailModal';
import { dispatchCurrencyUpdate } from '../utils/currencyEvents';
import { dispatchMailInboxViewed, dispatchMailUnreadRefresh } from '../utils/mailEvents';
import { mailHasClaimableRewards, normalizeSqlBool } from '../utils/mailRewardUtils';

const MailPage = () => {
  const { user, isLoading } = React.useContext(UserContext);
  const navigate = useNavigate();
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [selectedMail, setSelectedMail] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  // Authentication check
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user, isLoading]);

  // Fetch mails
  const fetchMails = async (filter = 'system') => {
    if (!user?.userId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mails/${user.userId}?filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
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
    if (!user?.userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/mails/${user.userId}/unread-count`);
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
    if (!user?.userId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/mails/claim-all/${user.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        alert(`Nhận thành công! ${result.message}`);
        
        // After claiming, mark all claimed mails as read
        const claimedMails = mails.filter((mail) => {
          const rewards = parseRewards(mail.attached_rewards);
          return mailHasClaimableRewards(rewards) && !mail.is_read;
        });
        
        // Mark each claimed mail as read
        for (const mail of claimedMails) {
          try {
            await fetch(`${API_BASE_URL}/api/mails/${mail.id}/read`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userId: user.userId }),
            });
          } catch (error) {
            console.error(`Error marking mail ${mail.id} as read:`, error);
          }
        }
        
        // Refresh mails
        fetchMails('all');
        fetchUnclaimedCount();
        dispatchCurrencyUpdate();
        dispatchMailUnreadRefresh();
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
    if (!user?.userId) return;
    if (!window.confirm('Bạn có chắc muốn xóa tất cả mail đã đọc và đã nhận quà?')) return;
    
    try {
      const deletableMails = mails.filter(mail => {
        if (!mail.is_read) return false;
        
        const rewards = parseRewards(mail.attached_rewards);
        const hasRewards = mailHasClaimableRewards(rewards);

        if (!hasRewards) return true;
        return normalizeSqlBool(mail.is_claimed);
      });
      
      if (deletableMails.length === 0) {
        alert('Không có mail nào để xóa! (Chỉ xóa mail đã đọc và đã nhận hết quà)');
        return;
      }

      for (const mail of deletableMails) {
        const response = await fetch(`${API_BASE_URL}/api/mails/${mail.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.userId }),
        });
        
        if (!response.ok) {
          console.error(`Failed to delete mail ${mail.id}:`, await response.text());
        }
      }

      alert(`Đã xóa ${deletableMails.length} mail!`);
      fetchMails('all');
      fetchUnclaimedCount();
      dispatchMailUnreadRefresh();
    } catch (error) {
      console.error('Lỗi khi xóa mail:', error);
      alert('Lỗi khi xóa mail');
    }
  };

  // Parse rewards
  const parseRewards = (rewardsJson) => {
    if (typeof rewardsJson === 'object' && rewardsJson !== null) {
      return rewardsJson;
    }
    
    if (typeof rewardsJson === 'string') {
      try {
        return JSON.parse(rewardsJson || '{}');
      } catch (error) {
        console.error('parseRewards error:', error);
        return {};
      }
    }
    
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


  // Handle mail item click
  const handleMailClick = async (mail) => {
    if (!user?.userId) return;
    
    const rewards = parseRewards(mail.attached_rewards);
    const hasRewards = mailHasClaimableRewards(rewards);

    if (!mail.is_read && (!hasRewards || normalizeSqlBool(mail.is_claimed))) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/mails/${mail.id}/read`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.userId }),
        });
        
        if (response.ok) {
          mail.is_read = true;
          fetchMails('all');
          dispatchMailUnreadRefresh();
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
  const handleDetailClaim = async () => {
    await fetchMails('all');
    
    if (selectedMail) {
      const updatedMail = mails.find(mail => mail.id === selectedMail.id);
      if (updatedMail) {
        setSelectedMail(updatedMail);
      }
    }
    
    fetchUnclaimedCount();
    dispatchCurrencyUpdate();
    dispatchMailUnreadRefresh();
  };

  // Load data when component mounts
  useEffect(() => {
    if (user?.userId) {
      dispatchMailInboxViewed();
      fetchMails('all'); // Load all mails
      fetchUnclaimedCount();
    }
  }, [user?.userId]);

  // Update selectedMail when mails change
  useEffect(() => {
    if (selectedMail && mails.length > 0) {
      const updatedMail = mails.find(mail => mail.id === selectedMail.id);
      if (updatedMail && normalizeSqlBool(updatedMail.is_claimed) !== normalizeSqlBool(selectedMail.is_claimed)) {
        setSelectedMail(updatedMail);
      }
    }
  }, [mails, selectedMail]);

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="mail-page-container">
          <div className="loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="mail-page-container">
          <div className="error">Vui lòng đăng nhập</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <>
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="mail-page-container">
          <div className="mail-page-wrapper">
            <div className="mail-page-card">
              <div className="mail-page-header">
                <h2>Hòm thư</h2>
                <div className="mail-page-count">
                  Tổng: {mails.length} thư
                </div>
              </div>

              {/* Action buttons */}
              <div className="mail-page-actions">
                <button
                  type="button"
                  className="mail-page-action-btn mail-page-compose"
                  onClick={() => navigate('/mail/compose')}
                >
                  Gửi thư
                </button>
                <button
                  type="button"
                  className="mail-page-action-btn mail-page-claim-all"
                  onClick={claimAllMails}
                  disabled={unclaimedCount === 0}
                >
                  Nhận tất cả ({unclaimedCount})
                </button>
                <button
                  type="button"
                  className="mail-page-action-btn mail-page-delete-all"
                  onClick={deleteAllReadMails}
                >
                  Xóa mail đã đọc
                </button>
              </div>

              {/* Mail list */}
              <div className="mail-page-content">
                {loading ? (
                  <div className="mail-page-loading">Đang tải thư...</div>
                ) : mails.length === 0 ? (
                  <div className="mail-page-empty">Không có thư nào</div>
                ) : (
                  <div className="mail-page-list">
                    {mails.map((mail) => {
                      const rewards = parseRewards(mail.attached_rewards);
                      const hasRewards = mailHasClaimableRewards(rewards);
                      const isUnclaimed = hasRewards && !normalizeSqlBool(mail.is_claimed);

                      return (
                        <div
                          key={mail.id}
                          className={`mail-page-item ${!mail.is_read ? 'unread' : ''} ${isUnclaimed ? 'unclaimed' : ''}`}
                          onClick={() => handleMailClick(mail)}
                        >
                          <div className="mail-page-item-header">
                            <span className="mail-page-subject">{mail.subject}</span>
                            <span className="mail-page-date">{formatDate(mail.created_at)}</span>
                          </div>
                          <div className="mail-page-item-body">
                            {mail.message}
                          </div>
                          <div className="mail-page-item-footer">
                            <span className="mail-page-sender-name" title={mail.sender_name || 'Hệ thống'}>
                              {mail.sender_name || 'Hệ thống'}
                            </span>
                            {isUnclaimed && (
                              <div className="mail-page-unclaimed-badge">Chưa nhận</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </TemplatePage>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedMail && (
        <MailDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleDetailModalClose}
          mail={selectedMail}
          onClaim={handleDetailClaim}
          userId={user.userId}
        />
      )}
    </>
  );
};

export default MailPage;

