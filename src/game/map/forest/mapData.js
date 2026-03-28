import { collisions } from './collisions.js';
import { battleZones } from './battleZones.js';
import { TILE } from '../tiles.js';

/** @typedef {'forest'} HuntingMapId */

export { TILE };

const LEGACY_WALL = 320;
const LEGACY_ENCOUNTER = 113;

/**
 * Single source of truth for forest grid: width/height match background pixel size / tileSize.
 * Legacy: collisions[i]===320 => wall; battleZones[i]===113 => encounter (walkable).
 */
export function buildForestMap() {
  const width = 50;
  const height = 40;
  const tileSize = 16;
  const expected = width * height;

  if (collisions.length !== expected || battleZones.length !== expected) {
    console.warn(
      '[hunting map] forest collisions/battleZones length mismatch',
      collisions.length,
      battleZones.length,
      expected
    );
  }

  const tiles = new Uint8Array(expected);
  for (let i = 0; i < expected; i++) {
    const wall = collisions[i] === LEGACY_WALL;
    const enc = battleZones[i] === LEGACY_ENCOUNTER;
    if (wall) tiles[i] = TILE.WALL;
    else if (enc) tiles[i] = TILE.ENCOUNTER;
    else tiles[i] = TILE.WALK;
  }

  return {
    id: 'forest',
    width,
    height,
    tileSize,
    /** null = không giới hạn bước (UI có thể hiển thị ∞) */
    maxSteps: null,
    start: { x: 10, y: 10 },
    assets: {
      background: '/hunting/maps/forest-map.png',
      foreground: '/hunting/maps/forest-map-forground.png',
    },
    tiles,
  };
}

export const FOREST_MAP = buildForestMap();
