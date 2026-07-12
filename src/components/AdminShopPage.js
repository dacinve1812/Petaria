// File: AdminShopPage.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import ShopItemCard from './ShopItemCard';
import AdminAddItemModal from './admin/AdminAddItemModal';
import AdminAddShopModal from './admin/AdminAddShopModal';
import AdminEditItemModal from './admin/AdminEditItemModal';
import AdminEditShopModal from './admin/AdminEditShopModal';
import AdminSetShopRestockModal from './admin/AdminSetShopRestockModal';
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
  { label: 'Chung', value: 'general', path: '/admin/edit-shop-items/general' },
  {
    label: 'Đổi thưởng',
    value: 'exchange',
    path: '/admin/edit-shop-items/exchange/peta',
    fallbackSubTabs: EXCHANGE_SUB_SHOPS,
  },
  {
    label: 'Cao cấp',
    value: 'premium',
    path: '/admin/edit-shop-items/premium/monthly',
    fallbackSubTabs: PREMIUM_SUB_SHOPS,
  },
];

function AdminShopPage() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const { category: rawCategory, shopCode: rawShopCode } = useParams();

  const category = String(rawCategory || 'general').toLowerCase();
  const shopCode = rawShopCode ? String(rawShopCode).toLowerCase() : null;

  const [shopData, setShopData] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAddShopModalOpen, setIsAddShopModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isEditShopModalOpen, setIsEditShopModalOpen] = useState(false);
  const [isSetRestockModalOpen, setIsSetRestockModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentShopRestockInterval, setCurrentShopRestockInterval] = useState(null);
  const [globalResetTime, setGlobalResetTime] = useState('19:00');
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [imgErrors, setImgErrors] = useState({});

  const currentMainTab = Math.max(0, CATEGORY_TABS.findIndex((t) => t.value === category));
  const currentCategory = CATEGORY_TABS[currentMainTab] || CATEGORY_TABS[0];
  const isGeneral = category === 'general';
  const isGeneralGrid = isGeneral && !shopCode;
  const isGeneralShop = isGeneral && Boolean(shopCode);

  const generalShops = useMemo(() => listGeneralShops(shopData), [shopData]);

  const subTabs = useMemo(() => {
    if (category === 'exchange') {
      return listCategorySubTabs(shopData, 'exchange', EXCHANGE_SUB_SHOPS);
    }
    if (category === 'premium') {
      return listCategorySubTabs(shopData, 'premium', PREMIUM_SUB_SHOPS);
    }
    return [];
  }, [category, shopData]);

  const activeGeneralShop = useMemo(() => {
    if (!isGeneralShop) return null;
    return (
      generalShops.find((s) => String(s.code).toLowerCase() === shopCode) ||
      shopData.find((s) => String(s.code).toLowerCase() === shopCode) ||
      null
    );
  }, [isGeneralShop, generalShops, shopData, shopCode]);

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

  // Nếu shop đang mở đã bị xóa / không còn trong tab → chuyển sang tab đầu
  useEffect(() => {
    if (category !== 'exchange' && category !== 'premium') return;
    if (!shopData.length) return;
    if (!shopCode) {
      if (subTabs[0]?.value) {
        navigate(`/admin/edit-shop-items/${category}/${subTabs[0].value}`, { replace: true });
      }
      return;
    }
    const stillExists = subTabs.some((t) => t.value === shopCode);
    if (!stillExists) {
      const next = subTabs[0]?.value;
      navigate(
        next
          ? `/admin/edit-shop-items/${category}/${next}`
          : `/admin/edit-shop-items/${category}`,
        { replace: true }
      );
    }
  }, [category, shopCode, subTabs, shopData.length, navigate]);

  useEffect(() => {
    if (!rawCategory) {
      navigate('/admin/edit-shop-items/general', { replace: true });
    }
  }, [rawCategory, navigate]);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !user.isAdmin) {
      window.location.href = '/login';
      return;
    }
    loadShopData();
  }, [user, isLoading]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/global-reset-time`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.global_reset_time) setGlobalResetTime(data.global_reset_time);
      })
      .catch(() => {});
  }, [API_BASE_URL]);

  const loadShopData = async () => {
    if (!user?.token) {
      setShopData([]);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setShopData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading shop data:', error);
      setShopData([]);
    }
  };

  const loadShopItems = useCallback(
    async (code) => {
      if (!user?.token || !code || isLoadingItems) return;
      setIsLoadingItems(true);
      try {
        let response = await fetch(`${API_BASE_URL}/api/admin/shop/${code}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!response.ok) {
          response = await fetch(`${API_BASE_URL}/api/shop/${code}`, {
            headers: { Authorization: `Bearer ${user.token}` },
          });
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setShopItems(Array.isArray(data) ? data : []);
      } catch (error) {
        console.warn(`Failed to load shop items for ${code}:`, error.message);
        setShopItems([]);
      } finally {
        setIsLoadingItems(false);
      }
    },
    [API_BASE_URL, user?.token, isLoadingItems]
  );

  useEffect(() => {
    if (!user?.token || isLoading) return;
    if (isGeneralGrid) {
      setShopItems([]);
      setCurrentShopRestockInterval(null);
      return;
    }
    if (!activeShopCode) return;
    const shop = shopData.find((s) => s.code === activeShopCode);
    setCurrentShopRestockInterval(shop?.shop_restock_interval || null);
    loadShopItems(activeShopCode);
  }, [activeShopCode, user?.token, isLoading, shopData, isGeneralGrid]);

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
    if (!currentShopRestockInterval || currentShopRestockInterval === 'none') {
      setTimeLeft(0);
      return;
    }
    setTimeLeft(calculateTimeUntilRestock(currentShopRestockInterval));
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return calculateTimeUntilRestock(currentShopRestockInterval);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentShopRestockInterval, calculateTimeUntilRestock]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const mainTabsForTemplate = useMemo(() => {
    const exchangeFirst =
      listCategorySubTabs(shopData, 'exchange', EXCHANGE_SUB_SHOPS)[0]?.value || 'peta';
    const premiumFirst =
      listCategorySubTabs(shopData, 'premium', PREMIUM_SUB_SHOPS)[0]?.value || 'monthly';

    return CATEGORY_TABS.map((tab) => {
      let path = tab.path;
      if (tab.value === 'exchange') path = `/admin/edit-shop-items/exchange/${exchangeFirst}`;
      if (tab.value === 'premium') path = `/admin/edit-shop-items/premium/${premiumFirst}`;
      return {
        label: tab.value === 'general' && isGeneralShop ? `< ${tab.label}` : tab.label,
        value: tab.value,
        onClick: () => {
          if (tab.value === 'general' && isGeneralShop) {
            navigate('/admin/edit-shop-items/general');
            return;
          }
          navigate(path);
        },
      };
    });
  }, [isGeneralShop, navigate, shopData]);

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsEditItemModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddItemModalOpen(false);
    setIsAddShopModalOpen(false);
    setIsEditItemModalOpen(false);
    setIsEditShopModalOpen(false);
    setIsSetRestockModalOpen(false);
    setSelectedItem(null);
    setSelectedShop(null);
  };

  const handleItemAdded = () => {
    if (activeShopCode) loadShopItems(activeShopCode);
    setIsAddItemModalOpen(false);
  };

  const handleItemUpdated = () => {
    if (activeShopCode) loadShopItems(activeShopCode);
    setIsEditItemModalOpen(false);
    setSelectedItem(null);
  };

  const handleRestockUpdated = () => {
    loadShopData();
    setIsSetRestockModalOpen(false);
    setSelectedShop(null);
  };

  const handleShopAdded = () => {
    loadShopData();
    setIsAddShopModalOpen(false);
  };

  const handleShopUpdated = () => {
    loadShopData();
    setIsEditShopModalOpen(false);
    setSelectedShop(null);
  };

  const handleShopDeleted = (deletedShop) => {
    loadShopData();
    setIsEditShopModalOpen(false);
    setSelectedShop(null);
    const deletedCode = String(deletedShop?.code || '').toLowerCase();
    const deletedParent = String(deletedShop?.parent_category || category || '').toLowerCase();

    if (deletedParent === 'general') {
      if (shopCode && deletedCode === String(shopCode).toLowerCase()) {
        navigate('/admin/edit-shop-items/general');
      }
      return;
    }

    if (deletedParent === 'exchange' || deletedParent === 'premium') {
      const remaining = listCategorySubTabs(
        (shopData || []).filter(
          (s) =>
            Number(s.is_active) !== 0 &&
            String(s.code).toLowerCase() !== deletedCode
        ),
        deletedParent,
        []
      );
      const next = remaining[0]?.value;
      navigate(
        next
          ? `/admin/edit-shop-items/${deletedParent}/${next}`
          : `/admin/edit-shop-items/${deletedParent}`
      );
    }
  };

  const openEditShop = (shop, e) => {
    e?.stopPropagation?.();
    if (!shop?.id) {
      alert('Shop chưa có trong DB. Reload trang hoặc restart backend để seed.');
      return;
    }
    setSelectedShop(shop);
    setIsEditShopModalOpen(true);
  };

  const resolveShopForTab = (subTab) => {
    if (subTab?.shop?.id) return subTab.shop;
    return shopData.find((s) => String(s.code).toLowerCase() === String(subTab?.value || '').toLowerCase());
  };

  const handleDeleteShopQuick = async (shop, e) => {
    e?.stopPropagation?.();
    if (!shop?.id) {
      alert('Shop chưa có trong DB. Restart backend để seed shop này.');
      return;
    }
    const ok = window.confirm(
      `Xóa cửa hàng "${shop.name || shop.code}"?\nToàn bộ item trong shop cũng sẽ bị xóa.`
    );
    if (!ok) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/${shop.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        alert(`Lỗi: ${error.error || error.message || 'Không thể xóa shop'}`);
        return;
      }
      handleShopDeleted({ ...shop, parent_category: shop.parent_category || category });
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa shop');
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!user || !user.isAdmin) return <div>Access denied</div>;

  const showItemPanel = !isGeneralGrid && activeShopCode;

  return (
    <>
      <div className="admin-page-header">
        <button type="button" className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      <TemplatePage tabs={mainTabsForTemplate} showSearch={false} currentTab={currentMainTab}>
        <div className="shop-page-container">
          {isGeneralGrid ? (
            <div className="my-stuff-management shop-general-picker">
              <div className="management-main">
                <div className="management-grid">
                  {generalShops.map((shop) => {
                    const code = String(shop.code).toLowerCase();
                    const imgSrc = resolveShopImage(shop);
                    return (
                      <div
                        key={code}
                        className="management-item shop-admin-grid-item"
                        onClick={() => navigate(`/admin/edit-shop-items/general/${code}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigate(`/admin/edit-shop-items/general/${code}`);
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
                        <button
                          type="button"
                          className="shop-edit-fab"
                          title="Sửa ảnh / thông tin shop"
                          onClick={(e) => openEditShop(shop, e)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="shop-delete-fab"
                          title="Xóa cửa hàng"
                          onClick={(e) => handleDeleteShopQuick(shop, e)}
                        >
                          🗑
                        </button>
                      </div>
                    );
                  })}
                  <div
                    className="management-item shop-admin-add-tile"
                    onClick={() => setIsAddShopModalOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setIsAddShopModalOpen(true);
                    }}
                  >
                    <div className="management-item-image shop-add-tile-inner">
                      <span>+</span>
                      <small>Thêm cửa hàng</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="shop-layout">
              {!isGeneral && (
                <div className="shop-sub-nav">
                  {subTabs.map((subTab, index) => (
                    <div
                      key={subTab.value}
                      className={`shop-sub-nav-item-wrap ${currentSubTabIndex === index ? 'active' : ''}`}
                    >
                      <button
                        type="button"
                        className={`shop-sub-nav-item ${currentSubTabIndex === index ? 'active' : ''}`}
                        onClick={() =>
                          navigate(`/admin/edit-shop-items/${category}/${subTab.value}`)
                        }
                      >
                        {subTab.label}
                      </button>
                      <button
                        type="button"
                        className="shop-sub-tab-delete"
                        title={`Xóa shop ${subTab.label}`}
                        onClick={(e) => handleDeleteShopQuick(resolveShopForTab(subTab), e)}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="shop-sub-nav-item add-shop-btn"
                    onClick={() => setIsAddShopModalOpen(true)}
                    title="Thêm shop mới"
                  >
                    <span className="add-icon">+</span>
                  </button>
                </div>
              )}

              <div className="shop-items-container">
                {isGeneralShop && activeGeneralShop && (
                  <div className="general-shop-banner general-shop-banner--admin">
                    <div>
                      <h2>{activeGeneralShop.name}</h2>
                      {activeGeneralShop.description ? (
                        <p>{activeGeneralShop.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="edit-shop-btn"
                      onClick={() => openEditShop(activeGeneralShop)}
                    >
                      Sửa shop / ảnh
                    </button>
                  </div>
                )}

                <div className="shop-timer-section">
                  {currentShopRestockInterval && currentShopRestockInterval !== 'none' && (
                    <div className="shop-timer">
                      <span className="timer-icon">⏰</span>
                      <span>{formatTime(timeLeft)}</span>
                    </div>
                  )}
                  {showItemPanel && (
                    <button
                      type="button"
                      className="set-restock-btn"
                      onClick={() => {
                        const shop = shopData.find((s) => s.code === activeShopCode);
                        setSelectedShop(shop || { code: activeShopCode });
                        setIsSetRestockModalOpen(true);
                      }}
                      title="Set shop restock interval"
                    >
                      <span className="restock-icon">🔄</span>
                      <span>Set Restock</span>
                    </button>
                  )}
                </div>

                <div className="shop-items-grid">
                  <div className="item-list-container">
                    {(Array.isArray(shopItems) ? shopItems : []).map((item, index) => (
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
                    {showItemPanel && (
                      <div
                        className="item-list-detail add-item-btn"
                        onClick={() => setIsAddItemModalOpen(true)}
                        title="Thêm item mới"
                      >
                        <div className="item-body">
                          <div className="add-item-icon">+</div>
                        </div>
                        <div className="item-price-section">
                          <span className="add-item-text">Thêm Item</span>
                        </div>
                      </div>
                    )}
                    {!isLoadingItems && shopItems.length === 0 && showItemPanel && (
                      <div className="empty-shop-message">
                        <div className="empty-icon">📦</div>
                        <h3>Chưa có vật phẩm nào</h3>
                        <p>Hãy thêm vật phẩm đầu tiên vào shop này</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </TemplatePage>

      {isAddItemModalOpen && (
        <AdminAddItemModal
          shopCode={activeShopCode}
          onClose={handleCloseModals}
          onItemAdded={handleItemAdded}
        />
      )}
      {isAddShopModalOpen && (
        <AdminAddShopModal
          parentCategory={category}
          onClose={handleCloseModals}
          onShopAdded={handleShopAdded}
        />
      )}
      {isEditShopModalOpen && selectedShop && (
        <AdminEditShopModal
          shop={selectedShop}
          onClose={handleCloseModals}
          onShopUpdated={handleShopUpdated}
          onShopDeleted={handleShopDeleted}
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
