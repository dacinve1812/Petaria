import React, { useState, useEffect } from 'react';
import './SpiritManagement.css';

const SpiritManagement = ({ userId }) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [userSpirits, setUserSpirits] = useState([]);
  const [availableSpirits, setAvailableSpirits] = useState([]);
  const [userPets, setUserPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  
  // New state for search, filter, and sort
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState('all');
  const [sortOption, setSortOption] = useState('rarity');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSpiritDetail, setSelectedSpiritDetail] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12; // Limit spirits per page

  useEffect(() => {
    if (userId) {
      fetchUserSpirits();
      fetchAvailableSpirits();
      fetchUserPets();
    }
  }, [userId]);

  const fetchUserSpirits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/spirits`);
      if (response.ok) {
        const data = await response.json();
        // Ensure boolean values for is_equipped
        const processedData = data.map(spirit => ({
          ...spirit,
          is_equipped: Boolean(spirit.is_equipped),
          equipped_pet_name: spirit.equipped_pet_name || null
        }));
        setUserSpirits(processedData);
      }
    } catch (error) {
      console.error('Error fetching user spirits:', error);
    }
  };

  const fetchAvailableSpirits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spirits`);
      if (response.ok) {
        const data = await response.json();
        setAvailableSpirits(data);
      }
    } catch (error) {
      console.error('Error fetching available spirits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/pets`);
      if (response.ok) {
        const data = await response.json();
        setUserPets(data);
      }
    } catch (error) {
      console.error('Error fetching user pets:', error);
    }
  };

  // Filter and search logic
  const filteredSpirits = userSpirits
    .filter(spirit => {
      const matchesSearch = spirit.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           spirit.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterRarity === 'all' || spirit.rarity === filterRarity;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortOption === 'rarity') {
        const rarityOrder = { 'legendary': 4, 'epic': 3, 'rare': 2, 'common': 1 };
        return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
      } else if (sortOption === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortOption === 'equipped') {
        if (a.is_equipped && !b.is_equipped) return -1;
        if (!a.is_equipped && b.is_equipped) return 1;
        return 0;
      }
      return 0;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredSpirits.length / pageSize);
  const paginatedSpirits = filteredSpirits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRarity, sortOption]);

  const handleEquipSpirit = async (userSpiritId, petId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spirits/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userSpiritId, petId }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchUserSpirits(); // Refresh data
        setShowEquipModal(false);
        setSelectedSpirit(null);
        setSelectedPet(null);
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error equipping spirit:', error);
      alert('Lỗi khi trang bị Linh Thú');
    }
  };

  const handleUnequipSpirit = async (userSpiritId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spirits/unequip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userSpiritId }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchUserSpirits(); // Refresh data
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error unequipping spirit:', error);
      alert('Lỗi khi tháo Linh Thú');
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#9d9d9d';
      case 'rare': return '#0070dd';
      case 'epic': return '#a335ee';
      case 'legendary': return '#ff8000';
      default: return '#9d9d9d';
    }
  };

  const getRarityText = (rarity) => {
    switch (rarity) {
      case 'common': return 'Thường';
      case 'rare': return 'Hiếm';
      case 'epic': return 'Epic';
      case 'legendary': return 'Huyền thoại';
      default: return 'Thường';
    }
  };

  const formatStatValue = (stat) => {
    const value = stat.stat_value;
    const modifier = stat.stat_modifier;
    const type = stat.stat_type;
    
    let statText = '';
    switch (type) {
      case 'hp': statText = 'HP'; break;
      case 'mp': statText = 'MP'; break;
      case 'str': statText = 'STR'; break;
      case 'def': statText = 'DEF'; break;
      case 'spd': statText = 'SPD'; break;
      case 'intelligence': statText = 'INT'; break;
      default: statText = type.toUpperCase();
    }

    const sign = value >= 0 ? '+' : '';
    const modifierText = modifier === 'percentage' ? '%' : '';
    
    return `${sign}${value}${modifierText} ${statText}`;
  };

  const openEquipModal = (spirit) => {
    setSelectedSpirit(spirit);
    setSelectedPet(null);
    setShowEquipModal(true);
  };

  const openDetailModal = (spirit) => {
    setSelectedSpiritDetail(spirit);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="spirit-management">
        <div className="loading-message">
          <p>Đang tải linh thú...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spirit-management">
      {/* Spirit Controls */}
      <div className="spirit-controls-bar">
        <div className="controls-row">
          <div className="search-section">
            <input
              type="text"
              placeholder="Tìm kiếm linh thú..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-controls">
            <label className="filter-label">Lọc theo:</label>
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tất cả</option>
              <option value="common">Thường</option>
              <option value="rare">Hiếm</option>
              <option value="epic">Epic</option>
              <option value="legendary">Huyền thoại</option>
            </select>
          </div>
          
          <div className="sort-controls">
            <label className="sort-label">Sắp xếp theo:</label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="sort-select"
            >
              <option value="rarity">Độ hiếm (cao → thấp)</option>
              <option value="name">Tên (A-Z)</option>
              <option value="equipped">Trạng thái trang bị</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Spirit Container */}
      <div className="spirit-container">
        <h3>Linh Thú Của Bạn ({filteredSpirits.length})</h3>
        {paginatedSpirits.length > 0 ? (
          <div className="spirit-grid">
            {paginatedSpirits.map((spirit) => (
              <div key={spirit.id} className={`spirit-card ${spirit.is_equipped ? 'equipped' : ''}`}>
                <div className="spirit-image" onClick={() => openDetailModal(spirit)}>
                  <img 
                    src={`/images/spirit/${spirit.image_url}`} 
                    alt={spirit.name}
                    onError={(e) => {
                      e.target.src = '/images/spirit/angelpuss.gif'; // Fallback image
                    }}
                  />
                </div>
                <div className="spirit-info">
                  <h4 className="spirit-name">{spirit.name}</h4>
                  <span 
                    className="spirit-rarity"
                    style={{ color: getRarityColor(spirit.rarity) }}
                  >
                    {getRarityText(spirit.rarity)}
                  </span>
                  <p className="spirit-description">{spirit.description}</p>
                  
                  <div className="spirit-stats">
                    {spirit.stats && spirit.stats.map((stat, index) => (
                      <span key={index} className="spirit-stat">
                        {formatStatValue(stat)}
                      </span>
                    ))}
                  </div>

                  {spirit.is_equipped && spirit.equipped_pet_name && (
                    <div className="equipped-info">
                      <span className="equipped-text">Đang trang bị cho: {spirit.equipped_pet_name}</span>
                      <button 
                        className="unequip-btn"
                        onClick={() => handleUnequipSpirit(spirit.id)}
                      >
                        Tháo
                      </button>
                    </div>
                  )}

                  {!spirit.is_equipped && (
                    <button 
                      className="equip-btn"
                      onClick={() => openEquipModal(spirit)}
                    >
                      Trang Bị
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-message">
            <p>Bạn chưa có linh thú nào.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
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

      {/* Equip Modal */}
      {showEquipModal && selectedSpirit && (
        <div className="equip-modal-overlay">
          <div className="equip-modal">
            <h3>Trang Bị Linh Thú: {selectedSpirit.name}</h3>
            <p>Chọn pet để trang bị:</p>
            
            <div className="pet-selection">
              {userPets.map((pet) => (
                <div 
                  key={pet.id} 
                  className={`pet-option ${selectedPet?.id === pet.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPet(pet)}
                >
                  <img 
                    src={`/images/pets/${pet.image}`} 
                    alt={pet.name}
                    className="pet-option-image"
                  />
                  <div className="pet-option-info">
                    <h4>{pet.name}</h4>
                    <p>Level {pet.level}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowEquipModal(false);
                  setSelectedSpirit(null);
                  setSelectedPet(null);
                }}
              >
                Hủy
              </button>
              <button 
                className="confirm-btn"
                disabled={!selectedPet}
                onClick={() => handleEquipSpirit(selectedSpirit.id, selectedPet.id)}
              >
                Trang Bị
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSpiritDetail && (
        <div className="detail-modal-overlay">
          <div className="detail-modal">
            <div className="detail-header">
              <h3>{selectedSpiritDetail.name}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedSpiritDetail(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="detail-content">
              <div className="detail-image">
                <img 
                  src={`/images/spirit/${selectedSpiritDetail.image_url}`} 
                  alt={selectedSpiritDetail.name}
                  onError={(e) => {
                    e.target.src = '/images/spirit/angelpuss.gif';
                  }}
                />
              </div>
              
              <div className="detail-info">
                <div className="detail-rarity">
                  <span 
                    className="rarity-badge"
                    style={{ color: getRarityColor(selectedSpiritDetail.rarity) }}
                  >
                    {getRarityText(selectedSpiritDetail.rarity)}
                  </span>
                </div>
                
                <div className="detail-description">
                  <p>{selectedSpiritDetail.description}</p>
                </div>
                
                <div className="detail-stats">
                  <h4>Chỉ số:</h4>
                  <div className="stats-grid">
                    {selectedSpiritDetail.stats && selectedSpiritDetail.stats.map((stat, index) => (
                      <div key={index} className="stat-item">
                        {formatStatValue(stat)}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedSpiritDetail.is_equipped && selectedSpiritDetail.equipped_pet_name && (
                  <div className="detail-equipped">
                    <p><strong>Đang trang bị cho:</strong> {selectedSpiritDetail.equipped_pet_name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpiritManagement; 