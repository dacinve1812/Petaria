// File: ShopPage.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../UserContext';
import ShopItemList from './ShopItemList';
import ItemDetailModal from './items/ItemDetailModal';
import TemplatePage from './template/TemplatePage';
import GameAlertModal from './ui/GameAlertModal';
import {
  EXCHANGE_SUB_SHOPS,
  PREMIUM_SUB_SHOPS,
  listGeneralShops,
  listCategorySubTabs,
  resolveShopImage,
} from '../config/generalShops';
import './MyStuffManagement.css';
import './ShopPage.css';

const CATEGORY_TABS = [
  { label: 'Chung', value: 'general', path: '/shop/general' },
  { label: 'Đổi thưởng', value: 'exchange', path: '/shop/exchange/peta' },
  { label: 'Cao cấp', value: 'premium', path: '/shop/premium/monthly' },
];

function ShopPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const { category: rawCategory, shopCode: rawShopCode } = useParams();

  const category = String(rawCategory || 'general').toLowerCase();
  const shopCode = rawShopCode ? String(rawShopCode).toLowerCase() : null;

  const [shops, setShops] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [alertModal, setAlertModal] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentShopRestockInterval, setCurrentShopRestockInterval] = useState(null);
  const [globalResetTime, setGlobalResetTime] = useState('06:00');
  const [imgErrors, setImgErrors] = useState({});
  const loadingRef = useRef(false);

  const currentMainTab = Math.max(
    0,
    CATEGORY_TABS.findIndex((t) => t.value === category)
  );
  const currentCategory = CATEGORY_TABS[currentMainTab] || CATEGORY_TABS[0];
  const isGeneral = category === 'general';
  const isGeneralGrid = isGeneral && !shopCode;
  const isGeneralShop = isGeneral && Boolean(shopCode);

  const generalShops = useMemo(() => listGeneralShops(shops), [shops]);

  const subTabs = useMemo(() => {
    if (category === 'exchange') {
      return listCategorySubTabs(shops, 'exchange', EXCHANGE_SUB_SHOPS);
    }
    if (category === 'premium') {
      return listCategorySubTabs(shops, 'premium', PREMIUM_SUB_SHOPS);
    }
    return [];
  }, [category, shops]);

  const activeGeneralShop = useMemo(() => {
    if (!isGeneralShop) return null;
    return (
      generalShops.find((s) => String(s.code).toLowerCase() === shopCode) ||
      shops.find((s) => String(s.code).toLowerCase() === shopCode) ||
      null
    );
  }, [isGeneralShop, generalShops, shops, shopCode]);

  const activeShopCode = useMemo(() => {
    if (isGeneralShop) return shopCode;
    if (category === 'exchange' || category === 'premium') {
      return shopCode || subTabs[0]?.value || null;
    }
    return null;
  }, [isGeneralShop, shopCode, category, subTabs]);

  const currentSubTabIndex = Math.max(
    0,
    subTabs.findIndex((s) => s.value === activeShopCode)
  );

  useEffect(() => {
    if (category !== 'exchange' && category !== 'premium') return;
    if (!Array.isArray(shops) || !shops.length) return;
    if (!shopCode && subTabs[0]?.value) {
      navigate(`/shop/${category}/${subTabs[0].value}`, { replace: true });
      return;
    }
    if (shopCode && subTabs.length && !subTabs.some((t) => t.value === shopCode)) {
      const next = subTabs[0]?.value;
      navigate(next ? `/shop/${category}/${next}` : `/shop/${category}`, { replace: true });
    }
  }, [category, shopCode, subTabs, shops, navigate]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login');
  }, [navigate, user, isLoading]);

  useEffect(() => {
    if (!rawCategory) {
      navigate('/shop/general', { replace: true });
    }
  }, [rawCategory, navigate]);

  useEffect(() => {
    if (!user?.token) return;
    fetch(`${API_BASE_URL}/api/shops`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then((res) => res.json())
      .then((data) => setShops(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error loading shops:', err));
  }, [API_BASE_URL, user?.token]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/global-reset-time`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.global_reset_time) setGlobalResetTime(data.global_reset_time);
      })
      .catch(() => {});
  }, [API_BASE_URL]);

  const fetchShopItems = useCallback(
    (code) => {
      if (!user?.token || !code || loadingRef.current) return;
      loadingRef.current = true;
      setIsLoadingItems(true);
      fetch(`${API_BASE_URL}/api/shop/${code}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
        .then((res) => res.json())
        .then((data) => setShopItems(Array.isArray(data) ? data : []))
        .catch(() => setShopItems([]))
        .finally(() => {
          loadingRef.current = false;
          setIsLoadingItems(false);
        });
    },
    [API_BASE_URL, user?.token]
  );

  useEffect(() => {
    if (!user?.token) return;
    if (isGeneralGrid) {
      setShopItems([]);
      setCurrentShopRestockInterval(null);
      return;
    }
    if (!activeShopCode) return;
    const shop = shops.find((s) => s.code === activeShopCode);
    setCurrentShopRestockInterval(shop?.shop_restock_interval || null);
    fetchShopItems(activeShopCode);
  }, [activeShopCode, user?.token, shops, isGeneralGrid, fetchShopItems]);

  const calculateTimeUntilRestock = useCallback(
    (cycle) => {
      if (!cycle || cycle === 'none') return 0;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const [resetHour, resetMinute] = globalResetTime.split(':').map(Number);
      const todayResetTime = new Date(today.getTime() + resetHour * 3600000 + resetMinute * 60000);
      let next;
      if (cycle === 'daily') {
        next =
          now >= todayResetTime
            ? new Date(todayResetTime.getTime() + 24 * 3600000)
            : todayResetTime;
      } else if (cycle === 'weekly') {
        const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
        const nextSunday = new Date(today.getTime() + daysUntilSunday * 24 * 3600000);
        next = new Date(nextSunday.getTime() + resetHour * 3600000 + resetMinute * 60000);
      } else if (cycle === 'monthly') {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        next = new Date(nextMonth.getTime() + resetHour * 3600000 + resetMinute * 60000);
      } else return 0;
      return Math.max(0, Math.floor((next - now) / 1000));
    },
    [globalResetTime]
  );

  useEffect(() => {
    if (isGeneralGrid || !currentShopRestockInterval || currentShopRestockInterval === 'none') {
      setTimeLeft(0);
      return;
    }
    setTimeLeft(calculateTimeUntilRestock(currentShopRestockInterval));
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (activeShopCode) fetchShopItems(activeShopCode);
          return calculateTimeUntilRestock(currentShopRestockInterval);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [
    currentShopRestockInterval,
    calculateTimeUntilRestock,
    activeShopCode,
    fetchShopItems,
    isGeneralGrid,
  ]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleBuy = async (item, quantity = 1) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shop/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          shop_item_id: item.id,
          quantity,
          shop_code: activeShopCode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAlertModal({
          title: 'Mua thất bại',
          message: data.message || data.error || 'Không thể mua vật phẩm',
          tone: 'danger',
        });
        return;
      }
      setAlertModal({
        title: 'Mua thành công',
        message: data.message || 'Đã mua vật phẩm',
        tone: 'success',
      });
      setSelectedItem(null);
      fetchShopItems(activeShopCode);
      window.dispatchEvent(new Event('currencyUpdate'));
    } catch (err) {
      setAlertModal({
        title: 'Lỗi',
        message: 'Không thể kết nối máy chủ',
        tone: 'danger',
      });
    }
  };

  const handleMainTabClick = useCallback(
    (tab) => {
      setSelectedItem(null);
      navigate(tab.path);
    },
    [navigate]
  );

  const handleGeneralTabClick = useCallback(() => {
    setSelectedItem(null);
    navigate('/shop/general');
  }, [navigate]);

  const mainTabsForTemplate = useMemo(() => {
    const exchangeFirst =
      listCategorySubTabs(shops, 'exchange', EXCHANGE_SUB_SHOPS)[0]?.value || 'peta';
    const premiumFirst =
      listCategorySubTabs(shops, 'premium', PREMIUM_SUB_SHOPS)[0]?.value || 'monthly';

    return CATEGORY_TABS.map((tab) => {
      let path = tab.path;
      if (tab.value === 'exchange') path = `/shop/exchange/${exchangeFirst}`;
      if (tab.value === 'premium') path = `/shop/premium/${premiumFirst}`;
      return {
        label: tab.value === 'general' && isGeneralShop ? `< ${tab.label}` : tab.label,
        value: tab.value,
        path,
        onClick: () => {
          if (tab.value === 'general' && isGeneralShop) {
            handleGeneralTabClick();
            return;
          }
          handleMainTabClick({ ...tab, path });
        },
      };
    });
  }, [isGeneralShop, handleGeneralTabClick, handleMainTabClick, shops]);

  return (
    <>
      <TemplatePage tabs={mainTabsForTemplate} showSearch={false} currentTab={currentMainTab}>
        <div className="shop-page-container">
          {isGeneralGrid ? (
            <div className="my-stuff-management shop-general-picker">
              <div className="management-main">
                <div className="management-grid">
                  {generalShops.map((shop) => {
                    const imgSrc = resolveShopImage(shop);
                    const code = String(shop.code).toLowerCase();
                    return (
                      <div
                        key={code}
                        className="management-item"
                        onClick={() => navigate(`/shop/general/${code}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigate(`/shop/general/${code}`);
                          }
                        }}
                      >
                        {!imgErrors[code] && imgSrc ? (
                          <img
                            className="management-item-image"
                            src={imgSrc}
                            alt={shop.name || code}
                            onError={() =>
                              setImgErrors((prev) => ({ ...prev, [code]: true }))
                            }
                          />
                        ) : (
                          <div className="management-item-image shop-grid-fallback">
                            {(shop.name || code).slice(0, 1)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="shop-layout">
              {!isGeneral && subTabs.length > 0 && (
                <div className="shop-sub-nav">
                  {subTabs.map((subTab, index) => (
                    <button
                      key={subTab.value}
                      type="button"
                      className={`shop-sub-nav-item ${currentSubTabIndex === index ? 'active' : ''}`}
                      onClick={() => navigate(`/shop/${category}/${subTab.value}`)}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="shop-items-container">
                {isGeneralShop && activeGeneralShop && (
                  <div className="general-shop-banner">
                    <h2>{activeGeneralShop.name}</h2>
                    {activeGeneralShop.description ? (
                      <p>{activeGeneralShop.description}</p>
                    ) : null}
                  </div>
                )}

                {currentShopRestockInterval && currentShopRestockInterval !== 'none' ? (
                  <div className="shop-timer">
                    <span className="timer-icon">⏰</span>
                    <span>{formatTime(timeLeft)}</span>
                  </div>
                ) : null}

                <div className="shop-items-grid">
                  {isLoadingItems ? (
                    <p className="shop-loading">Đang tải…</p>
                  ) : (
                    <ShopItemList
                      items={shopItems}
                      onItemClick={(item) => setSelectedItem(item)}
                      subTabValue={activeShopCode}
                    />
                  )}
                </div>
              </div>
            </div>
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

      {alertModal && (
        <GameAlertModal
          isOpen
          title={alertModal.title || 'Thông báo'}
          message={alertModal.message}
          tone={alertModal.tone || 'default'}
          confirmLabel="OK"
          onClose={() => setAlertModal(null)}
        />
      )}
    </>
  );
}

export default ShopPage;
