import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import { getAuctionDisplay } from '../../utils/auctionDisplay';
import './MyAuctionsPage.css';

const PLACEHOLDER = '/images/default-item.png';

function formatTimeLeft(endTime) {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;
  if (diff <= 0) return 'Đã kết thúc';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} phút`;
  return '<1 phút';
}

function bidCurLabel(auction) {
  return String(auction.bid_currency || 'peta').toLowerCase() === 'petagold' ? 'PetaGold' : 'Peta';
}

const MyAuctionsPage = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState([]);
  const [bidding, setBidding] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError('');
    const base = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    try {
      const r = await fetch(`${base}/api/auctions/me`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.message || 'Không tải được dữ liệu');
        setSelling([]);
        setBidding([]);
        return;
      }
      setSelling(Array.isArray(data.selling) ? data.selling : []);
      setBidding(Array.isArray(data.bidding) ? data.bidding : []);
    } catch (e) {
      console.error(e);
      setError('Lỗi kết nối');
      setSelling([]);
      setBidding([]);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    load();
  }, [user, isLoading, navigate, load]);

  const renderCard = (auction) => {
    const display = getAuctionDisplay(auction);
    const cur = bidCurLabel(auction);
    const current = Math.floor(auction.current_bid).toLocaleString('vi-VN');
    const mine =
      auction.my_max_bid != null ? Math.floor(auction.my_max_bid).toLocaleString('vi-VN') : null;
    const uid = Number(user?.userId);
    const highId =
      auction.highest_bidder_id != null && auction.highest_bidder_id !== ''
        ? Number(auction.highest_bidder_id)
        : null;
    const isOutbid =
      Number.isFinite(uid) && highId != null && Number.isFinite(highId) && highId !== uid;
    return (
      <button
        type="button"
        key={`bid-${auction.id}`}
        className={`my-auctions-card${isOutbid ? ' my-auctions-card--outbid' : ''}`}
        onClick={() => navigate(`/auction/${auction.id}`)}
      >
        <img
          src={display.image}
          alt=""
          className="my-auctions-card-img"
          onError={(e) => {
            e.target.src = PLACEHOLDER;
          }}
        />
        <div className="my-auctions-card-main">
          <div className="my-auctions-card-name">{display.name}</div>
          <div className="my-auctions-card-meta">
            <div className="my-auctions-card-meta-row my-auctions-card-meta-row--prices">
              <span className="my-auctions-meta-pill">
                <span className="my-auctions-meta-pill-label">Sàn</span>
                <span className="my-auctions-meta-pill-value">
                  {current} <span className="my-auctions-meta-cur">{cur}</span>
                </span>
              </span>
              {mine != null ? (
                <span className="my-auctions-meta-pill my-auctions-meta-pill--you">
                  <span className="my-auctions-meta-pill-label">Bạn</span>
                  <span className="my-auctions-meta-pill-value">
                    {mine} <span className="my-auctions-meta-cur">{cur}</span>
                  </span>
                </span>
              ) : null}
            </div>
            <div className="my-auctions-card-meta-row my-auctions-card-meta-row--footer">
              <span className="my-auctions-meta-time">{formatTimeLeft(auction.end_time)}</span>
            </div>
          </div>
        </div>
        {isOutbid ? (
          <div className="my-auctions-outbid-overlay" aria-hidden="true">
            <span className="my-auctions-outbid-label">Đã có người bid cao hơn</span>
          </div>
        ) : null}
      </button>
    );
  };

  const renderSellingCard = (auction) => {
    const display = getAuctionDisplay(auction);
    const cur = bidCurLabel(auction);
    const current = Math.floor(auction.current_bid).toLocaleString('vi-VN');
    return (
      <button
        type="button"
        key={`sell-${auction.id}`}
        className="my-auctions-card"
        onClick={() => navigate(`/auction/${auction.id}`)}
      >
        <img
          src={display.image}
          alt=""
          className="my-auctions-card-img"
          onError={(e) => {
            e.target.src = PLACEHOLDER;
          }}
        />
        <div className="my-auctions-card-main">
          <div className="my-auctions-card-name">{display.name}</div>
          <div className="my-auctions-card-meta">
            <div className="my-auctions-card-meta-row my-auctions-card-meta-row--prices">
              <span className="my-auctions-meta-pill my-auctions-meta-pill--wide">
                <span className="my-auctions-meta-pill-label">Giá hiện tại</span>
                <span className="my-auctions-meta-pill-value">
                  {current} <span className="my-auctions-meta-cur">{cur}</span>
                </span>
              </span>
            </div>
            <div className="my-auctions-card-meta-row my-auctions-card-meta-row--footer">
              <span className="my-auctions-meta-time">{formatTimeLeft(auction.end_time)}</span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="page-container my-auctions-page">
        <div className="my-auctions-header">
          <h1 className="my-auctions-title">Đấu giá của tôi</h1>
          <button type="button" className="my-auctions-back" onClick={() => navigate('/auction')}>
            ← Về sàn đấu giá
          </button>
        </div>

        {error ? <p className="my-auctions-msg error">{error}</p> : null}

        {isLoading || loading ? (
          <div className="my-auctions-empty">Đang tải…</div>
        ) : (
          <div className="my-auctions-grid">
            <section className="my-auctions-column">
              <div className="my-auctions-column-head">Đang đặt giá</div>
              <div className="my-auctions-column-body">
                {bidding.length === 0 ? (
                  <div className="my-auctions-empty">Chưa có vật phẩm nào</div>
                ) : (
                  bidding.map((a) => renderCard(a))
                )}
              </div>
            </section>

            <section className="my-auctions-column">
              <div className="my-auctions-column-head">Đang đăng bán</div>
              <div className="my-auctions-column-body">
                {selling.length === 0 ? (
                  <div className="my-auctions-empty">Chưa có vật phẩm nào</div>
                ) : (
                  selling.map((a) => renderSellingCard(a))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </TemplatePage>
  );
};

export default MyAuctionsPage;
