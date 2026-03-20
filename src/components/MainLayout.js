import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useScrollAnimation from '../hooks/useScrollAnimation';
import Sidebar from './Sidebar';
import MailModal from './MailModal';
import Footer from './Footer';
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

    // Cho sidebar wide viewport: bỏ padding-top khi top nav đã ẩn để không lộ khoảng trống
    useEffect(() => {
        if (isScrolledDown) {
            document.body.classList.add('nav-scrolled-hidden');
        } else {
            document.body.classList.remove('nav-scrolled-hidden');
        }
        return () => document.body.classList.remove('nav-scrolled-hidden');
    }, [isScrolledDown]);

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

    // Get page title based on current path
    const getPageTitle = (pathname) => {
        const titleMap = {
            '/': 'PETARIA',
            '/home': 'PETARIA',
            '/home-ver2': 'KINH THÀNH',
            '/inventory': 'TRANG BỊ',
            '/myhome': 'THÚ CƯNG',
            '/myhome/spirits': 'LINH THÚ',
            '/bank': 'NGÂN HÀNG',
            '/shop': 'CỬA HÀNG',
            '/auction': 'ĐẤU GIÁ',
            '/orphanage': 'TRẠI MỒ CÔI',
            '/restaurant': 'NHÀ HÀNG',
            '/healia-river': 'SÔNG HEALIA',
            '/battle': 'ĐẤU TRƯỜNG',
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
        <TopNavigation className={isScrolledDown ? 'hidden' : ''} onOpenSidebar={() => setSidebarOpen(true)} />
        
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
        <Footer />
        </>
    );
}

export default MainLayout; 