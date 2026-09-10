function getDifficultyConfig() {
  const d = settings.difficulty;
  return {
    peaceful: { enemySpawn: false, cropWilt: false, volMult: 0.5, hpRegen: 2,  seedPriceMult: 0.4,   startGold: 300, debtMult: 0.4  },
    easy:     { enemySpawn: false, cropWilt: false, volMult: 0.6, hpRegen: 1,  seedPriceMult: 0.5,   startGold: 240, debtMult: 0.6  },
    normal:   { enemySpawn: true,  cropWilt: true,  volMult: 1.0, hpRegen: 0,  seedPriceMult: 1.0,   startGold: 120, debtMult: 1.0  },
    hard:     { enemySpawn: true,  cropWilt: true,  volMult: 1.6, hpRegen: 0,  seedPriceMult: 1.5,   startGold: 60,  debtMult: 1.6, spawnMult: 1.5 },
  }[d] || { seedPriceMult: 1.0, startGold: 120, debtMult: 1.0 };
}