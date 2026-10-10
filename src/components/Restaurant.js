// Restaurant.js - Nhà hàng: Bình Dân miễn phí 2 lần/ngày, sau đó 2.000 Peta/thú
import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../UserContext';
import TemplatePage from './template/TemplatePage';
import './css/Restaurant.css';
import { useChapter0 } from './story/Chapter0/Chapter0Context';

const MENUS = [
  { id: 'normal', label: 'Bình Dân', name: 'Menu Bình Dân' },
  { id: 'signature', label: 'Signature', name: 'Menu Signature' },
  { id: 'premium', label: 'Premium', name: 'Menu Premium' },
];

function formatPeta(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function Restaurant() {
  const { user, isLoading } = useUser();
  const { postEvent, story } = useChapter0();
  const [loadingMenu, setLoadingMenu] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const storyNeedsNormal = story?.guidance?.lock === 'restaurant-normal';

  const fetchStatus = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/restaurant/status`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch (_) {}
  }, [API_BASE_URL, user?.token]);

  useEffect(() => {
    if (user?.token && !isLoading) fetchStatus();
  }, [user?.token, isLoading, fetchStatus]);

  const handleFeed = async (menuId) => {
    if (!user?.token || menuId !== 'normal') return;
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
        setResult({ success: true, message: data.message });
        void postEvent({ type: 'RESTAURANT_FED' });
        await fetchStatus();
      } else {
        setResult({ success: false, message: data.error || 'Có lỗi xảy ra.' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Lỗi kết nối. Thử lại sau.' });
    } finally {
      setLoadingMenu(null);
    }
  };

  const normal = status?.normal;
  const freeLeft = normal?.freeLeft ?? 2;
  const isFree = freeLeft > 0;
  const nextCost = normal?.nextCost ?? 0;
  const peta = status?.peta;
  const canAfford = isFree || peta == null || peta >= nextCost;

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
            <h2>Cần đăng nhập</h2>
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
          <p className="restaurant-balance">
            Số dư: <strong>{peta == null ? '—' : `${formatPeta(peta)} Peta`}</strong>
          </p>
          {result && (
            <div className={`restaurant-result ${result.success ? 'success' : 'error'}`}>
              {result.message}
            </div>
          )}
          <div className="restaurant-cards">
            {MENUS.map((menu) => {
              const isNormal = menu.id === 'normal';
              const costText = !isNormal
                ? 'Sắp mở'
                : isFree
                  ? `Miễn phí · còn ${freeLeft}/2 lượt hôm nay`
                  : `${formatPeta(2000)} Peta / thú`;
              const detail = !isNormal
                ? 'Giá menu này sẽ được tính sau.'
                : isFree
                  ? 'Hai lần đầu trong ngày không tốn Peta. Thú cưng được ăn no.'
                  : `Hết lượt miễn phí. ${status?.petCount || 0} thú = ${formatPeta(nextCost)} Peta.`;
              const disabled = !isNormal || !!loadingMenu || (!storyNeedsNormal && !canAfford);
              return (
                <div key={menu.id} className="restaurant-card">
                  <h3 className="restaurant-card-title">{menu.name}</h3>
                  <p className="restaurant-card-cost">{costText}</p>
                  <p className="restaurant-card-status">{detail}</p>
                  <button
                    type="button"
                    className="restaurant-card-btn"
                    data-story-target={isNormal ? 'restaurant-normal' : undefined}
                    disabled={disabled}
                    onClick={() => handleFeed(menu.id)}
                  >
                    {loadingMenu === menu.id ? 'Đang xử lý...' : menu.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TemplatePage>
  );
}

export default Restaurant;
