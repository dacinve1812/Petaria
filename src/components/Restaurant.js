// Restaurant.js - Nhà hàng: cho thú cưng ăn (hồi hunger_status), theo cấu trúc MainLayout + TemplatePage
import React, { useState, useEffect } from 'react';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import './css/Restaurant.css';

const MENUS = [
  { id: 'normal', label: 'Bình Dân', name: 'Menu Bình Dân' },
  { id: 'signature', label: 'Signature', name: 'Menu Signature' },
  { id: 'premium', label: 'Premium', name: 'Menu Premium' },
];

const COST_PETA = 1;

function Restaurant() {
  const { user, isLoading } = useUser();
  const [loadingMenu, setLoadingMenu] = useState(null);
  const [result, setResult] = useState(null);
  const [petaBalance, setPetaBalance] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

  const fetchProfile = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPetaBalance(data.peta != null ? data.peta : null);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (user?.token && !isLoading) fetchProfile();
  }, [user?.token, isLoading]);

  const handleFeed = async (menuId) => {
    if (!user?.token) return;
    setResult(null);
    setLoadingMenu(menuId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/restaurant/feed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ menuType: menuId }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message, petaRemaining: data.petaRemaining });
        if (data.petaRemaining != null) setPetaBalance(data.petaRemaining);
      } else {
        setResult({ success: false, message: data.error || 'Có lỗi xảy ra.' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Lỗi kết nối. Thử lại sau.' });
    } finally {
      setLoadingMenu(null);
    }
  };

  const hasPeta = petaBalance != null ? petaBalance >= COST_PETA : true;

  if (isLoading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="restaurant-page">
          <div className="restaurant-loading">Đang tải...</div>
        </div>
      </TemplatePage>
    );
  }

  if (!user) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="restaurant-page">
          <div className="restaurant-error">
            <h2>🔒 Cần đăng nhập</h2>
            <p>Bạn cần đăng nhập để sử dụng Nhà hàng.</p>
          </div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="restaurant-page">
        <div className="restaurant-background" aria-hidden="true" />
        <div className="restaurant-content">
          {petaBalance != null && (
            <p className="restaurant-balance">Số dư: <strong>{petaBalance} Peta</strong></p>
          )}
          {result && (
            <div className={`restaurant-result ${result.success ? 'success' : 'error'}`}>
              {result.success ? '✨' : '❌'} {result.message}
            </div>
          )}
          <div className="restaurant-cards">
            {MENUS.map((menu) => (
              <div key={menu.id} className="restaurant-card">
                <h3 className="restaurant-card-title">{menu.name}</h3>
                <p className="restaurant-card-cost">{COST_PETA} Peta</p>
                <p className="restaurant-card-status">
                  {hasPeta
                    ? 'Dùng 1 Peta để cho tất cả thú cưng ăn no (trạng thái mập mạp).'
                    : 'Bạn không đủ Peta.'}
                </p>
                <button
                  type="button"
                  className="restaurant-card-btn"
                  disabled={!hasPeta || !!loadingMenu}
                  onClick={() => handleFeed(menu.id)}
                >
                  {loadingMenu === menu.id ? 'Đang xử lý...' : menu.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default Restaurant;
