import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import GlobalBanner from '../GlobalBanner';
import NavigationMenu from '../NavigationMenu';
import './AuctionDetail.css';

const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [userCurrency, setUserCurrency] = useState({ peta: 0, petagold: 0 });

  useEffect(() => {
    fetchAuction();
    const interval = setInterval(updateTimeLeft, 1000); // Update every second for accurate countdown
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (auction) {
      updateTimeLeft();
    }
  }, [auction]);

  useEffect(() => {
    if (user) {
      fetchUserCurrency();
    }
  }, [user]);

  const updateBidAmount = (auctionData) => {
    if (auctionData.current_bid && auctionData.min_increment) {
      const newBidAmount = Math.ceil(parseFloat(auctionData.current_bid) + parseFloat(auctionData.min_increment));
      setBidAmount(newBidAmount.toString());
    }
  };

  const fetchAuction = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auctions/${id}`);
      const data = await response.json();
      
      if (response.ok) {
        setAuction(data.auction);
        setBids(data.bids);
        updateBidAmount(data.auction);
      } else {
        setMessage(data.message || 'Auction not found');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching auction:', error);
      setMessage('Error fetching auction');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const updateTimeLeft = () => {
    if (!auction) return;
    
    const now = new Date();
    const end = new Date(auction.end_time);
    const diff = end - now;
    
    if (diff <= 0) {
      setTimeLeft('Ended');
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      setTimeLeft(`${hours}h ${minutes}m`);
    } else if (minutes > 1) {
      setTimeLeft(`${minutes}m`);
    } else if (minutes === 1) {
      setTimeLeft(`${minutes}m ${seconds}s`);
    } else {
      setTimeLeft(`${seconds}s`);
    }
  };

  const fetchUserCurrency = async () => {
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
        setUserCurrency({
          peta: userProfile.peta || 0,
          petagold: userProfile.petagold || 0
        });
      }
    } catch (error) {
      console.error('Error fetching user currency:', error);
    }
  };

  const handleBid = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setMessage('Please login to place a bid');
      setMessageType('error');
      return;
    }

    if (!auction) {
      setMessage('Auction data not loaded');
      setMessageType('error');
      return;
    }

    const bidAmountNum = parseInt(bidAmount);
    const currentBid = parseFloat(auction.current_bid);
    const minIncrement = parseFloat(auction.min_increment);
    const minimumBid = Math.ceil(currentBid + minIncrement);

    // Validate bid amount
    if (bidAmountNum < minimumBid) {
      setMessage(`Minimum bid is ${minimumBid} peta (current bid + minimum increment)`);
      setMessageType('error');
      return;
    }

    // Check if user has enough currency (auctions use peta only)
    if (bidAmountNum > userCurrency.peta) {
      setMessage(`Insufficient funds. You have ${userCurrency.peta.toLocaleString()} peta`);
      setMessageType('error');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auctions/${id}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ bid_amount: parseInt(bidAmount) })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Bid placed successfully! Redirecting to auction list...');
        setMessageType('success');
        
        // Redirect to auction list after successful bid
        setTimeout(() => {
          navigate('/auction');
        }, 1500);
      } else {
        setMessage(data.message || 'Error placing bid');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error placing bid:', error);
      setMessage('Error placing bid');
      setMessageType('error');
    }
  };

  const handleBuyNow = async () => {
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

    if (window.confirm(`Are you sure you want to buy this item for ${Math.floor(auction.buy_now_price)} peta?`)) {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auctions/${id}/buy-now`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          }
        });

        const data = await response.json();
        
        if (response.ok) {
          setMessage('Item purchased successfully! Redirecting to auction list...');
          setMessageType('success');
          
          // Redirect to auction list after successful purchase
          setTimeout(() => {
            navigate('/auction');
          }, 1500);
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

  if (loading) {
    return (
      <div className="auction-detail-container">
        <div className="auction-loading">Loading auction...</div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="auction-detail-container">
        <div className="auction-error">Auction not found</div>
      </div>
    );
  }

  const isEnded = timeLeft === 'Ended';
  const isOwner = user && user.userId === auction.seller_id;
  const canBid = user && !isOwner && !isEnded && auction.status === 'active';

  return (
    <>
    <div>
      {/* Global Banner */}
      <GlobalBanner
        backgroundImage="/images/background/banner-1.jpeg"
        title="Auction Details"
        subtitle="Bid on items or buy now"
        showBackButton={true}
        onBackClick={() => navigate('/auction')}
        className="small"
        overlay={true}
      />

      {/* Navigation Menu */}
      <NavigationMenu />

      <div className="auction-detail-container">
        <div className="auction-detail-header">
          <button onClick={() => navigate('/auction')} className="auction-back-btn">
            ← Back to Auctions
          </button>
          <h1 className="auction-detail-title">Auction Details</h1>
        </div>

      {message && (
        <div className={`auction-message auction-message-${messageType}`}>
          {message}
        </div>
      )}

      {/* User Currency Display */}
      {user && (
        <div className="auction-detail-currency-section">
          <div className="auction-detail-currency-container">
            <div className="auction-detail-currency-item">
              <span className="auction-detail-currency-label">Your Peta:</span>
              <span className="auction-detail-currency-amount auction-detail-currency-gold">
                {Math.floor(userCurrency.peta).toLocaleString()} peta
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="auction-detail-content">
        <div className="auction-detail-main">
          <div className="auction-item-section">
            <div className="auction-item-image-large">
              <img 
                src={auction.item_image ? `/images/equipments/${auction.item_image}` : '/images/default-item.png'} 
                alt={auction.item_name}
                className="auction-item-img-large"
                onError={(e) => {
                  e.target.src = '/images/default-item.png';
                }}
              />
            </div>
            <div className="auction-item-details">
              <h2 className="auction-item-name-large">{auction.item_name}</h2>
              <div className="auction-item-rarity-large auction-rarity-{auction.item_rarity}">
                {auction.item_rarity} • {auction.item_type}
              </div>
              {auction.item_description && (
                <p className="auction-item-description">{auction.item_description}</p>
              )}
            </div>
          </div>

          <div className="auction-bidding-section">
            <div className="auction-bid-info">
              <div className="auction-current-bid">
                <span className="auction-bid-label">Current Bid:</span>
                <span className="auction-bid-amount">{Math.floor(auction.current_bid)} peta</span>
              </div>
              <div className="auction-time-left-large">
                <span className="auction-time-label">Time Left:</span>
                <span className={`auction-time-amount ${isEnded ? 'ended' : ''}`}>
                  {timeLeft}
                </span>
              </div>
              <div className="auction-seller-info">
                <span className="auction-seller-label">Seller:</span>
                <button onClick={() => navigate(`/user/${auction.seller_id}`)} className="auction-seller-link">
                  {auction.seller_name}
                </button>
              </div>
            </div>

            {canBid && (
              <form onSubmit={handleBid} className="auction-bid-form">
                <div className="auction-bid-input-group">
                  <label className="auction-bid-input-label">
                    Your Bid (Min: {Math.ceil(parseFloat(auction.current_bid) + parseFloat(auction.min_increment))} peta):
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={Math.ceil(parseFloat(auction.current_bid) + parseFloat(auction.min_increment))}
                    step="1"
                    className="auction-bid-input"
                    required
                  />
                </div>
                <button type="submit" className="auction-bid-submit">
                  Place Bid
                </button>
              </form>
            )}

            {auction.buy_now_price && !isOwner && !isEnded && (
              <div className="auction-buy-now-section">
                <div className="auction-buy-now-price">
                  Buy Now: {Math.floor(auction.buy_now_price)} peta
                </div>
                <button onClick={handleBuyNow} className="auction-buy-now-btn">
                  Buy Now
                </button>
              </div>
            )}

            {isOwner && (
              <div className="auction-owner-notice">
                This is your auction. You cannot bid on it.
              </div>
            )}

            {isEnded && (
              <div className="auction-ended-notice">
                This auction has ended.
              </div>
            )}
          </div>
        </div>

        <div className="auction-bid-history">
          <h3 className="auction-history-title">Bid History</h3>
          {bids.length === 0 ? (
            <div className="auction-no-bids">No bids yet</div>
          ) : (
            <div className="auction-bids-list">
              {bids.map((bid, index) => (
                <div key={index} className="auction-bid-item">
                  <div className="auction-bid-amount">{bid.bid_amount} peta</div>
                  <div className="auction-bid-bidder">{bid.bidder_name}</div>
                  <div className="auction-bid-time">
                    {new Date(bid.bid_time).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
    </>
  );
};

export default AuctionDetail;
