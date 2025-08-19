// Encounter System Configuration
// This file contains all encounter rates, pet data, and zone settings

// Wild Pets Data with Encounter Rates
export const WILD_PETS = [
  {
    id: 'pet_001',
    name: 'Forest Fox',
    rarity: 'COMMON',
    encounterRate: 0.60,    // 60% chance when pet is selected
    sprite: 'fox_sprite',
    description: 'A cunning forest fox with orange fur'
  },
  {
    id: 'pet_002', 
    name: 'Mystic Deer',
    rarity: 'UNCOMMON',
    encounterRate: 0.25,    // 25% chance when pet is selected
    sprite: 'deer_sprite',
    description: 'A graceful deer with mystical aura'
  },
  {
    id: 'pet_003',
    name: 'Golden Eagle', 
    rarity: 'RARE',
    encounterRate: 0.10,    // 10% chance when pet is selected
    sprite: 'eagle_sprite',
    description: 'A majestic golden eagle soaring high'
  },
  {
    id: 'pet_004',
    name: 'Crystal Wolf',
    rarity: 'EPIC',
    encounterRate: 0.04,    // 4% chance when pet is selected
    sprite: 'wolf_sprite',
    description: 'A powerful wolf with crystal-like fur'
  },
  {
    id: 'pet_005',
    name: 'Dragon Hatchling',
    rarity: 'LEGENDARY',
    encounterRate: 0.01,    // 1% chance when pet is selected
    sprite: 'dragon_sprite',
    description: 'A rare baby dragon with scales'
  }
];

// Zone Types for different maps
export const ZONE_TYPES = {
  FOREST: {
    id: 'forest',
    name: 'Forest Zone',
    baseEncounterRate: 0.05,  // 15% chance per step in battle zone
    cooldownSeconds: 3,      // 30 seconds cooldown after encounter
    availablePetIds: ['pet_001', 'pet_002', 'pet_003', 'pet_004', 'pet_005'], // All pets available
    description: 'Dense forest with various wildlife'
  },
  
  DESERT: {
    id: 'desert', 
    name: 'Desert Zone',
    baseEncounterRate: 0.12,  // 12% chance per step in battle zone
    cooldownSeconds: 3,      // 45 seconds cooldown after encounter
    availablePetIds: ['pet_002', 'pet_004', 'pet_005'], // No common pets in desert
    description: 'Harsh desert with rare creatures'
  },
  
  MOUNTAIN: {
    id: 'mountain',
    name: 'Mountain Zone',
    baseEncounterRate: 0.10,  // 10% chance per step in battle zone
    cooldownSeconds: 3,      // 60 seconds cooldown after encounter
    availablePetIds: ['pet_003', 'pet_004', 'pet_005'], // Only rare pets in mountains
    description: 'High mountains with legendary beasts'
  }
};

// Current map zone (default to forest for now)
export const CURRENT_ZONE = ZONE_TYPES.FOREST;

// Helper function to get available pets for current zone
export function getAvailablePetsForZone(zoneId = 'forest') {
  const zone = ZONE_TYPES[zoneId.toUpperCase()] || ZONE_TYPES.FOREST;
  return WILD_PETS.filter(pet => zone.availablePetIds.includes(pet.id));
}

// Helper function to get zone config
export function getZoneConfig(zoneId = 'forest') {
  return ZONE_TYPES[zoneId.toUpperCase()] || ZONE_TYPES.FOREST;
}
