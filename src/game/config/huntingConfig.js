// Central config for hunting maps
// Change these values to switch between 16px and 32px assets

export const TILE_SIZE = 16; // 16 or 32 depending on your Tiled map
export const HERO_FRAME_SIZE = 64; // Source frame size of hero spritesheet

// Display scale so a 64x64 frame can render as 16x16 in-game
export const HERO_DISPLAY_SIZE = 32; // desired on-screen size per axis
export const HERO_SCALE = HERO_DISPLAY_SIZE / HERO_FRAME_SIZE; // e.g., 16/64 = 0.25

// Collider tuning per size - Player is 16x32, collision only on bottom 16x16
export const HERO_COLLIDER_SIZE = TILE_SIZE === 16 ? 16 : 32;
export const HERO_COLLIDER_OFFSET = TILE_SIZE === 16 ? { x: 0, y: 16 } : { x: 0, y: 32 };

// Camera zoom recommendation by tile size
export const CAMERA_ZOOM = TILE_SIZE <= 16 ? 2 : 2;


