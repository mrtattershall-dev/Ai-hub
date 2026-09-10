function placeHomeFurniture(id) {
  const def = HOME_FURNITURE[id];
  if (!def) return;
  playerHome.furniture[id] = true;
  if (id === 'carpet') {
    // Carpet stamps its tile across full footprint but skips tiles already occupied by furniture
    const furnitureTiles = new Set([TL.HOME_BED,TL.HOME_FRIDGE,TL.HOME_TABLE,TL.HOME_FLOWERPOT,TL.HOME_RUG]);
    for (let dy = 0; dy < def.h; dy++)
      for (let dx = 0; dx < def.w; dx++) {
        const cur = getT(def.tx+dx, def.ty+dy);
        if (!furnitureTiles.has(cur)) setT(def.tx+dx, def.ty+dy, TL.HOME_CARPET);
      }
  } else {
    // Stamp ALL footprint tiles with the furniture tile ID
    // Non-anchor tiles draw only floor base then return (see drawTile anchor check)
    // This prevents TOWN_FLOOR from rendering on top of the multi-tile sprite
    for (let dy = 0; dy < def.h; dy++)
      for (let dx = 0; dx < def.w; dx++)
        setT(def.tx+dx, def.ty+dy, def.tile);
  }
}