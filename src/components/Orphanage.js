import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';
import Sidebar from './Sidebar';

function Orphanage() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [availablePets, setAvailablePets] = useState([]);
    const [selectedPet, setSelectedPet] = useState(null);
    const [petName, setPetName] = useState('');
    const navigate = useNavigate();
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            setUserId(decodedToken.userId);
        } catch (err) {
            console.error('Error decoding token:', err);
            setError('Invalid token');
        }
    }, [navigate]);

    useEffect(() => {
        const fetchPets = async () => {
            if (userId) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/orphanage-pets`);
                    if (response.ok) {
                        const data = await response.json();
                        setAvailablePets(data);
                    } else {
                        setError('Failed to fetch pets');
                    }
                } catch (err) {
                    console.error('Error fetching pets:', err);
                    setError('Network error');
                }
            }
        };

        fetchPets();
    }, [userId]);

    const handleSelectPet = (pet) => {
        setSelectedPet(pet);
    };

    const handleAdoptPet = async () => {
        if (selectedPet && petName && userId) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/adopt-pet`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tempId: selectedPet.tempId,
                        owner_id: userId,
                        petName: petName,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setAvailablePets((prevPets) =>
                        prevPets.filter((pet) => pet.tempId !== selectedPet.tempId)
                    );
                    setSelectedPet(null);
                    setPetName('');
                    alert(`Pet adopted successfully!`);
                } else {
                    const errorData = await response.json();
                    setError(errorData.message || 'Failed to adopt pet');
                }
            } catch (err) {
                console.error('Error adopting pet:', err);
                setError('Network error');
            }
        } else {
            setError('Please select a pet and enter a name.');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    return (
        <div className="container">
            <header>
                <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
            </header>
            <div className="content">
                <Sidebar userId={userId} handleLogout={handleLogout} isAdmin={isAdmin} />
                <div className="main-content">
                    <h2>Trại Mồ Côi</h2>
                    <div className="notice" > <p> Bạn có thể nhận nuôi một thú cưng bất kì</p></div>

                    {error && <p className="error">{error}</p>}

                    <div className="pet-list">
                        {availablePets.map((pet) => (
                            <div key={pet.tempId} className="pet-item" onClick={() => handleSelectPet(pet)}>
                                <img src={`/images/pets/${pet.image}`} alt={pet.name} />
                                <div className="pet-info">
                                    <p>Loài: {pet.pet_types_name}</p>
                                    <p>Level: {pet.level}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedPet && (
                        <div>
                            <h3>Chọn tên cho thú cưng:</h3>
                            <input type="text" value={petName} onChange={(e) => setPetName(e.target.value)} />
                            <button onClick={handleAdoptPet}>Nhận nuôi</button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default Orphanage;