// Updated Inventory.js to show equipped items with toggle and note
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Inventory.css';
import ItemCard from './ItemCard';
import ItemDetailModal from './ItemDetailModal';
import RepairButton from './RepairButton';
import GlobalBanner from '../GlobalBanner';
import { resolveAssetPath } from '../../utils/pathUtils';
import NavigationMenu from '../NavigationMenu';

function Inventory({ isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [sortOption, setSortOption] = useState('name');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showEquipped, setShowEquipped] = useState(true);
  const pageSize = 24;
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      navigate('/login');
    } else {
      try {
        const decodedToken = JSON.parse(atob(storedToken.split('.')[1]));
        setUserId(decodedToken.userId);
        setToken(storedToken);
      } catch (err) {
        console.error('Error decoding token:', err);
        setError('Invalid token');
        return;
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!userId || !token) return;
    fetch(`${API_BASE_URL}/api/users/${userId}/inventory`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setInventoryItems(data))
      .catch(err => {
        console.error('Lỗi khi fetch inventory:', err);
        setError('Không thể tải kho vật phẩm');
      });
  }, [API_BASE_URL, userId, token]);

  const handleLogout = () => {
    onLogoutSuccess();
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleCardClick = (item) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const handleBack = () => {
    navigate('/');
  };

  // Force re-render when filter changes to trigger animation
  const animationKey = `${filterType}-${searchTerm}-${sortOption}-${showEquipped}-${currentPage}`;

  const filterOptions = ['all', 'food', 'consumable', 'equipment', 'booster', 'misc'];

  const filteredItems = inventoryItems
    .filter(item => filterType === 'all' || item.type === filterType)
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(item => showEquipped || !item.is_equipped);

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortOption === 'name') return a.name.localeCompare(b.name);
    if (sortOption === 'quantity') return (b.quantity || 0) - (a.quantity || 0);
    return 0;
  });

  const totalPages = Math.ceil(sortedItems.length / pageSize);
  const paginatedItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateSingleItemInState = (updatedItem) => {
    if (updatedItem === null) {
      // Item was removed (quantity = 0), remove it from state
      setInventoryItems(prev => prev.filter(it => it.id !== selectedItem.id));
      setSelectedItem(null);
    } else {
      // Update item in state
      setInventoryItems(prev =>
        prev.map(it => it.id === updatedItem.id ? updatedItem : it)
      );
    }
  };

  const handleRepairComplete = () => {
    // Refresh inventory after repair
    if (userId && token) {
      fetch(`${API_BASE_URL}/api/users/${userId}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setInventoryItems(data))
        .catch(err => {
          console.error('Lỗi khi refresh inventory:', err);
        });
    }
  };

  if (error) return <div>Error: {error}</div>;

  return (
    <div className="inventory-page">
      {/* Banner section */}
      <GlobalBanner
        backgroundImage={resolveAssetPath("/images/background/inventory2.png")}
        title={false}
        showBackButton={true}
        className="small"
        backgroundPosition="70% 70%"
      />
      <NavigationMenu />

      {/* Main content */}
      <div className="inventory-main">
        {/* Filter options */}
        <div className="filter-section">
          <div className="filter-buttons">
            {filterOptions.map(type => (
              <button
                key={type}
                onClick={() => { setFilterType(type); setCurrentPage(1); }}
                className={`filter-btn ${type === filterType ? 'active' : ''}`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Controls section */}
        <div className="inventory-controls">
          {/* Row 1: Search + Sort */}
          <div className="controls-row controls-row-1">
            <div className="search-section">
              <input
                type="text"
                placeholder="Tìm kiếm vật phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="sort-controls">
              <label className="sort-label">Sắp xếp theo:</label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="sort-select"
              >
                <option value="name">Tên (A-Z)</option>
                <option value="quantity">Số lượng</option>
              </select>
            </div>
          </div>

          {/* Row 2: Toggle + Repair */}
          <div className="controls-row controls-row-2">
            <button
              onClick={() => setShowEquipped(prev => !prev)}
              className="toggle-equipped-btn"
            >
              {showEquipped ? 'Ẩn vật phẩm đã trang bị' : 'Hiện tất cả vật phẩm'}
            </button>

            <div className="repair-section">
              <RepairButton userId={userId} onRepairComplete={handleRepairComplete} />
            </div>
          </div>
        </div>

        {/* Items grid */}
        <div className="inventory-container">
          {paginatedItems.length > 0 ? (
            <div className="item-grid" key={animationKey}>
              {paginatedItems.map((item, index) => (
                <ItemCard
                  key={`${item.id}-${index}`}
                  item={item}
                  note={item.is_equipped ? `Trang bị cho ${item.pet_name || '??'} Lvl. ${item.pet_level}` : ''}
                  icon={item.is_equipped ? <img className="icon-button-1" src="/images/icons/equipped.png" alt="equipped" /> : ''}
                  onClick={() => handleCardClick(item)}
                  style={{ animationDelay: `${index * 0.02}s` }}
                />
              ))}
            </div>
          ) : (
            <div className="empty-inventory">
              <p>Bạn chưa có vật phẩm nào.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination at bottom */}
      {totalPages >= 1 && (
        <div className="pagination-container">
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                disabled={currentPage === i + 1}
                className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={handleCloseModal}
          onUpdateItem={updateSingleItemInState}
        />
      )}
    </div>
  );
}

export default Inventory;
