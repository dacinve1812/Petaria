import React, { useState } from 'react';
import TemplatePage from './TemplatePage';

const ExampleTemplatePage = () => {
  const [searchValue, setSearchValue] = useState('');

  // Example tabs data with routing
  const tabs = [
    { label: 'COMPETITIVE', value: 'competitive', path: '/example/competitive' },
    { label: 'EXP', value: 'exp', path: '/example/exp' },
    { label: 'CLAN', value: 'clan', path: '/example/clan' }
  ];

  const handleSearch = (value) => {
    setSearchValue(value);
    console.log('Search:', value);
  };

  // Get current tab from URL
  const getCurrentTab = () => {
    const path = window.location.pathname;
    if (path === '/example' || path.includes('/competitive')) return 0;
    if (path.includes('/exp')) return 1;
    if (path.includes('/clan')) return 2;
    return 0; // default to competitive
  };

  // Example content based on current tab
  const renderContent = () => {
    const currentTab = getCurrentTab();
    switch (currentTab) {
      case 0: // COMPETITIVE
        return (
          <div className="leaderboard-content">
            <h3>Competitive Leaderboards</h3>
            <div className="table-container">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>TIER</th>
                    <th>RANK</th>
                    <th>PLAYER NAME</th>
                    <th>KDR</th>
                    <th>WIN_RATE</th>
                    <th>CLAN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>🔴</td>
                    <td>👑</td>
                    <td>BHR</td>
                    <td>1.67</td>
                    <td>57.79%</td>
                    <td>NewYork5pct</td>
                  </tr>
                  <tr>
                    <td>2</td>
                    <td>🔴</td>
                    <td>👑</td>
                    <td>FR.</td>
                    <td>1.3</td>
                    <td>57.47%</td>
                    <td>-</td>
                  </tr>
                  <tr>
                    <td>3</td>
                    <td>🔴</td>
                    <td>👑</td>
                    <td>YeYe</td>
                    <td>2.1</td>
                    <td>61.61%</td>
                    <td>Vay</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 1: // EXP
        return (
          <div className="exp-content">
            <h3>Experience Leaderboards</h3>
            <p>Experience-based rankings will be displayed here.</p>
          </div>
        );
      
      case 2: // CLAN
        return (
          <div className="clan-content">
            <h3>Clan Leaderboards</h3>
            <p>Clan-based rankings will be displayed here.</p>
          </div>
        );
      
      default:
        return <div>No content available</div>;
    }
  };

  return (
    <TemplatePage
      tabs={tabs}
      showSearch={true}
      searchPlaceholder="Search"
      onSearch={handleSearch}
    >
      {renderContent()}
    </TemplatePage>
  );
};

export default ExampleTemplatePage;
