#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function toInt(v, fallback) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

function buildMask(png, alphaThreshold, rgbThreshold) {
  const { width, height, data } = png;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      const visible = a > alphaThreshold && r + g + b > rgbThreshold;
      mask[y * width + x] = visible ? 1 : 0;
    }
  }
  return { width, height, mask };
}

function isFilled(maskObj, x, y) {
  const { width, height, mask } = maskObj;
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return mask[y * width + x] === 1;
}

function pointKey(x, y) {
  return `${x},${y}`;
}

function parsePointKey(k) {
  const [xs, ys] = k.split(',');
  return [Number.parseFloat(xs), Number.parseFloat(ys)];
}

function addEdge(adjacency, edges, x1, y1, x2, y2) {
  const from = pointKey(x1, y1);
  const to = pointKey(x2, y2);
  if (!adjacency.has(from)) adjacency.set(from, []);
  adjacency.get(from).push(to);
  edges.push([from, to]);
}

function buildBoundaryEdges(maskObj) {
  const { width, height } = maskObj;
  const adjacency = new Map();
  const edges = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFilled(maskObj, x, y)) continue;

      if (!isFilled(maskObj, x, y - 1)) addEdge(adjacency, edges, x, y, x + 1, y);
      if (!isFilled(maskObj, x + 1, y)) addEdge(adjacency, edges, x + 1, y, x + 1, y + 1);
      if (!isFilled(maskObj, x, y + 1)) addEdge(adjacency, edges, x + 1, y + 1, x, y + 1);
      if (!isFilled(maskObj, x - 1, y)) addEdge(adjacency, edges, x, y + 1, x, y);
    }
  }

  return { adjacency, edges };
}

function signedArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function extractLoops(boundary) {
  const { adjacency, edges } = boundary;
  const used = new Set();
  const loops = [];
  const edgeKey = (a, b) => `${a}|${b}`;

  for (const [start, end] of edges) {
    const first = edgeKey(start, end);
    if (used.has(first)) continue;

    used.add(first);
    const points = [parsePointKey(start), parsePointKey(end)];
    let current = end;
    let safety = 0;

    while (current !== start && safety < edges.length + 10) {
      safety += 1;
      const nextList = adjacency.get(current) || [];
      let picked = null;
      for (const n of nextList) {
        const k = edgeKey(current, n);
        if (!used.has(k)) {
          picked = n;
          used.add(k);
          break;
        }
      }
      if (!picked) break;
      points.push(parsePointKey(picked));
      current = picked;
    }

    if (points.length >= 4) {
      const ring = points.slice(0, -1); // bỏ điểm đóng lặp với điểm đầu
      if (ring.length >= 3) loops.push(ring);
    }
  }

  return loops;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    const ddx = x - x1;
    const ddy = y - y1;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const tx = x1 + t * dx;
  const ty = y1 + t * dy;
  const ex = x - tx;
  const ey = y - ty;
  return Math.sqrt(ex * ex + ey * ey);
}

function rdp(points, epsilon) {
  if (points.length < 3) return points;

  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function simplifyClosedPolygon(points, epsilon) {
  if (points.length < 4) return points;
  const open = points.concat([points[0]]);
  const simplified = rdp(open, epsilon);
  const closedNoDup = simplified.slice(0, -1);
  return closedNoDup.length >= 3 ? closedNoDup : points;
}

function formatPointsString(points) {
  return points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
}

function parseRowCol(fileName) {
  const m = /^(\d+)-(\d+)\.png$/i.exec(fileName);
  if (!m) return { row: null, col: null };
  return { row: Number.parseInt(m[1], 10), col: Number.parseInt(m[2], 10) };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const dir = path.resolve(cwd, args.dir || 'public/worldmap');
  const base = String(args.base || 'worldmap.png').toLowerCase();
  const outPath = path.resolve(cwd, args.out || 'scripts/worldmap-zone-points.json');
  const outSrcPath = path.resolve(
    cwd,
    args['out-src'] || 'src/config/worldmap-zone-points.json'
  );
  const alphaThreshold = toInt(args.alpha, 0);
  const rgbThreshold = toInt(args.rgb, 3);
  const epsilon = Number.isFinite(Number(args.epsilon)) ? Number(args.epsilon) : 2.5;

  if (!fs.existsSync(dir)) {
    console.error(`[worldmap] Directory not found: ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.png$/i.test(f))
    .filter((f) => f.toLowerCase() !== base)
    .sort((a, b) => a.localeCompare(b, 'en'));

  if (!files.length) {
    console.error(`[worldmap] No zone PNG files found in: ${dir}`);
    process.exit(1);
  }

  const zones = [];
  let commonWidth = null;
  let commonHeight = null;

  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    const png = readPng(filePath);
    if (commonWidth == null) {
      commonWidth = png.width;
      commonHeight = png.height;
    }
    if (png.width !== commonWidth || png.height !== commonHeight) {
      console.warn(
        `[worldmap] Skip ${fileName}: size ${png.width}x${png.height} != ${commonWidth}x${commonHeight}`
      );
      continue;
    }

    const maskObj = buildMask(png, alphaThreshold, rgbThreshold);
    const boundary = buildBoundaryEdges(maskObj);
    const loops = extractLoops(boundary);

    if (!loops.length) {
      console.warn(`[worldmap] Skip ${fileName}: no contour found`);
      continue;
    }

    const largest = loops.reduce((best, cur) =>
      Math.abs(signedArea(cur)) > Math.abs(signedArea(best)) ? cur : best
    );
    const simplified = simplifyClosedPolygon(largest, epsilon);
    const { row, col } = parseRowCol(fileName);
    const id = fileName.replace(/\.png$/i, '');

    zones.push({
      id,
      row,
      col,
      file: fileName,
      pointCountRaw: largest.length,
      pointCount: simplified.length,
      points: simplified.map(([x, y]) => [Math.round(x), Math.round(y)]),
      pointsString: formatPointsString(simplified),
    });
  }

  zones.sort((a, b) => {
    if (a.row != null && b.row != null && a.row !== b.row) return a.row - b.row;
    if (a.col != null && b.col != null && a.col !== b.col) return a.col - b.col;
    return a.file.localeCompare(b.file, 'en');
  });

  const output = {
    generatedAt: new Date().toISOString(),
    sourceDir: path.relative(cwd, dir).replace(/\\/g, '/'),
    baseImage: `/${path.relative(path.join(cwd, 'public'), path.join(dir, base)).replace(/\\/g, '/')}`,
    width: commonWidth,
    height: commonHeight,
    options: { alphaThreshold, rgbThreshold, epsilon },
    zones,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  fs.mkdirSync(path.dirname(outSrcPath), { recursive: true });
  fs.writeFileSync(outSrcPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`[worldmap] Wrote ${zones.length} zones to ${path.relative(cwd, outPath)}`);
  console.log(`[worldmap] Wrote ${zones.length} zones to ${path.relative(cwd, outSrcPath)}`);
  for (const z of zones) {
    console.log(`  - ${z.file}: ${z.pointCount} points`);
  }
  console.log(
    '[worldmap] Next: copy "zones[].pointsString" into polygon points (or import this JSON directly).'
  );
}

main();
