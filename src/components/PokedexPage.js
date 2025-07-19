import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from './BackButton';
import './css/PlaceholderPage.css';

const PokedexPage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/home-ver2');
  };

  return (
    <div className="placeholder-page">
      <BackButton onClick={handleBack} />
      <div className="placeholder-content">
        <h1>Petadex</h1>
        <p>Trang Petadex đang được phát triển...</p>
      </div>
    </div>
  );
};

export default PokedexPage; 