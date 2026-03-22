import React, { useEffect, useMemo } from 'react';
import ModalHelpIconButton from '../ui/ModalHelpIconButton';

const STAT_LABELS = {
  hp: 'HP',
  mp: 'MP',
  str: 'Tấn công',
  def: 'Phòng thủ',
  spd: 'Tốc độ',
  intelligence: 'Trí tuệ',
};

function getRarityColor(rarity) {
  const key = (rarity || '').toLowerCase();
  const colors = {
    common: '#95a5a6',
    uncommon: '#27ae60',
    rare: '#3498db',
    epic: '#9b59b6',
    legendary: '#f39c12',
    mythic: '#e74c3c',
  };
  return colors[key] || '#95a5a6';
}

function getRarityText(rarity) {
  const key = (rarity || '').toLowerCase();
  const texts = {
    common: 'Thường',
    uncommon: 'Hiếm',
    rare: 'Hiếm',
    epic: 'Cực hiếm',
    legendary: 'Huyền thoại',
    mythic: 'Thần thoại',
  };
  return texts[key] || 'Thường';
}

/** Giá trị hiển thị bên phải (số, căn phải) */
function formatStatValueDisplay(stat) {
  const value = stat.stat_value;
  const mod = stat.stat_modifier === 'percentage' ? '%' : '';
  const sign = Number(value) >= 0 ? '+' : '';
  return `${sign}${value}${mod}`;
}

/** Luôn 4 slot; tối đa 4 stat, phần còn lại null (giữ chỗ chiều cao). */
function buildFourSlots(stats) {
  const list = Array.isArray(stats) ? stats.filter(Boolean).slice(0, 4) : [];
  const slots = [...list];
  while (slots.length < 4) slots.push(null);
  return slots;
}

/**
 * Modal linh thú — layout giống inventory item modal (header ảnh + info, footer).
 * Body: Pet Effect — vùng cố định 4 hàng; chỉ hàng có stat mới có viền/nội dung.
 */
function SpiritDetailModal({ spirit, onClose, equippedPetName, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const effectSlots = useMemo(() => buildFourSlots(spirit?.stats), [spirit?.stats]);

  if (!spirit) return null;

  let petEffectFilledIndex = 0;
  const petEffectRowElements = effectSlots.map((stat, i) => {
    if (!stat) {
      return (
        <div
          key={i}
          className="spirit-detail-pet-effect-row spirit-detail-pet-effect-row--empty-slot"
          aria-hidden
        />
      );
    }
    const stripeClass =
      petEffectFilledIndex % 2 === 0
        ? 'spirit-detail-pet-effect-row--stripe-a'
        : 'spirit-detail-pet-effect-row--stripe-b';
    petEffectFilledIndex += 1;
    return (
      <div key={i} className={`spirit-detail-pet-effect-row ${stripeClass}`}>
        <span
          className="spirit-detail-pet-effect-icon"
          data-stat-type={stat.stat_type}
          aria-hidden
        />
        <span className="spirit-detail-pet-effect-label">
          {STAT_LABELS[stat.stat_type] || String(stat.stat_type || '').toUpperCase()}
        </span>
        <span className="spirit-detail-pet-effect-value">{formatStatValueDisplay(stat)}</span>
      </div>
    );
  });

  return (
    <div
      className="inventory-item-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="inventory-item-modal spirit-detail-modal spirit-detail-modal--dark">
        <div className="inventory-item-modal-header spirit-detail-modal__header">
          <button
            type="button"
            className="inventory-item-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>

          <img
            src={`/images/spirit/${spirit.image_url}`}
            alt={spirit.name || ''}
            className="inventory-item-modal-image spirit-detail-modal__spirit-img"
            onError={(e) => {
              e.currentTarget.src = '/images/spirit/angelpuss.gif';
            }}
          />

          <div className="inventory-item-modal-header-info">
            <h3 className="inventory-item-modal-name">{spirit.name}</h3>
            <div className="inventory-item-modal-rarity spirit-detail-modal__rarity">
              Độ hiếm:{' '}
              <span style={{ color: getRarityColor(spirit.rarity) }}>
                {getRarityText(spirit.rarity)}
              </span>
            </div>
            <p
              className={`spirit-detail-modal-header-description${
                !(spirit.description && String(spirit.description).trim())
                  ? ' spirit-detail-modal-header-description--empty'
                  : ''
              }`}
            >
              {spirit.description && String(spirit.description).trim()
                ? spirit.description.trim()
                : 'Không có mô tả'}
            </p>
          </div>
        </div>

        <div className="inventory-item-modal-body spirit-detail-modal__body">
          {equippedPetName ? (
            <p className="spirit-detail-equipped-line">
              Đang trang bị cho: <strong>{equippedPetName}</strong>
            </p>
          ) : null}

          <div className="spirit-detail-pet-effect">
            <div className="spirit-detail-section-bar">
              <span className="spirit-detail-section-bar-deco spirit-detail-section-bar-deco--left" aria-hidden />
              <span className="spirit-detail-section-bar-title">Pet Effect</span>
              <span className="spirit-detail-section-bar-deco spirit-detail-section-bar-deco--right" aria-hidden />
              <ModalHelpIconButton
                sectionEnd
                ariaLabel="Giải thích Pet Effect"
                infoText="Chỉ số cộng thêm khi linh thú được trang bị cho thú cưng."
              />
            </div>

            <div className="spirit-detail-pet-effect-rows" aria-label="Pet effect stats (tối đa 4)">
              {petEffectRowElements}
            </div>
          </div>
        </div>

        <div className="inventory-item-modal-footer spirit-detail-modal__footer">
          {children}
        </div>
      </div>
    </div>
  );
}

export default SpiritDetailModal;
