import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import BackButton from './BackButton';
import './MyHome.css';

function MyHome({isLoggedIn, onLogoutSuccess }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 
  const [userPets, setUserPets] = useState([]);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState('pet'); // 'pet' or 'linhthu'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortOption, setSortOption] = useState('level');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState({});
  const navigate = useNavigate();
  const pageSize = 20;

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

  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // Fetch pets only when selectedOption is 'pet'
  useEffect(() => {
    const fetchUserPets = async () => {
      if (userId && selectedOption === 'pet') {
        setIsLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/users/${userId}/pets`);
          if (response.ok) {
            const data = await response.json();
            // Sort pets: deployed pets first, then by level descending
            const sortedPets = data.sort((a, b) => {
              if (a.is_deployed && !b.is_deployed) return -1;
              if (!a.is_deployed && b.is_deployed) return 1;
              return (b.level || 0) - (a.level || 0);
            });
            setUserPets(sortedPets);
            
            // Preload first few images for better UX
            const firstFewPets = sortedPets.slice(0, 6);
            firstFewPets.forEach(pet => {
              const img = new Image();
              img.src = `/images/pets/${pet.image}`;
            });
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
  }, [userId, selectedOption]);

  const handleBack = () => {
    navigate('/');
  };

  const handleOptionChange = (option) => {
    setSelectedOption(option);
    setCurrentPage(1);
    setSearchTerm('');
    setFilterType('all');
    setSortOption('level');
  };

  // Filter and search logic
  const filteredPets = userPets
    .filter(pet => {
      const matchesSearch = pet.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           pet.species_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || pet.species_name === filterType;
      return matchesSearch && matchesFilter;
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

  // Get unique species for filter
  const speciesOptions = [...new Set(userPets.map(pet => pet.species_name))];

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="myhome-page">
      {/* Banner section */}
      <div className="myhome-banner">
        <BackButton onClick={handleBack} />
        <div className="banner-content">
          <div className="banner-center">
            <h2>My Home</h2>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="myhome-main">
        {/* Filter options */}
        <div className="filter-section">
          <div className="filter-buttons">
            <button
              onClick={() => handleOptionChange('pet')}
              className={`filter-btn ${selectedOption === 'pet' ? 'active' : ''}`}
            >
              Thú cưng
            </button>
            <button
              onClick={() => handleOptionChange('linhthu')}
              className={`filter-btn ${selectedOption === 'linhthu' ? 'active' : ''}`}
            >
              Linh thú
            </button>
          </div>
        </div>

        {/* Controls section */}
        <div className="myhome-controls">
          {/* Row 1: Search + Filter */}
          <div className="controls-row controls-row-1">
            <div className="search-section">
              <input
                type="text"
                placeholder="Tìm kiếm thú cưng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

                         <div className="filter-controls">
               <label className="filter-label">Lọc theo:</label>
               <select
                 value={filterType}
                 onChange={(e) => setFilterType(e.target.value)}
                 className="filter-select"
               >
                 <option value="all">Tất cả</option>
                 {speciesOptions.map(species => (
                   <option key={species} value={species}>{species}</option>
                 ))}
               </select>
             </div>
             
             <div className="sort-controls">
               <label className="sort-label">Sắp xếp theo:</label>
               <select
                 value={sortOption}
                 onChange={(e) => setSortOption(e.target.value)}
                 className="sort-select"
               >
                 <option value="level">Cấp độ (cao → thấp)</option>
                 <option value="species">Loài (A-Z)</option>
               </select>
             </div>
          </div>
        </div>

        {/* Pets grid */}
        <div className="pets-container">
          {isLoading ? (
            <div className="loading-message">
              <p>Đang tải...</p>
            </div>
          ) : selectedOption === 'pet' && paginatedPets.length > 0 ? (
            <div className="pets-grid" key={`${selectedOption}-${currentPage}-${searchTerm}-${filterType}-${sortOption}`}>
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
          ) : selectedOption === 'linhthu' ? (
            <div className="empty-message">
              <p>Tính năng Linh thú đang phát triển...</p>
            </div>
          ) : (
            <div className="empty-message">
              <p>Bạn chưa có thú cưng nào.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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
    </div>
  );
}

export default MyHome;