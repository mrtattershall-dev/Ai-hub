function pressOre(oreId, batches) {
  // Ore Press: 3 flawed → 2 standard. Burns a little stamina per batch.
  if (!player._orePress) { showMsg('⚙️ Ore Press not unlocked.'); return; }
  const item = ITEMS[oreId]; if (!item) return;
  let flawedLeft = batches * 3;
  // Remove exactly `flawedLeft` flawed units from inventory
  const _eff = getEffectiveSlotCount();
  for (let i = _eff-1; i >= 0 && flawedLeft > 0; i--) {
    const s = inventory.slots[i];
    if (!s || s.itemId !== oreId || s.quality !== 'flawed') continue;
    const take = Math.min(s.qty, flawedLeft);
    s.qty -= take;
    if (s.qty <= 0) inventory.slots[i] = null;
    flawedLeft -= take;
  }
  const outputQty = batches * 2;
  addItem(oreId, outputQty, 'standard');
  player.stamina = Math.max(0, player.stamina - 3 * batches);
  spawnParticles(player.x, player.y, '#a0c080', 5, '⚙️');
  showMsg(`⚙️ Pressed ${batches*3}× flawed ${item.name} → ${outputQty}× standard ore!`);
  refreshInvUI();
}