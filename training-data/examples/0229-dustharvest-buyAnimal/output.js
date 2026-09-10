function buyAnimal(type) {
  const def = ANIMAL_DEFS[type];
  if (player.gold < def.buyCost) { showMsg('⚠️ Not enough gold!'); return; }
  // Find a pen that accepts this animal type and has capacity
  const pen = pens.find(p => (p.type === type || p.type === 'any') && getPenAnimalCount(p) < getPenCapacity(p));
  if (!pen) {
    const anyPen = pens.find(p => p.type === type || p.type === 'any');
    if (!anyPen) { showMsg(`⚠️ No ${type} pen built! Press [R] to place one.`); return; }
    showMsg(`⚠️ ${def.icon} Pen is full! Max ${getPenCapacity(anyPen)} ${def.name}s per pen.`); return;
  }
  player.gold -= def.buyCost;
  trackGoldSpent(def.buyCost);
  spawnAnimal(type, pen);
  const remaining = getPenCapacity(pen) - getPenAnimalCount(pen);
  spawnParticles(player.x, player.y, '#80e060', 6, def.icon);
  showMsg(`${def.icon} ${def.name} delivered! (${getPenAnimalCount(pen)}/${getPenCapacity(pen)} in pen)`);
  refreshMarketUI();
  updateRanchPanel();
}