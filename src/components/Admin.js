import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';
import Sidebar from './Sidebar';

function Admin() {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; 
  
  const [petData, setPetData] = useState({
    name: '',
    type: '',
    hp: 0,
    str: 0,
    def: 0,
    int: 0,
    spd: 0,
    mp: 0,
  });
  const [pets, setPets] = useState([]);
  const [showPets, setShowPets] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const [showCreatePet, setShowCreatePet] = useState(true);
  const [showCreatePetType, setShowCreatePetType] = useState(true);
  const [searchTermPetType, setSearchTermPetType] = useState('');
  const [userId, setUserId] = useState(null);
  const [editPetTypeId, setEditPetTypeId] = useState(null);
  const [editPetTypeData, setEditPetTypeData] = useState({
    name: '',
    image: '',
    evolution_tree: '',
    description: '',
    rarity: '',
  });
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // State cho việc sắp xếp và lọc
  const [sortCriteria, setSortCriteria] = useState('id'); // Mặc định sắp xếp theo ID
  const [sortOrder, setSortOrder] = useState('asc'); // Mặc định tăng dần
  const [filterRarity, setFilterRarity] = useState('all'); // Mặc định hiển thị tất cả


  // ... các hàm xử lý input, submit, fetch, delete, edit ...
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPetData({ ...petData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(petData),
      });

      if (response.ok) {
        alert('Pet created successfully!');
      } else {
        alert('Error creating pet.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred.');
    }
  };

  const fetchPets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pets`);
      if (response.ok) {
        const data = await response.json();
        setPets(data);
      } else {
        alert('Error fetching pets.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred.');
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pets/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('Pet deleted successfully!');
        fetchPets();
      } else {
        alert('Error deleting pet.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred.');
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
    }
    if (showPets) {
      fetchPets();
    }
  }, [navigate, showPets]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const [petTypes, setPetTypes] = useState([]);
  const [showPetTypes, setShowPetTypes] = useState(false);

  const fetchPetTypes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pet-types`);
      if (response.ok) {
        const data = await response.json();
        setPetTypes(data);
      } else {
        alert('Error fetching pet types.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred.');
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
    }
    if (showPetTypes) {
      fetchPetTypes();
    }
  }, [navigate, showPetTypes]);

  const filteredPets = pets.filter((pet) =>
    pet.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [petTypeData, setPetTypeData] = useState({
    name: '',
    image: '',
    evolution_tree: '',
    description: '',
    rarity: '',
  });

  const handlePetTypeInputChange = (e) => {
    const { name, value } = e.target;
    setPetTypeData({ ...petTypeData, [name]: value });
  };

  const handlePetTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pet-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(petTypeData),
      });

      if (response.ok) {
        alert('Pet type created successfully!');
        // Reset form
        setPetTypeData({
          name: '',
          image: '',
          evolution_tree: '',
          description: '',
          rarity: '',
        });
        fetchPetTypes(); // Reload danh sách pet types
      } else {
        alert('Error creating pet type.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred.');
    }
  };
  const handlePetTypeEdit = (petType) => {
    setEditPetTypeId(petType.id);
    setEditPetTypeData({
      name: petType.name,
      image: petType.image,
      evolution_tree: petType.evolution_tree,
      description: petType.description,
      rarity: petType.rarity,
    });
  };

  const handleEditPetTypeInputChange = (e) => {
    const { name, value } = e.target;
    setEditPetTypeData({ ...editPetTypeData, [name]: value });
  };

  const handleEditPetTypeSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pet-types/${editPetTypeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editPetTypeData),
      });

      if (response.ok) {
        alert('Pet type updated successfully!');
        setEditPetTypeId(null);
        fetchPetTypes();
      } else {
        alert('Error updating pet type.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred.');
    }
  };

  const handlePetTypeDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/pet-types/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('Pet type deleted successfully!');
        fetchPetTypes();
        if (editPetTypeId === id) {
          setEditPetTypeId(null);
        }
      } else {
        alert('Error deleting pet type.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred.');
    }
  };

const handleSortChange = (e) => {
    setSortCriteria(e.target.value);
};

const handleSortOrderChange = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
};

const handleFilterRarityChange = (e) => {
    setFilterRarity(e.target.value);
};

