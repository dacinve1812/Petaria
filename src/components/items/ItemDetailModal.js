// Updated ItemDetailModal.js with support for unequip and use item for pets
import React, { useEffect, useState } from 'react';
import PetSelectionModal from './PetSelectionModal';

function ItemDetailModal({ item, onClose, onBuy, mode = 'default', onUpdateItem }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [userPets, setUserPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPetSelection, setShowPetSelection] = useState(false);
  const [itemDetails, setItemDetails] = useState(null);
  const [itemEffects, setItemEffects] = useState([]);
  const [selectedAction, setSelectedAction] = useState('');
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [userOwnedQuantity, setUserOwnedQuantity] = useState(0);
  const [fetchedEquipmentData, setFetchedEquipmentData] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  // Set item details directly from inventory API (now includes description)
  useEffect(() => {
    if (item) {
      setItemDetails(item);
      
      // Fetch item effects
      const itemId = item.item_id || item.id;
      fetchItemEffects(itemId);
      
      // Fetch equipment data if it's an equipment item
      if (item.type === 'equipment') {
        fetchEquipmentData(itemId);
      }
      
      // Fetch user's owned quantity if in shop mode
      if (mode === 'shop') {
        console.log('Shop item object:', item);
        // Try both item_id and id
        const itemId = item.item_id || item.id;
        fetchUserOwnedQuantity(itemId);
      }
    }
  }, [item, mode]);

  const fetchItemEffects = async (itemId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/item-effects/${itemId}`);
      if (response.ok) {
        const effects = await response.json();
        setItemEffects(effects);
      }
    } catch (error) {
      console.error('Error fetching item effects:', error);
      setItemEffects([]);
    }
  };

  const fetchUserOwnedQuantity = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const userId = JSON.parse(atob(token.split('.')[1])).userId;
      console.log('Fetching owned quantity for itemId:', itemId, 'userId:', userId);
      
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const inventory = await response.json();
        console.log('Full inventory:', inventory);
        console.log('Looking for item_id:', itemId);
        
        const ownedItem = inventory.find(invItem => 
          invItem.item_id === itemId || 
          invItem.item_id === parseInt(itemId) || 
          parseInt(invItem.item_id) === itemId ||
          parseInt(invItem.item_id) === parseInt(itemId)
        );
        console.log('Found owned item:', ownedItem);
        
        if (ownedItem) {
          setUserOwnedQuantity(ownedItem.quantity);
        } else {
          // Try alternative approach - check if item exists in inventory at all
          console.log('Item not found in inventory, checking if user has any of this item...');
          const allItemsOfThisType = inventory.filter(invItem => {
            console.log('Comparing:', invItem.item_id, 'with', itemId);
            return invItem.item_id == itemId; // Use == for loose comparison
          });
          console.log('All items of this type:', allItemsOfThisType);
          
          if (allItemsOfThisType.length > 0) {
            const totalQuantity = allItemsOfThisType.reduce((sum, item) => sum + (item.quantity || 0), 0);
            setUserOwnedQuantity(totalQuantity);
          } else {
            setUserOwnedQuantity(0);
          }
        }
      } else {
        console.error('Failed to fetch inventory:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user owned quantity:', error);
      setUserOwnedQuantity(0);
    }
  };

  const fetchEquipmentData = async (itemId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/equipment-data/${itemId}`);
      if (response.ok) {
        const data = await response.json();
        setFetchedEquipmentData(data);
      } else {
        console.log('No equipment data found for item:', itemId);
        setFetchedEquipmentData(null);
      }
    } catch (error) {
      console.error('Error fetching equipment data:', error);
      setFetchedEquipmentData(null);
    }
  };

  // Handle quantity changes for shop purchase
  const handleQuantityChange = (delta) => {
    setPurchaseQuantity(prev => {
      const newQuantity = prev + delta;
      return Math.max(1, Math.min(newQuantity, 99)); // Limit between 1-99
    });
  };

  const handleQuantityInputChange = (e) => {
    const value = parseInt(e.target.value) || 1;
    setPurchaseQuantity(Math.max(1, Math.min(value, 99)));
  };

  // Define available actions for different item types
  const getAvailableActions = () => {
    if (item?.type === 'equipment') {
      return [
        { value: 'equip', label: item.is_equipped ? 'Remove' : 'Equip' }
      ];
    }
    
    return [
      { value: 'sell', label: 'Bán ve chai' },
      { value: 'feed', label: 'Cho thú cưng ăn' },
      { value: 'heal', label: 'Chữa trị cho thú cưng' },
      { value: 'restore_energy', label: 'Hồi phục năng lượng cho thú cưng' },
      { value: 'boost_stats', label: 'Gia tăng chỉ số cho thú cưng' },
      { value: 'play', label: 'Chơi đùa với thú cưng' },
      { value: 'transform', label: 'Thay đổi hình dạng cho thú cưng' },
      { value: 'sell_auction', label: 'Đặt vào cửa hàng' },
      { value: 'exhibition', label: 'Mang vào phòng triển lãm' },
      { value: 'gift', label: 'Tặng cho bạn bè' }
    ];
  };

  const handleActionSelect = (actionValue) => {
    setSelectedAction(actionValue);
    setShowActionDropdown(false);
    
    if (actionValue === 'equip') {
      handleActionClick();
    } else if (['sell', 'sell_auction', 'exhibition', 'gift'].includes(actionValue)) {
      // Placeholder actions - show alert for now
      alert(`Tính năng "${getActionLabel(actionValue)}" sẽ được cập nhật sau!`);
    } else {
      // For other actions, show pet selection modal
      setAction(actionValue);
      setShowPetSelection(true);
    }
  };

  const getActionLabel = (actionValue) => {
    const actions = getAvailableActions();
    const action = actions.find(a => a.value === actionValue);
    return action ? action.label : actionValue;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionDropdown && !event.target.closest('.inventory-item-modal-dropdown')) {
        setShowActionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionDropdown]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (item) {
      // Modal is open, disable scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Modal is closed, enable scroll
        document.body.style.overflow = 'unset';
      };
    }
  }, [item]);

  useEffect(() => {
    // Fetch user pets for both equipment and use actions
    if (item?.type === 'equipment' || item?.type === 'food' || item?.type === 'consumable' || item?.type === 'booster') {
      const token = localStorage.getItem('token');
      if (!token) return;
      const userId = JSON.parse(atob(token.split('.')[1])).userId;

      fetch(`${API_BASE_URL}/users/${userId}/pets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          // Ensure data is an array
          if (Array.isArray(data)) {
            setUserPets(data);
          } else if (data && Array.isArray(data.pets)) {
            setUserPets(data.pets);
          } else {
            setUserPets([]);
          }
        })
        .catch(err => {
          console.error('Error fetching pets:', err);
          setUserPets([]);
        });
    }
  }, [item]);

  const handleEquipItem = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/pets/${selectedPetId}/equip-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_id: item.id })
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Trang bị thành công!');
        if (typeof onUpdateItem === 'function') {
          onUpdateItem({ ...item, is_equipped: 1, equipped_pet_id: selectedPetId });
        }
        onClose();
      } else {
        alert(result.message || 'Trang bị thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi API equip:', err);
      alert('Lỗi khi trang bị.');
    }
  };

  const handleUnequipItem = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/unequip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Đã gỡ vật phẩm khỏi thú cưng!');
        if (typeof onUpdateItem === 'function') {
          onUpdateItem({ ...item, is_equipped: 0, equipped_pet_id: null, pet_name: null });
        }
        onClose();
      } else {
        alert(result.message || 'Không thể gỡ vật phẩm.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi API unequip:', err);
      alert('Lỗi khi gỡ vật phẩm.');
    }
  };

  const handleUseItem = async () => {
    if (!selectedPetId) {
      alert('Vui lòng chọn thú cưng để sử dụng vật phẩm!');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const userId = JSON.parse(atob(token.split('.')[1])).userId;

      const res = await fetch(`${API_BASE_URL}/api/pets/${selectedPetId}/use-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          item_id: item.item_id, 
          quantity: 1, 
          userId: userId 
        })
      });
      
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Sử dụng vật phẩm thành công!');
        
        // Update item quantity or remove if quantity becomes 0
        if (typeof onUpdateItem === 'function') {
          const newQuantity = item.quantity - 1;
          if (newQuantity <= 0) {
            // Item will be removed from inventory
            onUpdateItem(null); // Signal to remove item
          } else {
            onUpdateItem({ ...item, quantity: newQuantity });
          }
        }
        onClose();
      } else {
        alert(result.message || 'Sử dụng vật phẩm thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi sử dụng vật phẩm:', err);
      alert('Lỗi khi sử dụng vật phẩm.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = () => {
    if (item.is_equipped) {
      // Direct unequip
      handleUnequipItem();
    } else {
      // Show pet selection modal
      setShowPetSelection(true);
    }
  };

  const handlePetSelectionConfirm = async (petId, quantity = 1) => {
    setLoading(true);
    try {
      if (item.type === 'equipment') {
        await handleEquipItemWithPet(petId);
      } else if (item.type === 'food' || item.type === 'consumable' || item.type === 'booster') {
        await handleUseItemWithPet(petId, quantity);
      }
    } catch (error) {
      console.error('Error in pet selection confirm:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEquipItemWithPet = async (petId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/pets/${petId}/equip-item`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          item_id: item.id, // Use item.id from database
          inventory_id: item.inventory_id || item.id // Fallback for inventory_id
        })
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Trang bị thành công!');
        if (typeof onUpdateItem === 'function') {
          onUpdateItem({ ...item, is_equipped: 1, equipped_pet_id: petId });
        }
        onClose();
      } else {
        alert(result.message || 'Trang bị thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi API equip:', err);
      alert('Lỗi khi trang bị.');
    }
  };

  const handleUseItemWithPet = async (petId, quantity) => {
    try {
      const token = localStorage.getItem('token');
      const userId = JSON.parse(atob(token.split('.')[1])).userId;

      const res = await fetch(`${API_BASE_URL}/api/pets/${petId}/use-item`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          item_id: item.id, // Use item.id from database
          quantity: quantity,
          userId: userId
        })
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Sử dụng thành công!');
        if (typeof onUpdateItem === 'function') {
          const newQuantity = item.quantity - quantity;
          if (newQuantity <= 0) {
            onUpdateItem(null); // Signal to remove item
          } else {
            onUpdateItem({ ...item, quantity: newQuantity });
          }
        }
        onClose();
      } else {
        alert(result.message || 'Sử dụng thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi API use item:', err);
      alert('Lỗi khi sử dụng.');
    }
  };

  // Check if item is sold out
  const isSoldOut = item.stock_limit === 0 || item.stock_limit === null;

  if (!item) return null;

  // Use itemDetails if available, otherwise fallback to item
  const displayItem = itemDetails || item;

  // Helper function to get rarity color
  const getRarityColor = (rarity) => {
    const colors = {
      'common': '#95a5a6',
      'uncommon': '#27ae60',
      'rare': '#3498db',
      'epic': '#9b59b6',
      'legendary': '#f39c12',
      'mythic': '#e74c3c'
    };
    return colors[rarity?.toLowerCase()] || '#95a5a6';
  };

  // Helper function to get rarity text
  const getRarityText = (rarity) => {
    const texts = {
      'common': 'Thường',
      'uncommon': 'Hiếm',
      'rare': 'Hiếm',
      'epic': 'Cực hiếm',
      'legendary': 'Huyền thoại',
      'mythic': 'Thần thoại'
    };
    return texts[rarity?.toLowerCase()] || 'Thường';
  };

  // Get equipment data from API response (now includes power and durability)
  const getEquipmentData = () => {
    if (itemDetails && itemDetails.type === 'equipment') {
      return {
        power: itemDetails.power || 0,
        durability: itemDetails.max_durability || 0
      };
    }
    return null;
  };

  const equipmentData = getEquipmentData();

  return (
    <div 
      className="inventory-item-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="inventory-item-modal">
        {/* Header */}
        <div className="inventory-item-modal-header">
          <button 
            className="inventory-item-modal-close"
            onClick={onClose}
          >
            ×
          </button>
          
          <img 
            src={`/images/equipments/${displayItem.image_url}`} 
            alt={displayItem.name} 
            className="inventory-item-modal-image" 
          />
          
          <div className="inventory-item-modal-header-info">
            <h3 className="inventory-item-modal-name">{displayItem.name}</h3>
            <div className="inventory-item-modal-rarity" style={{ color: getRarityColor(displayItem.rarity) }}>
              {getRarityText(displayItem.rarity)}
            </div>
            {/* Quantity for non-equipment items */}
            {item.type !== 'equipment' && (
              <div className="inventory-item-modal-quantity-value">
                Owned: {mode === 'shop' ? userOwnedQuantity : item.quantity}
              </div>
            )}
            {item.type === 'equipment' && (
                <>
                  {mode === 'shop' && (
                    <div className="inventory-item-modal-quantity-value">
                      Owned: {userOwnedQuantity}
                    </div>
                  )}
                  {mode !== 'shop' && (
                    <div className="inventory-item-modal-quantity-value">
                      Durability: {item.durability_left}/{item.max_durability}
                    </div>
                  )}
                </>
              )}
            
            
          
          </div>
        </div>

        {/* Body */}
        <div className="inventory-item-modal-body">
          {/* Item Effects */}
          {itemEffects.length > 0 && (
            <div className="inventory-item-modal-section">
            
              <div className="inventory-item-modal-effects">
                {itemEffects.map((effect, index) => (
                  <div key={index} className="inventory-item-modal-effect">
                    <div className="inventory-item-modal-effect-content">
                      <div className="inventory-item-modal-effect-description">
                        {effect.description || `${effect.effect_target.toUpperCase()}: ${effect.value_min}${effect.effect_type === 'percent' ? '%' : ''}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
            </div>
          )}
          
          {/* Primary Stats */}
          <div className="inventory-item-modal-primary-stats">
          {item.type === 'equipment' && (
            <>
              <div className="inventory-item-modal-stat">
                <p>Deal damage equal to <span className="inventory-item-modal-stat-value">{fetchedEquipmentData?.power || equipmentData?.power || item.power || 'N/A'}%</span> of attack 
                <span className="inventory-item-modal-stat-value"> 1 time(s)</span> </p>
              </div>
            </>
          )}
        </div>  

        {/* Item Description */}
        {displayItem.description && (
            <div className="inventory-item-modal-section">
              <div className="inventory-item-modal-description">
                {displayItem.description}
              </div>
            </div>
          )} 

          {/* Show message if no description or effects */}
          {item.type !== 'equipment' && !displayItem.description && itemEffects.length === 0 && (
            <div className="inventory-item-modal-section">
              <div className="inventory-item-modal-no-info">
                Không có thông tin chi tiết cho vật phẩm này.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="inventory-item-modal-footer">
          {mode === 'shop' ? (
            <div className="shop-purchase-container">
              {/* Quantity Selector */}
              <div className="quantity-selector">
                
                <div className="quantity-controls">
                  <button 
                    className="quantity-btn minus"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={purchaseQuantity <= 1}
                  >
                    -
                  </button>
                  <input 
                    type="number"
                    className="quantity-input"
                    value={purchaseQuantity}
                    onChange={handleQuantityInputChange}
                    min="1"
                    max="99"
                  />
                  <button 
                    className="quantity-btn plus"
                    onClick={() => handleQuantityChange(1)}
                    disabled={purchaseQuantity >= 99}
                  >
                    +
                  </button>
                </div>
              </div>
              
              {/* Total Price and Buy Button */}
              <div className="purchase-summary">
                {/* <div className="total-price">
                  Tổng: {(item.price * purchaseQuantity).toLocaleString()} {item.currency_type === 'gem' ? 'petaGold' : 'peta'}
                </div> */}
                <button 
                  className="inventory-item-modal-action-btn buy-btn"
                  onClick={isSoldOut ? undefined : () => onBuy(item, purchaseQuantity)}
                  disabled={isSoldOut}
                >
                  {isSoldOut ? 'Vật phẩm đã bán hết' : `Mua với giá ${item.price * purchaseQuantity} ${item.currency_type === 'gem' ? 'petaGold' : 'peta'}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="inventory-item-modal-action-container">
              {item.type === 'equipment' ? (
                <button 
                  className={`inventory-item-modal-action-btn ${item.is_equipped ? 'unequip' : ''}`}
                  onClick={handleActionClick}
                  disabled={loading}
                >
                  {loading ? 'Đang xử lý...' : item.is_equipped ? 'Remove' : 'Equip'}
                </button>
              ) : (
                <div className="inventory-item-modal-dropdown">
                  <button 
                    className="inventory-item-modal-action-btn dropdown-trigger"
                    onClick={() => setShowActionDropdown(!showActionDropdown)}
                    disabled={loading}
                  >
                    {loading ? 'Đang xử lý...' : 'Chọn hành động'}
                  </button>
                  {showActionDropdown && (
                    <div className="inventory-item-modal-dropdown-menu">
                      {getAvailableActions().map((actionOption) => (
                        <button
                          key={actionOption.value}
                          className="inventory-item-modal-dropdown-item"
                          onClick={() => handleActionSelect(actionOption.value)}
                        >
                          {actionOption.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pet Selection Modal */}
      <PetSelectionModal
        isOpen={showPetSelection}
        onClose={() => setShowPetSelection(false)}
        onConfirm={handlePetSelectionConfirm}
        userPets={userPets}
        item={item}
        action={item.type === 'equipment' ? 'equip' : 'use'}
      />
    </div>
  );
}

export default ItemDetailModal;
