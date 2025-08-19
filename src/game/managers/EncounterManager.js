import { WILD_PETS, CURRENT_ZONE, getAvailablePetsForZone } from '../config/encounterConfig.js';

export class EncounterManager {
  constructor(scene) {
    this.scene = scene;
    this.currentZone = CURRENT_ZONE;
    this.lastEncounterTime = 0;
    this.isOnCooldown = false;
    this.cooldownTimer = null;
    
    // Callback for showing encounter modal
    this.onEncounterCallback = null;
  }

  // Set callback for showing encounter modal
  setEncounterCallback(callback) {
    this.onEncounterCallback = callback;
  }

  // Check if player is in battle zone and trigger encounter
  checkForEncounter(playerTileX, playerTileY) {
    // Check if player is in battle zone
    if (!this.isInBattleZone(playerTileX, playerTileY)) {
      return false;
    }

    // Check if on cooldown
    if (this.isOnCooldown) {
      return false;
    }

    // Calculate encounter chance
    const encounterChance = this.currentZone.baseEncounterRate;
    
    // Random check
    if (Math.random() < encounterChance) {
      // Trigger encounter!
      const wildPet = this.selectRandomPet();
      this.triggerEncounter(wildPet);
      return true;
    }

    return false;
  }

  // Check if tile is a battle zone
  isInBattleZone(tileX, tileY) {
    try {
      // Import battle zones data
      const { battleZones } = require('../../../src/game/map/forest/battleZones.js');
      
      // Convert tile coordinates to array index
      const mapWidth = 50; // Based on your map structure
      const index = tileY * mapWidth + tileX;
      
      // Check if tile is battle zone (value 113)
      return battleZones[index] === 113;
    } catch (error) {
      console.error('Error loading battle zones:', error);
      return false;
    }
  }

  // Select random pet based on encounter rates
  selectRandomPet() {
    const availablePets = getAvailablePetsForZone(this.currentZone.id);
    
    // Calculate total encounter rate for available pets
    const totalRate = availablePets.reduce((sum, pet) => sum + pet.encounterRate, 0);
    
    // Normalize rates to sum to 1
    const normalizedPets = availablePets.map(pet => ({
      ...pet,
      normalizedRate: pet.encounterRate / totalRate
    }));

    // Select pet based on normalized rates
    const rand = Math.random();
    let cumulativeRate = 0;
    
    for (const pet of normalizedPets) {
      cumulativeRate += pet.normalizedRate;
      if (rand <= cumulativeRate) {
        return pet;
      }
    }
    
    // Fallback to first available pet
    return availablePets[0];
  }

  // Trigger encounter and show modal
  triggerEncounter(wildPet) {
    // console.log('🎯 ENCOUNTER TRIGGERED!');
    // console.log('Wild Pet:', wildPet);
    
    // Set cooldown
    this.setCooldown();
    
    // Show encounter modal via callback
    if (this.onEncounterCallback) {
      this.onEncounterCallback(wildPet);
    } else {
      console.warn('No encounter callback set! Modal will not show.');
    }
  }

  // Set cooldown after encounter
  setCooldown() {
    this.isOnCooldown = true;
    this.lastEncounterTime = Date.now();
    
    // Clear existing timer
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }
    
    // Set new cooldown timer
    this.cooldownTimer = this.scene.time.delayedCall(
      this.currentZone.cooldownSeconds * 1000,
      () => {
        this.isOnCooldown = false;
        // console.log('⏰ Cooldown finished - can encounter again!');
      }
    );
    
    // console.log(`⏰ Cooldown set for ${this.currentZone.cooldownSeconds} seconds`);
  }

  // Get cooldown status
  getCooldownStatus() {
    if (!this.isOnCooldown) {
      return { isOnCooldown: false, remainingSeconds: 0 };
    }

    const elapsed = (Date.now() - this.lastEncounterTime) / 1000;
    const remaining = Math.max(0, this.currentZone.cooldownSeconds - elapsed);
    
    return {
      isOnCooldown: true,
      remainingSeconds: Math.ceil(remaining)
    };
  }

  // Change zone (for future use with different maps)
  changeZone(zoneId) {
    const { ZONE_TYPES } = require('../config/encounterConfig.js');
    this.currentZone = ZONE_TYPES[zoneId.toUpperCase()] || ZONE_TYPES.FOREST;
    // console.log(`🗺️ Changed to zone: ${this.currentZone.name}`);
  }

  // Clean up
  destroy() {
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }
  }
}
