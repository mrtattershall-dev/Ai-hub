function _diffSnapshot(prev, curr) {
  if (!prev) return {};
  return {
    goldDelta:       curr.gold - prev.gold,
    kills:           curr.totalKills - prev.totalKills,
    cropsHarvested:  curr.cropsHarvested - prev.cropsHarvested,
    planted:         curr.plantingsDone - prev.plantingsDone,
    watered:         curr.tilesWatered - prev.tilesWatered,
    oreMined:        curr.totalOreMined - prev.totalOreMined,
    fishCaught:      curr.totalFishCaught - prev.totalFishCaught,
    bootsThisDay:    curr.junkBootsFished - prev.junkBootsFished,
    woodChopped:     curr.woodChopped - prev.woodChopped,
    stoneGathered:   curr.stoneGathered - prev.stoneGathered,
    herbsGathered:   curr.herbsGathered - prev.herbsGathered,
    crafted:         curr.totalItemsCrafted - prev.totalItemsCrafted,
    debtPaid:        curr.debtRepaid - prev.debtRepaid,
    contractsDone:   curr.contractsCompleted - prev.contractsCompleted,
    newSingStone:    curr.singingStones - prev.singingStones,
    productsGot:     (curr.productsCollected || 0) - (prev.productsCollected || 0),
    newDeepFloor:    curr.deepestFloor  - prev.deepestFloor,
    // New ore types found this day
    newOreTypes: Object.keys(curr.oreByType).filter(k => !prev.oreByType[k] && curr.oreByType[k] > 0),
    // Dominant kill type this day
    dominantKill: (()=>{
      let best = '', bestDelta = 0;
      for (const [k, v] of Object.entries(curr.killsByType)) {
        const delta = v - (prev.killsByType[k] || 0);
        if (delta > bestDelta) { bestDelta = delta; best = k; }
      }
      return best;
    })(),
    // Notable fish this day
    notableFish: (()=>{
      const notable = ['goldenfish','swordfish','bluefinTuna','giantGrouper','deepseaPearl','kraken','ghostLantern','shipsLog','navalChart','leatherbackTurtle'];
      for (const id of notable) {
        const delta = (curr.fishByType[id] || 0) - (prev.fishByType[id] || 0);
        if (delta > 0) return id;
      }
      return null;
    })(),
  };
}