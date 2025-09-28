// File: ShopItemCard.js
import React from 'react';

function ShopItemCard({ 
  stock, 
  item, 
  currency = 'peta', 
  price, 
  onItemClick,
  className = '',
  showTag = true,
  showStock = true,
  isAdmin = false
}) {
  const getItemStatus = (stock) => {
    if (stock === 0 || stock === null) {
      return { type: 'sold-out', text: 'Sold Out' };
    }
    if (stock <= 2) {
      return { type: 'limited', text: 'Limited' };
    }
    return null;
  };

  const getItemTag = (item) => {
    if (!showTag) return null;
    
    // Logic để xác định tag dựa trên item properties
    if (price > 100000) {
      return { type: 'super-value', text: 'Super Value' };
    }
    if (item?.name?.includes('Ticket') || item?.name?.includes('Summon')) {
      return { type: 'must-buy', text: 'Must-Buy' };
    }
    return null;
  };

  const getCurrencyIcon = (currencyType) => {
    switch (currencyType) {
      case 'petagold':
        return '/images/icons/petagold.png';
      case 'peta':
        return '/images/icons/peta.png';
      case 'arena':
        return '/images/icons/arena-coin.png';
      case 'honor':
        return '/images/icons/honor-coin.png';
      case 'guild':
        return '/images/icons/guild-coin.png';
      default:
        return '/images/icons/peta.png';
    }
  };

  const getCurrencyClass = (currencyType) => {
    switch (currencyType) {
      case 'petagold':
        return 'gold';
      case 'peta':
        return 'peta';
      case 'arena':
        return 'arena';
      case 'honor':
        return 'honor';
      case 'guild':
        return 'guild';
      default:
        return 'peta';
    }
  };

  const status = getItemStatus(stock);
  const tag = getItemTag(item);
  const stockCount = stock === null ? 0 : stock;

  return (
    <div
      className={`item-list-detail ${status?.type === 'sold-out' ? 'is-out' : ''} ${className}`}
      onClick={() => onItemClick && onItemClick(item)}
    >
      

      {/* Panel Body Container */}
      <div className="item-body">
        {/* Stock Badge */}
      {showStock && (
        <div className={`item-stock ${status?.type || ''}`}>
          Stock: {stockCount}
        </div>
      )}

      {/* Item Tag */}
      {tag && (
        <div className={`item-tag ${tag.type}`}>
          {tag.text}
        </div>
      )}
        <img 
          className='item-image-shop-style'
          src={item?.image_url ? `/images/equipments/${item.image_url}` : '/images/placeholder.png'} 
          alt={item?.name || 'Item'}
          onError={(e) => {
            e.target.classList.add('placeholder');
            e.target.removeAttribute('src');
          }}
        />

        {/* Item Name - Overlay on panel */}
        <strong>{item?.name || 'Unknown Item'}</strong>
      </div>

      {/* Footer Price Section */}
      <div className="item-price-section">
        <img 
          src={getCurrencyIcon(currency)} 
          alt={currency}
          className="item-price-icon"
          onError={(e) => {
            e.target.outerHTML = '<span style="width:22px;height:22px;border-radius:50%;display:inline-block;background:#f4d03f;border:2px solid #c59c2f;"></span>';
          }}
        />
        <span className={`item-price ${getCurrencyClass(currency)}`}>
          {price?.toLocaleString() || '0'}
        </span>
      </div>

      {/* Status Overlay for Sold Out */}
      {status && status.type === 'sold-out' && (
        <div className={`item-status-overlay ${status.type}`}>
          {status.text}
        </div>
      )}
    </div>
  );
}

export default ShopItemCard;
