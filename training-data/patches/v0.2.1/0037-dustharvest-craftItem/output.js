function craftItem(recipeId, qty=1) {
  const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;

  // How many batches can we actually make?
  let maxBatches = qty;
  for (const ing of recipe.ingredients) {
    maxBatches = Math.min(maxBatches, Math.floor(countItem(ing.id) / ing.qty));
  }
  maxBatches = Math.min(maxBatches, Math.floor(player.stamina / recipe.staminaCost));
  if (maxBatches <= 0) {
    const check = canCraftRecipe(recipe);
    showMsg(`⚠️ Can't craft: ${check.reason}`);
    return;
  }

  // Consume ingredients
  for (const ing of recipe.ingredients) {
    removeItem(ing.id, ing.qty * maxBatches);
  }

  // Consume stamina
  player.stamina = Math.max(0, player.stamina - recipe.staminaCost * maxBatches);

  // Add output
  const totalOut = recipe.outputQty * maxBatches;
  const added = addItem(recipe.output, totalOut);

  const outItem = ITEMS[recipe.output];
  if (added > 0) {
    trackCraft(recipeId, maxBatches);
    showMsg(`⚒ Crafted ${totalOut}× ${outItem?.name || recipe.output}!`);
    spawnParticles(player.x, player.y, '#80c8e8', 5, outItem?.icon || '⚒');
    dSound('harvest');
  }

  refreshMarketUI();
  refreshInvUI();
  buildHotbar();
}