// File: ShopItemList.js
import React from 'react';
import './css/ShopPage.css';

function ShopItemList({ items = [], onItemClick }) {
  const getItemStatus = (item) => {
    if (item.stock_limit === 0 || item.stock_limit === null) {
      return { type: 'sold-out', text: 'Sold Out' };
    }
    if (item.stock_limit <= 2) {
      return { type: 'limited', text: 'Limited' };
    }
    return null;
  };

  const getItemTag = (item) => {
    // Logic để xác định tag dựa trên item properties
    if (item.price > 100000) {
      return { type: 'super-value', text: 'Super Value' };
    }
    if (item.name.includes('Ticket') || item.name.includes('Summon')) {
      return { type: 'must-buy', text: 'Must-Buy' };
    }
    return null;
  };

  if (!Array.isArray(items)) {
    return (
      <div className='item-list-container'>
        <div className='error-message'>
          Error: Items data is invalid
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className='item-list-container'>
        <div className='empty-message'>
          Không có vật phẩm nào trong shop này
        </div>
      </div>
    );
  }

  return (
    <div className='item-list-container'>
      {items.map((item, index) => {
        const status = getItemStatus(item);
        const tag = getItemTag(item);
        
        return (
          <div
            key={`${item.id}-${index}`}
            className={`item-list-detail ${status?.type || ''}`}
            onClick={() => onItemClick && onItemClick(item)}
          >
            {status && status.type === 'sold-out' && (
              <div className={`item-status-overlay ${status.type}`}>
                {status.text}
              </div>
            )}
            {tag && (
              <div className={`item-tag ${tag.type}`}>
                {tag.text}
              </div>
            )}
            <img src={`/images/equipments/${item.image_url}`} alt={item.name} />
            <strong>{item.name}</strong>
            <div className="item-stock">
              Còn lại: {item.stock_limit === null ? '0' : item.stock_limit}
            </div>
            <div className="item-price">
              Giá: {item.price.toLocaleString()} {item.currency_type === 'gem' ? 'petaGold' : 'peta'}
            </div>
            {status && status.type !== 'sold-out' && (
              <div className={`item-status ${status.type}`}>
                {status.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ShopItemList;