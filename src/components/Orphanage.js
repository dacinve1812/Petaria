import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Orphanage.css';
import GlobalBanner from './GlobalBanner';
import { resolveAssetPath } from '../utils/pathUtils';
import NavigationMenu from './NavigationMenu';
import PetNotice from './PetNotice';


function Orphanage() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const [availablePets, setAvailablePets] = useState([]);
    const [userPets, setUserPets] = useState([]);
    const [selectedPet, setSelectedPet] = useState(null);
    const [selectedPetsForRelease, setSelectedPetsForRelease] = useState([]);
    const [petName, setPetName] = useState('');
    const [currentMode, setCurrentMode] = useState('main'); // 'main', 'adopt', 'release'
    const navigate = useNavigate();
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Check if token is expired
    const isTokenExpired = () => {
        const token = localStorage.getItem('token');
        if (!token) return true;
        
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            return decodedToken.exp < currentTime;
        } catch (err) {
            return true;
        }
    };

    // Handle token expiration
    const handleTokenExpiration = () => {
        localStorage.removeItem('token');
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        setTimeout(() => {
            navigate('/login');
        }, 2000);
    };

    useEffect(() => {
        if (isTokenExpired()) {
            handleTokenExpiration();
            return;
        }

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
            setError('Token không hợp lệ');
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }
    }, [navigate]);

    useEffect(() => {
        if (userId && currentMode === 'adopt') {
            fetchOrphanagePets();
        } else if (userId && currentMode === 'release') {
            fetchUserPets();
        }
    }, [userId, currentMode]);

    const fetchOrphanagePets = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/orphanage-pets`);
            if (response.ok) {
                const data = await response.json();
                setAvailablePets(data);
            } else if (response.status === 401) {
                handleTokenExpiration();
            } else {
                setError('Failed to fetch orphanage pets');
            }
        } catch (err) {
            console.error('Error fetching orphanage pets:', err);
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const fetchUserPets = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/users/${userId}/pets`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setUserPets(data);
            } else if (response.status === 401) {
                handleTokenExpiration();
            } else {
                setError('Failed to fetch user pets');
            }
        } catch (err) {
            console.error('Error fetching user pets:', err);
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPet = (pet) => {
        setSelectedPet(pet);
    };

    const handleSelectPetForRelease = (pet) => {
        setSelectedPetsForRelease(prev => {
            const isSelected = prev.find(p => p.uuid === pet.uuid);
            if (isSelected) {
                return prev.filter(p => p.uuid !== pet.uuid);
            } else {
                return [...prev, pet];
            }
        });
    };

    const handleAdoptPet = async () => {
        if (selectedPet && petName && userId) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/adopt-pet`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
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
                    
                    // Update localStorage hasPet status
                    localStorage.setItem('hasPet', 'true');
                    
                    alert(`Pet adopted successfully!`);
                } else if (response.status === 401) {
                    handleTokenExpiration();
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

    const handleReleasePets = async () => {
        if (selectedPetsForRelease.length === 0) {
            setError('Please select at least one pet to release.');
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to release ${selectedPetsForRelease.length} pet(s)? This action cannot be undone.`);
        if (!confirmed) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token || isTokenExpired()) {
                handleTokenExpiration();
                return;
            }

            const releasePromises = selectedPetsForRelease.map(pet =>
                fetch(`${API_BASE_URL}/api/pets/${pet.uuid}/release`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
            );

            const results = await Promise.all(releasePromises);
            const failedReleases = results.filter(result => !result.ok);
            const unauthorizedReleases = results.filter(result => result.status === 401);

            if (unauthorizedReleases.length > 0) {
                handleTokenExpiration();
                return;
            }

            if (failedReleases.length === 0) {
                alert(`${selectedPetsForRelease.length} pet(s) released successfully!`);
                setSelectedPetsForRelease([]);
                fetchUserPets(); // Refresh the list
                
                // Check if user still has pets after release
                const remainingPets = userPets.length - selectedPetsForRelease.length;
                localStorage.setItem('hasPet', String(remainingPets > 0));
            } else {
                setError(`Failed to release ${failedReleases.length} pet(s).`);
            }
        } catch (err) {
            console.error('Error releasing pets:', err);
            setError('Network error while releasing pets');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToMain = () => {
        setCurrentMode('main');
        setSelectedPet(null);
        setSelectedPetsForRelease([]);
        setPetName('');
        setError(null);
    };

    const renderMainMenu = () => (
        <div className="orphanage-main-menu">
            <PetNotice />
            
            <div className="welcome-message">
                <p>Xin chào mừng bạn đã đến với Trung tâm thú cưng, tại đây bạn có thể nhân nuôi thú cưng cho riêng mình hoặc phóng thích thú cưng của mình.</p>
            </div>

            <div className="action-buttons">
                <button 
                    className="adopt-button"
                    onClick={() => setCurrentMode('adopt')}
                >
                    Nhân nuôi thú!
                </button>
                <button 
                    className="release-button"
                    onClick={() => setCurrentMode('release')}
                >
                    Phóng thích thú!
                </button>
            </div>
        </div>
    );

    const renderAdoptMode = () => (
        <div className="orphanage-adopt-mode">
            <div className="orphanage-mode-header">
                <h2>Nhận nuôi thú cưng</h2>
            </div>
            
            <button className="orphanage-mode-back-button" onClick={handleBackToMain}>← Quay lại</button>

            {error && <p className="orphanage-error">{error}</p>}

            {loading ? (
                <div className="orphanage-loading">Đang tải...</div>
            ) : (
                <div className="orphanage-pet-list">
                    {availablePets.map((pet) => (
                        <div 
                            key={pet.tempId} 
                            className={`orphanage-pet-item ${selectedPet?.tempId === pet.tempId ? 'orphanage-selected' : ''}`}
                            onClick={() => handleSelectPet(pet)}
                        >
                            <img src={`/images/pets/${pet.image}`} alt={pet.name} />
                            <div className="orphanage-pet-info">
                                <p>{pet.name} (Lv.{pet.level})</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedPet && (
                <div className="orphanage-adopt-form">
                    <h3>Chọn tên cho thú cưng:</h3>
                    <input 
                        type="text" 
                        value={petName} 
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder="Nhập tên thú cưng..."
                    />
                    <button onClick={handleAdoptPet} disabled={!petName.trim()}>
                        Nhận nuôi
                    </button>
                </div>
            )}
        </div>
    );

    const renderReleaseMode = () => (
        <div className="orphanage-release-mode">
            <div className="orphanage-mode-header">
                <h2>Phóng thích thú cưng</h2>
            </div>
            
            <button className="orphanage-mode-back-button" onClick={handleBackToMain}>← Quay lại</button>

            {error && <p className="orphanage-error">{error}</p>}

            {loading ? (
                <div className="orphanage-loading">Đang tải...</div>
            ) : userPets.length === 0 ? (
                <div className="orphanage-no-pets">
                    <p>Bạn chưa có thú cưng nào để phóng thích.</p>
                </div>
            ) : (
                <>
                    <div className="orphanage-pet-list">
                        {userPets.map((pet) => (
                            <div 
                                key={pet.uuid} 
                                className={`orphanage-pet-item ${selectedPetsForRelease.find(p => p.uuid === pet.uuid) ? 'orphanage-selected' : ''}`}
                                onClick={() => handleSelectPetForRelease(pet)}
                            >
                                <img src={`/images/pets/${pet.image}`} alt={pet.name} />
                                <div className="orphanage-pet-info">
                                    <p>{pet.name} (Lv.{pet.level})</p>
                                    <p>Type: {pet.species_name}</p>
                                </div>
                                {selectedPetsForRelease.find(p => p.uuid === pet.uuid) && (
                                    <div className="orphanage-selected-indicator">✓</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {selectedPetsForRelease.length > 0 && (
                        <div className="orphanage-release-form">
                            <h3>Đã chọn {selectedPetsForRelease.length} thú cưng để phóng thích:</h3>
                            <div className="orphanage-selected-pets">
                                {selectedPetsForRelease.map(pet => (
                                    <span key={pet.uuid} className="orphanage-selected-pet-tag">
                                        {pet.name}
                                    </span>
                                ))}
                            </div>
                            <button 
                                onClick={handleReleasePets} 
                                disabled={loading}
                                className="orphanage-release-confirm-button"
                            >
                                {loading ? 'Đang phóng thích...' : `Phóng thích ${selectedPetsForRelease.length} thú cưng`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    return (
        <div className="container">
            <div className="main-content">
            <GlobalBanner
                backgroundImage={resolveAssetPath("/images/background/pet-bg-3.jpg")}
                title="Trại Mồ Côi"
                subtitle="Nơi những thú cưng tìm được mái ấm mới"
                showBackButton={true}
                className="small"
                backgroundPosition="70% 70%"
            />
            <NavigationMenu />   
                {currentMode === 'main' && renderMainMenu()}
                {currentMode === 'adopt' && renderAdoptMode()}
                {currentMode === 'release' && renderReleaseMode()}
            </div>
        </div>
    );
}

export default Orphanage;
