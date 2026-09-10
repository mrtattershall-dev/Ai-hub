function applyPlotPatch(patches) {
  for (const [k, v] of Object.entries(patches)) {
    if (v === null) {
      delete plots[k];
      // Reset tile
      const [tx, ty] = k.split(',').map(Number);
      if (!isNaN(tx)) try { setT(tx, ty, TL.DIRT); } catch(_){}
    } else {
      if (!plots[k]) plots[k] = {};
      Object.assign(plots[k], v);
      // Sync tile visual
      const [tx, ty] = k.split(',').map(Number);
      if (!isNaN(tx)) {
        try {
          const tile = v.watered ? TL.FARM_WATERED : v.tilled ? TL.FARM_TILLED : TL.DIRT;
          setT(tx, ty, tile);
        } catch(_){}
      }
    }
  }
}