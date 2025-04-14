// File: ShopItemList.js
import React, { useState } from 'react';
import './css/ShopPage.css';

function ShopItemList({ items = [], onBuyClick }) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className='item-list-container'>
        {paginatedItems.map((item, index) => (
          <div key={`${item.id}-${index}`} className='item-list-detail'>
            <img src={`/images/equipments/${item.image_url}`} alt={item.name} width="60" />
            <div><strong>{item.name}</strong></div>
            <div>Còn lại: {item.stock_limit === null ? '0' : item.stock_limit}</div>
            <div>Giá: {item.price} {item.currency_type === 'gem' ? 'petaGold' : 'peta'}</div>
            <br></br>
            {onBuyClick && (
              <button onClick={() => onBuyClick(item)}>Mua</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i + 1}
            onClick={() => setCurrentPage(i + 1)}
            disabled={currentPage === i + 1}
            style={{ margin: '0 5px' }}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ShopItemList;
