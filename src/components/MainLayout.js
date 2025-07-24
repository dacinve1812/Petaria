import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNavbar from './BottomNavbar';
import CurrencyDisplay from './CurrencyDisplay';
import HomeFloatingButtons from './HomeFloatingButtons';
import { Outlet } from 'react-router-dom';
import '../styles/global.css';

function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(true); // Always mobile layout

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

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    // Check if current page is home page (where BottomNavbar should be shown)
    const isHomePage = () => {
        const homePaths = ['/', '/home', '/home-ver2'];
        return homePaths.includes(location.pathname);
    };

    return (
        <div className="container">
            <div className="content">
                <Sidebar 
                    userId={userId} 
                    handleLogout={handleLogout} 
                    isAdmin={isAdmin}
                    className={sidebarOpen ? 'sidebar open' : 'sidebar'}
                />
                {sidebarOpen && (
                    <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
                )}
                <div className="main-content">
                    <Outlet />
                </div>
                {isHomePage() && (
                    <BottomNavbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
                )}
                {isHomePage() && <HomeFloatingButtons />}
                {userId && <CurrencyDisplay userId={userId} />}
            </div>
        </div>
    );
}

export default MainLayout; 