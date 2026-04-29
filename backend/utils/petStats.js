function generateIVStats() {
  return {
    iv_hp: Math.floor(Math.random() * 32),
    iv_mp: Math.floor(Math.random() * 32),
    iv_str: Math.floor(Math.random() * 32),
    iv_def: Math.floor(Math.random() * 32),
    iv_intelligence: Math.floor(Math.random() * 32),
    iv_spd: Math.floor(Math.random() * 32),
  };
}

function calculateFinalStats(base, iv, level) {
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

module.exports = { generateIVStats, calculateFinalStats };
