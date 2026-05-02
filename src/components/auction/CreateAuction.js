import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import TemplatePage from '../template/TemplatePage';
import './CreateAuction.css';

const CreateAuction = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [userItems, setUserItems] = useState([]);
  const [userPets, setUserPets] = useState([]);
  const [userSpirits, setUserSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const [formData, setFormData] = useState({
    asset_type: 'item', // item | pet | spirit | currency
    inventory_id: '',
    pet_id: '',
    user_spirit_id: '',
    currency_type: 'petagold', // peta | petagold
    currency_amount: '',
    bid_currency: 'peta',
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
    fetchAllAssets();
  }, [user, navigate]);

  const fetchAllAssets = async () => {
    try {
      setLoading(true);
      const base = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const [itemsRes, petsRes, spiritsRes] = await Promise.all([
        fetch(`${base}/api/user/items`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
        fetch(`${base}/users/${user.userId}/pets?auction_eligible=1`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
        fetch(`${base}/api/users/${user.userId}/spirits?auction_eligible=1`, { headers: { 'Authorization': `Bearer ${user.token}` } })
      ]);

      const itemsData = await itemsRes.json();
      const petsData = await petsRes.json();
      const spiritsData = await spiritsRes.json();

      if (itemsRes.ok) setUserItems(itemsData.items || []);
      if (petsRes.ok) setUserPets(Array.isArray(petsData) ? petsData : []);
      if (spiritsRes.ok) setUserSpirits(Array.isArray(spiritsData) ? spiritsData : []);

      if (!itemsRes.ok) {
        setMessage(itemsData.message || 'Error fetching items');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching user assets:', error);
      setMessage('Error fetching your assets');
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

  const handleAssetTypeChange = (e) => {
    const nextType = e.target.value;
    setFormData(prev => ({
      ...prev,
      asset_type: nextType,
      inventory_id: '',
      pet_id: '',
      user_spirit_id: '',
      currency_amount: '',
      currency_type: 'petagold',
      bid_currency: nextType === 'currency' ? 'peta' : prev.bid_currency
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.asset_type === 'item' && !formData.inventory_id) {
      setMessage('Please select an item');
      setMessageType('error');
      return;
    }
    if (formData.asset_type === 'pet' && !formData.pet_id) {
      setMessage('Please select a pet');
      setMessageType('error');
      return;
    }
    if (formData.asset_type === 'spirit' && !formData.user_spirit_id) {
      setMessage('Please select a spirit');
      setMessageType('error');
      return;
    }
    if (formData.asset_type === 'currency') {
      const amt = parseInt(formData.currency_amount);
      if (!amt || amt < 1) {
        setMessage('Please enter a valid currency amount');
        setMessageType('error');
        return;
      }
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
          asset_type: formData.asset_type,
          inventory_id: formData.asset_type === 'item' && formData.inventory_id ? parseInt(formData.inventory_id, 10) : null,
          pet_id: formData.pet_id ? parseInt(formData.pet_id) : null,
          user_spirit_id: formData.user_spirit_id ? parseInt(formData.user_spirit_id) : null,
          currency_type: formData.asset_type === 'currency' ? formData.currency_type : null,
          currency_amount: formData.asset_type === 'currency' ? parseInt(formData.currency_amount) : null,
          bid_currency: formData.bid_currency,
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

  const selectedItem = userItems.find(
    (row) => String(row.inventory_id) === String(formData.inventory_id)
  );
  const selectedPet = userPets.find(p => p.id === parseInt(formData.pet_id, 10));
  const selectedSpirit = userSpirits.find(s => s.id === parseInt(formData.user_spirit_id, 10));

  const itemImageSrc = (imageUrl) =>
    imageUrl ? `/images/equipments/${imageUrl}` : '/images/default-item.png';
  const petImageSrc = (image) => {
    if (!image) return '/images/pets/placeholder.png';
    const s = String(image);
    if (s.startsWith('http') || s.startsWith('/')) return s;
    return `/images/pets/${s}`;
  };
  const spiritImageSrc = (imageUrl) => {
    if (!imageUrl) return '/images/spirit/placeholder.png';
    const s = String(imageUrl);
    if (s.startsWith('http') || s.startsWith('/')) return s;
    return `/images/spirit/${s}`;
  };

  const selectItem = (inventoryRowId) => {
    setFormData((prev) => ({ ...prev, inventory_id: String(inventoryRowId) }));
  };
  const selectPet = (id) => {
    setFormData((prev) => ({ ...prev, pet_id: String(id) }));
  };
  const selectSpirit = (id) => {
    setFormData((prev) => ({ ...prev, user_spirit_id: String(id) }));
  };

  const submitDisabled =
    submitting ||
    (formData.asset_type === 'item' && userItems.length === 0) ||
    (formData.asset_type === 'pet' && userPets.length === 0) ||
    (formData.asset_type === 'spirit' && userSpirits.length === 0);

  if (loading) {
    return (
      <TemplatePage showSearch={false} showTabs={false}>
        <div className="create-auction-container">
          <div className="create-auction-loading">Loading your assets...</div>
        </div>
      </TemplatePage>
    );
  }

  return (
    <TemplatePage showSearch={false} showTabs={false}>
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
            <h3 className="create-auction-section-title">What do you want to sell?</h3>
            <div className="create-auction-form-group">
              <label className="create-auction-label">Auction type:</label>
              <select
                name="asset_type"
                value={formData.asset_type}
                onChange={handleAssetTypeChange}
                className="create-auction-select"
              >
                <option value="item">Items</option>
                <option value="pet">Pet</option>
                <option value="spirit">Spirit</option>
                <option value="currency">PetaGold</option>
              </select>
              <div className="create-auction-help">
                Items/Pet/Spirit: buyers bid using your selected bid currency. Currency auctions transfer the listed currency amount to the buyer.
              </div>
              <div className="create-auction-rules-hint">
                {formData.asset_type === 'item' && (
                  <span>Điều kiện item: trang bị phải còn độ bền tối đa (trừ đồ vĩnh cửu / random không bền).</span>
                )}
                {formData.asset_type === 'pet' && (
                  <span>Điều kiện pet: phải tháo hết linh thú và vật phẩm đang trang bị.</span>
                )}
                {formData.asset_type === 'spirit' && (
                  <span>Điều kiện linh thú: không được gắn trên bất kỳ pet nào.</span>
                )}
              </div>
            </div>
            
            {formData.asset_type === 'item' && userItems.length === 0 ? (
              <div className="create-auction-no-items">
                <div className="create-auction-no-items-icon">📦</div>
                <div className="create-auction-no-items-title">No Items Available</div>
                <div className="create-auction-no-items-message">
                  You don't have any items available for auction. This could be because:
                  <ul>
                    <li>You don't own any items yet</li>
                    <li>All your items are already listed in active auctions</li>
                    <li>Your items have been sold or used</li>
                    <li>Equipment must be at full durability to list (permanent / unbreakable items are exempt)</li>
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
            ) : formData.asset_type === 'pet' && userPets.length === 0 ? (
              <div className="create-auction-no-items create-auction-no-items--compact">
                <div className="create-auction-no-items-title">Không có pet đủ điều kiện</div>
                <p className="create-auction-help" style={{ margin: 0 }}>
                  Pet phải tháo hết linh thú và đồ trang bị trước khi đem đấu giá.
                </p>
              </div>
            ) : formData.asset_type === 'spirit' && userSpirits.length === 0 ? (
              <div className="create-auction-no-items create-auction-no-items--compact">
                <div className="create-auction-no-items-title">Không có linh thú đủ điều kiện</div>
                <p className="create-auction-help" style={{ margin: 0 }}>
                  Linh thú phải gỡ khỏi toàn bộ pet trước khi đem đấu giá.
                </p>
              </div>
            ) : (
              <div className="create-auction-item-selection">
                {formData.asset_type === 'item' && (
                  <>
                    <label className="create-auction-label">Chọn vật phẩm (mỗi lần chỉ đăng bán 1):</label>
                    <div className="create-auction-pick-grid" role="listbox" aria-label="Danh sách vật phẩm">
                      {userItems.map((item) => {
                        const selected = String(item.inventory_id) === String(formData.inventory_id);
                        return (
                          <button
                            key={item.inventory_id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`create-auction-pick-card ${selected ? 'is-selected' : ''}`}
                            onClick={() => selectItem(item.inventory_id)}
                          >
                            <img
                              src={itemImageSrc(item.image_url)}
                              alt=""
                              className="create-auction-pick-img"
                              onError={(e) => { e.target.src = '/images/default-item.png'; }}
                            />
                            <span className="create-auction-pick-name">{item.name}</span>
                            <span className="create-auction-pick-meta">Có: {item.quantity}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedItem && (
                      <div className="create-auction-pick-summary">
                        Đã chọn: <strong>{selectedItem.name}</strong>
                        {' · '}
                        <span className={`create-auction-rarity-pill rarity-${String(selectedItem.rarity || 'common').toLowerCase()}`}>
                          {selectedItem.rarity}
                        </span>
                        {' · '}Bán 1 / đang có {selectedItem.quantity}
                      </div>
                    )}
                  </>
                )}

                {formData.asset_type === 'pet' && (
                  <>
                    <label className="create-auction-label">Chọn pet đấu giá:</label>
                    <div className="create-auction-pick-grid" role="listbox" aria-label="Danh sách pet">
                      {userPets.map((p) => {
                        const selected = String(p.id) === String(formData.pet_id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`create-auction-pick-card ${selected ? 'is-selected' : ''}`}
                            onClick={() => selectPet(p.id)}
                          >
                            <img
                              src={petImageSrc(p.image)}
                              alt=""
                              className="create-auction-pick-img"
                              onError={(e) => { e.target.src = '/images/pets/placeholder.png'; }}
                            />
                            <span className="create-auction-pick-name">{p.name}</span>
                            <span className="create-auction-pick-meta">Lv {p.level} · {p.species_name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedPet && (
                      <div className="create-auction-pick-summary">
                        Đã chọn: <strong>{selectedPet.name}</strong> — {selectedPet.species_name}, cấp {selectedPet.level}
                      </div>
                    )}
                  </>
                )}

                {formData.asset_type === 'spirit' && (
                  <>
                    <label className="create-auction-label">Chọn linh thú đấu giá:</label>
                    <div className="create-auction-pick-grid" role="listbox" aria-label="Danh sách linh thú">
                      {userSpirits.map((s) => {
                        const selected = String(s.id) === String(formData.user_spirit_id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`create-auction-pick-card ${selected ? 'is-selected' : ''}`}
                            onClick={() => selectSpirit(s.id)}
                          >
                            <img
                              src={spiritImageSrc(s.image_url)}
                              alt=""
                              className="create-auction-pick-img"
                              onError={(e) => { e.target.src = '/images/spirit/placeholder.png'; }}
                            />
                            <span className="create-auction-pick-name">{s.name}</span>
                            <span className="create-auction-pick-meta">{s.rarity}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedSpirit && (
                      <div className="create-auction-pick-summary">
                        Đã chọn: <strong>{selectedSpirit.name}</strong> — {selectedSpirit.rarity}
                      </div>
                    )}
                  </>
                )}
                
                {formData.asset_type === 'currency' && (
                  <>
                    <label className="create-auction-label">Currency you are selling:</label>
                    <select
                      name="currency_type"
                      value={formData.currency_type}
                      onChange={(e) => {
                        const next = e.target.value;
                        const nextBid = next === 'peta' ? 'petagold' : 'peta';
                        setFormData(prev => ({ ...prev, currency_type: next, bid_currency: nextBid }));
                      }}
                      className="create-auction-select"
                    >
                      <option value="petagold">PetaGold (sell PetaGold for Peta bids)</option>
                      <option value="peta">Peta (sell Peta for PetaGold bids)</option>
                    </select>
                    <div className="create-auction-form-group">
                      <label className="create-auction-label">Amount (you can only sell 1 listing amount):</label>
                      <input
                        type="number"
                        name="currency_amount"
                        value={formData.currency_amount}
                        onChange={handleInputChange}
                        min="1"
                        step="1"
                        className="create-auction-input"
                        placeholder="e.g. 100"
                        required
                      />
                      <div className="create-auction-help">
                        Bid currency will auto-set to the opposite currency.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="create-auction-section">
            <h3 className="create-auction-section-title">Auction Settings</h3>

            <div className="create-auction-form-group">
              <label className="create-auction-label">Bid currency:</label>
              <select
                name="bid_currency"
                value={formData.bid_currency}
                onChange={handleInputChange}
                className="create-auction-select"
                disabled={formData.asset_type === 'currency'}
              >
                <option value="peta">Peta</option>
                <option value="petagold">PetaGold</option>
              </select>
              {formData.asset_type === 'currency' && (
                <div className="create-auction-help">
                  Currency auctions force bid currency to be the opposite currency.
                </div>
              )}
            </div>
            
            <div className="create-auction-form-group">
              <label className="create-auction-label">Starting Price:</label>
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
              <label className="create-auction-label">Buy Now Price - Optional:</label>
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
              <label className="create-auction-label">Minimum Bid Increment:</label>
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
              disabled={submitDisabled}
              className="create-auction-submit-btn"
            >
              {submitting ? 'Creating...' : 'Create Auction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </TemplatePage>   
  );
};

export default CreateAuction;
