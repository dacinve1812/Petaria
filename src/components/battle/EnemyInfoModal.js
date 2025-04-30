// EnemyInfoModal.js - Modal hiển thị thông tin NPC + chọn pet để chiến đấu
import React, { useState, useEffect, useRef } from 'react';
import '../css/EnemyInfoModal.css';

function EnemyInfoModal({ enemy, onClose, onSelectPet }) {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [selectedPet, setSelectedPet] = useState(null);
  const [enemyDetail, setEnemyDetail] = useState(null);
  const petRefs = useRef({});

  useEffect(() => {
    const fetchEnemyDetail = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/pets/${enemy.uuid}`);
        if (res.ok) {
          const data = await res.json();
          setEnemyDetail(data);
        } else {
          console.error('Failed to fetch enemy details');
        }
      } catch (err) {
        console.error('Error fetching enemy details:', err);
      }
    };

    if (enemy?.uuid) {
      fetchEnemyDetail();
      console.log(enemy?.uuid)
    }
  }, [enemy]);

  useEffect(() => {
    if (selectedPet && petRefs.current[selectedPet.uuid]) {
      petRefs.current[selectedPet.uuid].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedPet]);

  if (!enemy) return null;

  return (
    <div className="enemy-modal-overlay" onClick={onClose}>
      <div className="enemy-modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="header-banner"></span>
        <div className="enemy-info-section">
          <img src={`/images/pets/${enemy.image}`} alt={enemy.name} className="enemy-modal-image" />
         
          <div className="enemy-stats">
            <h2>{enemy.name}</h2>
            <p>Level: {enemy.level}</p>
            <p>HP: {enemyDetail?.hp || '???'}</p>
            <p>STR: {enemyDetail?.str || '???'}</p>
            <p>DEF: {enemyDetail?.def || '???'}</p>
            <p>SPD: {enemyDetail?.spd || '???'}</p>
          </div>

        </div>

        <div className="select-pet-section">
          <h3>Chọn thú cưng để chiến đấu</h3>
          <div className="pet-scroll-list">
            {enemy.userPets && enemy.userPets.length > 0 ? (
              enemy.userPets.map(pet => (
                <div
                  key={pet.uuid}
                  ref={el => petRefs.current[pet.uuid] = el}
                  className={`pet-select-card ${selectedPet && selectedPet.uuid === pet.uuid ? 'selected' : ''}`}
                  onClick={() => setSelectedPet(pet)}
                >
                  <div><img src={`/images/pets/${pet.image}`} alt={pet.name} /></div>
                  <div className='pet-select-card-infor'>
                    <div>{pet.name}</div>
                    <div>Lvl.{pet.level}</div>
                  </div>
                </div>
              ))
            ) : (
              <p>Bạn chưa có thú cưng nào.</p>
            )}
          </div>
          <button
            className="battle-button"
            onClick={() => selectedPet && onSelectPet(selectedPet)}
            disabled={!selectedPet}
            style={{ opacity: selectedPet ? 1 : 0.5 }}
          >
            Battle
          </button>

          <button className='close-button' onClick={onClose} ><img src='/images/icons/close.png'></img></button>
        </div>
        
      </div>
    </div>
  );
}

export default EnemyInfoModal;
