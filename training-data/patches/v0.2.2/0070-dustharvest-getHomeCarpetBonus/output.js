function getHomeCarpetBonus()   {
  if (!homeFurnitureOwned('carpet')) return 1.0;
  // Only applies on the overworld (farm/town) — not in mines, badlands, hobo camp, ocean, jungle
  if (gameState.inMine||gameState.inBLMine||gameState.inBadlands||gameState.inHoboCamp||gameState.inOcean||gameState.inJungle) return 1.0;
  return 1.05;
}