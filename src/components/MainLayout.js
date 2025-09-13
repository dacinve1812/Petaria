import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useScrollAnimation from '../hooks/useScrollAnimation';
import Sidebar from './Sidebar';
import BottomNavbar from './BottomNavbar';
import CurrencyDisplay from './CurrencyDisplay';
import HomeFloatingButtons from './HomeFloatingButtons';
import MailModal from './MailModal';
import TopNavigation from './navbar/TopNavigation';
import NavigationMenu from './navbar/NavigationMenu';
import { Outlet } from 'react-router-dom';
import '../styles/global.css';
import { resolveAssetPath } from '../utils/pathUtils';

function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [userId, setUserId] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMailModalOpen, setIsMailModalOpen] = useState(false);
    const [currencyUpdateTrigger, setCurrencyUpdateTrigger] = useState(0);
    
    // Scroll animation - hide navs when scrolling down, show when scrolling up
    const isScrolledDown = useScrollAnimation(100); // 100px threshold

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
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const handleOpenMail = () => {
        setIsMailModalOpen(true);
    };

    const handleCloseMail = () => {
        setIsMailModalOpen(false);
    };

    const handleCurrencyUpdate = () => {
        setCurrencyUpdateTrigger(prev => prev + 1);
    };

    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    // Check if current page is home page (where BottomNavbar should be shown)
    const isHomePage = () => {
        const homePaths = ['/', '/home', '/home-ver2'];
        return homePaths.includes(location.pathname);
    };

    // Check if current page should show CurrencyDisplay
    const shouldShowCurrencyDisplay = () => {
        const currencyDisplayPaths = ['/shop', '/inventory']
        return currencyDisplayPaths.includes(location.pathname);
    };

    // Get page title based on current path
    const getPageTitle = (pathname) => {
        const titleMap = {
            '/': 'PETARIA',
            '/home': 'PETARIA',
            '/home-ver2': 'KINH THÀNH',
            '/inventory': 'TRANG BỊ',
            '/myhome': 'THÚ CƯNG',
            '/bank': 'NGÂN HÀNG',
            '/shop': 'MUA SẮM',
            '/auction': 'ĐẤU GIÁ',
            '/orphanage': 'VIỆN MỒ CÔI',
            '/battle/pve': 'ĐẤU TRƯỜNG',
            '/hunting-world': 'ĐI SĂN',
            '/guild': 'BANG HỘI',
            '/quest': 'NHIỆM VỤ',
            '/management': 'QUẢN LÝ',
            '/admin': 'ADMIN PANEL',
            '/dev-dashboard': 'DEV DASHBOARD',
            '/example': 'BẢNG XẾP HẠNG'
        };
        
        return titleMap[pathname] || 'PETARIA';
    };

    return (
        <>
       
        {/* Top Navigation Bar */}
        <TopNavigation className={isScrolledDown ? 'hidden' : ''} />
        
        {/* Second Navigation Menu */}
        <NavigationMenu className={isScrolledDown ? 'hidden' : ''} />
        
        {/* Main Content Area - Similar to cf-sub */}
        <div id="peta-sub">
            <section className="container">
                <h1 className="peta-sectiontitle">
                    {getPageTitle(location.pathname)}
                </h1>
                <main className="container_fixed" id="peta-body">
                    <Outlet />
                </main>
            </section>
        </div>
        
        {/* Sidebar - Overlay component */}
        <Sidebar 
            userId={userId} 
            handleLogout={handleLogout} 
            isAdmin={isAdmin}
            className={sidebarOpen ? 'sidebar open' : 'sidebar'}
        />
        {sidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
        )}
        
        {/* Mail Modal - Hiển thị khi cần */}
        <MailModal 
            isOpen={isMailModalOpen}
            onClose={handleCloseMail}
            userId={userId}
            onCurrencyUpdate={handleCurrencyUpdate}
        />
        {isHomePage() && (
            <BottomNavbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
        )}
        {isHomePage() && <HomeFloatingButtons userId={userId} onOpenMail={handleOpenMail} />}
        {userId && shouldShowCurrencyDisplay() && <CurrencyDisplay userId={userId} onCurrencyUpdate={currencyUpdateTrigger} />}
        
        </>
    );
}

export default MainLayout; 