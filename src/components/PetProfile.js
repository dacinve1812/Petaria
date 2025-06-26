// Updated PetProfile.js with remove item icon
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './PetProfile.css';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import expTable from '../data/exp_table_petaria.json';

function PetProfile() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const { uuid } = useParams();
  const [pet, setPet] = useState(null);
  const [equippedItems, setEquippedItems] = useState([]);
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
    }
  }, [pet, API_BASE_URL]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="content">
        <Sidebar userId={currentUserId} handleLogout={handleLogout} isAdmin={isAdmin} />
        <div className="main-content">
          <Navbar />
          <div className="pet-profile">
            <div className='pet-header'>Xem thông tin thú cưng</div>
            <div className="pet-details">
              <p>Tên: {pet.name}</p>
              <p><span className='extra-stats'>{isEvolved ? 'Đã tiến hóa' : 'Chưa tiến hóa'}</span></p>
              <p>Đẳng cấp: {pet.level}</p>
              <p>Sinh Nhật: {pet.created_date ? new Date(pet.created_date).toLocaleDateString() : 'N/A'}</p>
              <p>Hạng: {pet.rank || 'N/A'}</p>
              <p>EXP: {expProgress} / {expToNextLevel}</p>
              <progress value={(expProgress - expToThisLevel)} max={expRequired}></progress>
              <p>Sức Khỏe: {pet.hp}/{pet.max_hp}</p>
              <p>Năng Lượng: {pet.mp}/{pet.max_mp}</p>
              <p>Sức Mạnh: {pet.str}{pet.str_added > 0 ? ` (+${pet.str_added})` : ''}</p>
              <p>Phòng Thủ: {pet.def}{pet.def_added > 0 ? ` (+${pet.def_added})` : ''}</p>
              <p>Thông Minh: {pet.intelligence}{pet.intelligence_added > 0 ? ` (+${pet.intelligence_added})` : ''}</p>
              <p>Tốc Độ: {pet.spd}{pet.spd_added > 0 ? ` (+${pet.spd_added})` : ''}</p>
              <p>Tình Trạng: {pet.status || 'Ổn định'}</p>
              <br />
              <p>Chiến đấu thắng: {pet.battles_won || 'N/A'}</p>
            </div>
            <div className="pet-details-right">
              <img src={`/images/pets/${pet.image}`} alt={pet.name || pet.pet_types_name} className="pet-image" />
              <h2>{pet.name || pet.pet_types_name}</h2>
              <p className="pet-species">Loài: {pet.pet_types_name}</p>
              <p>Linh thú trang bị:</p>
              <p>Vật phẩm trang bị:</p>
              <div className="equipped-items" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {equippedItems.length === 0 && <p>(Không có item nào)</p>}
                {equippedItems.map(item => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <img
                      src={`/images/equipments/${item.image_url}`}
                      alt={item.item_name}
                      title={`${item.item_name} (Durability: ${item.durability})`}
                      style={{ width: 'min(64px,90%)', height: '64px', objectFit: 'contain' }}
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
    </div>
  );
}

export default PetProfile;