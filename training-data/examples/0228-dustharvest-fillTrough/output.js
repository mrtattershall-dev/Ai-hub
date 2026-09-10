function fillTrough() {
  // Use crops from inventory to fill trough
  const feedItems = ['carrot','corn','pumpkin','glowroot','tomato','dustwheat','sunblossom','pepper','melon','potato','lavender','cactusFruit','blueberry'];
  let filled = 0;
  for (const id of feedItems) {
    const qty = countItem(id);
    if (qty > 0) {
      const feedVal = { carrot:8, corn:15, pumpkin:20, glowroot:25, tomato:10, dustwheat:12, sunblossom:30, pepper:8, melon:22, potato:10, lavender:12, cactusFruit:14, blueberry:6 }[id] || 10;
      const use = Math.min(qty, Math.floor((TROUGH_MAX - troughFill) / feedVal));
      if (use > 0) {
        removeItem(id, use);
        troughFill = Math.min(TROUGH_MAX, troughFill + use*feedVal);
        filled += use;
      }
    }
  }
  if (filled > 0) {
    spawnParticles(player.x, player.y, '#e0c060', 5, '🌾');
    showMsg(`🌾 Trough filled! Feed: ${Math.round(troughFill)}%`);
    refreshInvUI();
  } else {
    showMsg('⚠️ No crops in inventory to feed the animals!');
  }
}