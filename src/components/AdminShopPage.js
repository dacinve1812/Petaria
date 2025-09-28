// File: AdminShopPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import ShopItemCard from './ShopItemCard';
import AdminAddItemModal from './admin/AdminAddItemModal';
import AdminAddShopModal from './admin/AdminAddShopModal';
import AdminEditItemModal from './admin/AdminEditItemModal';
import AdminSetShopRestockModal from './admin/AdminSetShopRestockModal';

function AdminShopPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user, isLoading } = useUser();
  const navigate = useNavigate();

  // State management
  const [currentMainTab, setCurrentMainTab] = useState(0); // Use index instead of string
  const [currentSubTab, setCurrentSubTab] = useState(0);
  const [shopData, setShopData] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAddShopModalOpen, setIsAddShopModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isSetRestockModalOpen, setIsSetRestockModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentShopRestockInterval, setCurrentShopRestockInterval] = useState(null);
  const [lastRestockTime, setLastRestockTime] = useState(null);
  const [globalResetTime, setGlobalResetTime] = useState('19:00'); // Default to 7 PM CST
  const [lastLoadedShop, setLastLoadedShop] = useState(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false); // Track last loaded shop

  // Main tabs structure
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

  // Template tabs for TemplatePage
  const mainTabsForTemplate = mainTabs.map((tab, index) => ({
    label: tab.label,
    value: tab.value,
    onClick: () => handleMainTabChange(index) // Use onClick instead of onTabChange
  }));

  // Get current tab data
  const currentMainTabData = mainTabs[currentMainTab];
  const currentSubTabData = currentMainTabData?.subTabs?.[currentSubTab];

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time display
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

  // Load shop data
  useEffect(() => {
    if (isLoading) return;
    if (!user || !user.isAdmin) {
      window.location.href = '/login';
      return;
    }
    
    loadShopData();
  }, [user, isLoading]);

  // Load shop items when sub-tab changes
  useEffect(() => {
    // Don't load items if user is not ready
    if (!user || !user.token || isLoading) return;
    
    if (currentSubTabData && currentSubTabData.value !== lastLoadedShop) {
      setLastLoadedShop(currentSubTabData.value);
      loadShopItems(currentSubTabData.value);
    } else if (!currentSubTabData) {
      // Clear items when no sub-tab is selected
      setShopItems([]);
      setLastLoadedShop(null);
    }
  }, [currentSubTabData?.value, lastLoadedShop, user?.token, isLoading]); // Add isLoading back but with proper checks

  // Load global reset time
  useEffect(() => {
    const loadGlobalResetTime = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/global-reset-time`);
        if (response.ok) {
          const data = await response.json();
          setGlobalResetTime(data.global_reset_time || '19:00');
        }
      } catch (error) {
        console.error('Error loading global reset time:', error);
        // Keep default fallback
      }
    };

    loadGlobalResetTime();
  }, []);

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

  // Update timer based on current shop's restock interval
  useEffect(() => {
    if (!currentSubTabData) {
      setTimeLeft(0);
      setCurrentShopRestockInterval(null);
      return;
    }

    const shop = shopData.find(s => s.code === currentSubTabData.value);
    if (shop) {
      const newRestockInterval = shop.shop_restock_interval;
      
      // Only update if the restock interval actually changed
      if (newRestockInterval !== currentShopRestockInterval) {
        setCurrentShopRestockInterval(newRestockInterval);
        
        if (newRestockInterval && newRestockInterval !== 'none') {
          // Calculate time until next global reset
          const initialTimeLeft = calculateTimeUntilRestock(newRestockInterval, null);
          setTimeLeft(initialTimeLeft);
        } else {
          setTimeLeft(0);
        }
      }
    }
  }, [currentSubTabData?.value, currentShopRestockInterval]); // Remove shopData from dependencies

  // Timer countdown effect
  useEffect(() => {
    if (!currentShopRestockInterval || currentShopRestockInterval === 'none' || timeLeft <= 0) {
      return;
    }

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
  }, [currentShopRestockInterval, timeLeft]);

  const loadShopData = async () => {
    // Check if user and token exist before making API calls
    if (!user || !user.token) {
      console.warn('User or token not available, skipping shop data load');
      setShopData([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      // Ensure data is always an array
      setShopData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading shop data:', error);
      setShopData([]);
    }
  };

  const loadShopItems = async (shopCode) => {
    // Check if user and token exist before making API calls
    if (!user || !user.token) {
      console.warn('User or token not available, skipping API call');
      setShopItems([]);
      return;
    }

    // Prevent duplicate API calls
    if (isLoadingItems) {
      return;
    }

    setIsLoadingItems(true);
    try {
      // Try the correct API endpoint first
      const response = await fetch(`${API_BASE_URL}/api/admin/shop/${shopCode}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      
      if (!response.ok) {
        // If admin endpoint fails, try regular endpoint
        const regularResponse = await fetch(`${API_BASE_URL}/api/shop/${shopCode}`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        
        if (regularResponse.ok) {
          const data = await regularResponse.json();
          setShopItems(Array.isArray(data) ? data : []);
          return;
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      // Ensure data is always an array
      setShopItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn(`Failed to load shop items for ${shopCode}:`, error.message);
      // Fallback data for testing
      const fallbackItems = getFallbackItems(shopCode);
      setShopItems(fallbackItems);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // No fallback data - let admin add items via interface
  const getFallbackItems = (shopCode) => {
    // Return empty array - admin will add items via AdminShopPage
    return [];
  };

  // Tab handlers
  const handleMainTabChange = (tabIndex) => {
    setCurrentMainTab(tabIndex);
    setCurrentSubTab(0);
  };

  const handleSubTabChange = (index) => {
    setCurrentSubTab(index);
  };

  // Item handlers
  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsEditItemModalOpen(true);
  };

  const handleAddItemClick = () => {
    setIsAddItemModalOpen(true);
  };

  const handleAddShopClick = () => {
    setIsAddShopModalOpen(true);
  };

  const handleSetRestockClick = () => {
    if (currentSubTabData) {
      const shop = shopData.find(s => s.code === currentSubTabData.value);
      setSelectedShop(shop);
      setIsSetRestockModalOpen(true);
    }
  };

  // Modal handlers
  const handleCloseModals = () => {
    setIsAddItemModalOpen(false);
    setIsAddShopModalOpen(false);
    setIsEditItemModalOpen(false);
    setIsSetRestockModalOpen(false);
    setSelectedItem(null);
    setSelectedShop(null);
  };

  const handleItemAdded = () => {
    if (currentSubTabData) {
      loadShopItems(currentSubTabData.value);
    }
    setIsAddItemModalOpen(false);
  };

  const handleItemUpdated = () => {
    if (currentSubTabData) {
      loadShopItems(currentSubTabData.value);
    }
    setIsEditItemModalOpen(false);
    setSelectedItem(null);
  };

  const handleRestockUpdated = () => {
    loadShopData(); // Reload shop data to get updated restock interval
    setIsSetRestockModalOpen(false);
    setSelectedShop(null);
  };

  const handleShopAdded = () => {
    loadShopData();
    setIsAddShopModalOpen(false);
  };

  // Navigation handler
  const handleBackToAdmin = () => {
    navigate('/admin');
  };

  // Filter items for current sub-tab
  const filteredShopItems = (Array.isArray(shopItems) ? shopItems : []).filter(item => {
    if (!currentSubTabData) return false;
    return item.shop_code === currentSubTabData.value;
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !user.isAdmin) {
    return <div>Access denied</div>;
  }

  return (
    <>
      {/* Back to Admin Button */}
      <div className="admin-page-header">
        <button className="back-admin-btn" onClick={handleBackToAdmin}>
          ← Quay lại Admin
        </button>
      </div>
      
      <TemplatePage
        tabs={mainTabsForTemplate}
        showSearch={false}
        currentTab={currentMainTab}
      >
        <div className='shop-page-container'>
          <div className='shop-layout'>
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
                {/* Add Shop Button */}
                <button
                  className='shop-sub-nav-item add-shop-btn'
                  onClick={handleAddShopClick}
                  title="Thêm shop mới"
                >
                  <span className="add-icon">+</span>
                </button>
              </div>
            )}
            <div className='shop-items-container'>
              {/* Timer and Restock Management */}
              <div className='shop-timer-section'>
                {/* Timer - Only show if shop has restock interval */}
                {currentShopRestockInterval && currentShopRestockInterval !== 'none' && (
                  <div className='shop-timer'>
                    <span className='timer-icon'>⏰</span>
                    <span>{formatTime(timeLeft)}</span>
                  </div>
                )}
                {currentSubTabData && (
                  <button 
                    className='set-restock-btn'
                    onClick={handleSetRestockClick}
                    title="Set shop restock interval"
                  >
                    <span className='restock-icon'>🔄</span>
                    <span>Set Restock</span>
                  </button>
                )}
              </div>
              <div className='shop-items-grid'>
                <div className='item-list-container'>
                  {filteredShopItems.length > 0 ? (
                    <>
                      {filteredShopItems.map((item, index) => (
                        <ShopItemCard
                          key={`${item.id}-${index}`}
                          stock={item.stock_limit}
                          item={item}
                          currency={item.currency_type}
                          price={item.custom_price || item.price}
                          onItemClick={handleItemClick}
                          isAdmin={true}
                        />
                      ))}
                      {/* Add Item Button */}
                      <div
                        className='item-list-detail add-item-btn'
                        onClick={handleAddItemClick}
                        title="Thêm item mới"
                      >
                        <div className="item-body">
                          <div className="add-item-icon">+</div>
                        </div>
                        <div className="item-price-section">
                          <span className="add-item-text">Thêm Item</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Empty State Message */}
                      <div className='empty-shop-message'>
                        <div className="empty-icon">📦</div>
                        <h3>Chưa có vật phẩm nào</h3>
                        <p>Hãy thêm vật phẩm đầu tiên vào shop này</p>
                        <button 
                          className="btn-primary"
                          onClick={handleAddItemClick}
                        >
                          + Thêm Item đầu tiên
                        </button>
                      </div>
                      {/* Add Item Button */}
                      <div
                        className='item-list-detail add-item-btn'
                        onClick={handleAddItemClick}
                        title="Thêm item mới"
                      >
                        <div className="item-body">
                          <div className="add-item-icon">+</div>
                        </div>
                        <div className="item-price-section">
                          <span className="add-item-text">Thêm Item</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </TemplatePage>

      {/* Modals */}
      {isAddItemModalOpen && (
        <AdminAddItemModal
          shopCode={currentSubTabData?.value}
          shopName={currentSubTabData?.label}
          onClose={handleCloseModals}
          onItemAdded={handleItemAdded}
        />
      )}

      {isAddShopModalOpen && (
        <AdminAddShopModal
          parentCategory={currentMainTab}
          onClose={handleCloseModals}
          onShopAdded={handleShopAdded}
        />
      )}

      {isEditItemModalOpen && selectedItem && (
        <AdminEditItemModal
          item={selectedItem}
          onClose={handleCloseModals}
          onItemUpdated={handleItemUpdated}
        />
      )}
      {isSetRestockModalOpen && selectedShop && (
        <AdminSetShopRestockModal
          shop={selectedShop}
          onClose={handleCloseModals}
          onRestockUpdated={handleRestockUpdated}
        />
      )}
    </>
  );
}

export default AdminShopPage;
