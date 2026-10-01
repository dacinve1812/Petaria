import React from 'react';
import { createPortal } from 'react-dom';
import './BattleOverlays.css';

const getRewardImageSrc = (imageUrl) => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  const clean = imageUrl.replace(/^\/+/, '');
  if (clean.startsWith('images/')) return `/${clean}`;
  if (clean.startsWith('equipments/')) return `/images/${clean}`;
  if (clean.startsWith('pets/')) return `/images/${clean}`;
  if (clean.startsWith('spirit/')) return `/images/${clean}`;
  return `/images/equipments/${clean}`;
};

/** Phân loại loot: peta / petagold / pet / spirit / item */
export function classifyBattleLoot(entry) {
  if (!entry || typeof entry !== 'object') return 'item';
  const kind = String(entry.kind || entry.type || entry.currency || '').toLowerCase();
  const name = String(entry.name || entry.label || '').toLowerCase().replace(/\s+/g, '');
  const itemId = Number(entry.item_id);
  if (
    kind === 'petagold' ||
    kind === 'peta_gold' ||
    itemId === -1 ||
    name === 'petagold' ||
    name.includes('petagold') ||
    name === 'peta_gold'
  ) {
    return 'petagold';
  }
  if (kind === 'peta' || itemId === 0 || name === 'peta' || name.includes('vàng(peta)') || name === 'vang(peta)') {
    return 'peta';
  }
  if (kind === 'pet' || kind === 'species' || entry.pet_id != null || entry.species_id != null) {
    return 'pet';
  }
  if (kind === 'spirit' || entry.spirit_id != null || entry.user_spirit_id != null) {
    return 'spirit';
  }
  return 'item';
}

export function resolveBattleLootVisual(entry) {
  const cls = classifyBattleLoot(entry);
  const qty = Number(entry?.quantity ?? entry?.amount ?? entry?.qty ?? 0) || 0;
  if (cls === 'peta') {
    return {
      cls,
      label: entry?.name || 'Peta',
      qty,
      image: '/images/icons/peta.png',
      iconMod: 'is-peta',
    };
  }
  if (cls === 'petagold') {
    return {
      cls,
      label: entry?.name || 'PetaGold',
      qty,
      image: '/images/icons/petagold.png',
      iconMod: 'is-petagold',
    };
  }
  if (cls === 'pet') {
    const img = entry?.image || entry?.image_url || entry?.species_image || '';
    return {
      cls,
      label: entry?.name || 'Thú cưng',
      qty: qty || 1,
      image: img ? getRewardImageSrc(img.startsWith('pets/') || img.includes('/') ? img : `pets/${img}`) : '/images/icons/bag.svg',
      iconMod: 'is-pet',
    };
  }
  if (cls === 'spirit') {
    const img = entry?.image || entry?.image_url || entry?.spirit_image || '';
    return {
      cls,
      label: entry?.name || 'Linh thú',
      qty: qty || 1,
      image: img ? getRewardImageSrc(img.startsWith('spirit/') || img.includes('/') ? img : `spirit/${img}`) : '/images/icons/bag.svg',
      iconMod: 'is-spirit',
    };
  }
  return {
    cls: 'item',
    label: entry?.name || (entry?.item_id != null ? `Item #${entry.item_id}` : 'Item'),
    qty,
    image: getRewardImageSrc(entry?.image_url || entry?.image) || '/images/equipments/placeholder.png',
    iconMod: '',
  };
}

