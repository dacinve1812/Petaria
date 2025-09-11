import React from 'react';
import './PetNotice.css';
import { useUser } from '../UserContext';

const PetNotice = () => {
  const { user, isLoading } = useUser();

  // Don't show anything while loading
  if (isLoading) {
    return null;
  }

  // Don't show anything if user has pets
  if (user && user.hasPet) {
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