import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './AdminCreatePet.css';

function AdminCreatePet() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  const [speciesList, setSpeciesList] = useState([]);
  const [form, setForm] = useState({
    name: '', 
    pet_species_id: '', 
    level: 1,
    iv_hp: 0, 
    iv_mp: 0, 
    iv_str: 0, 
    iv_def: 0, 
    iv_intelligence: 0, 
    iv_spd: 0
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [allPets, setAllPets] = useState([]);
  const [filteredPets, setFilteredPets] = useState([]);
  const [search, setSearch] = useState({ name: '', species: '', owner: '' });
  const [ownerFilter, setOwnerFilter] = useState('unowned');
  const [currentPage, setCurrentPage] = useState(1);
  const petsPerPage = 10;

  const fetchSpecies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pet-species`);
      const data = await res.json();
      setSpeciesList(data);
    } catch (error) {
      setMessage('❌ Lỗi khi tải danh sách Pet Species');
    }
  };

  const fetchPets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/pets`);
      const data = await res.json();
      setAllPets(data);
      applyFilters(search, ownerFilter, data);
    } catch (error) {
      setMessage('❌ Lỗi khi tải danh sách Pet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecies();
  }, []);

  useEffect(() => {
    if (showList) {
      fetchPets();
    }
  }, [showList]);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pets`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      
      if (response.ok) {
        setMessage(`✅ Đã tạo pet thành công với UUID: ${data.uuid}`);
        setForm({
          name: '', 
          pet_species_id: '', 
          level: 1,
          iv_hp: 0, 
          iv_mp: 0, 
          iv_str: 0, 
          iv_def: 0, 
          iv_intelligence: 0, 
          iv_spd: 0
        });
      } else {
        setMessage(`❌ Lỗi: ${data.message || 'Không thể tạo pet'}`);
      }
    } catch (err) {
      console.error('Error creating pet:', err);
      setMessage('❌ Lỗi khi gọi API');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    const newSearch = { ...search, [name]: value };
    setSearch(newSearch);
    applyFilters(newSearch, ownerFilter, allPets);
  };

  const handleOwnerSelect = (e) => {
    const value = e.target.value;
    setOwnerFilter(value);
    applyFilters(search, value, allPets);
  };

  const applyFilters = (criteria, ownerFilterValue, petsSource) => {
    const source = petsSource || allPets;
    const filtered = source.filter(pet => {
      const nameMatch = pet.name?.toLowerCase().includes(criteria.name.toLowerCase());
      const speciesMatch = pet.species_name?.toLowerCase().includes(criteria.species.toLowerCase());
      const ownerMatch = (pet.owner_name || '').toLowerCase().includes(criteria.owner.toLowerCase());
      const ownerCheck = ownerFilterValue === 'all' ? true : (ownerFilterValue === 'owned' ? !!pet.owner_name : !pet.owner_name);
      return nameMatch && speciesMatch && ownerMatch && ownerCheck;
    });
    setFilteredPets(filtered);
    setCurrentPage(1);
  };

  const handleDeletePet = async (uuid) => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá pet này không?')) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pets/${uuid}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const result = await res.json();
      
      if (res.ok) {
        setMessage('✅ Đã xoá pet thành công');
        setFilteredPets(prev => prev.filter(p => p.uuid !== uuid));
      } else {
        setMessage(`❌ Lỗi: ${result.message || 'Không thể xoá pet'}`);
      }
    } catch (err) {
      setMessage('❌ Lỗi khi xoá pet');
    } finally {
      setLoading(false);
    }
  };

  const petsToDisplay = filteredPets.slice((currentPage - 1) * petsPerPage, currentPage * petsPerPage);
  const totalPages = Math.ceil(filteredPets.length / petsPerPage);

  const totalIV = form.iv_hp + form.iv_mp + form.iv_str + form.iv_def + form.iv_intelligence + form.iv_spd;

  return (
    <div className="admin-create-pet">
      <div className="admin-create-pet-header">
        <h1>Tạo Pet Thủ Công (Admin)</h1>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="admin-create-pet-content">
        <div className="form-section">
          <h2>Thông tin Pet</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Tên Pet:</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Nhập tên pet"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Chủng loại:</label>
                <select name="pet_species_id" value={form.pet_species_id} onChange={handleChange} required>
                  <option value="">-- Chọn chủng loại --</option>
                  {speciesList.map(species => (
                    <option key={species.id} value={species.id}>{species.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Level:</label>
                <input
                  type="number"
                  name="level"
                  placeholder="1"
                  value={form.level}
                  onChange={handleChange}
                  min="1"
                  max="100"
                  required
                />
              </div>
            </div>

            <div className="iv-section">
              <h3>IV Stats (Tổng: {totalIV})</h3>
              <div className="iv-grid">
                {[
                  { key: 'iv_hp', label: 'HP' },
                  { key: 'iv_mp', label: 'MP' },
                  { key: 'iv_str', label: 'STR' },
                  { key: 'iv_def', label: 'DEF' },
                  { key: 'iv_intelligence', label: 'INT' },
                  { key: 'iv_spd', label: 'SPD' }
                ].map(stat => (
                  <div className="form-group" key={stat.key}>
                    <label>{stat.label}:</label>
                    <input
                      type="number"
                      name={stat.key}
                      placeholder="0"
                      value={form[stat.key]}
                      onChange={handleChange}
                      min="0"
                      max="31"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Đang tạo...' : 'Tạo Pet'}
              </button>
            </div>
          </form>
        </div>

        <div className="list-section">
          <div className="list-header">
            <h2>Danh sách Pet</h2>
            <button 
              className="toggle-list-btn"
              onClick={() => setShowList(!showList)}
            >
              {showList ? 'Ẩn danh sách' : 'Hiện danh sách'}
            </button>
          </div>

          {showList && (
            <div className="list-content">
              <div className="list-controls">
                <div className="search-filter">
                  <input
                    placeholder="Tìm theo tên..."
                    name="name"
                    value={search.name}
                    onChange={handleSearchChange}
                  />
                  <input
                    placeholder="Tìm theo loài..."
                    name="species"
                    value={search.species}
                    onChange={handleSearchChange}
                  />
                  <input
                    placeholder="Tìm theo chủ..."
                    name="owner"
                    value={search.owner}
                    onChange={handleSearchChange}
                  />
                  <select value={ownerFilter} onChange={handleOwnerSelect}>
                    <option value="unowned">Chưa có chủ</option>
                    <option value="owned">Đã có chủ</option>
                    <option value="all">Tất cả</option>
                  </select>
                </div>
                <p className="total-count">Tổng số: {filteredPets.length}</p>
              </div>

              {loading ? (
                <div className="loading">Đang tải...</div>
              ) : (
                <>
                  <div className="table-container">
                    <table className="pets-table">
                      <thead>
                        <tr>
                          <th>Tên</th>
                          <th>Loài</th>
                          <th>Level</th>
                          <th>IV Stats</th>
                          <th>Chủ</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {petsToDisplay.map(pet => (
                          <tr key={pet.uuid}>
                            <td>{pet.name}</td>
                            <td>{pet.species_name}</td>
                            <td>{pet.level}</td>
                            <td className="iv-stats">
                              <span>HP:{pet.iv_hp}</span>
                              <span>MP:{pet.iv_mp}</span>
                              <span>STR:{pet.iv_str}</span>
                              <span>DEF:{pet.iv_def}</span>
                              <span>INT:{pet.iv_intelligence}</span>
                              <span>SPD:{pet.iv_spd}</span>
                            </td>
                            <td>{pet.owner_name || 'Chưa có'}</td>
                            <td>
                              <div className="action-buttons">
                                <button 
                                  className="view-btn"
                                  onClick={() => window.open(`/pet/${pet.uuid}`, '_blank')}
                                  title="Xem chi tiết"
                                >
                                  👁️
                                </button>
                                {!pet.owner_name && (
                                  <button 
                                    className="delete-btn"
                                    onClick={() => handleDeletePet(pet.uuid)}
                                    title="Xóa pet"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="pagination">
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => setCurrentPage(i + 1)}
                          className={currentPage === i + 1 ? 'active-page' : ''}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminCreatePet;
