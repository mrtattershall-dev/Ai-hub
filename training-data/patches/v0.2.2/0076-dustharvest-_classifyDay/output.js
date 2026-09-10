function _classifyDay(diff, snap) {
  // Case complete — vera acknowledged — one-time special journal day
  if (typeof hcTalkSeen !== 'undefined' && hcTalkSeen.has('vera_case_acknowledged') &&
      !hcTalkSeen.has('vera_case_journaled')) {
    hcTalkSeen.add('vera_case_journaled');
    return 'vera_case';
  }
  if (diff.newSingStone > 0)        return 'singingStone';
  if (diff.newDeepFloor > 0 && snap.deepestFloor >= 3) return 'deepMine';
  if (diff.notableFish)             return 'notableFish';
  if (diff.debtPaid > 0 && snap.totalDebt <= 0 && snap.weekNumber >= 20) return 'debtAlmostClear';
  if (diff.debtPaid >= 1000)        return 'bigPayment';
  if (diff.kills >= 12)             return 'bloodDay';
  if (diff.kills >= 5 && snap.inBadlands) return 'badlandsRaid';
  if (diff.oreMined >= 20)          return 'heavyMining';
  if (diff.oreMined >= 8)           return 'mining';
  if (diff.cropsHarvested >= 15)    return 'bigHarvest';
  if (diff.cropsHarvested >= 5)     return 'harvest';
  if (diff.cropDeaths >= 3)         return 'cropDied';
  if (diff.cropDeaths >= 1)         return 'cropDied';
  if (diff.planted >= 10)           return 'bigPlanting';
  if (diff.planted >= 3)            return 'planting';
  if (diff.fishCaught >= 8)         return 'fishingDay';
  if (diff.fishCaught >= 3)         return 'fishing';
  if (diff.productsGot >= 6)        return 'ranch';
  if (diff.productsGot >= 2 && snap.aliveAnimals >= 4) return 'ranch';
  if (diff.crafted >= 5)            return 'crafting';
  if (diff.contractsDone >= 2)      return 'contracts';
  if (diff.contractsDone === 1)     return 'contract';
  if (snap.inOcean)                 return 'ocean';
  if (snap.inHoboCamp)              return 'hoboCamp';
  if (diff.woodChopped >= 8 || diff.stoneGathered >= 8) return 'gathering';
  if (diff.goldDelta >= 300)        return 'goodMoney';
  if (diff.goldDelta < -200)        return 'spentBig';
  if (diff.kills >= 1)              return 'combat';
  if (diff.watered >= 10)           return 'farmWork';
  if (snap.cropsWilted >= 3)        return 'wilted';
  if (diff.bootsThisDay > 0)        return 'boot';
  return 'quiet';
}