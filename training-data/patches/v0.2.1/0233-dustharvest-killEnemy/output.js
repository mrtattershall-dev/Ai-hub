function killEnemy(e) {
  trackKill(e.type);
  // Pirate skiff kill — rep gain, heat escalation, and dock defense message
  if (e.type === 'pirateSkiff') {
    gainRep('ocean', 8);
    gameState.pirateHeat = Math.min(5, (gameState.pirateHeat || 0) + 1);
    spawnParticles(e.x, e.y, '#3a5a8a', 8, '🏴‍☠️');
    const heatMsg = gameState.pirateHeat >= 4 ? ' ⚠️ They\'re sending bigger crews.' :
                    gameState.pirateHeat >= 2 ? ' More will come.' : '';
    showMsg(`⚓ Pirate skiff sunk. Salvage dropped.${heatMsg}`);
    // Bonus loot at high heat
    if (gameState.pirateHeat >= 3) {
      addItem('foreignCoin', 1 + Math.floor(gameState.pirateHeat / 2));
      if (gameState.pirateHeat >= 4 && Math.random() < 0.4) addItem('navalChart', 1);
      if (gameState.pirateHeat >= 5 && Math.random() < 0.25) addItem('mapFragment', 1);
    }
  }
  // Drop loot (addItem returns 0 if bag full — loot is a bonus so we accept loss)
  for (const [item, min, max] of e.def.loot) {
    const qty = min + Math.floor(Math.random() * (max - min + 1));
    if (item === 'gold') { player.gold += qty; trackGoldEarned(qty); spawnParticles(e.x,e.y,'#f0d060',4,'+$'+qty); }
    else { addItem(item, qty); spawnParticles(e.x,e.y,'#80c060',3,(ITEMS[item] && ITEMS[item].icon)||''); }
  }
  spawnParticles(e.x, e.y, '#c04020', 5, '💀');
}