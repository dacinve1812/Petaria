import React, { useState } from 'react';
import './EncounterModal.css';
import ConfirmFleeModal from './ConfirmFleeModal';
import GameModalButton from './ui/GameModalButton';

function resolveImageSrc(src, fallback) {
  if (!src) return fallback;
  if (src.startsWith('http') || src.startsWith('/')) return src;
  return fallback.includes('equipments')
    ? `/images/equipments/${src}`
    : `/images/pets/${src}`;
}

/**
 * Modal gặp gỡ thống nhất: pet / boss / item.
 * @param {{
 *   type: 'species'|'boss'|'item',
 *   data: object,
 *   onClose: () => void,
 *   onCatch?: (data: object) => void,
 *   onBattle?: (data: object) => void,
 *   onClaimItem?: (data: object) => void | Promise<void>,
 *   claimingItem?: boolean,
 * }} props
 */
function EncounterModal({
  type = 'species',
  data,
  onClose,
  onCatch,
  onBattle,
  onClaimItem,
  claimingItem = false,
}) {
  const [showConfirmFlee, setShowConfirmFlee] = useState(false);

  if (!data) return null;

  const isItem = type === 'item';
  const isBoss = type === 'boss';

  const title = isItem
    ? 'Chúc mừng, bạn đã tìm được vật phẩm'
    : isBoss
      ? 'Bạn gặp một Boss!'
      : 'Bạn gặp một thú cưng hoang dã!';

  const name = data.name || (isItem ? 'Vật phẩm' : isBoss ? 'Boss' : 'Pet');
  const level =
    data.level != null && data.level !== ''
      ? Number(data.level)
      : data.min_level != null
        ? Number(data.min_level)
        : null;

  const imageSrc = isItem
    ? resolveImageSrc(data.image_url, '/images/equipments/placeholder.png')
    : resolveImageSrc(data.image || data.sprite, '/images/pets/default.png');

  const fallbackImg = isItem
    ? '/images/equipments/placeholder.png'
    : '/images/pets/default.png';

  const handleCatch = () => {
    if (onCatch) onCatch(data);
  };

  const handleBattle = () => {
    if (onBattle) onBattle(data);
    if (!isBoss) onClose();
  };

  const handleFlee = () => {
    onClose();
  };

  const handleCloseClick = () => {
    if (isItem) return;
    setShowConfirmFlee(true);
  };

  const handleClaimItem = () => {
    if (claimingItem) return;
    if (onClaimItem) onClaimItem(data);
    else onClose();
  };

  return (
    <>
      <div className="encounter-modal-overlay">
        <div className="encounter-modal-content" onClick={(e) => e.stopPropagation()}>
          {!isItem && (
            <button type="button" className="encounter-modal-close" onClick={handleCloseClick}>
              ✕
            </button>
          )}

          <div className="encounter-header">
            <h2 className="encounter-title">{title}</h2>
          </div>

          <div className="encounter-pet-info">
            <div>
              <img
                src={imageSrc}
                alt=""
                className={isItem ? 'hmap-item-enc-img' : 'encounter-species-img'}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = fallbackImg;
                }}
              />
            </div>

            <h3 className="encounter-pet-name">{name}</h3>
            {isItem ? (
              <p className="encounter-level">×{data.qty ?? 1}</p>
            ) : (
              <p className="encounter-level">
                Lv. {Number.isFinite(level) ? level : '—'}
              </p>
            )}
          </div>

          <div className="encounter-actions">
            {isItem ? (
              <GameModalButton
                variant="cancel"
                showIcon={false}
                className="encounter-claim-btn"
                onClick={handleClaimItem}
                disabled={claimingItem}
              >
                {claimingItem ? 'Đang nhận…' : 'Xác nhận'}
              </GameModalButton>
            ) : isBoss ? (
              <>
                <button type="button" className="action-button primary" onClick={handleBattle}>
                  Chiến Đấu
                </button>
                <button type="button" className="action-button ghost" onClick={handleFlee}>
                  Bỏ chạy
                </button>
              </>
            ) : (
              <>
                <button type="button" className="action-button primary" onClick={handleCatch}>
                  Bắt
                </button>
                <button type="button" className="action-button secondary" onClick={handleBattle}>
                  Chiến Đấu
                </button>
                <button type="button" className="action-button ghost" onClick={handleFlee}>
                  Bỏ chạy
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showConfirmFlee && (
        <ConfirmFleeModal
          petName={name}
          onConfirm={() => {
            setShowConfirmFlee(false);
            handleFlee();
          }}
          onCancel={() => setShowConfirmFlee(false)}
        />
      )}
    </>
  );
}

export default EncounterModal;
