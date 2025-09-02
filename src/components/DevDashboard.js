import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DevDashboard.css';
import GlobalBanner from './GlobalBanner';
import { resolveAssetPath } from '../utils/pathUtils';
import NavigationMenu from './NavigationMenu';

function DevDashboard() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const [userId, setUserId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [tokenInfo, setTokenInfo] = useState(null);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

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

    // Get token information
    const getTokenInfo = () => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            const isExpired = decodedToken.exp < currentTime;
            
            return {
                token: token.substring(0, 20) + '...',
                decoded: decodedToken,
                isExpired,
                expiresAt: new Date(decodedToken.exp * 1000).toLocaleString(),
                timeUntilExpiry: Math.max(0, decodedToken.exp - currentTime),
                userId: decodedToken.userId,
                username: decodedToken.username || 'N/A'
            };
        } catch (err) {
            return { error: 'Invalid token format' };
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            if (isTokenExpired()) {
                localStorage.removeItem('token');
                setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
                return;
            }

            try {
                const decodedToken = JSON.parse(atob(token.split('.')[1]));
                setUserId(decodedToken.userId);
                
                // Check if user is admin
                const adminStatus = localStorage.getItem('isAdmin') === 'true';
                setIsAdmin(adminStatus);
                
                if (!adminStatus) {
                    setError('Bạn không có quyền truy cập trang này.');
                    setTimeout(() => {
                        navigate('/');
                    }, 2000);
                    return;
                }

                // Get token info
                setTokenInfo(getTokenInfo());
                
            } catch (err) {
                console.error('Error checking auth:', err);
                setError('Token không hợp lệ');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            }
        };

        checkAuth();
    }, [navigate]);

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours}h ${minutes}m ${secs}s`;
    };

    const refreshTokenInfo = () => {
        setTokenInfo(getTokenInfo());
    };

    if (error) {
        return (
            <div className="dev-dashboard">
                <GlobalBanner
                    backgroundImage={resolveAssetPath("/images/background/dev-bg.jpg")}
                    title="Dev Dashboard"
                    subtitle="Hệ thống quản lý cho Developer"
                    showBackButton={true}
                    className="small"
                />
                <NavigationMenu />
                <div className="main-content">
                    <div className="error-message">
                        <h2>Lỗi</h2>
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="dev-dashboard">
                <GlobalBanner
                    backgroundImage={resolveAssetPath("/images/background/dev-bg.jpg")}
                    title="Dev Dashboard"
                    subtitle="Hệ thống quản lý cho Developer"
                    showBackButton={true}
                    className="small"
                />
                <NavigationMenu />
                <div className="main-content">
                    <div className="access-denied">
                        <h2>⚠️ Truy cập bị từ chối</h2>
                        <p>Bạn không có quyền truy cập trang này. Chỉ Admin mới được phép.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dev-dashboard">
            <GlobalBanner
                backgroundImage={resolveAssetPath("/images/background/dev-bg.jpg")}
                title="Dev Dashboard"
                subtitle="Hệ thống quản lý cho Developer"
                showBackButton={true}
                className="small"
            />
            <NavigationMenu />
            
            <div className="main-content">
                <div className="dashboard-header">
                    <h1>🔧 Developer Dashboard</h1>
                    <p>Thông tin hệ thống dành cho Developer</p>
                </div>

                <div className="dashboard-content">
                    {/* Token Information */}
                    <div className="section">
                        <div className="section-header">
                            <h2>🔐 JWT Token</h2>
                            <button onClick={refreshTokenInfo} className="refresh-btn">🔄</button>
                        </div>
                        
                        {tokenInfo && (
                            <div className="token-info">
                                <div className="info-grid">
                                    <div className="info-item">
                                        <label>Status:</label>
                                        <span className={tokenInfo.isExpired ? 'expired' : 'valid'}>
                                            {tokenInfo.isExpired ? '❌ EXPIRED' : '✅ VALID'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <label>User ID:</label>
                                        <span>{tokenInfo.userId}</span>
                                    </div>
                                    <div className="info-item">
                                        <label>Expires:</label>
                                        <span className={tokenInfo.isExpired ? 'expired' : 'valid'}>
                                            {tokenInfo.isExpired ? 'EXPIRED' : formatTime(tokenInfo.timeUntilExpiry)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Project Structure */}
                    <div className="section">
                        <h2>📁 Project Structure</h2>
                        <div className="structure-info">
                            <h3>Petaria File Organization:</h3>
                            <pre className="code-block">
{`petaria/
├── backend/
│   ├── server.js          # Main server (Express + MySQL)
│   ├── package.json       # Dependencies
│   └── utils/
├── src/
│   ├── components/        # React components
│   │   ├── MyHome.js      # Pet management
│   │   ├── Orphanage.js   # Adopt/release pets
│   │   ├── ShopPage.js    # Shopping system
│   │   ├── DevDashboard.js # This page
│   │   └── NavigationMenu.js
│   ├── styles/            # CSS files
│   └── utils/             # Utilities
├── public/
│   └── images/            # Static assets
└── package.json`}
                            </pre>
                        </div>
                    </div>

                    {/* Database Schema */}
                    <div className="section">
                        <h2>🗄️ Database Schema</h2>
                        <div className="db-info">
                            <h3>Core Tables & Relationships:</h3>
                            <pre className="code-block">
{`users (id, username, password, gold, petagold, is_admin)
├── pets (id, uuid, name, owner_id, pet_species_id, level, stats)
│   └── pet_species (id, name, image, base_stats)
├── items (id, name, type, effect)
├── inventory (user_id, item_id, quantity)
└── spirits (id, name, user_id, level)

