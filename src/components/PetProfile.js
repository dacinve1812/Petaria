import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './PetProfile.css'; // Import file CSS cho PetProfile
import Sidebar from './Sidebar';
import Navbar from './Navbar';

function PetProfile() {
    const { petId } = useParams(); // Lấy ID thú cưng từ URL
    const [pet, setPet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [currentUserId, setCurrentUserId] = useState(null);
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            setCurrentUserId(decodedToken.userId);
        } catch (err) {
            console.error('Error decoding token:', err);
            navigate('/login');
            return;
        }

        const fetchPetDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`http://localhost:5000/api/pets/${petId}`); // Cần API endpoint để lấy thông tin thú cưng theo ID
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setPet(data);
            } catch (err) {
                console.error('Error fetching pet details:', err);
                setError('Failed to load pet details.');
            } finally {
                setLoading(false);
            }
        };

        fetchPetDetails();
    }, [petId, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (loading) {
        return <div>Loading pet details...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!pet) {
        return <div>Pet not found.</div>;
    }

    return (
        <div className="container">
            <header>
                <img src="/images/buttons/banner.jpeg" alt="Banner Petaria" />
            </header>
            <div className="content">
                <Sidebar userId={currentUserId} handleLogout={handleLogout} isAdmin={isAdmin} />
                <div className="main-content">
                    <Navbar />
                    <div className="pet-profile">
                        <div className="pet-header">
                            <img src={`/images/pets/${pet.image}`} alt={pet.name || pet.pet_types_name} className="pet-image" />
                            <h2>{pet.name || pet.pet_types_name}</h2>
                            {pet.name && <p className="pet-species">Loài: {pet.pet_types_name}</p>}
                        </div>
                        <div className="pet-details">
                            <h3>Thông tin chi tiết</h3>
                            <p><strong>HP:</strong> {pet.hp}</p>
                            <p><strong>STR:</strong> {pet.str}</p>
                            <p><strong>DEF:</strong> {pet.def}</p>
                            <p><strong>INT:</strong> {pet.intelligence}</p>
                            <p><strong>SPD:</strong> {pet.spd}</p>
                            <p><strong>MP:</strong> {pet.mp}</p>
                            <p><strong>Level:</strong> {pet.level}</p>
                            {/* Thêm các thông tin khác về thú cưng nếu có */}
                        </div>
                        {/* Các hành động khác có thể thêm vào như cho ăn, huấn luyện, v.v. */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PetProfile;