// Updated ItemDetailModal.js with support for unequip and use item for pets
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PetSelectionModal from './PetSelectionModal';
import GameDialogModal from '../ui/GameDialogModal';
import GameModalButton from '../ui/GameModalButton';

/**
 * Các lựa chọn “dùng cho thú cưng” trong menu — khớp catalog (type / category / subtype).
 * Food chỉ có “Cho ăn”; thuốc HP/MP, booster stat, đồ chơi… tách theo taxonomy.
 */
function getPetUseActionsForItem(item) {
  if (!item) return [];
  const type = String(item.type || '').toLowerCase().trim();
  const cat = String(item.item_category ?? item.category ?? '')
    .toLowerCase()
    .trim();
  const sub = String(item.item_subtype ?? item.subtype ?? '')
    .toLowerCase()
    .trim();

  const rows = [];
  const add = (value, label) => rows.push({ value, label });

  if (type === 'food' || (type === 'consumable' && cat === 'food')) {
    add('feed', 'Cho thú cưng ăn');
    return rows;
  }

  if ((type === 'consumable' || type === 'medicine') && cat === 'medicine') {
    if (sub === 'hp_recovery') add('heal', 'Chữa trị cho thú cưng');
    if (sub === 'mp_recovery') add('restore_energy', 'Hồi phục năng lượng cho thú cưng');
    return rows;
  }

  if (type === 'booster' && cat === 'stat_boost') {
    add('boost_stats', 'Gia tăng chỉ số cho thú cưng');
    return rows;
  }

  if ((type === 'consumable' && cat === 'toy') || type === 'toy') {
    add('play', 'Chơi đùa với thú cưng');
    return rows;
  }

  if (type === 'evolve') {
    add('transform', 'Thay đổi hình dạng cho thú cưng');
    return rows;
  }

  return rows;
}

function isMiscInventoryItem(item) {
  const type = String(item?.type || '').toLowerCase().trim();
  const cat = String(item?.item_category ?? item?.category ?? '')
    .toLowerCase()
    .trim();
  return type === 'misc' || cat === 'misc';
}

