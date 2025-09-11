import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './EditPetTypes.css';

function EditPetTypes() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const { user, isLoading } = useUser();

  const [formData, setFormData] = useState({
    name: '', image: '', type: '', description: '', rarity: '',
    base_hp: 0, base_mp: 0, base_str: 0, base_def: 0, base_intelligence: 0, base_spd: 0,
    evolve_to: ''
  });

  const [speciesList, setSpeciesList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showList, setShowList] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [rarityFilter, setRarityFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const itemsPerPage = 6;

  const fetchSpecies = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/pet-species`);
      const data = await res.json();
      setSpeciesList(data);
    } catch (error) {
      setMessage('❌ Lỗi khi tải danh sách Pet Species');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showList) {
      fetchSpecies();
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const endpoint = editingId
      ? `${API_BASE_URL}/api/admin/pet-species/${editingId}`
      : `${API_BASE_URL}/api/admin/pet-species`;
    const method = editingId ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          ...formData,
          evolve_to: formData.evolve_to ? JSON.parse(formData.evolve_to) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu Pet Species');
      
      setMessage(`✅ ${editingId ? 'Cập nhật' : 'Tạo mới'} thành công!`);
      setFormData({
        name: '', image: '', type: '', description: '', rarity: '',
        base_hp: 0, base_mp: 0, base_str: 0, base_def: 0, base_intelligence: 0, base_spd: 0,
        evolve_to: ''
      });
      setEditingId(null);
      fetchSpecies();
    } catch (err) {
      setMessage(`❌ Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (specie) => {
    setFormData({
      name: specie.name,
      image: specie.image,
      type: specie.type,
      description: specie.description,
      rarity: specie.rarity,
      base_hp: specie.base_hp,
      base_mp: specie.base_mp,
      base_str: specie.base_str,
      base_def: specie.base_def,
      base_intelligence: specie.base_intelligence,
      base_spd: specie.base_spd,
      evolve_to: specie.evolve_to ? JSON.stringify(specie.evolve_to) : ''
    });
    setEditingId(specie.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xác nhận xoá pet species này?')) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pet-species/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi xoá');
      }
      setMessage('✅ Đã xoá thành công');
      fetchSpecies();
    } catch (err) {
      setMessage(`❌ Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filtered = speciesList
    .filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) &&
      (rarityFilter === '' || s.rarity === rarityFilter)
    )
    .sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name)
        : b.base_hp + b.base_str + b.base_def + b.base_intelligence + b.base_spd -
          (a.base_hp + a.base_str + a.base_def + a.base_intelligence + a.base_spd)
    );

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSpecies = filtered.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const totalStats = ['base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd']
    .reduce((sum, key) => sum + Number(formData[key] || 0), 0);

  return (
    <div className="edit-pet-types">
      <div className="edit-pet-types-header">
        <h1>{editingId ? 'Chỉnh sửa' : 'Tạo mới'} Pet Species</h1>
        <button className="back-admin-btn" onClick={() => navigate('/admin')}>
          ← Quay lại Admin
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="edit-pet-types-content">
        <div className="form-section">
          <h2>Thông tin Pet Species</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Tên Pet:</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Nhập tên pet"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Hình ảnh:</label>
                <input
                  type="text"
                  name="image"
                  placeholder="Tên file hình ảnh"
                  value={formData.image}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Loại:</label>
                <input
                  type="text"
                  name="type"
                  placeholder="Loại pet (fire, water, etc.)"
                  value={formData.type}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Mô tả:</label>
                <textarea
                  name="description"
                  placeholder="Mô tả pet"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Độ hiếm:</label>
                <select name="rarity" value={formData.rarity} onChange={handleChange} required>
                  <option value="">-- Chọn độ hiếm --</option>
                  {['common','uncommon','rare','epic','legend','mythic'].map(r =>
                    <option key={r} value={r}>{r}</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Evolve To:</label>
                <input
                  type="text"
                  name="evolve_to"
                  placeholder="VD: [2,3] (JSON array)"
                  value={formData.evolve_to}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="stats-section">
              <h3>Base Stats (Tổng: {totalStats})</h3>
              <div className="stats-grid">
                {[
                  { key: 'base_hp', label: 'HP' },
                  { key: 'base_mp', label: 'MP' },
                  { key: 'base_str', label: 'STR' },
                  { key: 'base_def', label: 'DEF' },
                  { key: 'base_intelligence', label: 'INT' },
                  { key: 'base_spd', label: 'SPD' }
                ].map(stat => (
                  <div className="form-group" key={stat.key}>
                    <label>{stat.label}:</label>
                    <input
                      type="number"
                      name={stat.key}
                      placeholder="0"
                      value={formData[stat.key]}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Đang xử lý...' : (editingId ? 'Cập nhật' : 'Tạo mới')}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      name: '', image: '', type: '', description: '', rarity: '',
                      base_hp: 0, base_mp: 0, base_str: 0, base_def: 0, base_intelligence: 0, base_spd: 0,
                      evolve_to: ''
                    });
                  }}
                >
                  Hủy
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="list-section">
          <div className="list-header">
            <h2>Danh sách Pet Species</h2>
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
                    placeholder="Tìm kiếm theo tên..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="name">Sắp xếp theo Tên (A-Z)</option>
                    <option value="stat">Sắp xếp theo Tổng Stat</option>
                  </select>
                  <select 
                    value={rarityFilter} 
                    onChange={(e) => {
                      setRarityFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">-- Tất cả độ hiếm --</option>
                    {['common','uncommon','rare','epic','legend','mythic'].map(r =>
                      <option key={r} value={r}>{r}</option>
                    )}
                  </select>
                </div>
                <p className="total-count">Tổng số: {filtered.length}</p>
              </div>

              {loading ? (
                <div className="loading">Đang tải...</div>
              ) : (
                <>
                  <div className="table-container">
                    <table className="pet-species-table">
                      <thead>
                        <tr>
                          <th>Hình</th>
                          <th>Tên</th>
                          <th>Loại</th>
                          <th>Độ hiếm</th>
                          <th>HP</th>
                          <th>STR</th>
                          <th>DEF</th>
                          <th>INT</th>
                          <th>SPD</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSpecies.map(specie => (
                          <tr key={specie.id}>
                            <td>
                                                                 <img 
                                     src={`/images/pets/${specie.image}`} 
                                     alt={specie.name} 
                                     className="pet-species-image"
                                     onError={(e) => {
                                       e.target.src = '/images/pets/default.png';
                                     }}
                                   />
                            </td>
                            <td>{specie.name}</td>
                            <td>{specie.type}</td>
                            <td>
                              <span className={`rarity-badge rarity-${specie.rarity}`}>
                                {specie.rarity}
                              </span>
                            </td>
                            <td>{specie.base_hp}</td>
                            <td>{specie.base_str}</td>
                            <td>{specie.base_def}</td>
                            <td>{specie.base_intelligence}</td>
                            <td>{specie.base_spd}</td>
                            <td>
                              <div className="action-buttons">
                                <button 
                                  className="edit-btn"
                                  onClick={() => handleEdit(specie)}
                                  title="Chỉnh sửa"
                                >
                                  ✏️
                                </button>
                                <button 
                                  className="delete-btn"
                                  onClick={() => handleDelete(specie.id)}
                                  title="Xóa"
                                >
                                  🗑️
                                </button>
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

export default EditPetTypes;
  