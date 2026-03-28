import { CURRENT_ZONE, getAvailablePetsForZone } from '../config/encounterConfig.js';
import { weightedPickEncounterRow, randomQty } from '../../utils/huntingEncounterPool.js';

export class EncounterManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.currentZone = CURRENT_ZONE;
    this.lastEncounterTime = 0;
    this.isOnCooldown = false;
    this.cooldownTimer = null;

    /** @type {(tileX: number, tileY: number) => boolean} */
    this.isEncounterTile =
      typeof options.isEncounterTile === 'function' ? options.isEncounterTile : () => false;

    /** Bảng từ map custom; null/[] → dùng WILD_PETS + zone */
    this.encounterPool =
      Array.isArray(options.encounterPool) && options.encounterPool.length > 0 ? options.encounterPool : null;

    this.onEncounterCallback = null;
  }

  setEncounterCallback(callback) {
    this.onEncounterCallback = callback;
  }

  checkForEncounter(playerTileX, playerTileY) {
    if (!this.isInBattleZone(playerTileX, playerTileY)) {
      return false;
    }

    if (this.isOnCooldown) {
      return false;
    }

    const encounterChance = this.currentZone.baseEncounterRate;

    if (Math.random() < encounterChance) {
      const result = this.selectRandomEncounterResult();
      this.triggerEncounter(result);
      return true;
    }

    return false;
  }

  isInBattleZone(tileX, tileY) {
    try {
      return this.isEncounterTile(tileX, tileY);
    } catch (error) {
      console.error('Error checking battle zone:', error);
      return false;
    }
  }

  /**
   * @returns {{ encounterType: 'species', wildPet: object } | { encounterType: 'item', item: object }}
   */
  selectRandomEncounterResult() {
    if (this.encounterPool && this.encounterPool.length > 0) {
      const row = weightedPickEncounterRow(this.encounterPool);
      if (!row) return this.legacyPetResult();
      if (row.kind === 'item') {
        const qty = randomQty(row.min_qty, row.max_qty);
        return {
          encounterType: 'item',
          item: {
            item_id: row.item_id,
            name: row.name,
            image_url: row.image_url,
            qty,
          },
        };
      }
      return {
        encounterType: 'species',
        wildPet: {
          id: `species_${row.species_id}`,
          name: row.name,
          rarity: String(row.rarity || 'COMMON').toUpperCase(),
          description: row.description || '',
          encounterRate: row.rate,
          sprite: row.image,
          image: row.image,
          species_id: row.species_id,
        },
      };
    }
    return this.legacyPetResult();
  }

  legacyPetResult() {
    return { encounterType: 'species', wildPet: this.selectRandomPet() };
  }

  selectRandomPet() {
    const availablePets = getAvailablePetsForZone(this.currentZone.id);

    const totalRate = availablePets.reduce((sum, pet) => sum + pet.encounterRate, 0);

    const normalizedPets = availablePets.map((pet) => ({
      ...pet,
      normalizedRate: pet.encounterRate / totalRate,
    }));

    const rand = Math.random();
    let cumulativeRate = 0;

    for (const pet of normalizedPets) {
      cumulativeRate += pet.normalizedRate;
      if (rand <= cumulativeRate) {
        return pet;
      }
    }

    return availablePets[0];
  }

  triggerEncounter(result) {
    this.setCooldown();

    if (this.onEncounterCallback) {
      this.onEncounterCallback(result);
    } else {
      console.warn('No encounter callback set! Modal will not show.');
    }
  }

  setCooldown() {
    this.isOnCooldown = true;
    this.lastEncounterTime = Date.now();

    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }

    this.cooldownTimer = this.scene.time.delayedCall(
      this.currentZone.cooldownSeconds * 1000,
      () => {
        this.isOnCooldown = false;
      }
    );
  }

  getCooldownStatus() {
    if (!this.isOnCooldown) {
      return { isOnCooldown: false, remainingSeconds: 0 };
    }

    const elapsed = (Date.now() - this.lastEncounterTime) / 1000;
    const remaining = Math.max(0, this.currentZone.cooldownSeconds - elapsed);

    return {
      isOnCooldown: true,
      remainingSeconds: Math.ceil(remaining),
    };
  }

  changeZone(zoneId) {
    const { ZONE_TYPES } = require('../config/encounterConfig.js');
    this.currentZone = ZONE_TYPES[zoneId.toUpperCase()] || ZONE_TYPES.FOREST;
  }

  destroy() {
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }
  }
}
