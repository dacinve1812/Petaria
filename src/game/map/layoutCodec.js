import { TILE } from './tiles.js';

/**
 * Paint grid chars (Admin / export text):
 *   . walk   # wall   * encounter grass   S start (exactly one)
 */
export const LAYOUT_LEGEND = `. = đi được, # = tường, * = vùng gặp pet, S = điểm xuất phát`;

export function layoutRowsToTiles(rows) {
  const height = rows.length;
  if (height === 0) throw new Error('Layout rỗng');
  const width = rows[0].length;
  const tiles = new Uint8Array(width * height);
  let start = { x: 0, y: 0 };
  let startCount = 0;

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (row.length !== width) {
      throw new Error(`Hàng ${y} sai độ dài (cần ${width}, có ${row.length})`);
    }
    for (let x = 0; x < width; x++) {
      const c = row[x];
      let cell = TILE.WALK;
      if (c === '#') cell = TILE.WALL;
      else if (c === '*' || c === 'E') cell = TILE.ENCOUNTER;
      else if (c === 'S') {
        start = { x, y };
        startCount += 1;
        cell = TILE.WALK;
      } else if (c === '.' || c === ' ') cell = TILE.WALK;
      else cell = TILE.WALK;
      tiles[y * width + x] = cell;
    }
  }

  return { width, height, tiles, start, startCount };
}

export function tilesToLayoutRows(width, height, tiles, start) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (start && x === start.x && y === start.y) line += 'S';
      else {
        const t = tiles[i];
        if (t === TILE.WALL) line += '#';
        else if (t === TILE.ENCOUNTER) line += '*';
        else line += '.';
      }
    }
    rows.push(line);
  }
  return rows;
}
