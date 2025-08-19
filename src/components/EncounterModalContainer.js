import React, { useState, useEffect, useRef } from 'react';
import EncounterModal from './EncounterModal';
import SimpleFlashOverlay from './SimpleFlashOverlay';

function EncounterModalContainer() {
  const [wildPet, setWildPet] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showScreenFlash, setShowScreenFlash] = useState(false);
  const isProcessingRef = useRef(false); // Prevent duplicate processing

  useEffect(() => {
    // Listen for encounter events from the game
    const handleEncounter = (event) => {
      if (isProcessingRef.current) {
        return;
      }

      const { wildPet } = event.detail;
      
      isProcessingRef.current = true; // Mark as processing
      
      // Trigger screen flash first
      setShowScreenFlash(true);
      
      // Set wild pet data
      setWildPet(wildPet);
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
      {isModalOpen && wildPet && (
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
