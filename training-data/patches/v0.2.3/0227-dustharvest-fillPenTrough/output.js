function fillPenTrough(pen) {
  const feedItems = ['carrot','corn','pumpkin','glowroot','tomato','dustwheat','sunblossom','pepper','melon','potato','lavender','cactusFruit','blueberry'];
  const feedVal = { carrot:8, corn:15, pumpkin:20, glowroot:25, tomato:10, dustwheat:12, sunblossom:30, pepper:8, melon:22, potato:10, lavender:12, cactusFruit:14, blueberry:6 };
  const penTroughCap = pen._copperTrough ? Math.floor(PEN_TROUGH_MAX * 1.3) : PEN_TROUGH_MAX;
  let filled = 0;
  for (const id of feedItems) {
    const qty = countItem(id);
    if (qty > 0 && pen.troughFill < penTroughCap) {
      const use = Math.min(qty, Math.floor((penTroughCap - pen.troughFill) / feedVal[id]));
      if (use > 0) {
        removeItem(id, use);
        pen.troughFill = Math.min(penTroughCap, pen.troughFill + use * feedVal[id]);
        filled += use;
      }
    }
  }
  const { tx, ty } = getPenTroughPos(pen);
  if (filled > 0) {
    spawnParticles(tx*T+T/2, ty*T+T/2, '#e0c060', 5, '🌾');
    const penAnimals = animals.filter(a => a.penId === pen.id && a.hp > 0);
    const penType = penAnimals[0]?.type;
    const icons = ANIMAL_ICONS;
    const dailyCost = penAnimals.reduce((s,a) => s + ANIMAL_DEFS[a.type].feedCost, 0);
    const daysLeft = dailyCost > 0 ? Math.floor(pen.troughFill / dailyCost) : 99;
    showMsg(`🌾 ${icons[penType]||'🐾'} Pen trough filled — ${Math.round(pen.troughFill)}% (~${daysLeft}d left)`);
    refreshInvUI(); updateRanchPanel();
  } else if (pen.troughFill >= PEN_TROUGH_MAX) {
    showMsg('🪣 This trough is already full!');
  } else {
    showMsg('⚠️ No crops in inventory to fill this trough!');
  }
}