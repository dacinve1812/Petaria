// File: ShopPage.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import ShopItemList from './ShopItemList';
import ItemDetailModal from './items/ItemDetailModal';
import './css/ShopPage.css';
import BackButton from './BackButton';

function ShopPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const user = useContext(UserContext);
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE_URL}/api/shops`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setShops(data));
  }, [API_BASE_URL, user]);

  const fetchShopItems = (shopCode) => {
    if (!user) return;
    fetch(`${API_BASE_URL}/api/shop/${shopCode}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setShopItems(data));
  };

  useEffect(() => {
    if (!selectedShop || !user) return;
    fetchShopItems(selectedShop.code);
  }, [API_BASE_URL, selectedShop, user]);

  const handleBuy = async (item) => {
    const confirm = window.confirm(`Bạn muốn mua ${item.name} với giá ${item.price} ${item.currency_type}?`);
    if (!confirm) return;

    const res = await fetch(`${API_BASE_URL}/api/shop/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify({
        user_id: user.userId,
        shop_code: selectedShop.code,
        item_id: item.id
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Mua thành công!');
      fetchShopItems(selectedShop.code);
      setSelectedItem(null);
    } else {
      alert(data.error || 'Đã có lỗi xảy ra');
    }
  };
  const handleBack = () => {
    navigate('/');
  };

  return (

        <div>
          <BackButton onClick={handleBack} />
          <h1>Cửa hàng vật phẩm</h1>

          <div className='shop-container'>
            {Array.isArray(shops) && shops.map(shop => (
              <button
                key={shop.id}
                onClick={() => setSelectedShop(shop)}
                className={`shop-title ${selectedShop?.id === shop.id ? 'active' : ''}`}
              >
                {shop.name}
              </button>
            ))}
          </div>

          {selectedShop && (
            <>
              <h2>{selectedShop.name}</h2>
              <h3>{selectedShop.description}</h3>
              <ShopItemList items={shopItems} onItemClick={(item) => setSelectedItem(item)} />
            </>
          )}

          {selectedItem && (
            <ItemDetailModal
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onBuy={handleBuy}
              mode="shop"
            />
          )}
        </div>

  );
}

export default ShopPage;
