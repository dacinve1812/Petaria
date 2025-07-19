// Updated Inventory.js to show equipped items with toggle and note
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Inventory.css';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import ItemCard from './ItemCard';
import ItemDetailModal from './ItemDetailModal';
import RepairButton from './RepairButton';

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
  const pageSize = 50;
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
    setInventoryItems(prev =>
      prev.map(it => it.id === updatedItem.id ? updatedItem : it)
    );
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
    <div className="main-content">
          <Navbar />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2>Kho vật phẩm</h2>
              <Link to={`/profile/${userId}`}><p>Trang cá nhân</p></Link>
            </div>
            <RepairButton userId={userId} onRepairComplete={handleRepairComplete} />
          </div>

          <input
            type="text"
            placeholder="Tìm kiếm vật phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '6px', margin: '10px 0', width: '100%' }}
          />

          <div style={{ marginBottom: '10px' }}>
            {filterOptions.map(type => (
              <button
                key={type}
                onClick={() => { setFilterType(type); setCurrentPage(1); }}
                style={{
                  marginRight: '8px', padding: '6px 10px',
                  background: type === filterType ? '#c0ffe4' : '#eee',
                  border: '1px solid #999', borderRadius: '6px'
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Sắp xếp theo:</label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              style={{ marginLeft: '10px', padding: '4px 8px' }}
            >
              <option value="name">Tên (A-Z)</option>
              <option value="quantity">Số lượng</option>
            </select>
            <button
              onClick={() => setShowEquipped(prev => !prev)}
              style={{ marginLeft: '20px', background: '#ddd', padding: '6px 10px', border: '1px solid #aaa' }}
            >
              {showEquipped ? 'Ẩn vật phẩm đã trang bị' : 'Hiện tất cả vật phẩm'}
            </button>
          </div>
          

          <div className="inventory-container">
            {paginatedItems.length > 0 ? (
              <div className="item-grid">
                {paginatedItems.map((item, index) => (
                  <ItemCard
                    key={`${item.id}-${index}`}
                    item={item}
                    note={item.is_equipped ? `Trang bị cho ${item.pet_name || '??'} Lvl. ${item.pet_level}` : ''}
                    icon={item.is_equipped ? <img className="icon-button-1" src="/images/icons/equipped.png" alt="equipped" /> : ''}
                    onClick={() => handleCardClick(item)}
                  />
                ))}
              </div>
            ) : (
              <p>Bạn chưa có vật phẩm nào.</p>
            )}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  disabled={currentPage === i + 1}
                  style={{ margin: '0 5px' }}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {selectedItem && (
              <ItemDetailModal
              item={selectedItem}
              onClose={handleCloseModal}
              onUpdateItem={updateSingleItemInState}
            />
            )}
          </div>
        </div>
  );
}

export default Inventory;
