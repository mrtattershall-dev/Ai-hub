function openBLChest() {
  if (blChestLooted) { showMsg('📦 Already looted. Comes back around tomorrow.'); return; }
  blChestLooted = true;
  // Random loot from a table
  const lootTable = [
    ['gold', 40, 90],
    ['outlawBadge', 1, 2],
    ['silverOre', 1, 2],
    ['obsidian', 0, 1],
    ['potion', 1, 2],
    ['bread', 2, 3],
    ['sulfurDust', 2, 4],
  ];
  let goldGained = 0;
  const itemsGained = [];
  lootTable.forEach(([id, mn, mx]) => {
    if (Math.random() < 0.6) {
      const qty = mn + Math.floor(Math.random() * (mx - mn + 1));
      if (qty <= 0) return;
      if (id === 'gold') { player.gold += qty; goldGained += qty; }
      else { const added = addItem(id, qty); if (added > 0) itemsGained.push(`${qty}× ${ITEMS[id]?.name||id}`); }
    }
  });
  spawnParticles(player.x, player.y, '#f0d060', 8, '📦');
  const parts = [];
  if (goldGained > 0) parts.push(`$${goldGained}`);
  parts.push(...itemsGained);
  showMsg(`📦 Outpost chest: ${parts.length > 0 ? parts.join(', ') : 'mostly empty, a few scraps.'}`);
  refreshInvUI(); buildHotbar();
}