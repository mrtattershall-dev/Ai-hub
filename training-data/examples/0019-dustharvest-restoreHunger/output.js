function restoreHunger(itemId) {
  const restore = HUNGER_RESTORE[itemId] || 0;
  if (restore > 0) {
    // Table bonus: double hunger restore when eating inside the house
    const tableMult = isInsideHome() ? getHomeTableBonus() : 1.0;
    player.hunger = Math.min(100, player.hunger + restore * tableMult);
    if (player.hunger > 40) _hungerWarnedHungry   = false;
    if (player.hunger > 20) _hungerWarnedStarving = false;
  }
}