/** Dải icon loot — dùng chung Result overlay / trang classic-result */
export function BattleRewardStrip({ rewards = [], className = '', ariaLabel = 'Phần thưởng' }) {
  if (!Array.isArray(rewards) || rewards.length === 0) return null;
  return (
    <div className={`battle-result-overlay__rewards-strip ${className}`.trim()} role="region" aria-label={ariaLabel}>
      <div className="battle-result-overlay__rewards-list">
        {rewards.map((r, idx) => {
          const v = resolveBattleLootVisual(r);
          const formattedQty = Number(v.qty || 0).toLocaleString();
          const showQty = v.cls === 'peta' || v.cls === 'petagold' ? v.qty > 0 : v.qty > 1;
          return (
            <div className="battle-result-overlay__reward" key={`${v.cls}-${r?.item_id ?? r?.pet_id ?? r?.spirit_id ?? 'x'}-${idx}`}>
              <div className={`battle-result-overlay__reward-icon ${v.iconMod}`.trim()} aria-hidden>
                {v.image ? (
                  <img
                    className="battle-result-overlay__reward-item-img"
                    src={v.image}
                    alt=""
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.src = '/images/equipments/placeholder.png';
                    }}
                  />
                ) : (
                  <span>{v.label.slice(0, 1)}</span>
                )}
                {showQty ? <span className="battle-result-overlay__reward-qty">{formattedQty}</span> : null}
              </div>
              <div className="battle-result-overlay__reward-name" title={v.label}>
                {v.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Full-viewport blocking layer + centered image banner (START / FINISH).
 * Dùng lại cho mọi chế độ đánh (arena, boss, PvE, v.v.).
 */
export function BattleBannerOverlay({ open, imageSrc, alt = '', dimOpacity = 0.5 }) {
  if (!open || !imageSrc) return null;
  return createPortal(
    <div
      className={`battle-banner-overlay ${dimOpacity >= 0.45 ? 'battle-banner-overlay--dim-50' : 'battle-banner-overlay--dim-20'}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={alt || 'Battle banner'}
    >
      <img
        src={imageSrc}
        alt={alt}
        className="battle-banner-overlay__img"
        draggable={false}
      />
    </div>,
    document.body
  );
}

/**
 * Kết quả trận: nền đen (mờ), arena phía dưới vẫn thấy mờ.
 * outcome: 'win' | 'lose' → tiêu đề Victory / Defeat.
 */
export function BattleResultDimOverlay({
  open,
  outcome,
  rewards = [],
  petProgress = [],
  expGained = 0,
  levelUp = false,
  newLevel = null,
  footer,
  dimOpacity = 0.2,
}) {
  if (!open) return null;
  const isWin = outcome === 'win';
  const showRewards = isWin && Array.isArray(rewards) && rewards.length > 0;
  const fallbackPetProgress = isWin && (levelUp || expGained > 0)
    ? [{ id: 'single', image: '', name: 'Pet', expGained, levelUp, newLevel }]
    : [];
  const petProgressList = isWin && Array.isArray(petProgress) && petProgress.length > 0
    ? petProgress
    : fallbackPetProgress;
  return createPortal(
    <div
      className={`battle-result-overlay battle-result-overlay--${isWin ? 'win' : 'lose'} ${
        dimOpacity >= 0.45 ? 'battle-result-overlay--dim-50' : 'battle-result-overlay--dim-20'
      }`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={isWin ? 'Victory' : 'Defeat'}
    >
      <div className="battle-result-overlay__panel">
        <div className="battle-result-overlay__header">
          {isWin ? (
            <img
              className="battle-result-overlay__title-img"
              src="/images/banner/victorywing.png"
              alt="Victory"
              draggable={false}
            />
          ) : (
            <img
              className="battle-result-overlay__title-img battle-result-overlay__title-img--defeat"
              src="/images/banner/defeatwing.png"
              alt="Defeat"
              draggable={false}
            />
          )}
        </div>

        {(showRewards || isWin) && (
          <div className="battle-result-overlay__rewards-area">
            {showRewards ? (
              <BattleRewardStrip rewards={rewards} ariaLabel="Rewards" />
            ) : (
              <div className="battle-result-overlay__rewards-strip battle-result-overlay__rewards-strip--empty" />
            )}
          </div>
        )}

        {isWin && petProgressList.length > 0 ? (
          <div className="battle-result-overlay__info">
            <div className="battle-result-overlay__pet-strip">
              <div className="battle-result-overlay__pet-list">
                {petProgressList.map((pet, idx) => {
                  const expValue = pet?.expGained ?? 0;
                  const isLeveled = !!pet?.levelUp;
                  const petKey = pet?.id ?? idx;
                  return (
                    <div className="battle-result-overlay__pet-card" key={petKey}>
                      {isLeveled ? (
                        <div className="battle-result-overlay__pet-levelup-text">Level Up</div>
                      ) : null}
                      <div className="battle-result-overlay__pet-avatar-wrap">
                        {pet?.image ? (
                          <img
                            className="battle-result-overlay__pet-avatar"
                            src={`/images/pets/${pet.image}`}
                            alt={pet?.name || 'Pet'}
                            draggable={false}
                          />
                        ) : (
                          <div className="battle-result-overlay__pet-avatar battle-result-overlay__pet-avatar--placeholder" />
                        )}
                      </div>
                      <div className="battle-result-overlay__pet-meta">
                        <div className="battle-result-overlay__pet-exp">
                          {expValue > 0 ? `EXP +${expValue.toLocaleString()}` : 'EXP +0'}
                        </div>
                        {isLeveled && pet?.newLevel != null ? (
                          <div className="battle-result-overlay__pet-new-level">Lv. {pet.newLevel}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {footer ? <div className="battle-result-overlay__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