Key Relationships:
• users.id → pets.owner_id (1:N)
• pets.pet_species_id → pet_species.id (N:1)
• users.id → inventory.user_id (1:N)
• users.id → spirits.user_id (1:N)`}
                            </pre>
                        </div>
                    </div>

                    {/* API Endpoints */}
                    <div className="section">
                        <h2>🌐 API Endpoints</h2>
                        <div className="api-info">
                            <h3>Core APIs:</h3>
                            <div className="api-list">
                                <div className="api-item">
                                    <span className="method get">GET</span>
                                    <span className="path">/api/orphanage-pets</span>
                                    <span className="desc">Get available pets for adoption</span>
                                </div>
                                <div className="api-item">
                                    <span className="method post">POST</span>
                                    <span className="path">/api/adopt-pet</span>
                                    <span className="desc">Adopt a pet (requires auth)</span>
                                </div>
                                <div className="api-item">
                                    <span className="method get">GET</span>
                                    <span className="path">/users/:userId/pets</span>
                                    <span className="desc">Get user's pets (requires auth)</span>
                                </div>
                                <div className="api-item">
                                    <span className="method delete">DELETE</span>
                                    <span className="path">/api/pets/:uuid/release</span>
                                    <span className="desc">Release a pet (requires auth)</span>
                                </div>
                                <div className="api-item">
                                    <span className="method post">POST</span>
                                    <span className="path">/api/login</span>
                                    <span className="desc">User authentication</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Authentication Flow */}
                    <div className="section">
                        <h2>🔐 Authentication Flow</h2>
                        <div className="auth-info">
                            <h3>JWT Token Process:</h3>
                            <ol>
                                <li><strong>Login</strong> → Server generates JWT (24h expiry)</li>
                                <li><strong>Store</strong> → Token saved in localStorage</li>
                                <li><strong>API Calls</strong> → Include Authorization header</li>
                                <li><strong>Validation</strong> → Server verifies token</li>
                                <li><strong>Expiry</strong> → Auto redirect to login</li>
                            </ol>
                        </div>
                    </div>

                    {/* Development Notes */}
                    <div className="section">
                        <h2>📝 Development Notes</h2>
                        <div className="notes-info">
                            <h3>Important Info:</h3>
                            <ul>
                                <li><strong>Token Expiry:</strong> 24 hours (configurable in server.js)</li>
                                <li><strong>Admin Check:</strong> localStorage.getItem('isAdmin') === 'true'</li>
                                <li><strong>API Base:</strong> {API_BASE_URL}</li>
                                <li><strong>Database:</strong> MySQL with connection pooling</li>
                                <li><strong>Frontend:</strong> React with React Router</li>
                                <li><strong>Auth:</strong> JWT with automatic expiration check</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DevDashboard;
