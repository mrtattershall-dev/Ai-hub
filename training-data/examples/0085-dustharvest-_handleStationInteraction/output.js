function _handleStationInteraction(tx, ty) {
  // Forge — check adjacency via tile scan first (same logic as before)
  for (const [fx,fy] of playerAdjacentTiles()) {
    if (getT(fx, fy) === TL.FORGE) {
      if (!player._mineForge) { showMsg('🔒 Upgrade the Mine Forge first (Market → Upgrades → Mine).'); return true; }
      openSmeltForge(); return true;
    }
  }
  // Campfire — tile-click proximity
  if (Math.abs(tx-CAMPFIRE_TX)<=2 && Math.abs(ty-CAMPFIRE_TY)<=2 && getT(CAMPFIRE_TX,CAMPFIRE_TY)===TL.CAMPFIRE) {
    if (!player._campfireUnlocked) { showMsg('🔥 This campfire needs building — buy the Cooking Campfire upgrade at market (Farm tab, $120).'); return true; }
    // If player has fish + coal, offer quick-cook shortcut before opening full menu
    const fishRecipes = CRAFTING_RECIPES.filter(r => r.station==='campfire' && r.ingredients.some(i=>ITEMS[i.id]?.type==='fish'));
    const cookable = fishRecipes.filter(r => canCraftRecipe(r).ok);
    if (cookable.length > 0) {
      const r = cookable[0];
      showMsg(`🔥 Quick-cook: [E] again to make ${r.name}. Or open market → Crafting for all recipes.`);
      // Set a flag so next E at campfire executes the cook
      player._quickCookRecipe = r.id;
    } else {
      player._quickCookRecipe = null;
      openMarket(); setMktTab('crafting');
    }
    return true;
  }
  // Forge — tile-click proximity (duplicate entry point, kept for click-on-forge)
  if (Math.abs(tx-FORGE_TX)<=1 && Math.abs(ty-FORGE_TY)<=1 && getT(FORGE_TX,FORGE_TY)===TL.FORGE) {
    if (!player._mineForge) { showMsg('🔒 Upgrade the Mine Forge first (Market → Upgrades → Mine).'); return true; }
    openSmeltForge(); return true;
  }
  // Workbench
  if (Math.abs(tx-WORKBENCH_TX)<=1 && Math.abs(ty-WORKBENCH_TY)<=1) {
    if (!player._workbenchUnlocked) { showMsg('🔒 Upgrade the Crafting Workbench first (Market → Upgrades → Farm).'); return true; }
    openMarket(); setMktTab('crafting');
    showMsg('🪚 Workbench — craft items from your materials.');
    return true;
  }
  return false;
}