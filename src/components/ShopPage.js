// File: ShopPage.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

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
    if (!user || !user.token || isLoadingShops) return;
    
    setIsLoadingShops(true);
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
      })
      .finally(() => {
        setIsLoadingShops(false);
      });
  }, [API_BASE_URL, user?.token]); // Use user.token instead of user object

  // Handle main tab change
  const handleMainTabChange = useCallback((index) => {
    setCurrentMainTab(index);
    setCurrentSubTab(0); // Reset sub tab when changing main tab
  }, []);

  // Handle sub tab change
  const handleSubTabChange = useCallback((index) => {
    setCurrentSubTab(index);
    // Fetch items for the selected sub tab
    const currentSubTabData = mainTabs[currentMainTab]?.subTabs?.[index];
    if (currentSubTabData && user && user.token) {
      fetchShopItems(currentSubTabData.value);
    }
  }, [currentMainTab, user?.token]);

  // Filter items by sub tab
  const filterItemsBySubTab = (subTabValue) => {
    // Filter items based on currency_type matching the sub-tab
    const filteredItems = shopItems.filter(item => {
      // Map sub-tab values to currency types
      const currencyMap = {
        'peta': 'peta',
        'petagold': 'petagold', 
        'arena': 'arena',
        'honor': 'honor',
        'guild': 'guild',
        'guildwar': 'guildwar',
        'monthly': 'ruby',
        'special': 'ruby',
        'limited': 'ruby',
        'daily': 'ruby',
        'general': 'peta'
      };
      
      const expectedCurrency = currencyMap[subTabValue];
      return item.currency_type === expectedCurrency;
    });
    
    setFilteredShopItems(filteredItems);
  };

  const fetchShopItems = (shopCode) => {
    if (!user || !user.token || isLoadingItems) return;
    
    setIsLoadingItems(true);
    fetch(`${API_BASE_URL}/api/shop/${shopCode}`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        console.log(`Fetched items for ${shopCode}:`, data); // Debug log
        setShopItems(data || []);
        setFilteredShopItems(data || []);
      })
      .catch(error => {
        console.error('Error loading shop items:', error);
        setShopItems([]);
        setFilteredShopItems([]);
      })
      .finally(() => {
        setIsLoadingItems(false);
      });
  };

  // Calculate current tab data before using in useEffect
  const currentMainTabData = mainTabs[currentMainTab];
  const currentSubTabData = currentMainTabData?.subTabs?.[currentSubTab];

  useEffect(() => {
    if (!currentSubTabData || !user || !user.token) return;
    
    // Get shop restock interval
    const shop = shops.find(s => s.code === currentSubTabData.value);
    if (shop) {
      setCurrentShopRestockInterval(shop.shop_restock_interval);
    }
    
    fetchShopItems(currentSubTabData.value);
  }, [currentSubTabData?.value, user?.token, shops]); // Add shops to dependencies

  // Load shops data on component mount
  useEffect(() => {
    const loadShops = async () => {
      if (!user || !user.token) return;
      
      setIsLoadingShops(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setShops(data);
          
          // Auto-select first sub-tab if available
          if (data.length > 0 && mainTabs[0]?.subTabs?.length > 0) {
            const firstSubTab = mainTabs[0].subTabs[0];
            const firstShop = data.find(s => s.code === firstSubTab.value);
            if (firstShop) {
              setCurrentShopRestockInterval(firstShop.shop_restock_interval);
            }
          }
        }
      } catch (error) {
        console.error('Error loading shops:', error);
      } finally {
        setIsLoadingShops(false);
      }
    };

    loadShops();
  }, [user?.token]);
  useEffect(() => {
    const loadGlobalResetTime = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/global-reset-time`);
        if (response.ok) {
          const data = await response.json();
          setGlobalResetTime(data.global_reset_time || '06:00');
        }
      } catch (error) {
        console.error('Error loading global reset time:', error);
        // Keep default fallback
      }
    };

    loadGlobalResetTime();
  }, []);

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
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  // Timer based on actual restock interval
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentShopRestockInterval, setCurrentShopRestockInterval] = useState(null);
  const [lastRestockTime, setLastRestockTime] = useState(null);
  const [globalResetTime, setGlobalResetTime] = useState('06:00'); // Default fallback

  // Function to convert restock cycle to next reset time
  const getNextResetTime = (cycle) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Parse global reset time (e.g., "19:00" for 7 PM)
    const [resetHour, resetMinute] = globalResetTime.split(':').map(Number);
    const todayResetTime = new Date(today.getTime() + resetHour * 3600000 + resetMinute * 60000);
    
    switch (cycle) {
      case 'daily':
        // Next reset is today or tomorrow at global reset time
        if (now >= todayResetTime) {
          return new Date(todayResetTime.getTime() + 24 * 3600000); // Tomorrow
        }
        return todayResetTime; // Today
        
      case 'weekly':
        // Next reset is next Sunday at global reset time
        const daysUntilSunday = (7 - now.getDay()) % 7 || 7; // Sunday = 0
        const nextSunday = new Date(today.getTime() + daysUntilSunday * 24 * 3600000);
        return new Date(nextSunday.getTime() + resetHour * 3600000 + resetMinute * 60000);
        
      case 'monthly':
        // Next reset is 1st of next month at global reset time
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return new Date(nextMonth.getTime() + resetHour * 3600000 + resetMinute * 60000);
        
      default:
        return null;
    }
  };

  // Function to calculate time until next restock based on cycle
  const calculateTimeUntilRestock = (cycle, lastRestock) => {
    if (!cycle || cycle === 'none') return 0;
    
    const nextResetTime = getNextResetTime(cycle);
    if (!nextResetTime) return 0;
    
    const now = new Date();
    const timeUntilReset = Math.max(0, Math.floor((nextResetTime - now) / 1000));
    
    return timeUntilReset;
  };

  // Update timer based on restock interval
  useEffect(() => {
    if (!currentShopRestockInterval || currentShopRestockInterval === 'none') {
      // If no specific shop restock interval, use default daily cycle
      if (shops.length > 0) {
        const initialTimeLeft = calculateTimeUntilRestock('daily', null);
        setTimeLeft(initialTimeLeft);
      } else {
        setTimeLeft(0);
      }
      return;
    }

    // Calculate time until next global reset
    const initialTimeLeft = calculateTimeUntilRestock(currentShopRestockInterval, null);
    setTimeLeft(initialTimeLeft);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Reset to full interval when timer reaches 0
          return calculateTimeUntilRestock(currentShopRestockInterval, null);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentShopRestockInterval, globalResetTime, shops.length]);

  // Convert main tabs to format for TemplatePage (memoized to prevent re-renders)
  const mainTabsForTemplate = useMemo(() => 
    mainTabs.map((tab, index) => ({
      label: tab.label,
      value: tab.value,
      onClick: () => handleMainTabChange(index)
    })), [mainTabs, handleMainTabChange]
  );

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
              {/* Timer - Show if shop has restock interval or show default timer */}
              {(currentShopRestockInterval && currentShopRestockInterval !== 'none') || (!currentSubTabData && shops.length > 0) ? (
                <div className='shop-timer'>
                  <span className='timer-icon'>⏰</span>
                  <span>{formatTime(timeLeft)}</span>
                </div>
              ) : null}

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