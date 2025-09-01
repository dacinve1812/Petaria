// File: ShopPage.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import ShopItemList from './ShopItemList';
import ItemDetailModal from './items/ItemDetailModal';
import GlobalBanner from './GlobalBanner';
import { resolveAssetPath } from '../utils/pathUtils';
import './css/ShopPage.css';
import NavigationMenu from './NavigationMenu';

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
      })
      .catch(error => {
        console.error('Error loading shop items:', error);
      });
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

  const getBannerImage = (shopCode) => {
    switch (shopCode) {
      case 'food_shop':
        return '/images/background/enemy-card1.jpg';
      case 'consumable_shop':
        return '/images/background/enemy-card2.jpg';
      case 'equipment_shop':
        return '/images/background/enemy-card3.jpg';
      case 'booster_shop':
        return '/images/background/enemy-card3.jpg';
      case 'premium_shop':
        return '/images/background/enemy-card3.jpg';
      case 'mystic_shop':
        return '/images/background/enemy-card3.jpg';
      default:
        return '/images/background/pvp.jpg';
    }
  };

  const getBannerTitle = (shop) => {
    if (!shop) return 'Shop';
    return shop.name;
  };

  return (
    <div className='shop-page-container'>
      {/* Banner section */}
      <GlobalBanner
        backgroundImage={resolveAssetPath(getBannerImage(selectedShop?.code))}
        title={getBannerTitle(selectedShop)}
        showBackButton={true}
        className="small"
      />
      <NavigationMenu />

      <div className='shop-content'>
        <div className='shop-items-section'>
          {selectedShop && (
            <>
              <div className='shop-info'>
                <p>{selectedShop.description}</p>
              </div>
              
              <div className='shop-controls'>
                <div className='shop-timer'>
                  <span className='timer-icon'>⏰</span>
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>
              
              <div className='items-grid-container'>
                <ShopItemList items={shopItems} onItemClick={(item) => setSelectedItem(item)} />
              </div>
            </>
          )}
        </div>

        <div className='shop-navigation'>
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
        </div>
      </div>

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
