const fs = require('fs');
const path = require('path');

const MAX_LEVEL = 3000;
const MULTIPLIER = 20;

function expToReachLevel(level) {
  return Math.round(Math.pow(level, 3) * MULTIPLIER);
}

function main() {
  const table = {};
  for (let level = 1; level <= MAX_LEVEL; level++) {
    table[String(level)] = expToReachLevel(level);
  }

  const outPath = path.resolve(__dirname, '..', 'src', 'data', 'exp_table_petaria.json');
  fs.writeFileSync(outPath, JSON.stringify(table, null, 2) + '\n', 'utf8');
  console.log(`Wrote EXP table: 1..${MAX_LEVEL} -> ${outPath}`);
}

main();
