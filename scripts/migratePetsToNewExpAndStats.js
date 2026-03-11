/**
 * Migration: Recalculate pet level + stats using the NEW EXP table and stat formulas.
 *
 * What it does:
 * - Loads EXP thresholds from src/data/exp_table_petaria.json
 * - Reads pets from MySQL
 * - Recomputes level from current_exp against the new EXP table
 * - Normalizes current_exp to be at least expTable[level] (prevents negative progress)
 * - Recalculates base stats from (base_species, iv, level) using NEW formulas
 * - Preserves existing *_added bonuses by rebuilding final_stats = base + added
 * - Updates pets rows
 *
 * Usage:
 *   node petaria/scripts/migratePetsToNewExpAndStats.js --dry-run
 *   node petaria/scripts/migratePetsToNewExpAndStats.js
 *
 * Env:
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 */

const path = require('path');
const { createRequire } = require('module');

// Resolve dependencies from backend (where node_modules live)
const requireBackend = createRequire(path.resolve(__dirname, '..', 'backend', 'package.json'));
const dotenv = requireBackend('dotenv');
const mysql = requireBackend('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const expTable = require(path.resolve(__dirname, '..', 'src', 'data', 'exp_table_petaria.json'));

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has('--dry-run') || args.has('-n'),
    dropPetsTriggers: args.has('--drop-pets-triggers'),
    includeNpc: args.has('--include-npc'),
    includeUnowned: args.has('--include-unowned'),
    limit: (() => {
      const ix = argv.indexOf('--limit');
      if (ix === -1) return null;
      const val = parseInt(argv[ix + 1], 10);
      return Number.isFinite(val) ? val : null;
    })(),
  };
}

function calculateFinalStatsBase(base, iv, level) {
  const getStat = (b, i) => Math.floor(((2 * b + i) * level) / 100) + 5;
  const getHP = (b, i) => (Math.floor(((2 * b + i) * level) / 100) + level + 10) * 5;

  return {
    hp: getHP(base.hp, iv.iv_hp),
    mp: getStat(base.mp, iv.iv_mp),
    str: getStat(base.str, iv.iv_str),
    def: getStat(base.def, iv.iv_def),
    intelligence: getStat(base.intelligence, iv.iv_intelligence),
    spd: getStat(base.spd, iv.iv_spd),
  };
}

function buildExpLevels(expTableObj) {
  // exp_table_petaria.json is { "1": 20, "2": 160, ... }
  const levels = Object.keys(expTableObj)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const exps = levels.map((lvl) => ({
    level: lvl,
    expToReach: Number(expTableObj[String(lvl)]) || 0,
  }));

  return { levels, exps, maxLevel: levels.length ? levels[levels.length - 1] : 1 };
}

