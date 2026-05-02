import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import { dispatchCurrencyUpdate } from '../../utils/currencyEvents';
import { getAuctionDisplay } from '../../utils/auctionDisplay';
import TemplatePage from '../template/TemplatePage';
import './AuctionList.css';

const AuctionList = () => {
  const navigate = useNavigate();
  const { user, updateUserData } = useUser();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('end_time');
  const [order, setOrder] = useState('ASC');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [userCurrency, setUserCurrency] = useState({ peta: 0, petagold: 0 });
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
  const [isLoadingAuctions, setIsLoadingAuctions] = useState(false);
  const [assetTypeFilter, setAssetTypeFilter] = useState('all'); // all | item | pet | spirit | currency

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (isLoadingAuctions) return;
    
    setIsLoadingAuctions(true);
    fetchAuctions().finally(() => setIsLoadingAuctions(false));
  }, [debouncedSearchTerm, sortBy, order, currentPage, assetTypeFilter]);

  useEffect(() => {
    if (user?.userId) {
      fetchUserCurrency();
    }
  }, [user?.userId]); // Use specific property instead of user object

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const paramsObj = {
        page: currentPage,
        limit: 20,
        search: debouncedSearchTerm,
        sortBy,
        order
      };
      if (assetTypeFilter && assetTypeFilter !== 'all') paramsObj.asset_type = assetTypeFilter;
      const params = new URLSearchParams(paramsObj);
      
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auctions?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setAuctions(data.auctions);
        setTotalPages(data.pagination.totalPages);
      } else {
        setMessage(data.message || 'Error fetching auctions');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching auctions:', error);
      setMessage('Error fetching auctions');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeLeft = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 1) {
      return `${minutes}m`;
    } else if (minutes === 1) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    // Search will be triggered automatically by debouncedSearchTerm useEffect
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setOrder(order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(newSortBy);
      setOrder('ASC');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const fetchUserCurrency = async (opts = {}) => {
    const { syncCtx = false, notifySidebar = false } = opts;
    if (!user) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userProfile = await response.json();
        const peta = Math.floor(Number(userProfile.peta ?? 0));
        const petagold = Math.floor(Number(userProfile.petagold ?? 0));
        setUserCurrency({ peta, petagold });
        if (syncCtx) updateUserData({ peta, petagold });
        if (notifySidebar) dispatchCurrencyUpdate();
      }
    } catch (error) {
      console.error('Error fetching user currency:', error);
    }
  };

  const handleBuyNow = async (auction) => {
    if (!user) {
      setMessage('Please login to buy this item');
      setMessageType('error');
      return;
    }

    if (!auction.buy_now_price) {
      setMessage('Buy now not available for this auction');
      setMessageType('error');
      return;
    }

    const display = getAuctionDisplay(auction);
    const bidCur = String(auction.bid_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
    if (window.confirm(`Are you sure you want to buy ${display.name} for ${Math.floor(auction.buy_now_price)} ${bidCur}?`)) {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auctions/${auction.id}/buy-now`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          }
        });

        const data = await response.json();
        
        if (response.ok) {
          setMessage('Item purchased successfully!');
          setMessageType('success');
          fetchAuctions(); // Refresh auction list
          await fetchUserCurrency({ syncCtx: true, notifySidebar: true });
        } else {
          setMessage(data.message || 'Error purchasing item');
          setMessageType('error');
        }
      } catch (error) {
        console.error('Error purchasing item:', error);
        setMessage('Error purchasing item');
        setMessageType('error');
      }
    }
  };

  const showTooltip = (e, itemName) => {
    const rect = e.target.getBoundingClientRect();
    setTooltip({
      show: true,
      text: itemName,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const hideTooltip = () => {
    setTooltip({ show: false, text: '', x: 0, y: 0 });
  };

  if (loading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="auction-list-container">
          <div className="auction-loading">Loading auctions...</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
      <div className="auction-list-container">
        {/* Tooltip */}
        {tooltip.show && (
          <div 
            className="auction-item-tooltip show"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translateX(-50%)'
            }}
          >
            {tooltip.text}
          </div>
        )}
        <div className="auction-header">
        <h1 className="auction-title">Auction House</h1>
        <div className="auction-nav">
          <button onClick={() => navigate('/auction/create')} className="auction-nav-link">Create Auction</button>
          <button onClick={() => navigate('/auction/my-auctions')} className="auction-nav-link">My Auctions</button>
        </div>
      </div>

      <div className="auction-asset-tabs">
        <button
          type="button"
          onClick={() => { setAssetTypeFilter('item'); setCurrentPage(1); }}
          className={`auction-asset-tab ${assetTypeFilter === 'item' ? 'active' : ''}`}
        >
          Items
        </button>
        <button
          type="button"
          onClick={() => { setAssetTypeFilter('pet'); setCurrentPage(1); }}
          className={`auction-asset-tab ${assetTypeFilter === 'pet' ? 'active' : ''}`}
        >
          Pets
        </button>
        <button
          type="button"
          onClick={() => { setAssetTypeFilter('spirit'); setCurrentPage(1); }}
          className={`auction-asset-tab ${assetTypeFilter === 'spirit' ? 'active' : ''}`}
        >
          Spirits
        </button>
        <button
          type="button"
          onClick={() => { setAssetTypeFilter('currency'); setCurrentPage(1); }}
          className={`auction-asset-tab ${assetTypeFilter === 'currency' ? 'active' : ''}`}
        >
          PetaGold
        </button>
        <button
          type="button"
          onClick={() => { setAssetTypeFilter('all'); setCurrentPage(1); }}
          className={`auction-asset-tab subtle ${assetTypeFilter === 'all' ? 'active' : ''}`}
        >
          All
        </button>
      </div>

      {message && (
        <div className={`auction-message auction-message-${messageType}`}>
          {message}
        </div>
      )}

      {/* Search and Filter */}
      <div className="auction-search-section">
        <form onSubmit={handleSearch} className="auction-search-form">
          <div className="auction-search-controls">
            <div className="auction-search-field">
              <label className="auction-search-label">Search:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Item name..."
                className="auction-search-input"
              />
            </div>
            <div className="auction-sort-controls">
              <label className="auction-sort-label">Sort by:</label>
              <div className="auction-sort-buttons">
                <button
                  type="button"
                  onClick={() => handleSortChange('end_time')}
                  className={`auction-sort-btn ${sortBy === 'end_time' ? 'active' : ''}`}
                >
                  Time Left
                </button>
                <button
                  type="button"
                  onClick={() => handleSortChange('current_bid')}
                  className={`auction-sort-btn ${sortBy === 'current_bid' ? 'active' : ''}`}
                >
                  Price
                </button>
                <button
                  type="button"
                  onClick={() => handleSortChange('created_at')}
                  className={`auction-sort-btn ${sortBy === 'created_at' ? 'active' : ''}`}
                >
                  Newest
                </button>
              </div>
            </div>
            <button type="submit" className="auction-search-submit">Search</button>
          </div>
        </form>
      </div>

      {/* User Currency Display */}
      {user && (
        <div className="auction-currency-section">
          <div className="auction-currency-container">
            <div className="auction-currency-item">
              <span className="auction-currency-label">Your Peta:</span>
                <span className="auction-currency-amount auction-currency-gold">
                {Math.floor(userCurrency.peta).toLocaleString()} peta
              </span>
            </div>
            <div className="auction-currency-item">
              <span className="auction-currency-label">Your PetaGold:</span>
              <span className="auction-currency-amount auction-currency-gold">
                {Math.floor(userCurrency.petagold).toLocaleString()} petagold
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Auction List */}
      <div className="auction-list-section">
        <div className="auction-list-header">
          <div className="auction-list-col auction-col-item">Item</div>
          <div className="auction-list-col auction-col-price">Current Bid</div>
          <div className="auction-list-col auction-col-buy-now">Buy Now </div>
          <div className="auction-list-col auction-col-time">Time Left</div>
          <div className="auction-list-col auction-col-actions">Actions</div>
          <div className="auction-list-col auction-col-bids">Last Bid</div>
          <div className="auction-list-col auction-col-seller">Seller</div>
        </div>

        {auctions.length === 0 ? (
          <div className="auction-empty">No auctions found</div>
        ) : (
          auctions.map((auction) => {
            const display = getAuctionDisplay(auction);
            const bidCur = String(auction.bid_currency || 'peta').toLowerCase() === 'petagold' ? 'petagold' : 'peta';
            return (
            <div key={auction.id} className="auction-item">
              <div className="auction-item-col auction-col-item">
                <div className="auction-item-image">
                  <img 
                    src={display.image} 
                    alt={display.name}
                    className="auction-item-img"
                    title={display.name}
                    onClick={(e) => {
                      // On mobile, show tooltip; on desktop, navigate to detail
                      if (window.innerWidth <= 768) {
                        showTooltip(e, display.name);
                        setTimeout(() => hideTooltip(), 2000);
                      } else {
                        navigate(`/auction/${auction.id}`);
                      }
                    }}
                    onError={(e) => {
                      e.target.src = '/images/default-item.png';
                    }}
                  />
                </div>
                <div className="auction-item-info">
                  <button onClick={() => navigate(`/auction/${auction.id}`)} className="auction-item-name">
                    {display.name}
                  </button>
                  
                  {/* Mobile compact info */}
                  <div className="auction-mobile-info">
                    <span className="auction-mobile-bids">{auction.bid_count} bids</span>
                    <span className="auction-mobile-seller">by {auction.seller_name}</span>
                  </div>
                </div>
              </div>
              <div className="auction-item-col auction-col-price">
                <div className="auction-current-price">{Math.floor(auction.current_bid).toLocaleString()} {bidCur}</div>
              </div>
              <div className="auction-item-col auction-col-buy-now">
                {auction.buy_now_price ? (
                  <div className="auction-buy-now-price">{Math.floor(auction.buy_now_price).toLocaleString()} {bidCur}
                  </div>
                ) : (
                  <div className="auction-no-buy-now">-</div>
                )}
              </div>
              <div className="auction-item-col auction-col-time">
                <div className="auction-time-left">{formatTimeLeft(auction.end_time)}</div>
              </div>
              <div className="auction-item-col auction-col-actions">
                <div className="auction-action-buttons">
                  <button onClick={() => navigate(`/auction/${auction.id}`)} className="auction-bid-btn">
                    Bid
                  </button>
                  {auction.buy_now_price && (
                    <button onClick={() => handleBuyNow(auction)} className="auction-buy-now-btn">
                      Buy Now
                    </button>
                  )}
                </div>
              </div>
              <div className="auction-item-col auction-col-bids">
                {/* <div className="auction-bid-count">{auction.bid_count} bids</div> */}
                {auction.highest_bidder_name && (
                  <div className="auction-highest-bidder">
                    by {auction.highest_bidder_name}
                  </div>
                )}
              </div>
              <div className="auction-item-col auction-col-seller">
                <button onClick={() => navigate(`/user/${auction.seller_id}`)} className="auction-seller-link">
                  {auction.seller_name}
                </button>
              </div>
            </div>
          )})
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="auction-pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="auction-page-btn"
          >
            Previous
          </button>
          <span className="auction-page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="auction-page-btn"
          >
            Next
          </button>
        </div>
      )}
      </div>
    </TemplatePage>
  );
};

export default AuctionList;
