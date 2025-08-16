// Player movement and behavior configuration
export const PLAYER_CONFIG = {
  // Movement speed (pixels per second)
  SPEED: {
    WALK: 100,        // Normal walking speed
    RUN: 200,         // Running speed (if you want to add running)
    SLOW: 50,         // Slow movement (for sneaking, etc.)
    FAST: 150         // Fast movement
  },
  
  // Tile size for grid-based movement
  TILE_SIZE: 16,
  
  // Player dimensions
  PLAYER_SIZE: {
    WIDTH: 16,
    HEIGHT: 32,
    COLLISION_SIZE: 16  // Only bottom 16x16 area for collision
  },
  
  // Animation settings
  ANIMATION: {
    WALK_FRAME_RATE: 8,  // Reduced from 8 to 4 for slower animation
    IDLE_FRAME_RATE: 4
  }
};

// Helper function to get speed by type
export const getPlayerSpeed = (speedType = 'WALK') => {
  return PLAYER_CONFIG.SPEED[speedType] || PLAYER_CONFIG.SPEED.WALK;
};

// Helper function to set custom speed
export const setPlayerSpeed = (speedType, newSpeed) => {
  if (PLAYER_CONFIG.SPEED.hasOwnProperty(speedType)) {
    PLAYER_CONFIG.SPEED[speedType] = newSpeed;
    return true;
  }
  return false;
};
