function canCraftRecipe(recipe) {
  // Station check
  if (recipe.station === 'forge' && !player._mineForge) return { ok:false, reason:'Requires Mine Forge upgrade.' };
  if (recipe.station === 'campfire') {
    if (!player._campfireUnlocked) return { ok:false, reason:'Requires Cooking Campfire upgrade ($120, Market → Farm).' };
    const ptx=Math.floor(player.x/T), pty=Math.floor(player.y/T);
    const nearFire = Math.abs(ptx-CAMPFIRE_TX)<=2 && Math.abs(pty-CAMPFIRE_TY)<=2;
    if (!nearFire) return { ok:false, reason:'Must be at the Campfire (northeast farm corner).' };
  }
  // 'hand' = craft anywhere, no upgrade needed
  // 'workbench' = requires the workbench upgrade AND proximity to the bench
  if (recipe.station === 'workbench') {
    if (!player._workbenchUnlocked) return { ok:false, reason:'Requires Crafting Workbench upgrade ($300).' };
    const ptx=Math.floor(player.x/T), pty=Math.floor(player.y/T);
    const nearBench = Math.abs(ptx-WORKBENCH_TX)<=2 && Math.abs(pty-WORKBENCH_TY)<=2;
    if (!nearBench) return { ok:false, reason:'Must be at the Workbench (farm, bottom-right).' };
  }
  // Stamina check
  if (player.stamina < recipe.staminaCost) return { ok:false, reason:`Need ${recipe.staminaCost} stamina.` };
  // Ingredient check
  for (const ing of recipe.ingredients) {
    const have = countItem(ing.id);
    if (have < ing.qty) {
      const name = ITEMS[ing.id]?.name || ing.id;
      return { ok:false, reason:`Need ${ing.qty}× ${name} (have ${have}).` };
    }
  }
  return { ok:true, reason:'' };
}