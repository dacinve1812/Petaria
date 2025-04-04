import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './HomePage.css'; 
import Sidebar from './Sidebar';


function MyHome({isLoggedIn, onLogoutSuccess }) {
  const [userPets, setUserPets] = useState([]);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    } else {
      // Giải mã token để lấy userId
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

  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    const fetchUserPets = async () => {
      if (userId) {
        try {
          const response = await fetch(`http://localhost:5000/users/${userId}/pets`);
          if (response.ok) {
            const data = await response.json();
            setUserPets(data);
          } else {
            setError('Failed to fetch pets');
          }
        } catch (err) {
          console.error('Error fetching pets:', err);
          setError('Network error');
        }
      }
    };

    fetchUserPets();
  }, [userId]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container">
      <header>
      <img
          src="/images/buttons/banner.jpeg"
          alt="Banner Petaria"
        />
        {/* <h1>Petaria - Vương quốc thú ảo</h1> */}
      </header>
      <div className="content">
      <Sidebar
          userId={userId}
          handleLogout={handleLogout}
          isAdmin={isAdmin}
        />
      <div className="main-content">
        <div>
          <h2>Nhà của tôi</h2>
          <Link to={`/profile/${userId}`}>
              <p>Trang cá nhân</p>
            </Link>
          {/* <h3><a href={`/profile/${userId}`}>Trang Cá nhân</a></h3> */}
          <div>
            <h3>Thú cưng của bạn:</h3>
            {userPets.length > 0 ? (
              <div className="pet-list">
                {userPets.map((pet) => (
                  <div key={pet.id} className="pet-item">
                    <Link to={`/pet/${pet.id}`}> {/* Thêm Link */}
                        <img src={`/images/pets/${pet.image}`} alt={pet.name || pet.pet_types_name} />
                        <div className="pet-info">
                            <p>
                                {pet.name ? pet.name : pet.pet_types_name}
                                {pet.name && ` (Loài: ${pet.pet_types_name})`}
                            </p>
                        </div>
                  </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p>Bạn chưa có thú cưng nào.</p>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default MyHome;