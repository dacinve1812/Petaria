// Updated PetProfile.js with remove item icon
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './PetProfile.css';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
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
  const [hungerStatus, setHungerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState(null);
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

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

      // Fetch hunger status
      fetch(`${API_BASE_URL}/api/pets/${pet.id}/hunger-status`)
        .then(res => res.json())
        .then(data => {
          setHungerStatus(data);
        })
        .catch(err => console.error('Error loading hunger status:', err));
    }
  }, [pet, API_BASE_URL]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleBack = () => {
    navigate('/myhome');
  };

  const handleReleasePet = async () => {
    if (!pet || !currentUserId) return;
    if (pet.owner_id !== currentUserId) {
      alert('Bạn không có quyền phóng thích thú cưng này.');
      return;
    }
    const confirmRelease = window.confirm(`Bạn có chắc chắn muốn phóng thích ${pet.name || pet.pet_types_name} không? Hành động này không thể hoàn tác.`);
    if (confirmRelease) {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch(`${API_BASE_URL}/api/pets/${uuid}/release`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          alert('Thú cưng đã được phóng thích thành công.');
          navigate('/myhome');
        } else if (response.status === 401) {
          setError('Bạn chưa đăng nhập.');
          navigate('/login');
        } else if (response.status === 403) {
          alert('Bạn không có quyền phóng thích thú cưng này.');
        } else if (response.status === 404) {
          setError('Không tìm thấy thú cưng này.');
        } else {
          const errorData = await response.json();
          setError(`Lỗi khi phóng thích thú cưng: ${errorData?.message || response.statusText}`);
        }
      } catch (err) {
        console.error('Error releasing pet:', err);
        setError('Lỗi mạng khi phóng thích thú cưng.');
      }
    }
  };

  const handleUnequip = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/${itemId}/unequip`, {
        method: 'POST'
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message || 'Đã gỡ vật phẩm!');
        setEquippedItems(prev => prev.filter(item => item.id !== itemId));
      } else {
        alert(result.message || 'Không thể gỡ vật phẩm.');
      }
    } catch (err) {
      console.error('Lỗi khi gọi API unequip:', err);
      alert('Lỗi khi gỡ vật phẩm.');
    }
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
  const progressPercent = Math.max(Math.floor(((expProgress - expToThisLevel) / expRequired) * 100), 0);

  return (
    <div className="container">
      <header>
        <BackButton onClick={handleBack} />
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>
      <div className="content">

        <div className="main-content">
          <Navbar />
          <div className="pet-profile">
            <div className='pet-header'>Xem thông tin thú cưng</div>
            <div className="pet-details">
              <p style={{ animationDelay: '0.02s' }}>Tên: {pet.name}</p>
              <p style={{ animationDelay: '0.04s' }}><span className='extra-stats'>{isEvolved ? 'Đã tiến hóa' : 'Chưa tiến hóa'}</span></p>
              <p style={{ animationDelay: '0.06s' }}>Đẳng cấp: {pet.level}</p>
              <p style={{ animationDelay: '0.08s' }}>Sinh Nhật: {pet.created_date ? new Date(pet.created_date).toLocaleDateString() : 'N/A'}</p>
              <p style={{ animationDelay: '0.1s' }}>Hạng: {pet.rank || 'N/A'}</p>
              <p style={{ animationDelay: '0.12s' }}>EXP: {expProgress} / {expToNextLevel}</p>
              <progress value={(expProgress - expToThisLevel)} max={expRequired} style={{ animationDelay: '0.13s' }}></progress>
              <p style={{ animationDelay: '0.14s' }}>Sức Khỏe: {pet.hp}/{pet.max_hp}</p>
              <p style={{ animationDelay: '0.16s' }}>Năng Lượng: {pet.mp}/{pet.max_mp}</p>
              <p style={{ animationDelay: '0.18s' }}>Sức Mạnh: {pet.str}{pet.str_added > 0 ? ` (+${pet.str_added})` : ''}</p>
              <p style={{ animationDelay: '0.2s' }}>Phòng Thủ: {pet.def}{pet.def_added > 0 ? ` (+${pet.def_added})` : ''}</p>
              <p style={{ animationDelay: '0.22s' }}>Thông Minh: {pet.intelligence}{pet.intelligence_added > 0 ? ` (+${pet.intelligence_added})` : ''}</p>
              <p style={{ animationDelay: '0.24s' }}>Tốc Độ: {pet.spd}{pet.spd_added > 0 ? ` (+${pet.spd_added})` : ''}</p>
              <p style={{ animationDelay: '0.26s' }}>Tình Trạng: {hungerStatus ? <HungerStatusDisplay 
                    hungerStatus={hungerStatus.hunger_status}
                    canBattle={hungerStatus.can_battle}
                  /> : 'Ổn định'}</p>
              
              <br />
              <p style={{ animationDelay: '0.28s' }}>Chiến đấu thắng: {pet.battles_won || 'N/A'}</p>
            </div>
            <div className="pet-details-right">
              <img src={`/images/pets/${pet.image}`} alt={pet.name || pet.pet_types_name} className="pet-image" />
              <h2>{pet.name || pet.pet_types_name}</h2>
              <p className="pet-species">Loài: {pet.pet_types_name}</p>
              <p style={{ animationDelay: '0.3s' }}>Linh thú trang bị:</p>
              <p style={{ animationDelay: '0.32s' }}>Vật phẩm trang bị:</p>
              <div className="equipped-items" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {equippedItems.length === 0 && <p style={{ animationDelay: '0.34s' }}>(Không có item nào)</p>}
                {equippedItems.map((item, index) => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <img
                      src={`/images/equipments/${item.image_url}`}
                      alt={item.item_name}
                      title={`${item.item_name} (Durability: ${item.durability})`}
                      style={{ 
                        width: 'min(64px,90%)', 
                        height: '64px', 
                        objectFit: 'contain',
                        animationDelay: `${0.34 + (index * 0.02)}s`
                      }}
                    />
                    {currentUserId === pet.owner_id && (
                      <button
                        onClick={() => handleUnequip(item.id)}
                        className="remove-button"
                        title="Gỡ vật phẩm"
                        style={{ animationDelay: `${0.34 + (index * 0.02)}s` }}
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
    </div>
  );
}

export default PetProfile;