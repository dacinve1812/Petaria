import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from './BackButton';
import './css/PlaceholderPage.css';

const CultivatePage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/home-ver2');
  };

  return (
    <div className="placeholder-page">
      <BackButton onClick={handleBack} />
      <div className="placeholder-content">
        <h1>Huấn luyện</h1>
        <p>Trang huấn luyện đang được phát triển...</p>
      </div>
    </div>
  );
};

export default CultivatePage; 