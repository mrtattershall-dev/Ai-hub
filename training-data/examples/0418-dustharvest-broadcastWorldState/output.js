function broadcastWorldState() {
  if (!mp.isActive()) return;
  const plotsCompact = {};
  for (const [k, p] of Object.entries(plots)) {
    plotsCompact[k] = {
      crop: p.crop, stage: p.stage, growTimer: p.growTimer,
      watered: p.watered, wilted: p.wilted, harvestReady: p.harvestReady,
      tilled: p.tilled, wateredToday: p.wateredToday,
    };
  }
  mp.broadcast({
    type: 'world_state',
    plots: plotsCompact,
    econPrices: economy.prices,
    econSeedPrices: economy.seedPrices,
    econEvent: economy.event || null,
    econEvDaysLeft: economy.evDaysLeft,
    day: gameState.day,
    timeOfDay: gameState.timeOfDay,
    season: gameState.season,
    isNight: gameState.isNight,
    // Sprinkler tile positions — synced every 2s as fallback
    sprinklers: (()=>{ const s=[]; try{ for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) if(getT(x,y)===TL.SPRINKLER) s.push([x,y]); }catch(_){} return s; })(),
  });
}