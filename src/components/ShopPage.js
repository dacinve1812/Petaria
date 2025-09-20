// File: ShopPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import ShopItemList from './ShopItemList';
import ItemDetailModal from './items/ItemDetailModal';
import TemplatePage from './template/TemplatePage';
import { resolveAssetPath } from '../utils/pathUtils';

function ShopPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user, isLoading } = useUser();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [filteredShopItems, setFilteredShopItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user, isLoading]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE_URL}/api/shops`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        setShops(data);
        // Auto-select first shop if available and no shop is currently selected
        if (data && data.length > 0 && !selectedShop) {
          setSelectedShop(data[0]);
        }
      })
      .catch(error => {
        console.error('Error loading shops:', error);
      });
  }, [API_BASE_URL, user]);

  const fetchShopItems = (shopCode) => {
    if (!user) return;
    fetch(`${API_BASE_URL}/api/shop/${shopCode}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        setShopItems(data);
        setFilteredShopItems(data);
      })
      .catch(error => {
        console.error('Error loading shop items:', error);
      });
  };

  useEffect(() => {
    if (!selectedShop || !user) return;
    fetchShopItems(selectedShop.code);
  }, [API_BASE_URL, selectedShop, user]);

  const handleBuy = async (item, quantity = 1) => {
    const totalPrice = item.price * quantity;
    const confirm = window.confirm(`Bạn muốn mua ${quantity}x ${item.name} với tổng giá ${totalPrice.toLocaleString()} ${item.currency_type}?`);
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
        item_id: item.id,
        quantity: quantity
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
  

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Mock timer - in real app this would come from API
  const [timeLeft, setTimeLeft] = useState(11 * 3600 + 36 * 60); // 11h 36m

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 24 * 3600; // Reset to 24 hours
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  // Convert shops to tabs format for TemplatePage
  const shopTabs = shops.map((shop, index) => ({
    label: shop.name,
    value: shop.code,
    onClick: () => {
      setSelectedShop(shop);
      setCurrentTab(index);
    }
  }));


  return (
    <>


      <TemplatePage
        tabs={shopTabs}
        showSearch={false}
        currentTab={currentTab}
      >
        <div className='shop-items-section'>
          {selectedShop && (
            <>
              <div className='shop-info'>
                <p>{selectedShop.description}</p>
                <div className='shop-timer'>
                  <span className='timer-icon'>⏰</span>
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>
              
              <div className='items-grid-container'>
                <ShopItemList items={filteredShopItems} onItemClick={(item) => setSelectedItem(item)} />
              </div>
            </>
          )}
        </div>
      </TemplatePage>

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onBuy={handleBuy}
          mode="shop"
        />
      )}
    </>
  );
}

export default ShopPage;