const sortedPetTypes = [...petTypes].sort((a, b) => {
    if (sortCriteria === 'rarity') {
        // Custom sort order for rarity (optional, you can define your own)
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legend', 'mythic'];
        const aIndex = rarityOrder.indexOf(a.rarity.toLowerCase());
        const bIndex = rarityOrder.indexOf(b.rarity.toLowerCase());
        if (sortOrder === 'asc') {
            return aIndex - bIndex;
        } else {
            return bIndex - aIndex;
        }
    } else {
        if (sortOrder === 'asc') {
            return a[sortCriteria] > b[sortCriteria] ? 1 : -1;
        } else {
            return a[sortCriteria] < b[sortCriteria] ? 1 : -1;
        }
    }
});

const filteredPetTypes = sortedPetTypes.filter((petType) => {
    if (filterRarity === 'all') {
        return petType.name.toLowerCase().includes(searchTermPetType.toLowerCase());
    } else {
        return (
            petType.name.toLowerCase().includes(searchTermPetType.toLowerCase()) &&
            petType.rarity.toLowerCase() === filterRarity.toLowerCase()
        );
    }
});

const totalPetTypes = petTypes.length;
const totalFilteredPetTypes = filteredPetTypes.length;

  const rarityOptions = ['common', 'uncommon', 'rare', 'epic', 'legend', 'mythic'];
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
        <h1>Admin Page</h1>
        
        <h2>Create Pet Type</h2>
        <button onClick={() => setShowCreatePetType(!showCreatePetType)}>
            {showCreatePetType ? 'Hide Create Pet Type' : 'Show Create Pet Type'}
            </button>
            {showCreatePetType && (
            <div>
                
                <form className="admin-pet-form-container" onSubmit={handlePetTypeSubmit}>
                <label className="admin-pet-form-label">Name:</label>
                <input className="admin-pet-form-input" type="text" name="name" placeholder="Name" onChange={handlePetTypeInputChange} />

                <label className="admin-pet-form-label">Image:</label>
                <input className="admin-pet-form-input" type="text" name="image" placeholder="Image Filename" onChange={handlePetTypeInputChange} />

                <label className="admin-pet-form-label">Evolution Tree:</label>
                <textarea className="admin-pet-form-input" name="evolution_tree" placeholder="Evolution Tree (JSON)" onChange={handlePetTypeInputChange} />

                <label className="admin-pet-form-label">Description:</label>
                <textarea className="admin-pet-form-input" name="description" placeholder="Description" onChange={handlePetTypeInputChange} />

                <label className="admin-pet-form-label">Rarity:</label>
                      <select
                          className="admin-pet-form-input"
                          name="rarity"
                          value={petTypeData.rarity}
                          onChange={handlePetTypeInputChange}
                      >
                          <option value=""> -- Select Rarity -- </option>
                          {rarityOptions.map((option) => (
                              <option key={option} value={option}>
                                  {option}
                              </option>
                          ))}
                      </select>

                <button className="admin-pet-form-button" type="submit">Create Pet Type</button>
                </form>
          </div>
        )}

        <br></br>

        <h2>Pet Type List</h2>
                    <button onClick={() => setShowPetTypes(!showPetTypes)}>
                        {showPetTypes ? 'Hide Pet Types' : 'Show Pet Types'}
                    </button>
                    {showPetTypes && (
                        <div>
                            <div className='pet-type-list-summary'>
                                <p><strong>Total: {totalPetTypes}</strong></p>{' '}
                                {rarityOptions.map((rarity) => (
                                    <span key={rarity}>
                                      ;  {rarity} (Total: {petTypes.filter(pt => pt.rarity.toLowerCase() === rarity).length})
                                    </span>
                                ))}
                            </div>
                            <div className='pet-type-list-filter'>
                                <h4> - Search & Filter</h4>
                                <input
                                    type="text"
                                    placeholder="Search pet types..."
                                    value={searchTermPetType}
                                    onChange={(e) => setSearchTermPetType(e.target.value)}
                                />
                                <label htmlFor="sortCriteria">Sort By:</label>
                                <select id="sortCriteria" value={sortCriteria} onChange={handleSortChange} className="admin-pet-form-input-2">
                                    <option value="id">ID</option>
                                    <option value="name">Name</option>
                                    <option value="rarity">Rarity</option>
                                </select>
                                <button onClick={handleSortOrderChange}>
                                    {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                </button>
                                <label htmlFor="filterRarity">Filter Rarity:</label>
                                <select id="filterRarity" value={filterRarity} onChange={handleFilterRarityChange} className="admin-pet-form-input-2">
                                    <option value="all">All</option>
                                    {rarityOptions.map((rarity) => (
                                        <option key={rarity} value={rarity}>{rarity}</option>
                                    ))}
                                </select>
                                <p><strong>Filtered Total: {totalFilteredPetTypes}</strong></p>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th onClick={() => { setSortCriteria('id'); handleSortOrderChange(); }}>ID</th>
                                        <th onClick={() => { setSortCriteria('name'); handleSortOrderChange(); }}>Name</th>
                                        <th>Image</th>
                                        <th>Evolution Tree</th>
                                        <th>Description</th>
                                        <th onClick={() => { setSortCriteria('rarity'); handleSortOrderChange(); }}>Rarity</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPetTypes.map((petType) => (
                                        <tr key={petType.id}>
                                            <td>{petType.id}</td>
                                            <td>{petType.name}</td>
                                            <td>
                                                <img src={`/images/pets/${petType.image}`} alt={petType.name} style={{ width: '50px', height: '50px' }} />
                                            </td>
                                            <td>{petType.evolution_tree}</td>
                                            <td>{petType.description}</td>
                                            <td>{petType.rarity}</td>
                                            <td>
                                                <button onClick={() => handlePetTypeEdit(petType)}>Edit</button>
                                                <button onClick={() => handlePetTypeDelete(petType.id)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        {editPetTypeId && (
          <div>
            <h2>Edit Pet Type</h2>
            <form className="admin-pet-form-container" onSubmit={handleEditPetTypeSubmit}>
              <label className="admin-pet-form-label">Name:</label>
              <input className="admin-pet-form-input" type="text" name="name" value={editPetTypeData.name} onChange={handleEditPetTypeInputChange} />

              <label className="admin-pet-form-label">Image:</label>
              <input className="admin-pet-form-input" type="text" name="image" value={editPetTypeData.image} onChange={handleEditPetTypeInputChange} />

              <label className="admin-pet-form-label">Evolution Tree:</label>
              <textarea className="admin-pet-form-input" name="evolution_tree" value={editPetTypeData.evolution_tree} onChange={handleEditPetTypeInputChange} />

              <label className="admin-pet-form-label">Description:</label>
              <textarea className="admin-pet-form-input" name="description" value={editPetTypeData.description} onChange={handleEditPetTypeInputChange} />

              <label className="admin-pet-form-label">Rarity:</label>
                      <select
                          className="admin-pet-form-input"
                          name="rarity"
                          value={petTypeData.rarity}
                          onChange={handleEditPetTypeInputChange}
                      >
                          <option value=""> {editPetTypeData.rarity}</option>
                          {rarityOptions.map((option) => (
                              <option key={option} value={option}>
                                  {option}
                              </option>
                          ))}
                      </select>

              <button className="admin-pet-form-button" type="submit">Update Pet Type</button>
              <button type="button" onClick={() => setEditPetTypeId(null)}>Cancel</button>
            </form>
          </div>
        )}

        <h2>Pet List</h2>
        {/* <button onClick={() => setShowPets(!showPets)}>
          {showPets ? 'Hide Pets' : 'Show Pets'}
        </button> */}
        {showPets && (
          <div>
            <input
              type="text"
              placeholder="Search pets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>HP</th>
                  <th>STR</th>
                  <th>DEF</th>
                  <th>INT</th>
                  <th>SPD</th>
                  <th>MP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPets.map((pet) => (
                  <tr key={pet.id}>
                    <td>{pet.name}</td>
                    <td>{pet.type}</td>
                    <td>{pet.hp}</td>
                    <td>{pet.str}</td>
                    <td>{pet.def}</td>
                    <td>{pet.int}</td>
                    <td>{pet.spd}</td>
                    <td>{pet.mp}</td>
                    <td>
                      <button onClick={() => handleDelete(pet.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

export default Admin;