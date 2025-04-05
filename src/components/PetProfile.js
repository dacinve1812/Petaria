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
                        <div className='pet-header'>Xem thông tin thú cưng</div>
                        <div className="pet-details">
                            
                            <p>Tên: {pet.name}</p>
                            <p><spam className='extra-stats'>Chưa tiến hóa</spam></p>
                            <p>Đẳng cấp: {pet.level}</p>
                            <p>Sinh Nhật: 07-11-2024</p>
                            <p>Hạng: {pet.rank}</p>
                            <p>Điểm cần nâng cấp: {pet.experience}/99999999</p>
                            <p>Sức Khỏe: {pet.hp}/99999</p>
                            <p>Năng Lượng:{pet.mp}</p>
                            <p>Sức Mạnh: {pet.str}</p>
                            <p>Phòng Thủ: {pet.def}</p>
                            <p>Thông Minh: {pet.intelligence}</p>
                            <p>Tốc Độ: {pet.spd}</p>
                            <p>Tình Trạng: Mập Mạp</p>
                            <br></br>
                            <p >Chiến đấu thắng: N/A</p>
                            
                            
                            {/* Thêm các thông tin khác về thú cưng nếu có */}
                        </div>

                        <div className="pet-details-right">
                            <img src={`/images/pets/${pet.image}`} alt={pet.name || pet.pet_types_name} className="pet-image" />
                            <h2>{pet.name || pet.pet_types_name}</h2>
                            <p className="pet-species">Loài: {pet.pet_types_name}</p>
                            <p>Linh thú trang bị:</p>
                            <p>Vật phẩm trang bị:</p>
                        </div>

                        {/* Các hành động khác có thể thêm vào như cho ăn, huấn luyện, v.v. */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PetProfile;