function ItemDetailModal({ item, onClose, onBuy, mode = 'default', onUpdateItem }) {
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const [userPets, setUserPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPetSelection, setShowPetSelection] = useState(false);
  const [itemDetails, setItemDetails] = useState(null);
  const [itemEffects, setItemEffects] = useState([]);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  /** null | { mode: 'sell' } | { mode: 'placeholder', label, actionValue } */
  const [gameDialog, setGameDialog] = useState(null);
  /** Chặn ghost click (mobile): cùng lần chạm có thể kích hoạt luôn item đầu menu → setSelectedAction → mất nút trigger */
  const [dropdownPointerGuard, setDropdownPointerGuard] = useState(false);
  const dropdownGuardTimerRef = useRef(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [userOwnedQuantity, setUserOwnedQuantity] = useState(0);
  const [fetchedEquipmentData, setFetchedEquipmentData] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  // Set item details directly from inventory API (now includes description)
  useEffect(() => {
    if (item) {
      setItemDetails(item);
      setSellQuantity(1);
      setGameDialog(null);
      setShowActionDropdown(false);
      setDropdownPointerGuard(false);
      setAction('');
      if (dropdownGuardTimerRef.current) {
        clearTimeout(dropdownGuardTimerRef.current);
        dropdownGuardTimerRef.current = null;
      }
      
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
    if (item?.type === 'equipment' && !item?.is_equipped) {
      const rows = [
        { value: 'equip', label: 'Trang bị cho thú cưng' },
        { value: 'sell', label: 'Bán ve chai' },
        { value: 'sell_auction', label: 'Đặt vào cửa hàng' },
        { value: 'exhibition', label: 'Mang vào phòng triển lãm' },
      ];
      if (!isMiscInventoryItem(item)) {
        rows.push({ value: 'gift', label: 'Tặng cho bạn bè' });
      }
      return rows;
    }

    const petRows = getPetUseActionsForItem(item);
    const rows = [
      { value: 'sell', label: 'Bán ve chai' },
      ...petRows,
      { value: 'sell_auction', label: 'Đặt vào cửa hàng' },
      { value: 'exhibition', label: 'Mang vào phòng triển lãm' },
    ];
    if (!isMiscInventoryItem(item)) {
      rows.push({ value: 'gift', label: 'Tặng cho bạn bè' });
    }
    return rows;
  };

  const handleActionSelect = (actionValue) => {
    setShowActionDropdown(false);
    setDropdownPointerGuard(false);
    if (dropdownGuardTimerRef.current) {
      clearTimeout(dropdownGuardTimerRef.current);
      dropdownGuardTimerRef.current = null;
    }

    if (actionValue === 'equip') {
      handleActionClick();
    } else if (actionValue === 'remove') {
      handleActionClick();
    } else if (actionValue === 'sell') {
      setSellQuantity(1);
      setGameDialog({ mode: 'sell' });
    } else if (actionValue === 'exhibition') {
      handleBringToExhibition();
    } else if (actionValue === 'sell_auction') {
      setGameDialog({
        mode: 'placeholder',
        actionValue,
        label: getActionLabel(actionValue),
      });
    } else if (actionValue === 'gift') {
      if (item?.id != null) {
        navigate(`/mail/compose?inventory_id=${encodeURIComponent(String(item.id))}`);
      } else {
        navigate('/mail/compose');
      }
      onClose();
    } else {
      setAction(actionValue);
      setShowPetSelection(true);
    }
  };

  const toggleActionDropdown = () => {
    if (showActionDropdown) {
      setShowActionDropdown(false);
      setDropdownPointerGuard(false);
      if (dropdownGuardTimerRef.current) {
        clearTimeout(dropdownGuardTimerRef.current);
        dropdownGuardTimerRef.current = null;
      }
      return;
    }
    setShowActionDropdown(true);
    setDropdownPointerGuard(true);
    if (dropdownGuardTimerRef.current) {
      clearTimeout(dropdownGuardTimerRef.current);
    }
    dropdownGuardTimerRef.current = setTimeout(() => {
      setDropdownPointerGuard(false);
      dropdownGuardTimerRef.current = null;
    }, 380);
  };

  const getActionLabel = (actionValue) => {
    const actions = getAvailableActions();
    const action = actions.find(a => a.value === actionValue);
    return action ? action.label : actionValue;
  };

  // Đóng khi click / chạm ra ngoài — chỉ gắn listener khi menu đã mở, trễ 1 tick để tránh race với lần mở
  useEffect(() => {
    if (!showActionDropdown) return undefined;

    const handlePointerOutside = (event) => {
      if (!event.target.closest('.inventory-item-modal-dropdown')) {
        setShowActionDropdown(false);
        setDropdownPointerGuard(false);
        if (dropdownGuardTimerRef.current) {
          clearTimeout(dropdownGuardTimerRef.current);
          dropdownGuardTimerRef.current = null;
        }
      }
    };

    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      document.addEventListener('mousedown', handlePointerOutside);
      document.addEventListener('touchstart', handlePointerOutside, { passive: true });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
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
    const petUseRows = item ? getPetUseActionsForItem(item) : [];
    const needsPetsForEquip = item?.type === 'equipment' && !item?.is_equipped;
    const needsPetsForUse = petUseRows.length > 0;
    if (!needsPetsForEquip && !needsPetsForUse) return undefined;

    const token = localStorage.getItem('token');
    if (!token) return undefined;
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

    return undefined;
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

      const cid =
        item?.item_id != null && item.item_id !== ''
          ? Number(item.item_id)
          : item?.id != null
            ? Number(item.id)
            : null;
      if (!cid || Number.isNaN(cid)) {
        alert('Không xác định được vật phẩm (thiếu item_id catalog).');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/pets/${selectedPetId}/use-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: cid,
          quantity: 1,
          userId: userId,
        }),
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

  const getCurrentOwnedQuantity = () => {
    if (mode === 'shop') return userOwnedQuantity || 0;
    return Number(item.quantity) || 0;
  };

  const changeSellQuantity = (delta) => {
    const maxQty = Math.max(1, getCurrentOwnedQuantity());
    setSellQuantity((prev) => {
      const next = prev + delta;
      return Math.max(1, Math.min(next, maxQty));
    });
  };

  const handleSellQuantityInput = (e) => {
    const maxQty = Math.max(1, getCurrentOwnedQuantity());
    const v = parseInt(e.target.value, 10) || 1;
    setSellQuantity(Math.max(1, Math.min(v, maxQty)));
  };

  const handleSellItem = async () => {
    const maxQty = getCurrentOwnedQuantity();
    if (maxQty <= 0) {
      alert('Không còn vật phẩm để bán.');
      return;
    }
    const qty = Math.max(1, Math.min(sellQuantity, maxQty));
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: qty }),
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Bán thành công!');
        if (typeof onUpdateItem === 'function') {
          const remain = Number(result.remaining_quantity);
          if (remain <= 0 || result.removed) {
            onUpdateItem(null);
          } else {
            onUpdateItem({ ...item, quantity: remain });
          }
        }
        onClose();
      } else {
        alert(result.message || 'Bán thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi bán item:', err);
      alert('Lỗi khi bán vật phẩm.');
    } finally {
      setLoading(false);
    }
  };

  const handleBringToExhibition = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Bạn cần đăng nhập lại để thực hiện thao tác này.');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/inventory/${item.id}/exhibition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result?.message || 'Không thể đưa item vào phòng triển lãm.');
        return;
      }

      if (typeof onUpdateItem === 'function') {
        const remain = Number(result?.remaining_quantity);
        if (result?.removed || remain <= 0) {
          onUpdateItem(null);
        } else {
          onUpdateItem({
            ...item,
            quantity: remain,
          });
        }
      }

      alert(result?.message || 'Đã mang item vào phòng triển lãm.');
      onClose();
    } catch (err) {
      console.error('Lỗi khi đưa item vào phòng triển lãm:', err);
      alert('Lỗi khi đưa item vào phòng triển lãm.');
    } finally {
      setLoading(false);
    }
  };

  const handlePetSelectionConfirm = async (petId, quantity = 1) => {
    setLoading(true);
    try {
      if (item.type === 'equipment') {
        await handleEquipItemWithPet(petId);
      } else if (
        item.type === 'food' ||
        item.type === 'consumable' ||
        item.type === 'medicine' ||
        item.type === 'booster' ||
        item.type === 'toy' ||
        item.type === 'evolve'
      ) {
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

      const cid =
        item?.item_id != null && item.item_id !== ''
          ? Number(item.item_id)
          : item?.id != null
            ? Number(item.id)
            : null;
      if (!cid || Number.isNaN(cid)) {
        alert('Không xác định được vật phẩm (thiếu item_id catalog).');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/pets/${petId}/use-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: cid,
          quantity,
          userId,
        }),
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

  const normalizeItemRarityUi = (rarity) => {
    const k = String(rarity || '').trim().toLowerCase();
    if (['common', 'rare', 'epic', 'legendary'].includes(k)) return k;
    if (['legend', 'mythic', 'unique', 'artifact'].includes(k)) return 'legendary';
    if (k === 'uncommon') return 'rare';
    return 'common';
  };

  // Helper function to get rarity color (4 mức: common / rare / epic / legendary)
  const getRarityColor = (rarity) => {
    const r = normalizeItemRarityUi(rarity);
    const colors = {
      common: '#95a5a6',
      rare: '#3498db',
      epic: '#9b59b6',
      legendary: '#f39c12',
    };
    return colors[r] || '#95a5a6';
  };

  // Helper function to get rarity text
  const getRarityText = (rarity) => {
    const r = normalizeItemRarityUi(rarity);
    const texts = {
      common: 'Thường',
      rare: 'Hiếm',
      epic: 'Cực hiếm',
      legendary: 'Legend',
    };
    return texts[r] || 'Thường';
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

  const isPermanentDurability = () => {
    const durabilityMode = String(
      fetchedEquipmentData?.durability_mode ??
      item?.durability_mode ??
      displayItem?.durability_mode ??
      ''
    ).toLowerCase();
    const maxDurability = Number(
      fetchedEquipmentData?.durability_max ??
      item?.max_durability ??
      displayItem?.max_durability ??
      0
    );
    return durabilityMode === 'unbreakable' || maxDurability >= 999999;
  };

  const getDurabilityDisplay = () => {
    if (isPermanentDurability()) return 'Vĩnh viễn';
    const durabilityMode = String(
      fetchedEquipmentData?.durability_mode ??
      item?.durability_mode ??
      displayItem?.durability_mode ??
      ''
    ).toLowerCase();
    if (durabilityMode === 'unknown' || durabilityMode === 'random') return 'Ngẫu Nhiên';
    const current = item?.durability_left ?? fetchedEquipmentData?.durability_max ?? 0;
    const max = item?.max_durability ?? fetchedEquipmentData?.durability_max ?? 0;
    return `${current}/${max}`;
  };

  const equipmentData = getEquipmentData();
  const ownedQty = getCurrentOwnedQuantity();
  const sellPricePerItem = Number(displayItem.sell_price || item.sell_price || 0);
  const sellTotal = sellPricePerItem * Math.max(1, Math.min(sellQuantity, Math.max(1, ownedQty)));

  /** Ma thuật catalog (items.magic_value); đồ trang bị ưu tiên equipment_data */
  const effectiveMagicDisplay =
    fetchedEquipmentData?.magic_value ??
    displayItem.items_magic_value ??
    displayItem.magic_value ??
    item?.magic_value ??
    itemEffects[0]?.magic_value ??
    displayItem.power ??
    item?.power ??
    0;

  return (
    <div 
      className="inventory-item-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="inventory-item-modal inventory-item-modal--allow-dropdown-overflow">
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
            alt={displayItem.name || displayItem.item_name || ''} 
            className="inventory-item-modal-image" 
          />
          
          <div className="inventory-item-modal-header-info">
            <h3 className="inventory-item-modal-name">
              {displayItem.name || displayItem.item_name || '-'}
            </h3>
            <div className="inventory-item-modal-quantity-value">
              Loại: {displayItem.type || item.type || '-'}
            </div>
            <div className="inventory-item-modal-rarity">
              Độ hiếm:{' '}
              <span style={{ color: getRarityColor(displayItem.rarity) }}>
                {getRarityText(displayItem.rarity)}
              </span>
            </div>
            <div className="inventory-item-modal-quantity-value">
              Chỉ số ma thuật: {effectiveMagicDisplay}
            </div>
            {item.type === 'equipment' && (
              <div className="inventory-item-modal-quantity-value">
                Độ bền: {getDurabilityDisplay()}
              </div>
            )}
            {item.type !== 'equipment' && (
              <div className="inventory-item-modal-quantity-value">
                Sở hữu: {mode === 'shop' ? userOwnedQuantity : item.quantity}
              </div>
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
                        {` (Ma thuật: ${effect.magic_value ?? effectiveMagicDisplay})`}
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
        <div
          className={`inventory-item-modal-footer${
            mode === 'shop' ? ' inventory-item-modal-footer--shop-game' : ''
          }`}
        >
          {mode === 'shop' ? (
            <div className="shop-purchase-container shop-purchase-container--game-style">
              <div className="shop-purchase-game-body">
                <div className="quantity-selector shop-purchase-quantity">
                  <div className="quantity-controls">
                    <button
                      type="button"
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
                      type="button"
                      className="quantity-btn plus"
                      onClick={() => handleQuantityChange(1)}
                      disabled={purchaseQuantity >= 99}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="purchase-summary shop-purchase-summary-total">
                  <div className="total-price shop-purchase-total-price">
                    {(item.price * purchaseQuantity).toLocaleString()}{' '}
                    {item.currency_type === 'gem' ? 'petaGold' : 'peta'}
                  </div>
                </div>
              </div>
              <footer className="game-dialog-modal__footer">
                <GameModalButton type="button" variant="cancel" onClick={onClose}>
                  Cancel
                </GameModalButton>
                <GameModalButton
                  type="button"
                  variant="confirm"
                  onClick={() => onBuy(item, purchaseQuantity)}
                  disabled={isSoldOut}
                >
                  {isSoldOut ? 'Hết hàng' : 'Confirm'}
                </GameModalButton>
              </footer>
            </div>
          ) : (
            <div className="inventory-item-modal-action-container">
              {item.type === 'equipment' && item.is_equipped ? (
                <GameModalButton
                  type="button"
                  variant="confirm"
                  className="inventory-item-modal-remove-game-btn"
                  onClick={handleActionClick}
                  disabled={loading}
                >
                  {loading ? 'Đang xử lý...' : 'Remove'}
                </GameModalButton>
              ) : (
                <div className="inventory-item-modal-dropdown">
                  <GameModalButton
                    type="button"
                    variant="primary"
                    showIcon={false}
                    className="inventory-item-modal-dropdown-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleActionDropdown();
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Đang xử lý...' : 'Chọn hành động'}
                  </GameModalButton>
                  {showActionDropdown && (
                    <div
                      className={`inventory-item-modal-dropdown-menu${
                        dropdownPointerGuard ? ' inventory-item-modal-dropdown-menu--pointer-guard' : ''
                      }`}
                    >
                      {getAvailableActions().map((actionOption) => (
                        <button
                          type="button"
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
        action={item?.type === 'equipment' ? 'equip' : action || 'use'}
      />

      {/* Bán: quantity + xác nhận trên nút Confirm của GameDialogModal */}
      {gameDialog?.mode === 'sell' && (
        <GameDialogModal
          isOpen
          onClose={() => setGameDialog(null)}
          className="game-dialog-modal--global-item"
          title="Xác nhận bán vật phẩm"
          mode="confirm"
          cancelLabel="Cancel"
          confirmLabel="Confirm"
          onConfirm={handleSellItem}
          confirmDisabled={loading || ownedQty <= 0}
          closeOnOverlayClick
          contentClassName="item-detail-game-dialog-body"
        >
          <p className="item-detail-sell-dialog-intro">
            Chọn số lượng <span className="highlight">{displayItem.name || displayItem.item_name || 'vật phẩm'}</span> muốn bán.
          </p>
          <div className="quantity-selector item-detail-sell-quantity">
            <div className="quantity-controls">
              <button
                type="button"
                className="quantity-btn minus"
                onClick={() => changeSellQuantity(-1)}
                disabled={loading || sellQuantity <= 1}
              >
                -
              </button>
              <input
                type="number"
                className="quantity-input"
                value={sellQuantity}
                min="1"
                max={Math.max(1, ownedQty)}
                onChange={handleSellQuantityInput}
                disabled={loading}
              />
              <button
                type="button"
                className="quantity-btn plus"
                onClick={() => changeSellQuantity(1)}
                disabled={loading || sellQuantity >= Math.max(1, ownedQty)}
              >
                +
              </button>
            </div>
          </div>
          <div className="purchase-summary item-detail-sell-summary">
            <div className="total-price">{sellTotal.toLocaleString()} peta</div>
          </div>
        </GameDialogModal>
      )}

      {gameDialog?.mode === 'placeholder' && (
        <GameDialogModal
          isOpen
          onClose={() => setGameDialog(null)}
          className="game-dialog-modal--global-item"
          title={gameDialog.label}
          mode="alert"
          tone="info"
          confirmLabel="Confirm"
          onConfirm={() => setGameDialog(null)}
          closeOnOverlayClick
          contentClassName="item-detail-game-dialog-body"
        >
          <p>
            Tính năng <strong>{gameDialog.label}</strong> sẽ được cập nhật sau.
          </p>
        </GameDialogModal>
      )}
    </div>
  );
}

export default ItemDetailModal;