function computeLevelFromExp(currentExp, expMeta) {
  // Level = highest L such that expToReach[L] <= currentExp
  // Always at least level 1.
  const exp = Math.max(0, Number(currentExp) || 0);
  const { exps } = expMeta;

  let lo = 0;
  let hi = exps.length - 1;
  let best = 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const { level, expToReach } = exps[mid];
    if (expToReach <= exp) {
      best = level;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return Math.max(1, best);
}

function normalizeCurrentExpForLevel(currentExp, level, expMeta) {
  const exp = Math.max(0, Number(currentExp) || 0);
  const expThis = Number(expTable[String(level)]) || 0;

  // Ensure progress isn't negative in UI (expProgress - expToThisLevel)
  return Math.max(exp, expThis);
}

async function main() {
  const args = parseArgs(process.argv);
  const expMeta = buildExpLevels(expTable);

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'petaria';

  const conn = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  try {
    let savedTriggers = [];
    if (!args.dryRun && args.dropPetsTriggers) {
      const [triggers] = await conn.execute(
        "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE='pets'"
      );

      for (const t of triggers) {
        const triggerName = t.TRIGGER_NAME;
        const [createRows] = await conn.query(`SHOW CREATE TRIGGER \`${triggerName}\``);
        const createStmt =
          createRows?.[0]?.['SQL Original Statement'] ||
          createRows?.[0]?.['Create Trigger'] ||
          null;
        if (!createStmt) {
          throw new Error(`Could not read CREATE TRIGGER for ${triggerName}`);
        }
        savedTriggers.push({ name: triggerName, createStmt });
      }

      for (const t of savedTriggers) {
        console.log(`Dropping trigger: ${t.name}`);
        await conn.query(`DROP TRIGGER IF EXISTS \`${t.name}\``);
      }
    }

    const [speciesRows] = await conn.execute(
      'SELECT id, base_hp, base_mp, base_str, base_def, base_intelligence, base_spd FROM pet_species'
    );

    const speciesMap = new Map();
    for (const row of speciesRows) {
      speciesMap.set(row.id, {
        hp: parseInt(row.base_hp, 10) || 0,
        mp: parseInt(row.base_mp, 10) || 0,
        str: parseInt(row.base_str, 10) || 0,
        def: parseInt(row.base_def, 10) || 0,
        intelligence: parseInt(row.base_intelligence, 10) || 0,
        spd: parseInt(row.base_spd, 10) || 0,
      });
    }

    let where = '1=1';
    if (!args.includeNpc) where += ' AND (is_npc IS NULL OR is_npc = 0)';
    if (!args.includeUnowned) where += ' AND owner_id IS NOT NULL';
    const limitSql = args.limit ? ` LIMIT ${args.limit}` : '';

    const [pets] = await conn.execute(
      `
      SELECT
        id, owner_id, is_npc,
        pet_species_id,
        level, current_exp,
        current_hp,
        iv_hp, iv_mp, iv_str, iv_def, iv_intelligence, iv_spd,
        hp_added, mp_added, str_added, def_added, intelligence_added, spd_added
      FROM pets
      WHERE ${where}
      ORDER BY id ASC
      ${limitSql}
      `
    );

    console.log(`Found ${pets.length} pets to migrate. dryRun=${args.dryRun}`);

    let updated = 0;
    let skipped = 0;

    for (const pet of pets) {
      const base = speciesMap.get(pet.pet_species_id);
      if (!base) {
        skipped++;
        console.warn(`Skip pet id=${pet.id}: missing species_id=${pet.pet_species_id}`);
        continue;
      }

      const iv = {
        iv_hp: parseInt(pet.iv_hp, 10) || 0,
        iv_mp: parseInt(pet.iv_mp, 10) || 0,
        iv_str: parseInt(pet.iv_str, 10) || 0,
        iv_def: parseInt(pet.iv_def, 10) || 0,
        iv_intelligence: parseInt(pet.iv_intelligence, 10) || 0,
        iv_spd: parseInt(pet.iv_spd, 10) || 0,
      };

      const currentExp = Number(pet.current_exp) || 0;
      const newLevel = computeLevelFromExp(currentExp, expMeta);
      const newExp = normalizeCurrentExpForLevel(currentExp, newLevel, expMeta);

      const baseStats = calculateFinalStatsBase(base, iv, newLevel);

      const added = {
        hp: parseInt(pet.hp_added, 10) || 0,
        mp: parseInt(pet.mp_added, 10) || 0,
        str: parseInt(pet.str_added, 10) || 0,
        def: parseInt(pet.def_added, 10) || 0,
        intelligence: parseInt(pet.intelligence_added, 10) || 0,
        spd: parseInt(pet.spd_added, 10) || 0,
      };

      const finalStats = {
        hp: baseStats.hp + added.hp,
        mp: baseStats.mp + added.mp,
        str: baseStats.str + added.str,
        def: baseStats.def + added.def,
        intelligence: baseStats.intelligence + added.intelligence,
        spd: baseStats.spd + added.spd,
      };

      const currentHpRaw = pet.current_hp === null || pet.current_hp === undefined ? null : Number(pet.current_hp);
      const newCurrentHp =
        currentHpRaw === null || !Number.isFinite(currentHpRaw)
          ? null
          : Math.min(currentHpRaw, finalStats.hp);

      if (!args.dryRun) {
        await conn.execute(
          `
          UPDATE pets SET
            level = ?,
            current_exp = ?,
            hp = ?, max_hp = ?,
            current_hp = ?,
            mp = ?, max_mp = ?,
            str = ?, def = ?, intelligence = ?, spd = ?,
            final_stats = ?
          WHERE id = ?
          `,
          [
            newLevel,
            newExp,
            baseStats.hp,
            baseStats.hp,
            newCurrentHp,
            baseStats.mp,
            baseStats.mp,
            baseStats.str,
            baseStats.def,
            baseStats.intelligence,
            baseStats.spd,
            JSON.stringify(finalStats),
            pet.id,
          ]
        );
      }

      updated++;
      if (updated % 100 === 0) console.log(`Migrated ${updated}/${pets.length}...`);
    }

    console.log(`Done. updated=${updated}, skipped=${skipped}`);

    if (!args.dryRun && args.dropPetsTriggers && savedTriggers.length) {
      for (const t of savedTriggers) {
        console.log(`Restoring trigger: ${t.name}`);
        await conn.query(t.createStmt);
      }
      console.log(`Restored ${savedTriggers.length} trigger(s).`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});

