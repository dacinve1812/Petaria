import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './PetProfile.css'; // Import file CSS cho PetProfile
import Sidebar from './Sidebar';
import Navbar from './Navbar';

function PetProfile() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const { uuid } = useParams(); // Lấy UUID thú cưng từ URL
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
                const response = await fetch(`${API_BASE_URL}/api/pets/${uuid}`); // Gọi API với UUID
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
    }, [uuid, navigate,API_BASE_URL]); // Theo dõi uuid thay vì petId

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };
    const handleReleasePet = async () => {
        if (!pet || !currentUserId) return;

        if (pet.owner_id !== currentUserId) {
            alert('Bạn không có quyền phóng thích thú cưng này.');
            return;
        }

        const confirmRelease = window.confirm(`Bạn có chắc chắn muốn phóng thích ${pet.name || pet.pet_types_name} không? Hành động này không thể hoàn tác.`);

        if (confirmRelease) {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(`${API_BASE_URL}/api/pets/${uuid}/release`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    alert('Thú cưng đã được phóng thích thành công.');
                    navigate('/myhome'); // Chuyển về trang nhà sau khi phóng thích
                } else if (response.status === 401) {
                    setError('Bạn chưa đăng nhập.');
                    navigate('/login');
                } else if (response.status === 403) {
                    alert('Bạn không có quyền phóng thích thú cưng này.');
                } else if (response.status === 404) {
                    setError('Không tìm thấy thú cưng này.');
                } else {
                    const errorData = await response.json();
                    setError(`Lỗi khi phóng thích thú cưng: ${errorData?.message || response.statusText}`);
                }
            } catch (err) {
                console.error('Error releasing pet:', err);
                setError('Lỗi mạng khi phóng thích thú cưng.');
            }
        }
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

    const isEvolved = pet.evolution_stage === true; // Kiểm tra trạng thái tiến hóa

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
                            <p><span className='extra-stats'>{isEvolved ? 'Đã tiến hóa' : 'Chưa tiến hóa'}</span></p>
                            <p>Đẳng cấp: {pet.level}</p>
                            <p>Sinh Nhật: {pet.created_date ? new Date(pet.created_date).toLocaleDateString() : 'N/A'}</p>
                            <p>Hạng: {pet.rank || 'N/A'}</p>
                            <p>Điểm cần nâng cấp: {pet.experience}/99999999</p>
                            <p>Sức Khỏe: {pet.hp}/{pet.max_hp}</p>
                            <p>Năng Lượng: {pet.mp}/{pet.max_mp}</p>
                            <p>Sức Mạnh: {pet.str}{pet.str_added > 0 ? ` (+${pet.str_added})` : ''}</p>
                            <p>Phòng Thủ: {pet.def}{pet.def_added > 0 ? ` (+${pet.def_added})` : ''}</p>
                            <p>Thông Minh: {pet.intelligence}{pet.intelligence_added > 0 ? ` (+${pet.intelligence_added})` : ''}</p>
                            <p>Tốc Độ: {pet.spd}{pet.spd_added > 0 ? ` (+${pet.spd_added})` : ''}</p>
                            <p>Tình Trạng: {pet.status || 'Ổn định'}</p>
                            <br></br>
                            <p>Chiến đấu thắng: {pet.battles_won || 'N/A'}</p>
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
                    {currentUserId === pet.owner_id && (
                            <div className="pet-actions">
                                {/* Các hành động khác có thể thêm vào như cho ăn, huấn luyện, v.v. */}
                                <button className="release-button" onClick={handleReleasePet}>
                                    Phóng thích thú cưng
                                </button>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}

export default PetProfile;