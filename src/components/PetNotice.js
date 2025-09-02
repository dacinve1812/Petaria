import React, { useState, useEffect } from 'react';
import './PetNotice.css';

const PetNotice = () => {
  const [hasPets, setHasPets] = useState(null);

  useEffect(() => {
    // Get hasPet status from localStorage (set during login)
    const hasPetStatus = localStorage.getItem('hasPet');
    if (hasPetStatus !== null) {
      setHasPets(hasPetStatus === 'true');
    } else {
      // Fallback: if not in localStorage, assume user has pets (safer default)
      setHasPets(true);
    }
  }, []);

  // Don't show anything if user has pets
  if (hasPets) {
    return null;
  }

  return (
    <div className="pet-notice">
      <div className="notice-content">
        <p><strong>Thông báo: Bạn chưa có thú cưng nào cả!</strong></p>
        <p>Bạn có thể đến <u><a href="/orphanage">Trại mồ côi</a></u> để nhận nuôi thú cưng!!!</p>
      </div>
    </div>
  );
};

export default PetNotice;
