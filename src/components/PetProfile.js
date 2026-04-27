// Pet profile: equipped item detail dùng ItemDetailModal; gỡ đồ trong modal (Remove).
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TemplatePage from './template/TemplatePage';
import BackButton from './BackButton';
import ItemDetailModal from './items/ItemDetailModal';
import SpiritDetailModal from './spirit/SpiritDetailModal';
import GameModalButton from './ui/GameModalButton';
import expTable from '../data/exp_table_petaria.json';

/** Chuẩn hóa dòng từ GET /api/pets/:id/equipment → shape dùng chung với ItemDetailModal (inventory). */
function mapEquippedRowToModalItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    item_id: row.item_id,
    name: row.item_name,
    item_name: row.item_name,
    image_url: row.image_url,
    type: row.type || 'equipment',
    is_equipped: 1,
    durability_left: row.durability_left,
    max_durability: row.max_durability,
    durability_mode: row.durability_mode,
    power: row.power,
    rarity: row.rarity,
    description: row.description,
  };
}

/** API GET /api/pets/:id/hunger-status — cùng kiểu dòng với pet-detail-hp, mp, … */
const PetVitalsDisplay = ({ vitals }) => {
  if (!vitals) return null;
  const hColor = vitals.hunger_color || '#333';
  const mColor = vitals.mood_color || '#333';
  return (
    <>
      <p className="pet-detail-tinh-trang">
        Tình trạng:{' '}
        <span style={{ color: hColor, fontWeight: 600 }}>{vitals.hunger_status_text}</span>
      </p>
      <p className="pet-detail-tam-trang">
        Tâm trạng:{' '}
        <span style={{ color: mColor, fontWeight: 600 }}>{vitals.mood_text}</span>
      </p>
    </>
  );
};

