import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TemplatePage = ({ 
  tabs = [], 
  showSearch = true, 
  searchPlaceholder = "Search...",
  onSearch, // Generic search handler
  searchHandlers = {}, // Object with search handlers for each tab
  additionalControls, // Additional controls to show in second tab group
  currentTab = 0, // Current active tab index from parent
  children 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabClick = (tab) => {
    if (tab.path) {
      navigate(tab.path);
    }
  };

  // Enhanced search handler with tab-specific logic
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    
    // Call generic search handler if provided
    if (onSearch) {
      onSearch(value);
    }
    
    // Call tab-specific search handler if available
    const tabKey = tabs[currentTab]?.value;
    const specificHandler = searchHandlers[tabKey];
    
    if (specificHandler && typeof specificHandler === 'function') {
      specificHandler(value);
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
                className={`tabs__top-button ${currentTab === index ? 'active' : ''}`}
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
            {additionalControls && (
              <div className="tabs__top-group">
                {additionalControls}
              </div>
            )}
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