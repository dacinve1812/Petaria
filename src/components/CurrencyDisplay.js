import React, { useEffect, useState } from 'react';
import './CurrencyDisplay.css';

function CurrencyDisplay({ userId }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [userData, setUserData] = useState({
    gold: 0,
    petagold: 0
  });

  useEffect(() => {
    if (userId) {
      fetch(`${API_BASE_URL}/users/${userId}`)
        .then((response) => response.json())
        .then((data) => {
          setUserData({
            gold: data.gold || 0,
            petagold: data.petagold || 0
          });
        })
        .catch((error) => console.error('Error fetching user data:', error));
    }
  }, [userId]);

  return (
    <div className="currency-display">
      <div className="currency-box peta">
        <div className="currency-info">
          <div className="currency-label">💰Peta</div>
          <div className="currency-value">{userData.gold.toLocaleString()}</div>
        </div>
      </div>
      
      <div className="currency-box petagold">
        <div className="currency-info">
          <div className="currency-label">💎 PetaGold</div>
          <div className="currency-value">{userData.petagold.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

export default CurrencyDisplay; 