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

  // Main shop tabs
  const [currentMainTab, setCurrentMainTab] = useState(0);
  const [currentSubTab, setCurrentSubTab] = useState(0);
  
  // Data states
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [filteredShopItems, setFilteredShopItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // Shop configuration
  const mainTabs = [
    { 
      label: 'Exchange Shop', 
      value: 'exchange',
      subTabs: [
        { label: 'Peta', value: 'peta' },
        { label: 'PetaGold', value: 'petagold' },
        { label: 'Arena', value: 'arena' },
        { label: 'Honor', value: 'honor' },
        { label: 'Guild', value: 'guild' },
        { label: 'Guild War', value: 'guildwar' }
      ]
    },
    { 
      label: 'Premium', 
      value: 'premium',
      subTabs: [
        { label: 'Monthly Subscription', value: 'monthly' },
        { label: 'Special', value: 'special' },
        { label: 'Limited Time', value: 'limited' },
        { label: 'Daily Shop', value: 'daily' }
      ]
    },
    { 
      label: 'General', 
      value: 'general',
      subTabs: []
    }
  ];

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

  // Handle main tab change
  const handleMainTabChange = (index) => {
    setCurrentMainTab(index);
    setCurrentSubTab(0); // Reset sub tab when changing main tab
  };

  // Handle sub tab change
  const handleSubTabChange = (index) => {
    setCurrentSubTab(index);
    // Filter items based on selected sub tab
    const currentSubTabData = mainTabs[currentMainTab]?.subTabs?.[index];
    if (currentSubTabData) {
      filterItemsBySubTab(currentSubTabData.value);
    }
  };

  // Filter items by sub tab
  const filterItemsBySubTab = (subTabValue) => {
    if (subTabValue === 'peta') {
      // Show actual items for Peta tab
      setFilteredShopItems(shopItems);
    } else {
      // Show placeholder for other tabs
      setFilteredShopItems([]);
    }
  };

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
  }, [selectedShop, user]);

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
  const [timeLeft, setTimeLeft] = useState(4 * 3600); // 4h

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

  // Convert main tabs to format for TemplatePage
  const mainTabsForTemplate = mainTabs.map((tab, index) => ({
    label: tab.label,
    value: tab.value,
    onClick: () => handleMainTabChange(index)
  }));

  const currentMainTabData = mainTabs[currentMainTab];
  const currentSubTabData = currentMainTabData?.subTabs?.[currentSubTab];

  return (
    <>
      <TemplatePage
        tabs={mainTabsForTemplate}
        showSearch={false}
        currentTab={currentMainTab}
      >
        <div className='shop-page-container'>
          {/* Two-panel layout */}
          <div className='shop-layout'>
            {/* Left panel - Sub tabs navigation */}
            {currentMainTabData?.subTabs?.length > 0 && (
              <div className='shop-sub-nav'>
                {currentMainTabData.subTabs.map((subTab, index) => (
                  <button
                    key={index}
                    className={`shop-sub-nav-item ${currentSubTab === index ? 'active' : ''}`}
                    onClick={() => handleSubTabChange(index)}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Right panel - Items container with timer */}
            <div className='shop-items-container'>
              {/* Timer */}
              <div className='shop-timer'>
                <span className='timer-icon'>⏰</span>
                <span>{formatTime(timeLeft)}</span>
              </div>

              {/* Items grid */}
              <div className='shop-items-grid'>
                <ShopItemList 
                  items={filteredShopItems} 
                  onItemClick={(item) => setSelectedItem(item)}
                  subTabValue={currentSubTabData?.value || 'peta'}
                />
              </div>
            </div>
          </div>
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