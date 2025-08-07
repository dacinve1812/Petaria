// Updated PetProfile.js with remove item icon
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './PetProfile.css';
// import Sidebar from './Sidebar';
// import Navbar from './Navbar';
import BackButton from './BackButton';
import expTable from '../data/exp_table_petaria.json';

// Component hiển thị hunger status
const HungerStatusDisplay = ({ hungerStatus, canBattle }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 0: return '#c20000'; // Chết đói - đỏ
      case 1: return '#c20000'; // Đói - cam
      case 2: return '#870000'; // Hơi đói - vàng
      case 3: return '#870000'; // Mập mạp - xanh
      default: return '#000000';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 0: return 'Chết đói';
      case 1: return 'Đói';
      case 2: return 'Hơi đói';
      case 3: return 'Mập mạp';
      default: return 'Không xác định';
    }
  };

  return (
    <span>
      <span  style={{ color: getStatusColor(hungerStatus) }}>
        <span >{getStatusText(hungerStatus)}</span>
      </span>

      {!canBattle && (
        <div className="battle-warning">
          ⚠️ Pet không thể đấu do đói hoặc hết máu
        </div>
      )}
    </span>
  );
};

function PetProfile() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { uuid } = useParams();
  const [pet, setPet] = useState(null);
  const [equippedItems, setEquippedItems] = useState([]);
  const [equippedSpirits, setEquippedSpirits] = useState([]);
  const [hungerStatus, setHungerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState(null);
  // const isAdmin = localStorage.getItem('isAdmin') === 'true'
  
  // New state for detail modals
  const [showSpiritDetail, setShowSpiritDetail] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      setCurrentUserId(decodedToken.userId);
    } catch (err) {
      console.error('Error decoding token:', err);
      navigate('/login');
      return;
    }

    const fetchPetDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/pets/${uuid}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setPet(data);
      } catch (err) {
        console.error('Error fetching pet details:', err);
        setError('Failed to load pet details.');
      } finally {
        setLoading(false);
      }
    };

    fetchPetDetails();
  }, [uuid, navigate, API_BASE_URL]);

  useEffect(() => {
    if (pet?.id) {
      // Fetch equipped items
      fetch(`${API_BASE_URL}/api/pets/${pet.id}/equipment`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setEquippedItems(data);
          else {
            console.warn('Expected array but got:', data);
            setEquippedItems([]);
          }
        })
        .catch(err => console.error('Error loading equipped items:', err));

      // Fetch equipped spirits
      fetch(`${API_BASE_URL}/api/pets/${pet.id}/spirits`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setEquippedSpirits(data);
          else {
            console.warn('Expected array but got:', data);
            setEquippedSpirits([]);
          }
        })
        .catch(err => console.error('Error loading equipped spirits:', err));

      // Fetch hunger status
      fetch(`${API_BASE_URL}/api/pets/${pet.id}/hunger-status`)
        .then(res => res.json())
        .then(data => {
          setHungerStatus(data);
        })
        .catch(err => console.error('Error loading hunger status:', err));
    }
  }, [pet?.id, API_BASE_URL]);

  // const handleLogout = () => {
  //   localStorage.removeItem('token');
  //   localStorage.removeItem('isAdmin');
  //   navigate('/login');
  // };

  const handleBack = () => {
    navigate('/myhome');
  };

  const handleReleasePet = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn phóng thích thú cưng này?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/pets/${pet.id}/release`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('Phóng thích thú cưng thành công!');
        navigate('/myhome');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Lỗi khi phóng thích thú cưng');
      }
    } catch (error) {
      console.error('Error releasing pet:', error);
      alert('Lỗi khi phóng thích thú cưng');
    }
  };

  const handleUnequip = async (itemId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/equipment/unequip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId })
      });
      if (response.ok) {
        // Refresh equipped items
        const itemsResponse = await fetch(`${API_BASE_URL}/api/pets/${pet.id}/equipment`);
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          if (Array.isArray(itemsData)) setEquippedItems(itemsData);
        }
        alert('Tháo vật phẩm thành công!');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Lỗi khi tháo vật phẩm');
      }
    } catch (error) {
      console.error('Error unequipping item:', error);
      alert('Lỗi khi tháo vật phẩm');
    }
  };

  const handleUnequipSpirit = async (userSpiritId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spirits/unequip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userSpiritId })
      });
      if (response.ok) {
        // Refresh equipped spirits
        const spiritsResponse = await fetch(`${API_BASE_URL}/api/pets/${pet.id}/spirits`);
        if (spiritsResponse.ok) {
          const spiritsData = await spiritsResponse.json();
          if (Array.isArray(spiritsData)) setEquippedSpirits(spiritsData);
        }
        alert('Tháo linh thú thành công!');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Lỗi khi tháo linh thú');
      }
    } catch (error) {
      console.error('Error unequipping spirit:', error);
      alert('Lỗi khi tháo linh thú');
    }
  };

  // New handlers for detail modals
  const openSpiritDetail = (spirit) => {
    setSelectedSpirit(spirit);
    setShowSpiritDetail(true);
  };

  const openItemDetail = (item) => {
    setSelectedItem(item);
    setShowItemDetail(true);
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

  // Calculate bonus stats from equipped spirits and items
  const calculateBonusStats = () => {
    const bonusStats = {
      hp: 0,
      mp: 0,
      str: 0,
      def: 0,
      spd: 0,
      intelligence: 0
    };

    // Calculate bonus from equipped spirits
    equippedSpirits.forEach(spirit => {
      if (spirit.stats) {
        spirit.stats.forEach(stat => {
          const statType = stat.stat_type;
          const value = parseFloat(stat.stat_value) || 0;
          const modifier = stat.stat_modifier;

          if (bonusStats.hasOwnProperty(statType)) {
            if (modifier === 'percentage') {
              // Percentage bonus will be calculated based on base stats
              bonusStats[`${statType}_percent`] = (bonusStats[`${statType}_percent`] || 0) + value;
            } else {
              // Flat bonus
              bonusStats[statType] += value;
            }
          }
        });
      }
    });

    // Calculate bonus from equipped items
    equippedItems.forEach(item => {
      if (item.str_bonus) bonusStats.str += (item.str_bonus || 0);
      if (item.def_bonus) bonusStats.def += (item.def_bonus || 0);
      if (item.spd_bonus) bonusStats.spd += (item.spd_bonus || 0);
      if (item.intelligence_bonus) bonusStats.intelligence += (item.intelligence_bonus || 0);
    });

    // Apply percentage bonuses
    if (bonusStats.hp_percent) {
      bonusStats.hp += Math.floor((pet.hp * bonusStats.hp_percent) / 100);
    }
    if (bonusStats.mp_percent) {
      bonusStats.mp += Math.floor((pet.mp * bonusStats.mp_percent) / 100);
    }
    if (bonusStats.str_percent) {
      bonusStats.str += Math.floor((pet.str * bonusStats.str_percent) / 100);
    }
    if (bonusStats.def_percent) {
      bonusStats.def += Math.floor((pet.def * bonusStats.def_percent) / 100);
    }
    if (bonusStats.spd_percent) {
      bonusStats.spd += Math.floor((pet.spd * bonusStats.spd_percent) / 100);
    }
    if (bonusStats.intelligence_percent) {
      bonusStats.intelligence += Math.floor((pet.intelligence * bonusStats.intelligence_percent) / 100);
    }

    return bonusStats;
  };

  if (loading) return <div>Loading pet details...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!pet) return <div>Pet not found.</div>;

  const isEvolved = pet.evolution_stage === true;
  const currentExp = pet.current_exp || 0;
  const level = pet.level || 1;
  const expToThisLevel = expTable[level] || 0;
  const expToNextLevel = expTable[level + 1] || 1;
  const expProgress = currentExp;
  const expRequired = expToNextLevel - expToThisLevel;
  // const progressPercent = Math.max(Math.floor(((expProgress - expToThisLevel) / expRequired) * 100), 0);

  // Calculate bonus stats
  const bonusStats = calculateBonusStats();

  return (
    <div className="container">
      <header>
        <BackButton onClick={handleBack} />
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>
      <div className="content">

        <div className="main-content">
          {/* <Navbar /> */}
          <div className="pet-profile">
            <div className='pet-header'>Xem thông tin thú cưng</div>
            <div className="pet-details">
              <p className="pet-detail-name">Tên: {pet.name}</p>
              <p className="pet-detail-evolved"><span className='extra-stats'>{isEvolved ? 'Đã tiến hóa' : 'Chưa tiến hóa'}</span></p>
              <p className="pet-detail-level">Đẳng cấp: {pet.level}</p>
              <p className="pet-detail-birthday">Sinh Nhật: {pet.created_date ? new Date(pet.created_date).toLocaleDateString() : 'N/A'}</p>
              <p className="pet-detail-rank">Hạng: {pet.rank || 'N/A'}</p>
              <p className="pet-detail-exp">EXP: {expProgress} / {expToNextLevel}</p>
              <progress className="pet-detail-progress" value={(expProgress - expToThisLevel)} max={expRequired}></progress>
              <p className="pet-detail-hp">
                Sức Khỏe: {pet.hp}/{pet.max_hp}
                {bonusStats.hp > 0 && (
                  <span className="bonus-stats">
                    {' '}+ {bonusStats.hp}
                  </span>
                )}
              </p>
              <p className="pet-detail-mp">
                Năng Lượng: {pet.mp}/{pet.max_mp}
                {bonusStats.mp > 0 && (
                  <span className="bonus-stats">
                    {' '}+ {bonusStats.mp}
                  </span>
                )}
              </p>
              <p className="pet-detail-str">
                Sức Mạnh: {pet.str}
                {bonusStats.str > 0 && (
                  <span className="bonus-stats">
                    {' '}+ {bonusStats.str}
                  </span>
                )}
              </p>
              <p className="pet-detail-def">
                Phòng Thủ: {pet.def}
                {bonusStats.def > 0 && (
                  <span className="bonus-stats">
                    {' '}+ {bonusStats.def}
                  </span>
                )}
              </p>
              <p className="pet-detail-int">
                Thông Minh: {pet.intelligence}
                {bonusStats.intelligence > 0 && (
                  <span className="bonus-stats">
                    {' '}+ {bonusStats.intelligence}
                  </span>
                )}
              </p>
              <p className="pet-detail-spd">
                Tốc Độ: {pet.spd}
                {bonusStats.spd > 0 && (
                  <span className="bonus-stats">
                    {' '}+ {bonusStats.spd}
                  </span>
                )}
              </p>
              <p className="pet-detail-status">Tình Trạng: {hungerStatus ? <HungerStatusDisplay 
                    hungerStatus={hungerStatus.hunger_status}
                    canBattle={hungerStatus.can_battle}
                  /> : 'Ổn định'}</p>
              
              <br />
              <p className="pet-detail-battles">Chiến đấu thắng: {pet.battles_won || 'N/A'}</p>
            </div>
            <div className="pet-details-right">
              <img src={`/images/pets/${pet.image}`} alt={pet.name || pet.pet_types_name} className="pet-image" />
              <h2>{pet.name || pet.pet_types_name}</h2>
              <p className="pet-species">Loài: {pet.pet_types_name}</p>
              <p className="equipped-spirits-title">Linh thú trang bị:</p>
              <div className="equipped-spirits">
                {equippedSpirits.length === 0 && <p className="equipped-spirits-empty">(Không có linh thú nào)</p>}
                {equippedSpirits.map((spirit, index) => (
                  <div key={spirit.id} className="equipped-spirit-item">
                    <img
                      src={`/images/spirit/${spirit.image_url}`}
                      alt={spirit.name}
                      title={`${spirit.name} (${spirit.rarity})`}
                      className="spirit-image"
                      onClick={() => openSpiritDetail(spirit)}
                    />
                    {currentUserId === pet.owner_id && (
                      <button
                        onClick={() => handleUnequipSpirit(spirit.id)}
                        className="remove-button"
                        title="Gỡ linh thú"
                      >
                        <img className="icon-button-1" src="/images/icons/delete.png" alt="remove" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <p className="equipped-items-title">Vật phẩm trang bị:</p>
              <div className="equipped-items">
                {equippedItems.length === 0 && <p className="equipped-items-empty">(Không có item nào)</p>}
                {equippedItems.map((item, index) => (
                  <div key={item.id} className="equipped-item">
                    <img
                      src={`/images/equipments/${item.image_url}`}
                      alt={item.item_name}
                      title={`${item.item_name} (Durability: ${item.durability})`}
                      className="equipped-item-image"
                      onClick={() => openItemDetail(item)}
                    />
                    {currentUserId === pet.owner_id && (
                      <button
                        onClick={() => handleUnequip(item.id)}
                        className="remove-button"
                        title="Gỡ vật phẩm"
                      >
                        <img className="icon-button-1" src="/images/icons/delete.png" alt="remove" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {currentUserId === pet.owner_id && (
            <div className="pet-actions">
              <button className="release-button" onClick={handleReleasePet}>
                Phóng thích thú cưng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Spirit Detail Modal */}
      {showSpiritDetail && selectedSpirit && (
        <div className="detail-modal-overlay">
          <div className="detail-modal">
            <div className="detail-header">
              <h3>{selectedSpirit.name}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowSpiritDetail(false);
                  setSelectedSpirit(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="detail-content">
              <div className="detail-image">
                <img 
                  src={`/images/spirit/${selectedSpirit.image_url}`} 
                  alt={selectedSpirit.name}
                  onError={(e) => {
                    e.target.src = '/images/spirit/angelpuss.gif';
                  }}
                />
              </div>
              
              <div className="detail-info">
                <div className="detail-rarity">
                  <span 
                    className="rarity-badge"
                    style={{ color: getRarityColor(selectedSpirit.rarity) }}
                  >
                    {getRarityText(selectedSpirit.rarity)}
                  </span>
                </div>
                
                <div className="detail-description">
                  <p>{selectedSpirit.description}</p>
                </div>
                
                <div className="detail-stats">
                  <h4>Chỉ số:</h4>
                  <div className="stats-grid">
                    {selectedSpirit.stats && selectedSpirit.stats.map((stat, index) => (
                      <div key={index} className="stat-item">
                        {formatStatValue(stat)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {showItemDetail && selectedItem && (
        <div className="detail-modal-overlay">
          <div className="detail-modal">
            <div className="detail-header">
              <h3>{selectedItem.item_name}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowItemDetail(false);
                  setSelectedItem(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="detail-content">
              <div className="detail-image">
                <img 
                  src={`/images/equipments/${selectedItem.image_url}`} 
                  alt={selectedItem.item_name}
                  onError={(e) => {
                    e.target.src = '/images/equipments/placeholder.png';
                  }}
                />
              </div>
              
              <div className="detail-info">
                <div className="detail-description">
                  <p>{selectedItem.description || 'Không có mô tả'}</p>
                </div>
                
                <div className="detail-stats">
                  <h4>Thông tin:</h4>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <strong>Loại:</strong> {selectedItem.item_type}
                    </div>
                    <div className="stat-item">
                      <strong>Độ bền:</strong> {selectedItem.durability}
                    </div>
                    {selectedItem.str_bonus && (
                      <div className="stat-item">
                        <strong>STR:</strong> +{selectedItem.str_bonus}
                      </div>
                    )}
                    {selectedItem.def_bonus && (
                      <div className="stat-item">
                        <strong>DEF:</strong> +{selectedItem.def_bonus}
                      </div>
                    )}
                    {selectedItem.spd_bonus && (
                      <div className="stat-item">
                        <strong>SPD:</strong> +{selectedItem.spd_bonus}
                      </div>
                    )}
                    {selectedItem.intelligence_bonus && (
                      <div className="stat-item">
                        <strong>INT:</strong> +{selectedItem.intelligence_bonus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PetProfile;