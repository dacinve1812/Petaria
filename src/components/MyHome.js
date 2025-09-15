import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import './MyHome.css';
import GlobalBanner from './GlobalBanner';
import { resolveAssetPath } from '../utils/pathUtils';


function MyHome({isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 
  const [userPets, setUserPets] = useState([]);
  const [userSpirits, setUserSpirits] = useState([]);
  const [availableSpirits, setAvailableSpirits] = useState([]);
  const [spiritUserPets, setSpiritUserPets] = useState([]);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [spiritLoading, setSpiritLoading] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState({});
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired
      if (decodedToken.exp < currentTime) {
        localStorage.removeItem('token');
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        return;
      }
      
      setUserId(decodedToken.userId);
    } catch (err) {
      console.error('Error decoding token:', err);
      setError('Token không hợp lệ');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
  }, [navigate]);

  const handleLogout = () => {
    onLogoutSuccess();
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // Get current active tab from URL path
  const getCurrentTab = () => {
    const currentPath = location.pathname;
    if (currentPath === '/myhome/spirits') return 1;
    return 0; // Default to pets tab
  };

  const currentTab = getCurrentTab();

  // Fetch pets when userId is available
  useEffect(() => {
    const fetchUserPets = async () => {
      if (userId) {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/users/${userId}/pets`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            // Sort pets: deployed pets first, then by level descending
            const sortedPets = data.sort((a, b) => {
              if (a.is_deployed && !b.is_deployed) return -1;
              if (!a.is_deployed && b.is_deployed) return 1;
              return (b.level || 0) - (a.level || 0);
            });
            setUserPets(sortedPets);
            
            // Update localStorage hasPet status based on whether user has pets
            localStorage.setItem('hasPet', String(data.length > 0));
            
            // Preload first few images for better UX
            const firstFewPets = sortedPets.slice(0, 6);
            firstFewPets.forEach(pet => {
              const img = new Image();
              img.src = `/images/pets/${pet.image}`;
            });
          } else if (response.status === 401) {
            // Handle token expiration
            localStorage.removeItem('token');
            setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          } else {
            setError('Failed to fetch pets');
          }
        } catch (err) {
          console.error('Error fetching pets:', err);
          setError('Network error');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchUserPets();
  }, [userId, navigate]);

  // Fetch spirits when userId is available
  useEffect(() => {
    const fetchUserSpirits = async () => {
      if (userId) {
        setSpiritLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/users/${userId}/spirits`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            const processedData = data.map(spirit => ({
              ...spirit,
              is_equipped: Boolean(spirit.is_equipped),
              equipped_pet_name: spirit.equipped_pet_name || null
            }));
            setUserSpirits(processedData);
          } else if (response.status === 401) {
            // Handle token expiration
            localStorage.removeItem('token');
            setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        } catch (error) {
          console.error('Error fetching user spirits:', error);
        }
      }
    };

    const fetchAvailableSpirits = async () => {
      if (userId) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/spirits`);
          if (response.ok) {
            const data = await response.json();
            setAvailableSpirits(data);
          }
        } catch (error) {
          console.error('Error fetching available spirits:', error);
        } finally {
          setSpiritLoading(false);
        }
      }
    };

    const fetchSpiritUserPets = async () => {
      if (userId) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/users/${userId}/pets`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setSpiritUserPets(data);
          } else if (response.status === 401) {
            // Handle token expiration
            localStorage.removeItem('token');
            setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          } else {
            console.error('Failed to fetch user pets for spirits:', response.status);
          }
        } catch (error) {
          console.error('Error fetching user pets for spirits:', error);
        }
      }
    };

    fetchUserSpirits();
    fetchAvailableSpirits();
    fetchSpiritUserPets();
  }, [userId]);

  const handleBack = () => {
    navigate('/');
  };

  // Tab configuration
  const tabs = [
    { label: 'Thú cưng', value: 'pet', path: '/myhome' },
    { label: 'Linh thú', value: 'spirits', path: '/myhome/spirits' }
  ];

  // Search handlers for each tab
  const [petSearchTerm, setPetSearchTerm] = useState('');
  const [spiritSearchTerm, setSpiritSearchTerm] = useState('');

  const searchHandlers = {
    pet: (searchValue) => {
      setPetSearchTerm(searchValue);
    },
    spirits: (searchValue) => {
      setSpiritSearchTerm(searchValue);
    }
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>

      {/* Main content using TemplatePage */}
      <TemplatePage
        tabs={tabs}
        showSearch={true}
        searchPlaceholder={currentTab === 0 ? "Tìm kiếm thú cưng..." : "Tìm kiếm linh thú..."}
        searchHandlers={searchHandlers}
        currentTab={currentTab}
      >
        <>
          {currentTab === 0 ? (
            <PetManagement 
              userPets={userPets}
              isLoading={isLoading}
              imageLoadErrors={imageLoadErrors}
              setImageLoadErrors={setImageLoadErrors}
              searchTerm={petSearchTerm}
            />
          ) : (
            <SpiritManagement 
              userSpirits={userSpirits}
              spiritUserPets={spiritUserPets}
              isLoading={spiritLoading}
              searchTerm={spiritSearchTerm}
              onRefreshSpirits={() => {
                // Refresh spirits data
                const fetchUserSpirits = async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/spirits`, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    if (response.ok) {
                      const data = await response.json();
                      const processedData = data.map(spirit => ({
                        ...spirit,
                        is_equipped: Boolean(spirit.is_equipped),
                        equipped_pet_name: spirit.equipped_pet_name || null
                      }));
                      setUserSpirits(processedData);
                    } else if (response.status === 401) {
                      // Handle token expiration
                      localStorage.removeItem('token');
                      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                      setTimeout(() => {
                        navigate('/login');
                      }, 2000);
                    }
                  } catch (error) {
                    console.error('Error refreshing user spirits:', error);
                  }
                };
                fetchUserSpirits();
              }}
            />
          )}
        </>
      </TemplatePage>
    </>
  );
}

// Pet Management Component
function PetManagement({ userPets, isLoading, imageLoadErrors, setImageLoadErrors, searchTerm }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOption, setSortOption] = useState('level');
  const pageSize = 20;

  // Filter and search logic
  const filteredPets = userPets
    .filter(pet => {
      const matchesSearch = pet.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           pet.species_name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortOption === 'level') {
        return (b.level || 0) - (a.level || 0);
      } else if (sortOption === 'species') {
        return (a.species_name || '').localeCompare(b.species_name || '');
      }
      return 0;
    });

  const totalPages = Math.ceil(filteredPets.length / pageSize);
  const paginatedPets = filteredPets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      {/* Pet Container */}
      
        <div className="pet-list-info">
          <h3>Pet của bạn ({userPets.length})</h3>
          <div className="pet-controls">
            <div className="sort-controls">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="sort-select"
              >
                <option value="level">Level</option>
                <option value="species">Species</option>
              </select>
            </div>
          </div>
        </div>
      {isLoading ? (
        <div className="loading-message">
          <p>Loading...</p>
        </div>
        ) : paginatedPets.length > 0 ? (
          <div className="pets-grid" key={`pet-${currentPage}-${searchTerm}-${sortOption}`}>
            {paginatedPets.map((pet, index) => (
              <div
                key={`${pet.uuid}-${index}`}
                className="pet-card"
                style={{ animationDelay: `${index * 0.02}s` }}
              >
                <Link to={`/pet/${pet.uuid}`} style={{ textDecoration: 'none' }}>
                  <div className="pet-image-container">
                    <img 
                      src={imageLoadErrors[pet.uuid] ? '/images/pets/placeholder.png' : `/images/pets/${pet.image}`}
                      alt={pet.name || pet.species_name}
                      className="myhome-pet-image"
                      loading="lazy"
                      onError={(e) => {
                        setImageLoadErrors(prev => ({
                          ...prev,
                          [pet.uuid]: true
                        }));
                        e.target.src = '/images/pets/placeholder.png';
                        e.target.onerror = null;
                      }}
                    />
                    {pet.is_deployed && (
                      <div className="deployed-badge">
                        <span>Trong đội</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pet-info">
                    <div className="pet-name">
                      {pet.name || pet.species_name}
                    </div>
                    <div className="pet-level">
                      Cấp độ {pet.level}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-message">
            <p>Bạn chưa có thú cưng nào.</p>
          </div>
        )}
      

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
    </>
  );
}

// Spirit Management Component
function SpiritManagement({ userSpirits, spiritUserPets, isLoading, searchTerm, onRefreshSpirits }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [filterRarity, setFilterRarity] = useState('all');
  const [sortOption, setSortOption] = useState('rarity');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSpiritDetail, setSelectedSpiritDetail] = useState(null);
  const pageSize = 12;

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

  const totalPages = Math.ceil(filteredSpirits.length / pageSize);
  const paginatedSpirits = filteredSpirits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRarity, sortOption]);

  const handleEquipSpirit = async (userSpiritId, petId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/spirits/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userSpiritId, petId }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        onRefreshSpirits();
        setShowEquipModal(false);
        setSelectedSpirit(null);
        setSelectedPet(null);
        // Also close detail modal if it's open
        setShowDetailModal(false);
        setSelectedSpiritDetail(null);
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/spirits/unequip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userSpiritId }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        onRefreshSpirits();
        // Also close detail modal if it's open
        setShowDetailModal(false);
        setSelectedSpiritDetail(null);
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

  if (isLoading) {
    return (
      <div className="spirit-management">
        <div className="loading-message">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Spirit Container */}
      <div className="spirit-container">
        <div className="spirit-header">
          <h3>Linh Thú Của Bạn ({filteredSpirits.length})</h3>
          <div className="spirit-controls">
            <div className="spirit-filter-controls">
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
              <label className="sort-label">Sort</label>
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
        
        {paginatedSpirits.length > 0 ? (
          <div className="spirit-grid">
            {paginatedSpirits.map((spirit) => (
              <div key={spirit.id} className={`spirit-card ${spirit.is_equipped ? 'equipped' : ''}`}>
                <div className="spirit-image" onClick={() => openDetailModal(spirit)}>
                  <img 
                    src={`/images/spirit/${spirit.image_url}`} 
                    alt={spirit.name}
                    onError={(e) => {
                      e.target.src = '/images/spirit/angelpuss.gif';
                    }}
                  />
                </div>
                <div className="spirit-info">
                  <h4 className="spirit-name" onClick={() => openDetailModal(spirit)}>{spirit.name}</h4>
                  <span 
                    className="spirit-rarity"
                    style={{ color: getRarityColor(spirit.rarity) }}
                  >
                    {getRarityText(spirit.rarity)}
                  </span>

                  {spirit.is_equipped && spirit.equipped_pet_name && (
                    <div className="equipped-info">
                      <span className="equipped-text">Đang trang bị cho: {spirit.equipped_pet_name}</span>
                    </div>
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
              {spiritUserPets.map((pet) => (
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

      {/* Spirit Detail Modal */}
      {showDetailModal && selectedSpiritDetail && (
        <div 
          className="detail-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailModal(false);
              setSelectedSpiritDetail(null);
              setSelectedPet(null);
            }
          }}
        >
          <div className="spirit-detail-modal">
            <div className="spirit-detail-modal-header">
              <h3>{selectedSpiritDetail.name}</h3>
              <button 
                className="spirit-detail-close-btn"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedSpiritDetail(null);
                  setSelectedPet(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="spirit-detail-modal-content">
              <div className="spirit-detail-left-section">
                {/* Rarity Badge above image */}
                <div className="spirit-detail-rarity-section">
                  <span 
                    className="spirit-detail-rarity-badge"
                    style={{ color: getRarityColor(selectedSpiritDetail.rarity) }}
                  >
                    {getRarityText(selectedSpiritDetail.rarity)}
                  </span>
                </div>
                
                {/* Spirit Image */}
                <div className="spirit-image">
                  <img 
                    src={`/images/spirit/${selectedSpiritDetail.image_url}`} 
                    alt={selectedSpiritDetail.name}
                    
                    onError={(e) => {
                      e.target.src = '/images/spirit/angelpuss.gif';
                    }}
                  />
                </div>
                
                {/* Equipped Status below image */}
                {selectedSpiritDetail.is_equipped && selectedSpiritDetail.equipped_pet_name && (
                  <div className="spirit-detail-equipped-info">
                    <p>Đang trang bị cho: {selectedSpiritDetail.equipped_pet_name}</p>
                  </div>
                )}
              </div>
              
              <div className="spirit-detail-right-section">
                <h4>Mô tả:</h4>
                <div className="spirit-detail-description-section">
                  <p>{selectedSpiritDetail.description}</p>
                </div>
                
                <div className="spirit-detail-stats-section">
                  <h4>Chỉ số:</h4>
                  <div className="spirit-detail-stats-grid">
                    {selectedSpiritDetail.stats && selectedSpiritDetail.stats.map((stat, index) => (
                      <div key={index} className="spirit-detail-stat-item">
                        {formatStatValue(stat)}
                      </div>
                    ))}
                  </div>
                </div>

                
              </div>
              
            </div>
            {/* Pet Selection and Action Buttons */}
            <div className="spirit-detail-actions-section">
                  {!selectedSpiritDetail.is_equipped ? (
                    <div className="spirit-detail-equip-section">
                      <label className="spirit-detail-pet-select-label">Chọn thú cưng để trang bị:</label>
                      <select
                        value={selectedPet?.id || ''}
                        onChange={(e) => {
                          const petId = e.target.value;
                          const pet = spiritUserPets.find(p => p.id === parseInt(petId));
                          setSelectedPet(pet);
                        }}
                        className="spirit-detail-pet-select"
                      >
                        <option value="">-- Chọn thú cưng --</option>
                        {spiritUserPets.map((pet) => (
                          <option key={pet.id} value={pet.id}>
                            {pet.name} (Level {pet.level})
                          </option>
                        ))}
                      </select>
                      <button 
                        className="spirit-detail-equip-btn"
                        disabled={!selectedPet}
                        onClick={() => handleEquipSpirit(selectedSpiritDetail.id, selectedPet.id)}
                      >
                        Equip
                      </button>
                    </div>
                  ) : (
                    <div className="spirit-detail-unequip-section">
                      <button 
                        className="spirit-detail-unequip-btn"
                        onClick={() => handleUnequipSpirit(selectedSpiritDetail.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MyHome;