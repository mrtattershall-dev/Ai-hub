function buildWorldState() {
  const plotsCompact = {};
  for (const [k,p] of Object.entries(plots)) {
    plotsCompact[k] = {
      crop:p.crop, stage:p.stage, growTimer:p.growTimer,
      watered:p.watered, wilted:p.wilted, harvestReady:p.harvestReady,
      tilled:p.tilled, wateredToday:p.wateredToday,
    };
  }
  return {
    plots: plotsCompact,
    econPrices: economy.prices,
    econSeedPrices: economy.seedPrices,
    econEvent: economy.event || null,
    econEvDaysLeft: economy.evDaysLeft,
    day: gameState.day,
    timeOfDay: gameState.timeOfDay,
    season: gameState.season,
    isNight: gameState.isNight,
    // Sprinkler tiles
    sprinklers: (()=>{ const s=[]; try{ for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) if(getT(x,y)===TL.SPRINKLER) s.push([x,y]); }catch(_){} return s; })(),
    // Shared farm state
    chestSlots: chestSlots.slice(0, getChestSize()),
    weeklyBills: JSON.parse(JSON.stringify(weeklyBills)),
    playerDebt: player.debt,
    upgrades: [...purchasedUpgrades],
    // Shared progression
    activeContracts:    JSON.parse(JSON.stringify(activeContracts)),
    completedContracts: completedContracts.map(c => c.uid),
    activeQuests:       JSON.parse(JSON.stringify(activeQuests)),
    completedQuests:    completedQuests.map(q => q.id),
    claimableQuests:    [...claimableQuests],
    contractStreak:     contractStreak,
    reputation:         {...REPUTATION},
    sharedStats: {
      totalCropsHarvested: stats.totalCropsHarvested || 0,
      contractsCompleted:  stats.contractsCompleted  || 0,
      goldEarned:          stats.goldEarned          || 0,
      daysSurvived:        stats.daysSurvived        || 0,
    },
  };
}