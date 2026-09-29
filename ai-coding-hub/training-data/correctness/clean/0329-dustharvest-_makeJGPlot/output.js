function _makeJGPlot() {
  return {
    tilled: false, watered: false, wateredToday: false,
    crop: null, growthProgress: 0, harvestReady: false, wilted: false,
    soilTier: 'stripped',   // stripped / recovering / restored
    harvestCount: 0,        // total harvests on this plot — drives tier progression
    compostUses: 0,         // each compost application = +2 effective harvests
  };
}