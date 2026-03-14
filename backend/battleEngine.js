// battleEngine.js - Công thức Battle Engine cho Petaria
// Dmg dùng power_min / power_max (int trong DB), random giữa 2 số rồi chia 10.

function randomFactor() {
  return (Math.floor(Math.random() * (100 - 85 + 1)) + 85) / 100;
}

function isCriticalHit() {
  return Math.random() < 0.0625;
}

function isDodged(attackerSpd, defenderSpd) {
  const dodgeChance = Math.min(Math.max((defenderSpd - attackerSpd) * 0.5, 0), 20) / 100;
  return Math.random() < dodgeChance;
}

// [min, max] inclusive, integer
function randomIntInclusive(min, max) {
  const lo = Math.floor(Number(min) ?? 0);
  const hi = Math.floor(Number(max) ?? 0);
  if (hi <= lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

// Hệ số từ trang bị: R = random(power_min, power_max), mult = 1 + R/10 (DB lưu 80,85 → 8.0–8.5)
function randomMultiplierFromPowerRange(power_min, power_max) {
  const R = randomIntInclusive(power_min ?? 0, power_max ?? 0);
  return 1 + R / 10;
}

/**
 * Sát thương gây ra (attacker → defender): Dmg_out = max(1, (Str_attacker * (1 + R/10)) * 0.6 - Def_defender * 0.5)
 * R = randomIntInclusive(power_min, power_max). Dùng chung cho Pet và Boss, không dùng hệ số 1.45.
 */
function calculateDamage(attacker, defender, movePower, options = {}) {
  const Str = attacker.final_stats?.str ?? 10;
  const Def = defender.final_stats?.def ?? 10;
  const mult = randomMultiplierFromPowerRange(options.power_min, options.power_max);
  const dmg = (Str * mult) * 0.6 - Def * 0.5;
  const damage = Math.max(1, Math.floor(dmg));
  return { damage, critical: false };
}

/**
 * Mô phỏng 1 lượt tấn công. Nếu defender đang có current_def_dmg > 0 thì áp dụng counter_dmg:
 * counter_dmg = Dmg_out - defender.current_def_dmg. counter_dmg > 0 → defender nhận counter_dmg; counter_dmg <= 0 → attacker nhận |counter_dmg| (phản đòn). Sau đó defender.current_def_dmg = 0.
 * options.defender_current_def_dmg: giá trị def_dmg hiện tại của defender (mặc định 0).
 */
function simulateTurn(attacker, defender, movePower, moveName, options = {}) {
  if (isDodged(attacker.final_stats?.spd, defender.final_stats?.spd)) {
    return {
      attacker: attacker.name,
      defender: defender.name,
      moveUsed: moveName,
      damage: 0,
      miss: true,
      critical: false,
      defender_current_def_dmg: defender.current_def_dmg ?? 0,
      reflectedDamage: 0,
    };
  }

  const defDmg = Math.max(0, Number(options.defender_current_def_dmg) ?? 0);
  const { damage: dmgOut, critical } = calculateDamage(attacker, defender, movePower, options);

  let damageToDefender = dmgOut;
  let reflectedDamage = 0;
  let defenderHpAfter = (defender.current_hp ?? defender.final_stats?.hp);
  let attackerHpAfter = (attacker.current_hp ?? attacker.final_stats?.hp);

  if (defDmg > 0) {
    const counterDmg = dmgOut - defDmg;
    if (counterDmg > 0) {
      damageToDefender = counterDmg;
      defenderHpAfter = Math.max(0, (defender.current_hp ?? defender.final_stats?.hp) - damageToDefender);
      if (typeof defender.current_hp === 'number') defender.current_hp = defenderHpAfter;
    } else {
      reflectedDamage = Math.max(1, Math.floor(Math.abs(counterDmg)));
      damageToDefender = 0;
      attackerHpAfter = Math.max(0, (attacker.current_hp ?? attacker.final_stats?.hp) - reflectedDamage);
      if (typeof attacker.current_hp === 'number') attacker.current_hp = attackerHpAfter;
    }
    if (typeof defender.current_def_dmg === 'number') defender.current_def_dmg = 0;
  } else {
    defenderHpAfter = Math.max(0, (defender.current_hp ?? defender.final_stats?.hp) - dmgOut);
    if (typeof defender.current_hp === 'number') defender.current_hp = defenderHpAfter;
  }

  return {
    attacker: attacker.name,
    defender: defender.name,
    moveUsed: moveName,
    damage: damageToDefender,
    miss: false,
    critical,
    defender_current_def_dmg: 0,
    reflectedDamage,
    defender_hp_after: defenderHpAfter,
    attacker_hp_after: attackerHpAfter,
  };
}
  
// Mô phỏng full trận đấu (player = Pet, enemy = Boss). options: { playerPowerMin, playerPowerMax, enemyPowerMin, enemyPowerMax }
// Cả hai bên dùng công thức Dmg_out với power_min/power_max.
function simulateFullBattle(playerPet, enemyPet, playerMovePower, playerMoveName, enemyMovePower, enemyMoveName, options = {}) {
  const log = [];
  const playerGoesFirst = (playerPet.final_stats?.spd ?? 0) >= (enemyPet.final_stats?.spd ?? 0);
  const playerPower = { power_min: options.playerPowerMin, power_max: options.playerPowerMax, defender_current_def_dmg: enemyPet.current_def_dmg ?? 0 };
  const enemyPower = { power_min: options.enemyPowerMin ?? 80, power_max: options.enemyPowerMax ?? 100, defender_current_def_dmg: playerPet.current_def_dmg ?? 0 };

  while ((playerPet.current_hp ?? playerPet.final_stats?.hp) > 0 && (enemyPet.current_hp ?? enemyPet.final_stats?.hp) > 0) {
    if (playerGoesFirst) {
      log.push(simulateTurn(playerPet, enemyPet, playerMovePower, playerMoveName, playerPower));
      if ((enemyPet.current_hp ?? enemyPet.final_stats?.hp) > 0) {
        const opt = { ...enemyPower, defender_current_def_dmg: playerPet.current_def_dmg ?? 0 };
        log.push(simulateTurn(enemyPet, playerPet, enemyMovePower, enemyMoveName, opt));
      }
    } else {
      const opt = { ...enemyPower, defender_current_def_dmg: playerPet.current_def_dmg ?? 0 };
      log.push(simulateTurn(enemyPet, playerPet, enemyMovePower, enemyMoveName, opt));
      if ((playerPet.current_hp ?? playerPet.final_stats?.hp) > 0) {
        log.push(simulateTurn(playerPet, enemyPet, playerMovePower, playerMoveName, { ...playerPower, defender_current_def_dmg: enemyPet.current_def_dmg ?? 0 }));
      }
    }
  }

  return log;
}

/** Boss: kiểm tra chiêu thức có trúng không (accuracy 0-100). */
function checkHit(accuracy) {
  const acc = Math.min(100, Math.max(0, Number(accuracy) ?? 100));
  return (Math.random() * 100) <= acc;
}

/**
 * Boss: lấy skill cho lượt hiện tại.
 * - Nếu action_pattern có và không rỗng: dùng thứ tự cố định (pattern[(turnNumber-1) % length]).
 * - Nếu action_pattern rỗng/null: chọn random 1 skill trong danh sách (AI random).
 */
function getBossAction(boss, turnNumber, allSkills) {
  const skills = allSkills || boss.skills || [];
  if (!skills.length) return null;
  const pattern = boss.action_pattern;
  const hasPattern = pattern && Array.isArray(pattern) && pattern.length > 0;
  if (hasPattern) {
    const skillId = pattern[(turnNumber - 1) % pattern.length];
    const id = typeof skillId === 'number' ? skillId : parseInt(skillId, 10);
    return skills.find((s) => (s.id === id) || (s.id === skillId)) || null;
  }
  return skills[Math.floor(Math.random() * skills.length)];
}

/**
 * Lượt Boss dùng skill: attack (Dmg_out + kiểm tra def_dmg của Pet) hoặc defend (chỉ thiết lập boss.current_def_dmg, không gây sát thương).
 * skill: { id, name, type: 'attack'|'defend', power_min, power_max, accuracy }
 */
function simulateBossTurn(boss, pet, skill) {
  const skillName = skill.name || 'Skill';
  if (skill.type === 'defend') {
    const Str_pet = pet.final_stats?.str ?? 10;
    const Def_boss = boss.final_stats?.def ?? 10;
    const R = randomIntInclusive(skill.power_min ?? 80, skill.power_max ?? 100);
    const mult = 1 + R / 10;
    let defDmg = (Def_boss * mult) * 0.6 - Str_pet * 0.5;
    defDmg = Math.max(0, Math.floor(defDmg));
    if (typeof boss.current_def_dmg === 'number') boss.current_def_dmg = defDmg;
    return {
      attacker: boss.name,
      defender: pet.name,
      moveUsed: skillName,
      miss: false,
      isBossDefend: true,
      bossDefDmg: defDmg,
      damageToBoss: 0,
      damageToPet: 0,
      defender_current_def_dmg: pet.current_def_dmg ?? 0,
    };
  }
  if (skill.type === 'attack') {
    if (!checkHit(skill.accuracy ?? 100)) {
      return {
        attacker: boss.name,
        defender: pet.name,
        moveUsed: skillName,
        damage: 0,
        miss: true,
        critical: false,
        defender_current_def_dmg: pet.current_def_dmg ?? 0,
        reflectedDamage: 0,
      };
    }
    const defDmg = Math.max(0, Number(pet.current_def_dmg) ?? 0);
    const Str_boss = boss.final_stats?.str ?? 10;
    const Def_pet = pet.final_stats?.def ?? 10;
    const R = randomIntInclusive(skill.power_min ?? 80, skill.power_max ?? 100);
    const mult = 1 + R / 10;
    const dmgOut = Math.max(1, Math.floor((Str_boss * mult) * 0.6 - Def_pet * 0.5));

    let damageToPet = dmgOut;
    let reflectedDamage = 0;
    let petHpAfter = (pet.current_hp ?? pet.final_stats?.hp);
    let bossHpAfter = (boss.current_hp ?? boss.final_stats?.hp);

    if (defDmg > 0) {
      const counterDmg = dmgOut - defDmg;
      if (counterDmg > 0) {
        damageToPet = counterDmg;
        petHpAfter = Math.max(0, (pet.current_hp ?? pet.final_stats?.hp) - damageToPet);
        if (typeof pet.current_hp === 'number') pet.current_hp = petHpAfter;
      } else {
        reflectedDamage = Math.max(1, Math.floor(Math.abs(counterDmg)));
        damageToPet = 0;
        bossHpAfter = Math.max(0, (boss.current_hp ?? boss.final_stats?.hp) - reflectedDamage);
        if (typeof boss.current_hp === 'number') boss.current_hp = bossHpAfter;
      }
      if (typeof pet.current_def_dmg === 'number') pet.current_def_dmg = 0;
    } else {
      petHpAfter = Math.max(0, (pet.current_hp ?? pet.final_stats?.hp) - dmgOut);
      if (typeof pet.current_hp === 'number') pet.current_hp = petHpAfter;
    }

    return {
      attacker: boss.name,
      defender: pet.name,
      moveUsed: skillName,
      damage: damageToPet,
      miss: false,
      critical: false,
      defender_current_def_dmg: 0,
      reflectedDamage,
      damageToBoss: reflectedDamage,
      damageToPet,
      defender_hp_after: petHpAfter,
      attacker_hp_after: bossHpAfter,
    };
  }
  return { attacker: boss.name, defender: pet.name, moveUsed: skillName, damage: 0, miss: true };
}

/**
 * Lượt phòng thủ (khiên / skill defend): không gây sát thương, chỉ thiết lập def_dmg cho lượt sau.
 * def_dmg = (Def_defenderUnit * (1 + R/10)) * 0.6 - Str_enemy * 0.5; nếu < 0 thì set = 0.
 * defenderUnit = đơn vị dùng khiên (Pet hoặc Boss), enemy = đối thủ (để lấy Str).
 * Trả về defDmg để frontend set defenderUnit.current_def_dmg.
 */
function simulateDefendTurn(defenderUnit, enemy, shieldPowerMin, shieldPowerMax) {
  const Def = defenderUnit.final_stats?.def ?? 10;
  const Str_enemy = enemy.final_stats?.str ?? 10;
  const R = randomIntInclusive(shieldPowerMin ?? 0, shieldPowerMax ?? 0);
  const mult = 1 + R / 10;
  let defDmg = (Def * mult) * 0.6 - Str_enemy * 0.5;
  defDmg = Math.max(0, Math.floor(defDmg));
  if (typeof defenderUnit.current_def_dmg === 'number') defenderUnit.current_def_dmg = defDmg;
  const defenderName = defenderUnit.name || 'Defender';
  return {
    defDmg,
    defenderName,
    moveUsed: 'Phòng thủ',
    logMessage: `${defenderName} sử dụng Phòng thủ, thiết lập shield ${defDmg} HP phòng ngự.`,
  };
}

// EXPORT
module.exports = {
  randomFactor,
  isCriticalHit,
  isDodged,
  randomIntInclusive,
  randomMultiplierFromPowerRange,
  calculateDamage,
  simulateTurn,
  simulateFullBattle,
  simulateDefendTurn,
  checkHit,
  getBossAction,
  simulateBossTurn,
};