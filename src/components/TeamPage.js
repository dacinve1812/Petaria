import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from './BackButton';
import './css/PlaceholderPage.css';

const TeamPage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="placeholder-page">
      <BackButton onClick={handleBack} />
      <div className="placeholder-content">
        <h1>Đội hình</h1>
        <p>Trang đội hình đang được phát triển...</p>
      </div>
    </div>
  );
};

export default TeamPage; 