import React from 'react';
import { createPortal } from 'react-dom';
import './BattleOverlays.css';

const getRewardImageSrc = (imageUrl) => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  const clean = imageUrl.replace(/^\/+/, '');
  if (clean.startsWith('images/equipments/')) return `/${clean}`;
  if (clean.startsWith('equipments/')) return `/images/${clean}`;
  return `/images/equipments/${clean}`;
};

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
              <div className="battle-result-overlay__rewards-strip" role="region" aria-label="Rewards">
                <div className="battle-result-overlay__rewards-list">
                  {rewards.map((r, idx) => {
                    const qty = r?.quantity ?? 0;
                    const formattedQty = Number(qty || 0).toLocaleString();
                    const label = r?.name || (r?.item_id === 0 ? 'Peta' : 'Item');
                    const isPeta = r?.item_id === 0;
                    const rewardImage = isPeta ? '/images/icons/peta.png' : getRewardImageSrc(r?.image_url);
                    return (
                      <div className="battle-result-overlay__reward" key={`${r?.item_id ?? 'x'}-${idx}`}>
                        <div className={`battle-result-overlay__reward-icon ${isPeta ? 'is-peta' : ''}`} aria-hidden>
                          {rewardImage ? (
                            <img
                              className="battle-result-overlay__reward-item-img"
                              src={rewardImage}
                              alt=""
                              draggable={false}
                            />
                          ) : (
                            <span>{isPeta ? 'Peta' : 'I'}</span>
                          )}
                          {qty > 1 ? <span className="battle-result-overlay__reward-qty">{formattedQty}</span> : null}
                        </div>
                        <div className="battle-result-overlay__reward-name" title={label}>
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
