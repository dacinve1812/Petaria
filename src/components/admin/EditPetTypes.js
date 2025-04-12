
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

  const [petTypes, setPetTypes] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    image: '',
    evolution_tree: '',
    description: '',
    rarity: '',
  });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!user || !user.isAdmin) {
      navigate('/login');
    }
  }, [navigate, user]);

  const fetchPetTypes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pet-types`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!res.ok) throw new Error('Lỗi khi lấy danh sách pet types');
      const data = await res.json();
      setPetTypes(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (showList) {
      fetchPetTypes();
    }
  }, [showList]);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const endpoint = editMode
      ? `${API_BASE_URL}/api/admin/pet-types/${editId}`
      : `${API_BASE_URL}/api/admin/pet-types`;

    const method = editMode ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Lỗi khi lưu pet type');

      await fetchPetTypes();
      setFormData({
        name: '',
        image: '',
        evolution_tree: '',
        description: '',
        rarity: '',
      });
      setEditMode(false);
      setEditId(null);
      alert('Pet type đã được lưu thành công!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (type) => {
    setFormData({
      name: type.name,
      image: type.image,
      evolution_tree: type.evolution_tree,
      description: type.description,
      rarity: type.rarity,
    });
    setEditMode(true);
    setEditId(type.id);
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm('Bạn có chắc chắn muốn xoá pet type này không?');
    if (!confirm) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pet-types/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!res.ok) throw new Error('Lỗi khi xoá pet type');
      await fetchPetTypes();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    navigate('/login');
  };

  return (
    <div className="container">
      <header>
        <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
      </header>
      <div className="content">
        <Sidebar userId={user?.userId} isAdmin={user?.isAdmin} handleLogout={handleLogout} />
        <div className="main-content">
          <Navbar />
          <h1>Quản lý Pet Types</h1>

          <form className="admin-pet-form-container" onSubmit={handleSubmit}>
            <input className="admin-pet-form-input" type="text" name="name" placeholder="Tên" value={formData.name} onChange={handleChange} required />
            <input className="admin-pet-form-input" type="text" name="image" placeholder="Link ảnh" value={formData.image} onChange={handleChange} required />
            <input className="admin-pet-form-input" type="text" name="evolution_tree" placeholder="Evolution Tree" value={formData.evolution_tree} onChange={handleChange} />
            <input className="admin-pet-form-input" type="text" name="description" placeholder="Mô tả" value={formData.description} onChange={handleChange} />
            <select className="admin-pet-form-input" name="rarity" value={formData.rarity} onChange={handleChange} required>
              <option value="">Độ hiếm</option>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>

            <button type="submit" className="admin-pet-form-button">
              {editMode ? 'Cập nhật' : 'Tạo'}
            </button>
          </form>

          <div className="pet-type-list-summary">
            <h2>Danh sách Pet Types</h2>
            <button onClick={() => setShowList(!showList)}>
            {showList ? 'Ẩn danh thú cưng' : 'Hiện danh sách thú cưng'}
            </button>

            {showList && (
            <>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <table>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Ảnh</th>
                  <th>Mô tả</th>
                  <th>Độ hiếm</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {petTypes.map((type) => (
                  <tr key={type.id}>
                    <td>{type.name}</td>
                    <td><img src={`/images/pets/${type.image}`} alt={type.name} width="50" /></td>
                    <td>{type.description}</td>
                    <td>{type.rarity}</td>
                    <td>
                      <button onClick={() => handleEdit(type)}>Sửa</button>
                      <button onClick={() => handleDelete(type.id)}>Xoá</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditPetTypes;
