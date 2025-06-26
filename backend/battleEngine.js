// battleEngine.js - Công thức Battle Engine cho Petaria

// Random hệ số từ 85% đến 100%
function randomFactor() {
    return (Math.floor(Math.random() * (100 - 85 + 1)) + 85) / 100;
  }
  
  // Critical Hit 6.25%
  function isCriticalHit() {
    return Math.random() < 0.0625;
  }
  
  // Dodge dựa trên SPD
  function isDodged(attackerSpd, defenderSpd) {
    const dodgeChance = Math.min(Math.max((defenderSpd - attackerSpd) * 0.5, 0), 20) / 100;
    return Math.random() < dodgeChance;
  }
  
  // Tính Damage
  function calculateDamage(attacker, defender, movePower, attackerLevel) {
    const A = attacker.final_stats.str || 10;
    const D = defender.final_stats.def || 10;
  
    let baseDamage = ((((2 * attackerLevel) / 5 + 2) * movePower * A / D) / 50);
    baseDamage *= randomFactor();
  
    if (isCriticalHit()) {
      baseDamage *= 2;
      return { damage: Math.max(Math.floor(baseDamage), 1), critical: true };
    }
  
    return { damage: Math.max(Math.floor(baseDamage), 1), critical: false };
  }
  
  // Mô phỏng 1 lượt tấn công
  function simulateTurn(attacker, defender, movePower, moveName) {
    if (isDodged(attacker.final_stats.spd, defender.final_stats.spd)) {
      return {
        attacker: attacker.name,
        defender: defender.name,
        moveUsed: moveName,
        damage: 0,
        miss: true,
        critical: false
      };
    }
  
    const { damage, critical } = calculateDamage(attacker, defender, movePower, attacker.level);
    defender.current_hp = Math.max(defender.current_hp - damage, 0);
  
    return {
      attacker: attacker.name,
      defender: defender.name,
      moveUsed: moveName,
      damage: damage,
      miss: false,
      critical: critical
    };
  }
  
  // Mô phỏng full trận đấu
  function simulateFullBattle(playerPet, enemyPet, playerMovePower, playerMoveName, enemyMovePower, enemyMoveName) {
    const log = [];
    const playerGoesFirst = playerPet.final_stats.spd >= enemyPet.final_stats.spd;
  
    while (playerPet.current_hp > 0 && enemyPet.current_hp > 0) {
      if (playerGoesFirst) {
        log.push(simulateTurn(playerPet, enemyPet, playerMovePower, playerMoveName));
        if (enemyPet.current_hp > 0) {
          log.push(simulateTurn(enemyPet, playerPet, enemyMovePower, enemyMoveName));
        }
      } else {
        log.push(simulateTurn(enemyPet, playerPet, enemyMovePower, enemyMoveName));
        if (playerPet.current_hp > 0) {
          log.push(simulateTurn(playerPet, enemyPet, playerMovePower, playerMoveName));
        }
      }
    }
  
    return log;
  }
  
  // EXPORT
  module.exports = {
    randomFactor,
    isCriticalHit,
    isDodged,
    calculateDamage,
    simulateTurn,
    simulateFullBattle
  };