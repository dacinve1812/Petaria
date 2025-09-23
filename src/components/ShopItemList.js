// File: ShopItemList.js
import React from 'react';
import ShopItemCard from './ShopItemCard';

function ShopItemList({ items = [], onItemClick, subTabValue = 'peta' }) {

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
    const getEmptyMessage = (subTabValue) => {
      switch (subTabValue) {
        case 'peta':
          return 'Không có vật phẩm nào trong shop này';
        case 'petagold':
          return 'Chưa có vật phẩm cho PetaGold';
        case 'arena':
          return 'Chưa có vật phẩm cho Arena';
        case 'honor':
          return 'Chưa có vật phẩm cho Honor';
        case 'guild':
          return 'Chưa có vật phẩm cho Guild';
        case 'guildwar':
          return 'Chưa có vật phẩm cho Guild War';
        case 'monthly':
          return 'Chưa có vật phẩm cho Monthly Subscription';
        case 'special':
          return 'Chưa có vật phẩm cho Special';
        case 'limited':
          return 'Chưa có vật phẩm cho Limited Time';
        case 'daily':
          return 'Chưa có vật phẩm cho Daily Shop';
        default:
          return 'Không có vật phẩm nào trong shop này';
      }
    };

    return (
      <div className='item-list-container'>
        <div className='empty-message'>
          {getEmptyMessage(subTabValue)}
        </div>
      </div>
    );
  }

  return (
    <div className='item-list-container'>
      {items.map((item, index) => (
        <ShopItemCard
          key={`${item.id}-${index}`}
          stock={item.stock_limit}
          item={item}
          currency={item.currency_type}
          price={item.price}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}

export default ShopItemList;