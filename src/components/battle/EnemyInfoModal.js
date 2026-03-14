// EnemyInfoModal.js - Modal hiển thị thông tin NPC + chọn pet để chiến đấu
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../css/EnemyInfoModal.css';

function EnemyInfoModal({ enemy, onClose, onSelectPet }) {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [selectedPet, setSelectedPet] = useState(null);
  const [enemyDetail, setEnemyDetail] = useState(null);
  const petRefs = useRef({});
  const petListRef = useRef(null);

  useEffect(() => {
    const fetchEnemyDetail = async () => {
      try {
        // Boss: GET /api/bosses/:id
        if (enemy?.isBoss && enemy?.id) {
          const res = await fetch(`${API_BASE_URL}/api/bosses/${enemy.id}`);
          if (res.ok) {
            const data = await res.json();
            setEnemyDetail(data);
          }
          return;
        }
        if (enemy?.uuid) {
          const res = await fetch(`${API_BASE_URL}/api/pets/${enemy.uuid}`);
          if (res.ok) {
            const data = await res.json();
            setEnemyDetail(data);
          }
        }
      } catch (err) {
        console.error('Error fetching enemy details:', err);
      }
    };

    if (enemy?.id || enemy?.uuid) fetchEnemyDetail();
  }, [enemy]);

  useEffect(() => {
    if (selectedPet && petRefs.current[selectedPet.uuid]) {
      petRefs.current[selectedPet.uuid].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedPet]);

  // Khóa scroll nền khi modal mở
  useEffect(() => {
    if (!enemy) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [enemy]);

  const handlePetListWheel = (e) => {
    const el = petListRef.current;
    if (!el || !el.scrollWidth || el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };

  if (!enemy) return null;

  const modalEl = (
    <div className="enemy-modal-overlay" onClick={onClose}>
      <div className="enemy-modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="header-banner"></span>
        <div className="enemy-info-section">
          <div className="enemy-modal-image-wrap">
            <img
              src={enemy.image?.startsWith('/') || enemy.image?.startsWith('http') ? enemy.image : `/images/pets/${enemy.image}`}
              alt={enemy.name}
              className="enemy-modal-image"
            />
          </div>
          <div className="enemy-stats">
            <h2>{enemy.name}</h2>
            <p><span className="stat-label">Level</span> <span className="stat-value">{enemy.level}</span></p>
            <p><span className="stat-label">HP</span> <span className="stat-value">{enemyDetail?.final_stats?.hp ?? enemyDetail?.hp ?? '—'}</span></p>
            <p><span className="stat-label">STR</span> <span className="stat-value">{enemyDetail?.final_stats?.str ?? enemyDetail?.str ?? '—'}</span></p>
            <p><span className="stat-label">DEF</span> <span className="stat-value">{enemyDetail?.final_stats?.def ?? enemyDetail?.def ?? '—'}</span></p>
            <p><span className="stat-label">SPD</span> <span className="stat-value">{enemyDetail?.final_stats?.spd ?? enemyDetail?.spd ?? '—'}</span></p>
          </div>
        </div>

        <div className="select-pet-section">
          <h3>Chọn thú cưng để chiến đấu</h3>
          <div
            ref={petListRef}
            className="pet-scroll-list"
            onWheel={handlePetListWheel}
          >
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

  return createPortal(modalEl, document.body);
}

export default EnemyInfoModal;
