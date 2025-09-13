import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TemplatePage = ({ 
  tabs = [], 
  showSearch = true, 
  searchPlaceholder = "Search...",
  onSearch,
  children 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // Default title from pathname if not provided

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  // Get current active tab from URL path
  const getCurrentTab = () => {
    const currentPath = location.pathname;
    return tabs.findIndex(tab => currentPath.includes(tab.path)) || 0;
  };

  const handleTabClick = (tab) => {
    if (tab.path) {
      navigate(tab.path);
    }
  };

  return (
    <>
      {/* Tabs and Search Section */}
      <nav className="tabs__top">
        {/* Tabs Group */}
        {tabs.length > 0 && (
          <div className="tabs__top-group" expanded>
            {tabs.map((tab, index) => (
              <button
                key={index}
                className={`tabs__top-button ${getCurrentTab() === index ? 'active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Search Group */}
        {showSearch && (
          <div className="tabs__top-group">
            <form id="desk_search" className="search-input" onSubmit={(e) => e.preventDefault()}>
             
                <input
                  type="text"
                  className="search-input"
                  id="desk_search_text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={handleSearchChange}
                />
                <button type="submit" className="search-button">
                  <img src="/images/icons/search.png" alt="Search" className="search-icon" />
                </button>
              
            </form>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <div className="page-content">
        {children}
      </div>
    </>
  );
};

export default TemplatePage;
