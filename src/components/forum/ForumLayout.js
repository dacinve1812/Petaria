import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useUser } from '../../UserContext';
import './forum.css';

export default function ForumLayout() {
  const { user, isAuthenticated } = useUser();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('forumTheme');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('forumTheme', theme);
  }, [theme]);

  return (
    <div className="forumShell" data-theme={theme}>
      <div className="forumHeader">
        <div className="forumHeaderInner">
          <div className="forumBrand">
            <Link className="forumBrandLink" to="/forum">
              Diễn đàn Petaria
            </Link>
            <span className="forumBrandSub">Nơi tổng hợp thông báo & thảo luận</span>
          </div>

          <div className="forumHeaderActions">
            <Link className="forumHeaderBtn" to="/">
              Vào game
            </Link>
            {isAuthenticated ? (
              <Link className="forumHeaderBtn" to="/forum/my">
                Bài của tôi
              </Link>
            ) : null}
            <button
              type="button"
              className="forumHeaderBtn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Đổi theme"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            {isAuthenticated ? (
              <span className="forumUserPill" title={user?.username || ''}>
                {user?.effectiveName || user?.username || 'Người chơi'}
              </span>
            ) : (
              <Link className="forumHeaderBtn forumHeaderBtnPrimary" to="/login">
                Đăng nhập để đăng bài
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="forumMain">
        <Outlet />
      </div>
    </div>
  );
}

