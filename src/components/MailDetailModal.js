import React, { useState, useEffect, useMemo } from 'react';
import './MailDetailModal.css';
import { dispatchCurrencyUpdate } from '../utils/currencyEvents';
import { mailHasClaimableRewards, mailIsRewardsClaimed } from '../utils/mailRewardUtils';

const PLACEHOLDER_ITEM = '/images/icons/bag.svg';
/** File placeholder.png không có trong repo — dùng SVG có sẵn để tránh icon vỡ. */
const PLACEHOLDER_PET = '/images/icons/bag.svg';
const PLACEHOLDER_SPIRIT = '/images/icons/bag.svg';

function getItemImageSrc(url) {
  if (!url) return PLACEHOLDER_ITEM;
  const s = String(url);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/equipments/${s}`;
}

function petPreviewSrc(row) {
  if (!row?.species_image) return PLACEHOLDER_PET;
  const s = String(row.species_image);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/pets/${s}`;
}

function spiritPreviewSrc(row) {
  if (!row?.spirit_image) return PLACEHOLDER_SPIRIT;
  const s = String(row.spirit_image);
  if (s.startsWith('http') || s.startsWith('/')) return s;
  return `/images/spirit/${s}`;
}

const MailDetailModal = ({ isOpen, onClose, mail, onClaim, userId }) => {
  const [claiming, setClaiming] = useState(false);
  const [itemDetails, setItemDetails] = useState({});
  const [auctionPreviews, setAuctionPreviews] = useState({ pets: {}, spirits: {} });
  const [selectedItem, setSelectedItem] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  const parseRewards = (rewardsJson) => {
    try {
      if (!rewardsJson) return {};
      if (typeof rewardsJson === 'object') return rewardsJson;
      if (typeof rewardsJson === 'string') return JSON.parse(rewardsJson);
      return {};
    } catch (error) {
      console.error('Error parsing rewards:', error);
      return {};
    }
  };

  const rewards = parseRewards(mail?.attached_rewards);
  const rewardsClaimed = mailIsRewardsClaimed(mail);
  const hasRewards = mailHasClaimableRewards(rewards);

  const itemsFetchKey = useMemo(() => {
    if (!rewards.items?.length) return '';
    return [...new Set(rewards.items.map((i) => i.item_id).filter(Boolean))].sort((a, b) => a - b).join(',');
  }, [rewards.items]);

  const mailAssetPreviewKey = useMemo(() => {
    if (!isOpen || !mail?.id || !userId) return '';
    const r = parseRewards(mail?.attached_rewards);
    const ap = [...(r.auction_transfer_pet_ids || [])].map((x) => String(x)).sort().join(',');
    const gp = [...(r.pets || [])]
      .map((x) => String(x.pet_id ?? ''))
      .filter(Boolean)
      .sort()
      .join(',');
    const as = [...(r.auction_transfer_spirit_ids || [])].map((x) => String(x)).sort().join(',');
    const gs = [...(r.spirits || [])]
      .map((x) => String(x.user_spirit_id ?? ''))
      .filter(Boolean)
      .sort()
      .join(',');
    if (!ap && !gp && !as && !gs) return '';
    return `${mail.id}|ap:${ap}|gp:${gp}|as:${as}|gs:${gs}`;
  }, [isOpen, mail?.id, mail?.attached_rewards, userId]);

  useEffect(() => {
    if (!mailAssetPreviewKey || !mail?.id || !userId) {
      setAuctionPreviews({ pets: {}, spirits: {} });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/mails/${mail.id}/preview-assets?userId=${encodeURIComponent(String(userId))}`
        );
        if (!r.ok || cancelled) return;
        const data = await r.json();
        if (cancelled) return;
        const pets = {};
        (data.pets || []).forEach((p) => {
          pets[p.id] = p;
        });
        const spirits = {};
        (data.spirits || []).forEach((s) => {
          spirits[s.user_spirit_id] = s;
        });
        setAuctionPreviews({ pets, spirits });
      } catch (e) {
        if (!cancelled) {
          console.error('Mail auction preview assets:', e);
          setAuctionPreviews({ pets: {}, spirits: {} });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, mailAssetPreviewKey, mail?.id, userId]);

  useEffect(() => {
    const fetchItemDetails = async () => {
      if (!itemsFetchKey) {
        setItemDetails({});
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/items/by-ids?ids=${encodeURIComponent(itemsFetchKey)}`);
        if (!response.ok) {
          setItemDetails({});
          return;
        }
        const allItems = await response.json();
        const itemsMap = {};
        (Array.isArray(allItems) ? allItems : []).forEach((item) => {
          itemsMap[item.id] = item;
        });
        setItemDetails(itemsMap);
      } catch (error) {
        console.error('Error fetching item details:', error);
        setItemDetails({});
      }
    };

    fetchItemDetails();
  }, [API_BASE_URL, itemsFetchKey]);

  if (!isOpen || !mail) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClaim = async () => {
    if (!mail || claiming) return;

    setClaiming(true);
    try {
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

        mail.is_claimed = true;

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

        dispatchCurrencyUpdate();

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

  const handleItemClick = (item, itemDetail) => {
    setSelectedItem({ ...item, detail: itemDetail });
    setShowItemModal(true);
  };

  const handleItemModalClose = () => {
    setShowItemModal(false);
    setSelectedItem(null);
  };

  return (
    <>
      <div className="mail-detail-modal-overlay">
        <div className="mail-detail-modal">
          <div className="mail-detail-header">
            <h2>Chi tiết thư</h2>
            <button type="button" className="mail-detail-close" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="mail-detail-content">
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

            <div className="mail-detail-message">
              <div className="message-label">Nội dung:</div>
              <div className="message-content">{mail.message}</div>
            </div>

            {hasRewards && (
              <div className={`mail-detail-rewards${rewardsClaimed ? ' mail-detail-rewards--claimed' : ''}`}>
                <div className="rewards-label">Phần thưởng</div>
                <div className="rewards-container">
                  <div className="rewards-scroll">
                    {rewards.peta ? (
                      <div className="reward-item-small">
                        <div className="reward-icon-container">
                          <img src="/images/icons/peta.png" alt="Peta" className="reward-icon-small" />
                          <div className="reward-quantity-badge">+{rewards.peta}</div>
                        </div>
                      </div>
                    ) : null}
                    {rewards.peta_gold ? (
                      <div className="reward-item-small">
                        <div className="reward-icon-container">
                          <img src="/images/icons/petagold.png" alt="Peta Gold" className="reward-icon-small" />
                          <div className="reward-quantity-badge">+{rewards.peta_gold}</div>
                        </div>
                      </div>
                    ) : null}
                    {rewards.items &&
                      rewards.items.map((item, index) => {
                        const itemDetail = itemDetails[item.item_id];
                        const imgSrc = getItemImageSrc(itemDetail?.image_url);
                        const label = itemDetail?.name || `Vật phẩm #${item.item_id}`;
                        return (
                          <div
                            key={`${item.item_id}-${index}`}
                            className="reward-item-small clickable"
                            onClick={() => handleItemClick(item, itemDetail)}
                            title={label}
                          >
                            <div className="reward-icon-container">
                              <img
                                src={imgSrc}
                                alt=""
                                className="reward-icon-small"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER_ITEM;
                                }}
                              />
                              <div className="reward-quantity-badge">x{item.quantity}</div>
                            </div>
                            <span className="reward-item-label">{label}</span>
                          </div>
                        );
                      })}
                    {rewards.pets &&
                      rewards.pets.map((pet, index) => {
                        const id = Number(pet.pet_id);
                        const row = Number.isFinite(id) ? auctionPreviews.pets[id] : null;
                        const label = row?.name ? row.name : `Thú cưng #${id}`;
                        return (
                          <div key={`pet-${pet.pet_id}-${index}`} className="reward-item-small" title="Thú cưng">
                            <div className="reward-icon-container">
                              <img
                                src={petPreviewSrc(row)}
                                alt=""
                                className="reward-icon-small"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER_ITEM;
                                }}
                              />
                              <div className="reward-quantity-badge">×{pet.quantity || 1}</div>
                            </div>
                            <span className="reward-item-label">{label}</span>
                          </div>
                        );
                      })}
                    {rewards.spirits &&
                      rewards.spirits.map((spirit, index) => {
                        const sid = Number(spirit.user_spirit_id);
                        const row = Number.isFinite(sid) ? auctionPreviews.spirits[sid] : null;
                        const label = row?.name ? row.name : `Linh thú #${spirit.spirit_id ?? sid}`;
                        return (
                          <div
                            key={`spirit-${spirit.user_spirit_id || spirit.spirit_id}-${index}`}
                            className="reward-item-small"
                            title="Linh thú"
                          >
                            <div className="reward-icon-container">
                              <img
                                src={spiritPreviewSrc(row)}
                                alt=""
                                className="reward-icon-small"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER_ITEM;
                                }}
                              />
                              <div className="reward-quantity-badge">×{spirit.quantity || 1}</div>
                            </div>
                            <span className="reward-item-label">{label}</span>
                          </div>
                        );
                      })}
                    {rewards.auction_transfer_pet_ids &&
                      rewards.auction_transfer_pet_ids.map((pid) => {
                        const id = Number(pid);
                        const row = Number.isFinite(id) ? auctionPreviews.pets[id] : null;
                        const label = row?.name ? row.name : `Thú cưng #${id}`;
                        return (
                          <div key={`auction-pet-${id}`} className="reward-item-small" title="Thú cưng (đấu giá)">
                            <div className="reward-icon-container">
                              <img
                                src={petPreviewSrc(row)}
                                alt=""
                                className="reward-icon-small"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER_PET;
                                }}
                              />
                              <div className="reward-quantity-badge">×1</div>
                            </div>
                            <span className="reward-item-label">{label}</span>
                          </div>
                        );
                      })}
                    {rewards.auction_transfer_spirit_ids &&
                      rewards.auction_transfer_spirit_ids.map((sid) => {
                        const id = Number(sid);
                        const row = Number.isFinite(id) ? auctionPreviews.spirits[id] : null;
                        const label = row?.name ? row.name : `Linh thú #${id}`;
                        return (
                          <div key={`auction-spirit-${id}`} className="reward-item-small" title="Linh thú (đấu giá)">
                            <div className="reward-icon-container">
                              <img
                                src={spiritPreviewSrc(row)}
                                alt=""
                                className="reward-icon-small"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER_SPIRIT;
                                }}
                              />
                              <div className="reward-quantity-badge">×1</div>
                            </div>
                            <span className="reward-item-label">{label}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mail-detail-actions">
            <button type="button" className="mail-detail-btn close-btn" onClick={onClose}>
              Đóng
            </button>
            {hasRewards && !mailIsRewardsClaimed(mail) && (
              <button type="button" className="mail-detail-btn claim-btn" onClick={handleClaim} disabled={claiming}>
                {claiming ? 'Đang nhận...' : 'Nhận phần thưởng'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showItemModal && selectedItem && (
        <div className="item-detail-modal-overlay" onClick={handleItemModalClose}>
          <div className="item-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="item-detail-header">
              <h3>Chi tiết vật phẩm</h3>
              <button type="button" className="item-detail-close" onClick={handleItemModalClose}>
                ×
              </button>
            </div>
            <div className="item-detail-content">
              <div className="item-detail-icon">
                <img
                  src={getItemImageSrc(selectedItem.detail?.image_url)}
                  alt=""
                  className="item-detail-image"
                  onError={(e) => {
                    e.target.src = PLACEHOLDER_ITEM;
                  }}
                />
                <div className="item-detail-quantity">x{selectedItem.quantity}</div>
              </div>
              <div className="item-detail-info">
                <div className="item-detail-name">
                  {selectedItem.detail?.name || `Vật phẩm #${selectedItem.item_id}`}
                </div>
                <div className="item-detail-description">
                  {selectedItem.detail?.description || 'Không có mô tả'}
                </div>
                <div className="item-detail-type">Loại: {selectedItem.detail?.type || 'Không xác định'}</div>
                <div className="item-detail-rarity">Độ hiếm: {selectedItem.detail?.rarity || 'Không xác định'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MailDetailModal;
