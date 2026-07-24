import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useScrollAnimation from '../hooks/useScrollAnimation';
import Sidebar from './Sidebar';
import MailModal from './MailModal';
import Footer from './Footer';
import TopNavigation from './navbar/TopNavigation';
import NavigationMenu from './navbar/NavigationMenu';
import GlobalChatBox from './GlobalChatBox';
import EncounterModalContainer from './EncounterModalContainer';
import { Outlet } from 'react-router-dom';
import { NarrativeDialogProvider } from './ui/NarrativeDialogContext';
import NarrativeHost from './ui/NarrativeHost';
import { GameCenterAlertsProvider } from './entertainment/GameCenterAlertsContext';
import '../styles/global.css';
import { resolveAssetPath } from '../utils/pathUtils';
import { dispatchMailInboxViewed } from '../utils/mailEvents';

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

    useEffect(() => {
        if (isMailModalOpen && userId) {
            dispatchMailInboxViewed();
        }
    }, [isMailModalOpen, userId]);

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
        if (pathname.startsWith('/region/')) {
            return 'PETARIA';
        }
        if (pathname.startsWith('/hunting-world/confirm')) {
            return 'PETARIA';
        }
        if (pathname.startsWith('/guild')) {
            return 'BANG HỘI';
        }
        if (pathname.startsWith('/exhibition')) {
            return 'PHÒNG TRIỂN LÃM';
        }
        if (pathname.startsWith('/tasks')) {
            return 'NHIỆM VỤ';
        }
        if (pathname.startsWith('/shop') || pathname.startsWith('/admin/edit-shop-items')) {
            return 'CỬA HÀNG';
        }
        if (pathname.startsWith('/inventory')) {
            return 'TRANG BỊ';
        }
        if (pathname.startsWith('/battle/arena/select') || pathname.startsWith('/battle/select')) {
            return 'CHUẨN BỊ CHIẾN ĐẤU';
        }
        if (pathname.startsWith('/battle/match') || pathname.startsWith('/battle/arena/arenabattle')) {
            return 'CHIẾN ĐẤU';
        }
        if (pathname.startsWith('/battle/champion')) {
            return 'CHAMPION CHALLENGE';
        }
        if (pathname.startsWith('/battle')) {
            return 'ĐẤU TRƯỜNG';
        }

        const titleMap = {
            '/': 'PETARIA',
            '/home': 'PETARIA',
            '/home-ver2': 'KINH THÀNH',
            '/inventory': 'TRANG BỊ',
            '/myhome': 'THÚ CƯNG',
            '/myhome/mypet': 'THÚ CƯNG',
            '/myhome/myspirit': 'LINH THÚ',
            '/myhome/spirits': 'LINH THÚ',
            '/bank': 'NGÂN HÀNG',
            '/shop': 'CỬA HÀNG',
            '/auction': 'ĐẤU GIÁ',
            '/orphanage': 'TRẠI MỒ CÔI',
            '/restaurant': 'NHÀ HÀNG',
            '/healia-river': 'SÔNG HEALIA',
            '/battle': 'ĐẤU TRƯỜNG',
            '/battle/arena': 'ĐẤU TRƯỜNG',
            '/battle/match': 'CHIẾN ĐẤU',
            '/battle/arena/arenabattle': 'CHIẾN ĐẤU',
            '/hunting-world': 'ĐI SĂN',
            '/world-map': 'PETARIA',
            '/quest': 'NHIỆM VỤ',
            '/tasks': 'NHIỆM VỤ',
            '/management': 'QUẢN LÝ',
            '/title': 'DANH HIỆU',
            '/exhibition': 'PHÒNG TRIỂN LÃM',
            '/buddies': 'BẠN BÈ',
            '/admin': 'ADMIN PANEL',
            '/dev-dashboard': 'DEV DASHBOARD',
            '/example': 'BẢNG XẾP HẠNG',
            '/game-center/lucky-wheel': 'LUCKLY WHEEL',
            '/game-center/lucky-booth': 'LÀNG HẢO VỌNG',
            '/game-center/mystery-box': 'LÀNG TRÁO TRỞ',
            '/game-center/scratch-lottery': 'VÉ SỐ CÀO',
            '/game-center/beggar-king': 'LÀNG PHÚ GIA',
            '/game-center/slot-machine': 'LÀNG ĐỎ ĐEN',
            '/game-center/guess-number': 'LÀNG TRẺ CON',
            '/game-center/daily-free': 'LÀNG NHÂN ÁI'
            

        };
        
        return titleMap[pathname] || 'PETARIA';
    };

    return (
        <GameCenterAlertsProvider>
       
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
                <NarrativeDialogProvider>
                  <main className="container_fixed" id="peta-body">
                      <Outlet />
                      <NarrativeHost />
                  </main>
                </NarrativeDialogProvider>
            </section>
        </div>
        
        {/* Sidebar - Overlay component */}
        <Sidebar 
            userId={userId} 
            handleLogout={handleLogout} 
            isAdmin={isAdmin}
            className={sidebarOpen ? 'sidebar open' : 'sidebar'}
            onCurrencyUpdate={currencyUpdateTrigger}
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
        <GlobalChatBox />
        <EncounterModalContainer />
        <Footer />
        </GameCenterAlertsProvider>
    );
}

export default MainLayout; 