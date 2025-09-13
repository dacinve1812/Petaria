import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import GlobalBanner from '../GlobalBanner';
import NavigationMenu from '../NavigationMenu';
import './CreateAuction.css';

const CreateAuction = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [userItems, setUserItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const [formData, setFormData] = useState({
    item_id: '',
    starting_price: '',
    buy_now_price: '',
    min_increment: '1',
    duration_hours: '24'
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchUserItems();
  }, [user, navigate]);

  const fetchUserItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/user/items`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUserItems(data.items || []);
      } else {
        setMessage(data.message || 'Error fetching items');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching user items:', error);
      setMessage('Error fetching items');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.item_id) {
      setMessage('Please select an item');
      setMessageType('error');
      return;
    }

    if (!formData.starting_price || parseFloat(formData.starting_price) < 0) {
      setMessage('Please enter a valid starting price');
      setMessageType('error');
      return;
    }

    if (formData.buy_now_price && parseFloat(formData.buy_now_price) <= parseFloat(formData.starting_price)) {
      setMessage('Buy now price must be higher than starting price');
      setMessageType('error');
      return;
    }

    if (parseFloat(formData.min_increment) < 0) {
      setMessage('Minimum increment must be non-negative');
      setMessageType('error');
      return;
    }

    if (parseFloat(formData.duration_hours) < 0.5 || parseFloat(formData.duration_hours) > 168) {
      setMessage('Duration must be between 0.5 and 168 hours');
      setMessageType('error');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auctions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          item_id: parseInt(formData.item_id),
          starting_price: parseFloat(formData.starting_price),
          buy_now_price: formData.buy_now_price ? parseFloat(formData.buy_now_price) : null,
          min_increment: parseFloat(formData.min_increment),
          duration_hours: parseFloat(formData.duration_hours)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Auction created successfully!');
        setMessageType('success');
        setTimeout(() => {
          navigate('/auction');
        }, 2000);
      } else {
        setMessage(data.message || 'Error creating auction');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error creating auction:', error);
      setMessage('Error creating auction');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = userItems.find(item => item.id === parseInt(formData.item_id));

  if (loading) {
    return (
      <div className="create-auction-container">
        <div className="create-auction-loading">Loading your items...</div>
      </div>
    );
  }

  return (
    <>
      {/* Global Banner */}
      <GlobalBanner
        backgroundImage="/images/background/banner-1.jpeg"
        title="Create New Auction"
        subtitle="List your items for sale"
        showBackButton={true}
        onBackClick={() => navigate('/auction')}
        className="small"
        overlay={true}
      />

      {/* Navigation Menu */}
      <NavigationMenu />

      <div className="page-container">
        <div className="create-auction-header">
          <button onClick={() => navigate('/auction')} className="create-auction-back-btn">
            ← Back to Auctions
          </button>
          <h1 className="create-auction-title">Create New Auction</h1>
        </div>

      {message && (
        <div className={`create-auction-message create-auction-message-${messageType}`}>
          {message}
        </div>
      )}

      <div className="create-auction-content">
        <form onSubmit={handleSubmit} className="create-auction-form">
          <div className="create-auction-section">
            <h3 className="create-auction-section-title">Select Item</h3>
            
            {userItems.length === 0 ? (
              <div className="create-auction-no-items">
                <div className="create-auction-no-items-icon">📦</div>
                <div className="create-auction-no-items-title">No Items Available</div>
                <div className="create-auction-no-items-message">
                  You don't have any items available for auction. This could be because:
                  <ul>
                    <li>You don't own any items yet</li>
                    <li>All your items are already listed in active auctions</li>
                    <li>Your items have been sold or used</li>
                  </ul>
                  Visit the shop to buy some items first, or wait for your current auctions to end.
                </div>
                <button 
                  type="button" 
                  onClick={() => navigate('/shop')} 
                  className="create-auction-shop-btn"
                >
                  Visit Shop
                </button>
              </div>
            ) : (
              <div className="create-auction-item-selection">
                <label className="create-auction-label">Choose an item to auction:</label>
                <select
                  name="item_id"
                  value={formData.item_id}
                  onChange={handleInputChange}
                  className="create-auction-select"
                  required
                >
                  <option value="">Select an item...</option>
                  {userItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Quantity: {item.quantity})
                    </option>
                  ))}
                </select>
                
                {selectedItem && (
                  <div className="create-auction-item-preview">
                    <img 
                      src={`/images/equipments/${selectedItem.image_url}` || '/images/default-item.png'} 
                      alt={selectedItem.name}
                      className="create-auction-item-img"
                    />
                    <div className="create-auction-item-info">
                      <div className="create-auction-item-name">{selectedItem.name}</div>
                      <div className="create-auction-item-rarity create-auction-rarity-{selectedItem.rarity}">
                        {selectedItem.rarity} • {selectedItem.type}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="create-auction-section">
            <h3 className="create-auction-section-title">Auction Settings</h3>
            
            <div className="create-auction-form-group">
              <label className="create-auction-label">Starting Price (peta):</label>
              <input
                type="number"
                name="starting_price"
                value={formData.starting_price}
                onChange={handleInputChange}
                min="1"
                step="1"
                className="create-auction-input"
                placeholder="0"
                required
              />
            </div>

            <div className="create-auction-form-group">
              <label className="create-auction-label">Buy Now Price (peta) - Optional:</label>
              <input
                type="number"
                name="buy_now_price"
                value={formData.buy_now_price}
                onChange={handleInputChange}
                min="1"
                step="1"
                className="create-auction-input"
                placeholder="Leave empty for bidding only"
              />
              <div className="create-auction-help">
                If set, buyers can purchase immediately at this price
              </div>
            </div>

            <div className="create-auction-form-group">
              <label className="create-auction-label">Minimum Bid Increment (peta):</label>
              <input
                type="number"
                name="min_increment"
                value={formData.min_increment}
                onChange={handleInputChange}
                min="1"
                step="1"
                className="create-auction-input"
                required
              />
              <div className="create-auction-help">
                Minimum amount each bid must increase by
              </div>
            </div>

            <div className="create-auction-form-group">
              <label className="create-auction-label">Auction Duration:</label>
              <select
                name="duration_hours"
                value={formData.duration_hours}
                onChange={handleInputChange}
                className="create-auction-select"
                required
              >
                <option value="0.5">30 minutes</option>
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours (3 days)</option>
                <option value="168">168 hours (1 week)</option>
              </select>
            </div>
          </div>

          <div className="create-auction-actions">
            <button
              type="button"
              onClick={() => navigate('/auction')}
              className="create-auction-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || userItems.length === 0}
              className="create-auction-submit-btn"
            >
              {submitting ? 'Creating...' : 'Create Auction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </>   
  );
};

export default CreateAuction;
