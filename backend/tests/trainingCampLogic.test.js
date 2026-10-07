const { test } = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../services/trainingCampLogic');

test('arena victory exp stays inside level × 300..500', () => {
  for (let i = 0; i < 400; i += 1) {
    const exp = logic.calculateArenaVictoryExp(10, 9);
    assert.equal(exp % 10, 0);
    assert.ok(exp >= 3000 && exp <= 5000);
  }
  assert.equal(logic.calculateArenaVictoryExp(4, 1, () => 0), 1200);
  assert.equal(logic.calculateArenaVictoryExp(4, 99, () => 0.999999), 2000);
});

test('training ticks level up before the next exp roll', () => {
  const expTable = { 1: 0, 2: 100, 3: 1000 };
  const seen = [];
  const result = logic.simulateTrainingTicks({
    level: 1,
    exp: 0,
    npcLevel: 10,
    ticks: 4,
    expTable,
    gainForTick: ({ level }) => {
      seen.push(level);
      return level === 1 ? 60 : 10;
    },
  });
  assert.deepEqual(seen, [1, 1, 2, 2]);
  assert.equal(result.pendingExp, 140);
  assert.equal(result.level, 2);
  assert.equal(result.exp, 140);
});

test('tick count is one arena win per completed minute and stops at the end', () => {
  const start = 1_000_000;
  assert.equal(logic.completedTickCount(start, start + logic.TICK_MS * 60, start + 59_000, 60), 0);
  assert.equal(logic.completedTickCount(start, start + logic.TICK_MS * 60, start + 60_000, 60), 1);
  assert.equal(logic.completedTickCount(start, start + logic.TICK_MS * 60, start + logic.TICK_MS * 90, 60), 60);
  assert.equal(logic.completedTickCount(start, start + logic.TICK_MS * 1440, start + logic.TICK_MS * 1440, 1440), 1440);
});

test('unlock requires a win and remaining hp strictly above 50 percent', () => {
  assert.equal(logic.qualifiesTrainingUnlock(true, 51, 100), true);
  assert.equal(logic.qualifiesTrainingUnlock(true, 50, 100), false);
  assert.equal(logic.qualifiesTrainingUnlock(false, 100, 100), false);
  assert.equal(logic.qualifiesTrainingUnlock(true, 0, 0), false);
});

test('longer sessions use the duration multiplier on the npc hourly cost', () => {
  assert.equal(logic.baseCostForLevel(1), 20000);
  assert.equal(logic.baseCostForLevel(1400), 1450000);
  assert.equal(logic.baseCostForLevel(15), 50000);
  assert.equal(logic.trainingCost(20000, 60), 20000);
  assert.equal(logic.trainingCost(20000, 120), 38000);
  assert.equal(logic.trainingCost(20000, 240), 75000);
  assert.equal(logic.trainingCost(20000, 480), 144000);
  assert.equal(logic.trainingCost(20000, 720), 210000);
  assert.equal(logic.trainingCost(20000, 1440), 390000);
  assert.equal(logic.trainingCost(1450000, 1440), 28275000);
  assert.equal(logic.trainingCost(20000, 90), null);
});

test('slots open from purchase or vip tier, and higher npc unlocks lower ones', () => {
  assert.equal(logic.slotIsOpen(1, false, 0), true);
  assert.equal(logic.slotIsOpen(2, false, 0), false);
  assert.equal(logic.slotIsOpen(2, true, 0), true);
  assert.equal(logic.slotIsOpen(2, false, logic.effectiveVipLevel(0, true)), true);
  assert.equal(logic.slotIsOpen(3, false, 3), true);
  assert.equal(logic.slotIsOpen(4, false, 3), false);
  assert.equal(logic.opponentUnlocked(10, 25), true);
  assert.equal(logic.opponentUnlocked(40, 25), false);
  assert.equal(logic.opponentUnlocked(1, 0), false);
});
