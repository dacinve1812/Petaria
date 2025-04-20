// File đã được tạo lại từ đầu với nút xoá pet chưa có chủ
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';

function AdminCreatePet() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const navigate = useNavigate();
  const [speciesList, setSpeciesList] = useState([]);
  const [form, setForm] = useState({
    name: '', pet_species_id: '', level: 1,
    iv_hp: 0, iv_mp: 0, iv_str: 0, iv_def: 0, iv_intelligence: 0, iv_spd: 0
  });
  const [message, setMessage] = useState('');
  const [showList, setShowList] = useState(false);
  const [allPets, setAllPets] = useState([]);
  const [filteredPets, setFilteredPets] = useState([]);
  const [search, setSearch] = useState({ name: '', species: '', owner: '' });
  const [ownerFilter, setOwnerFilter] = useState('unowned');
  const [currentPage, setCurrentPage] = useState(1);
  const petsPerPage = 10;

  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const token = localStorage.getItem('token');
  const userId = JSON.parse(atob(token.split('.')[1]))?.userId;

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/pet-species`)
      .then(res => res.json())
      .then(data => setSpeciesList(data))
      .catch(err => console.error('Error loading species:', err));
  }, []);

  useEffect(() => {
    if (showList) {
      fetch(`${API_BASE_URL}/api/admin/pets`)
        .then(res => res.json())
        .then(data => {
          setAllPets(data);
          applyFilters(search, ownerFilter, data);
        })
        .catch(err => console.error('Error fetching pets:', err));
    }
  }, [showList]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Đã tạo pet thành công với UUID: ${data.uuid}`);
      } else {
        setMessage(`Lỗi: ${data.message || 'Không thể tạo pet'}`);
      }
    } catch (err) {
      console.error('Error creating pet:', err);
      setMessage('Lỗi khi gọi API');
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

  const petsToDisplay = filteredPets.slice((currentPage - 1) * petsPerPage, currentPage * petsPerPage);
  const totalPages = Math.ceil(filteredPets.length / petsPerPage);

  const handleDeletePet = async (uuid) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá pet này không?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/pets/${uuid}`, { method: 'DELETE' });
        const result = await res.json();
        alert(result.message || 'Đã xoá pet');
        setFilteredPets(prev => prev.filter(p => p.uuid !== uuid));
      } catch (err) {
        alert('Xoá thất bại.');
      }
    }
  };

  return (
    <div className="container">
      <header><img src="/images/buttons/banner.jpeg" alt="Banner Petaria" /></header>
      <div className="content">
        <Sidebar userId={userId} handleLogout={() => { localStorage.removeItem('token'); navigate('/login'); }} isAdmin={isAdmin} />
        <div className="main-content">
          <Navbar />
          <h2>Tạo Pet Thủ Công (Admin)</h2>
          {message && <p>{message}</p>}
          <label>Tên Pet: <input type="text" name="name" value={form.name} onChange={handleChange} /></label><br />
          <label>Chủng loại (species):
            <select name="pet_species_id" value={form.pet_species_id} onChange={handleChange}>
              <option value="">-- Chọn --</option>
              {speciesList.map(species => (
                <option key={species.id} value={species.id}>{species.name}</option>
              ))}
            </select>
          </label><br />
          <label>Level: <input type="number" name="level" value={form.level} onChange={handleChange} /></label><br />
          <label>IV HP: <input type="number" name="iv_hp" value={form.iv_hp} onChange={handleChange} /></label><br />
          <label>IV MP: <input type="number" name="iv_mp" value={form.iv_mp} onChange={handleChange} /></label><br />
          <label>IV STR: <input type="number" name="iv_str" value={form.iv_str} onChange={handleChange} /></label><br />
          <label>IV DEF: <input type="number" name="iv_def" value={form.iv_def} onChange={handleChange} /></label><br />
          <label>IV INT: <input type="number" name="iv_intelligence" value={form.iv_intelligence} onChange={handleChange} /></label><br />
          <label>IV SPD: <input type="number" name="iv_spd" value={form.iv_spd} onChange={handleChange} /></label><br />
          <button onClick={handleSubmit}>Tạo Pet</button>

          <hr />
          <button onClick={() => setShowList(prev => !prev)}>{showList ? 'Ẩn danh sách' : 'Hiện danh sách tất cả pet'}</button>
          {showList && (
            <div>
              <h3>Danh sách tất cả Pet</h3>
              <label>Hiển thị:&nbsp;
                <select value={ownerFilter} onChange={handleOwnerSelect}>
                  <option value="unowned">Chưa có chủ</option>
                  <option value="owned">Đã có chủ</option>
                  <option value="all">Tất cả</option>
                </select>
              </label>
              <br />
              <input placeholder="Tìm theo tên" name="name" value={search.name} onChange={handleSearchChange} />
              <input placeholder="Tìm theo loài" name="species" value={search.species} onChange={handleSearchChange} />
              <input placeholder="Tìm theo chủ" name="owner" value={search.owner} onChange={handleSearchChange} />

              <table border="1" cellPadding="5">
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Loài</th>
                    <th>Level</th>
                    <th>IV</th>
                    <th>Chủ</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {petsToDisplay.map(pet => (
                    <tr key={pet.uuid}>
                      <td>{pet.name}</td>
                      <td>{pet.species_name}</td>
                      <td>{pet.level}</td>
                      <td>
                        HP:{pet.iv_hp}, MP:{pet.iv_mp}, STR:{pet.iv_str}, DEF:{pet.iv_def},
                        INT:{pet.iv_intelligence}, SPD:{pet.iv_spd}
                      </td>
                      <td>{pet.owner_name || 'Chưa có'}</td>
                      <td>
                        <button onClick={() => navigate(`/pet/${pet.uuid}`)}>Xem</button>
                        {!pet.owner_name && (
                          <button onClick={() => handleDeletePet(pet.uuid)} style={{ marginLeft: '6px' }}>Xoá</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '10px' }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i + 1} onClick={() => setCurrentPage(i + 1)} disabled={currentPage === i + 1}>{i + 1}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminCreatePet;