function PetProfile() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [equippedItems, setEquippedItems] = useState([]);
  const [equippedSpirits, setEquippedSpirits] = useState([]);
  const [hungerStatus, setHungerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  
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

  const refreshEquippedItems = useCallback(() => {
    if (!pet?.id || !API_BASE_URL) return;
    fetch(`${API_BASE_URL}/api/pets/${pet.id}/equipment`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setEquippedItems(data);
        else {
          console.warn('Expected array but got:', data);
          setEquippedItems([]);
        }
      })
      .catch((err) => console.error('Error loading equipped items:', err));
  }, [pet?.id, API_BASE_URL]);

  useEffect(() => {
    if (pet?.id) {
      refreshEquippedItems();

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
  }, [pet?.id, API_BASE_URL, refreshEquippedItems]);

  // const handleLogout = () => {
  //   localStorage.removeItem('token');
  //   localStorage.removeItem('isAdmin');
  //   navigate('/login');
  // };

  const handleBack = () => {
    navigate('/myhome');
  };


  // New handlers for detail modals
  const openSpiritDetail = (spirit) => {
    setSelectedSpirit(spirit);
    setShowSpiritDetail(true);
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
        body: JSON.stringify({ userSpiritId })
      });
      if (response.ok) {
        // Refresh equipped spirits
        const spiritsResponse = await fetch(`${API_BASE_URL}/api/pets/${pet.id}/spirits`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (spiritsResponse.ok) {
          const spiritsData = await spiritsResponse.json();
          if (Array.isArray(spiritsData)) setEquippedSpirits(spiritsData);
        }
        alert('Tháo linh thú thành công!');
        // Close modal after successful unequip
        setShowSpiritDetail(false);
        setSelectedSpirit(null);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Lỗi khi tháo linh thú');
      }
    } catch (error) {
      console.error('Error unequipping spirit:', error);
      alert('Lỗi khi tháo linh thú');
    }
  };

  const openItemDetail = (item) => {
    setSelectedItem(item);
    setShowItemDetail(true);
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
  const level = pet.level || 1;
  const expProgress = pet.current_exp ?? 0;
  const expToThisLevel = expTable[level] || 0;
  const expToNextLevel = expTable[level + 1] || 1;
  const expRequired = expToNextLevel - expToThisLevel;
  // const progressPercent = Math.max(Math.floor(((expProgress - expToThisLevel) / expRequired) * 100), 0);

  // Calculate bonus stats
  const bonusStats = calculateBonusStats();

  // Tab configuration for TemplatePage
  const tabs = [
    { label: '← Thú cưng', value: 'pet-profile', path: `/myhome` }
  ];

  // Additional controls for the header
  const additionalControls = (
    <BackButton onClick={handleBack} />
  );

  return (
    <>
      <TemplatePage
        tabs={tabs}
        showSearch={false}
        additionalControls={additionalControls}
        currentTab={0}
      >
        <div className="pet-profile">
          <div className='pet-header'>Xem thông tin thú cưng</div>
          <div className="pet-details">
            <p className="pet-detail-name">Tên: {pet.name}</p>
            <p className="pet-detail-evolved"><span className='extra-stats'>{isEvolved ? 'Đã tiến hóa' : 'Chưa tiến hóa'}</span></p>
            <p className="pet-detail-level">Đẳng cấp: {pet.level}</p>
            <p className="pet-detail-birthday">Sinh Nhật: {pet.created_date ? new Date(pet.created_date).toLocaleDateString() : 'N/A'}</p>
            <p className="pet-detail-rank">Hạng: {pet.rank || 'N/A'}</p>
            <p className="pet-detail-exp">EXP: {expProgress} / {expToNextLevel}</p>
            {/* <progress className="pet-detail-progress" value={(expProgress - expToThisLevel)} max={expRequired}></progress> */}
            <p className="pet-detail-hp">
              Sức Khỏe: {pet.current_hp ?? pet.hp}/{pet.max_hp ?? pet.hp}
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
            {hungerStatus ? (
              <PetVitalsDisplay vitals={hungerStatus} />
            ) : (
              <>
                <p className="pet-detail-tinh-trang">Tình trạng: —</p>
                <p className="pet-detail-tam-trang">Tâm trạng: —</p>
              </>
            )}
            
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
                    className="pet-spirit-image"
                    onClick={() => openSpiritDetail(spirit)}
                  />
                </div>
              ))}
            </div>
            
            <p className="equipped-items-title">Vật phẩm trang bị:</p>
            <div className="equipped-items">
              {equippedItems.length === 0 && <p className="equipped-items-empty">(Không có item nào)</p>}
              {equippedItems.map((item, index) => (
                <div key={item.id} className="equipped-item">
                  {(() => {
                    const isPermanentDurability =
                      String(item.durability_mode || '').toLowerCase() === 'unbreakable' ||
                      Number(item.max_durability || 0) >= 999999;
                    const modeKey = String(item.durability_mode || '').toLowerCase();
                    const isRandomDurability = modeKey === 'unknown' || modeKey === 'random';
                    const durabilityLabel = isPermanentDurability
                      ? 'Vĩnh viễn'
                      : isRandomDurability
                        ? 'Ngẫu Nhiên'
                      : `${item.durability_left ?? 0}/${item.max_durability ?? 0}`;
                    return (
                  <img
                    src={`/images/equipments/${item.image_url}`}
                    alt={item.item_name}
                    title={`${item.item_name} (Độ bền: ${durabilityLabel})`}
                    className="equipped-item-image"
                    onClick={() => openItemDetail(item)}
                  />
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>

      </TemplatePage>

      {showSpiritDetail && selectedSpirit && (
        <SpiritDetailModal
          spirit={selectedSpirit}
          onClose={() => {
            setShowSpiritDetail(false);
            setSelectedSpirit(null);
          }}
        >
          {currentUserId === pet.owner_id && (
            <GameModalButton
              type="button"
              variant="confirm"
              className="inventory-item-modal-remove-game-btn"
              onClick={() => handleUnequipSpirit(selectedSpirit.id)}
            >
              Remove
            </GameModalButton>
          )}
        </SpiritDetailModal>
      )}

      {/* Item detail: cùng component + class global với Inventory (inventory-item-modal-*) */}
      {showItemDetail && selectedItem && (
        <ItemDetailModal
          item={mapEquippedRowToModalItem(selectedItem)}
          onClose={() => {
            setShowItemDetail(false);
            setSelectedItem(null);
          }}
          onUpdateItem={() => {
            refreshEquippedItems();
          }}
        />
      )}
    </>
  );
}

export default PetProfile;