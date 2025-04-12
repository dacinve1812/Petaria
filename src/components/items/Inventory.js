import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Inventory.css';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import ItemCard from './ItemCard';
import ItemDetailModal from './ItemDetailModal';

const mockItems = [
  {
    id: 1,
    name: 'Morguss Spell Book',
    image_url: '/images/equipments/boo_morguss_spells.gif',
    description: 'A dark dagger made from volcanic rock.',
    type: 'equipment',
    rarity: 'rare',
    quantity: 1,
  },
  {
    id: 2,
    name: 'Altador Dog',
    image_url: '/images/equipments/alf_hotdog.gif',
    description: 'Restores 10% HP.',
    type: 'food',
    rarity: 'common',
    quantity: 5,
  },
];

function Inventory({ isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const navigate = useNavigate();

  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        setUserId(decodedToken.userId);
      } catch (err) {
        console.error('Error decoding token:', err);
        setError('Invalid token');
        return;
      }
    }
  }, [navigate]);

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

  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container">
      <header>
        <img
          src="/images/buttons/banner.jpeg"
          alt="Banner Petaria"
        />
      </header>

      <div className="content">
        <Sidebar
          userId={userId}
          handleLogout={handleLogout}
          isAdmin={isAdmin}
        />

        <div className="main-content">
          <Navbar />
          <h2>Kho vật phẩm</h2>
          <Link to={`/profile/${userId}`}>
            <p>Trang cá nhân</p>
          </Link>

          <div>
            {mockItems.length > 0 ? (
              <div className="inventory-container">
                <div className="item-grid">
                  {mockItems.map((item) => (
                    <ItemCard key={item.id} item={item} onClick={() => handleCardClick(item)} />
                  ))}
                </div>
                {selectedItem && (
                  <ItemDetailModal item={selectedItem} onClose={handleCloseModal} />
                )}
              </div>
            ) : (
              <p>Bạn chưa có vật phẩm nào.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Inventory;
