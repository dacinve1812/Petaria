import React, { useState, useEffect, useRef } from 'react';
import EncounterModal from './EncounterModal';
import ItemEncounterModal from './ItemEncounterModal';
import SimpleFlashOverlay from './SimpleFlashOverlay';

function EncounterModalContainer() {
  const [wildPet, setWildPet] = useState(null);
  const [itemEncounter, setItemEncounter] = useState(null);
  const [encounterType, setEncounterType] = useState('species');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showScreenFlash, setShowScreenFlash] = useState(false);
  const isProcessingRef = useRef(false); // Prevent duplicate processing

  useEffect(() => {
    // Listen for encounter events from the game
    const handleEncounter = (event) => {
      if (isProcessingRef.current) {
        return;
      }

      const detail = event.detail || {};
      const type = detail.encounterType === 'item' ? 'item' : 'species';

      isProcessingRef.current = true; // Mark as processing

      // Trigger screen flash first
      setShowScreenFlash(true);

      setEncounterType(type);
      if (type === 'item') {
        setItemEncounter(detail.itemEncounter || null);
        setWildPet(null);
      } else {
        setWildPet(detail.wildPet);
        setItemEncounter(null);
      }
    };

    window.addEventListener('wildPetEncounter', handleEncounter);

    return () => {
      window.removeEventListener('wildPetEncounter', handleEncounter);
    };
  }, []);

  const handleScreenFlashComplete = () => {
    // After all flashes complete, show the modal
    setIsModalOpen(true);
    setShowScreenFlash(false);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setWildPet(null);
    setItemEncounter(null);
    setEncounterType('species');
    isProcessingRef.current = false; // Reset processing flag

    // Dispatch event to re-enable player movement
    const closeEvent = new CustomEvent('encounterModalClosed');
    window.dispatchEvent(closeEvent);
  };

  const handleCatch = (pet) => {
    console.log('🎣 Attempting to catch:', pet.name);
    // TODO: Implement catch logic
    alert(`🎣 Attempting to catch ${pet.name}! (Catch system not implemented yet)`);
  };

  const handleBattle = (pet) => {
    console.log('⚔️ Starting battle with:', pet.name);
    // TODO: Implement battle logic
    alert(`⚔️ Starting battle with ${pet.name}! (Battle system not implemented yet)`);
  };

  return (
    <>
      {/* Simple CSS Flash Overlay */}
      <SimpleFlashOverlay 
        isActive={showScreenFlash} 
        onAnimationComplete={handleScreenFlashComplete}
        flashCount={3}        // Flash 4 lần
        duration={800}        // Tổng thời gian 800ms (200ms mỗi flash)
      />

      {/* Encounter Modal */}
      {isModalOpen && encounterType === 'item' && itemEncounter && (
        <ItemEncounterModal item={itemEncounter} onClose={handleClose} />
      )}
      {isModalOpen && encounterType !== 'item' && wildPet && (
        <EncounterModal
          wildPet={wildPet}
          onClose={handleClose}
          onCatch={handleCatch}
          onBattle={handleBattle}
        />
      )}
    </>
  );
}

export default EncounterModalContainer;
