import React, { useState, useEffect } from 'react';
import './MailDetailModal.css';

const MailDetailModal = ({ isOpen, onClose, mail, onClaim, userId }) => {
  const [claiming, setClaiming] = useState(false);
  const [itemDetails, setItemDetails] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);

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

  const rewards = parseRewards(mail?.attached_rewards);
  const hasRewards = rewards.peta || rewards.peta_gold || (rewards.items && rewards.items.length > 0);
  const isUnclaimed = hasRewards && !mail?.is_claimed;
  
  // Update local claimed state when mail changes
  useEffect(() => {
    if (mail) {
      setIsClaimed(mail.is_claimed === true);
    }
  }, [mail]);

  // Fetch item details for items in rewards
  useEffect(() => {
    const fetchItemDetails = async () => {
      if (rewards.items && rewards.items.length > 0) {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const itemIds = rewards.items.map(item => item.item_id);
        
        try {
          const response = await fetch(`${API_BASE_URL}/api/admin/items`);
          if (response.ok) {
            const allItems = await response.json();
            const itemsMap = {};
            allItems.forEach(item => {
              itemsMap[item.id] = item;
            });
            setItemDetails(itemsMap);
          }
        } catch (error) {
          console.error('Error fetching item details:', error);
        }
      }
    };

    fetchItemDetails();
  }, [rewards.items]);

  if (!isOpen || !mail) return null;

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

  // Handle claim rewards
  const handleClaim = async () => {
    if (!mail || claiming) return;
    
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
        
        // Update the mail object to reflect claimed status
        mail.is_claimed = true;
        
        // Mark mail as read after claiming
        try {
          const readResponse = await fetch(`${API_BASE_URL}/api/mails/${mail.id}/read`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });
          
          if (readResponse.ok) {
            mail.is_read = true;
          }
        } catch (error) {
          console.error('Error marking mail as read:', error);
        }
        
        // Refresh parent component
        onClaim();
      } else {
        const errorData = await response.json();
        alert(`Lỗi: ${errorData.error || 'Không thể nhận phần thưởng'}`);
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      alert('Lỗi kết nối khi nhận phần thưởng');
    } finally {
      setClaiming(false);
    }
  };

  // Handle item click
  const handleItemClick = (item, itemDetail) => {
    setSelectedItem({ ...item, detail: itemDetail });
    setShowItemModal(true);
  };

  // Handle item modal close
  const handleItemModalClose = () => {
    setShowItemModal(false);
    setSelectedItem(null);
  };

  // // Debug info
  // console.log('MailDetailModal Debug:', {
  //   mailId: mail.id,
  //   subject: mail.subject,
  //   attached_rewards: mail.attached_rewards,
  //   parsed_rewards: rewards,
  //   hasRewards,
  //   isUnclaimed,
  //   is_claimed: mail.is_claimed,
  //   is_claimed_type: typeof mail.is_claimed,
  //   is_claimed_value: mail.is_claimed,
  //   isClaimed_local: isClaimed,
  //   claiming: claiming
  // });

  return (
    <>
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

            {/* Rewards Section - New Design */}
            {hasRewards && (
              <div className="mail-detail-rewards">
                <div className="rewards-label">
                  Phần thưởng
                </div>
                <div className="rewards-container">
                  {/* Currency Rewards */}
                  <div className="rewards-scroll">
                    {rewards.peta && (
                      <div className="reward-item-small">
                        <div className="reward-icon-container">
                          <img 
                            src="/images/icons/peta.png" 
                            alt="Peta" 
                            className="reward-icon-small"
                          />
                          <div className="reward-quantity-badge">
                            +{rewards.peta}
                          </div>
                        </div>
                      </div>
                    )}
                    {rewards.peta_gold && (
                      <div className="reward-item-small">
                        <div className="reward-icon-container">
                          <img 
                            src="/images/icons/petagold.png" 
                            alt="Peta Gold" 
                            className="reward-icon-small"
                          />
                          <div className="reward-quantity-badge">
                            +{rewards.peta_gold}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Item Rewards */}
                    {rewards.items && rewards.items.map((item, index) => {
                      const itemDetail = itemDetails[item.item_id];
                      return (
                        <div 
                          key={index} 
                          className="reward-item-small clickable"
                          onClick={() => handleItemClick(item, itemDetail)}
                        >
                          <div className="reward-icon-container">
                            <img 
                              src={`/images/equipments/${itemDetail?.image_url || 'default-item.png'}`}
                              alt={itemDetail?.name || `Item ${item.item_id}`}
                              className="reward-icon-small"
                            />
                            <div className="reward-quantity-badge">
                              x{item.quantity}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mail-detail-actions">
            <button className="mail-detail-btn close-btn" onClick={onClose}>
              Đóng
            </button>
            {hasRewards && !mail?.is_claimed && (
              <button 
                className="mail-detail-btn claim-btn"
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming ? 'Đang nhận...' : 'Nhận phần thưởng'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Item Detail Modal */}
      {showItemModal && selectedItem && (
        <div className="item-detail-modal-overlay" onClick={handleItemModalClose}>
          <div className="item-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="item-detail-header">
              <h3>Chi tiết vật phẩm</h3>
              <button className="item-detail-close" onClick={handleItemModalClose}>×</button>
            </div>
            <div className="item-detail-content">
              <div className="item-detail-icon">
                <img 
                  src={`/images/equipments/${selectedItem.detail?.image_url || 'default-item.png'}`}
                  alt={selectedItem.detail?.name || `Item ${selectedItem.item_id}`}
                  className="item-detail-image"
                />
                <div className="item-detail-quantity">
                  x{selectedItem.quantity}
                </div>
              </div>
              <div className="item-detail-info">
                <div className="item-detail-name">
                  {selectedItem.detail?.name || `Item #${selectedItem.item_id}`}
                </div>
                <div className="item-detail-description">
                  {selectedItem.detail?.description || 'Không có mô tả'}
                </div>
                <div className="item-detail-type">
                  Loại: {selectedItem.detail?.type || 'Không xác định'}
                </div>
                <div className="item-detail-rarity">
                  Độ hiếm: {selectedItem.detail?.rarity || 'Không xác định'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MailDetailModal; 