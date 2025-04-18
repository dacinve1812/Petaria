import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import '../HomePage.css';
import { UserContext } from '../../UserContext';

function EditPetTypes() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const user = useContext(UserContext);

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
  const itemsPerPage = 10;

  const fetchSpecies = async () => {
    const res = await fetch(`${API_BASE_URL}/api/admin/pet-species`);
    const data = await res.json();
    setSpeciesList(data);
  };

  useEffect(() => {
    if (showList) {
      fetchSpecies();
    }
  }, [showList]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      alert(editingId ? 'Cập nhật thành công!' : 'Tạo mới thành công!');
      setFormData({
        name: '', image: '', type: '', description: '', rarity: '',
        base_hp: 0, base_mp: 0, base_str: 0, base_def: 0, base_intelligence: 0, base_spd: 0,
        evolve_to: ''
      });
      setEditingId(null);
      fetchSpecies();
    } catch (err) {
      alert(err.message);
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
    const res = await fetch(`${API_BASE_URL}/api/admin/pet-species/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Lỗi khi xoá');
    } else {
      alert('Đã xoá thành công');
      fetchSpecies();
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
      <div className="container">
        <header>
          <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
        </header>
        <div className="content">
          <Sidebar userId={user?.userId} isAdmin={user?.isAdmin} />
          <div className="main-content">
            <Navbar />
            <h1>{editingId ? 'Chỉnh sửa' : 'Tạo mới'} Pet Species</h1>
  
            <form onSubmit={handleSubmit}>
              {[
                ['Tên', 'name'],
                ['Img', 'image'],
                ['Type', 'type'],
                ['Description', 'description']
              ].map(([label, field]) => (
                <div  className="admin-form-container" key={field}>
                  <label className="admin-pet-form-label">{label}</label>
                  <input
                    className="admin-pet-form-input"
                    type="text"
                    name={field}
                    placeholder={label}
                    value={formData[field]}
                    onChange={handleChange}
                    required={field !== 'description' && field !== 'type'}
                  />
                </div>
              ))}
              <div  className="admin-form-container">
              <label className="admin-pet-form-label">Độ hiếm</label>
              <select className="admin-pet-form-input"name="rarity" value={formData.rarity} onChange={handleChange} required>
                <option value="">-- Chọn độ hiếm --</option>
                {['common','uncommon','rare','epic','legend','mythic'].map(r =>
                  <option key={r} value={r}>{r}</option>
                )}
              </select>
              </div>
              <h4>Base Stats (Tổng: {totalStats})</h4>
              {['base_hp', 'base_mp', 'base_str', 'base_def', 'base_intelligence', 'base_spd'].map(stat => (
                <div  className="admin-form-container" key={stat}>
                  <label className="admin-pet-form-label">{stat}</label>
                  <input
                    className="admin-pet-form-input"
                    type="number"
                    name={stat}
                    placeholder={stat}
                    value={formData[stat]}
                    onChange={handleChange}
                  />
                </div>
              ))}
              <div  className="admin-form-container">
              <label  className="admin-pet-form-label" >evolve_to</label>
              <input
                className="admin-pet-form-input"
                name="evolve_to"
                placeholder="VD: [2,3]"
                value={formData.evolve_to}
                onChange={handleChange}
              />
              </div>
  
              <button type="submit" className="admin-pet-form-button">{editingId ? 'Cập nhật' : 'Tạo mới'}</button>
            </form>
  
            <hr />
            <h2>Danh sách Pet Species</h2>
            <button onClick={() => setShowList(!showList)}>
              {showList ? 'Ẩn danh sách thú cưng' : 'Hiện danh sách thú cưng'}
            </button>
            {showList && (
            <>
            <p>Tổng số Pet Types: {filtered.length}</p>
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
            <label>Lọc theo Độ Hiếm</label>
              <select value={rarityFilter} onChange={(e) => {
                setRarityFilter(e.target.value);
                setCurrentPage(1); // reset page nếu có pagination
              }}>
                <option value="">-- Tất cả --</option>
                {['common','uncommon','rare','epic','legend','mythic'].map(r =>
                  <option key={r} value={r}>{r}</option>
                )}
              </select>
  
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Img</th>
                  <th>Species</th>
                  <th>Type</th>
                  <th>Rarity</th>
                  <th>Base HP</th>
                  <th>Base STR</th>
                  <th>Base DEF</th>
                  <th>Base INT</th>
                  <th>Base SPD</th>
                  <th>Choose</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSpecies.map(specie => (
                  <tr key={specie.id}>
                    <td><img src={`/images/pets/${specie.image}`} alt={specie.name} width="40" /></td>
                    <td>{specie.name}</td>
                    <td>{specie.type}</td>
                    <td>{specie.rarity}</td>
                    <td>{specie.base_hp}</td>
                    <td>{specie.base_str}</td>
                    <td>{specie.base_def}</td>
                    <td>{specie.base_intelligence}</td>
                    <td>{specie.base_spd}</td>
                    <td>
                      <button onClick={() => handleEdit(specie)}>✏️</button>
                      <button onClick={() => handleDelete(specie.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
  
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
            </>)}
          </div>
          
        </div>
      </div>
    );
  }
  
  export default EditPetTypes;
  