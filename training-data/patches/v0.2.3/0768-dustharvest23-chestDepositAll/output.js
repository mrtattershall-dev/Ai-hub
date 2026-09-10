function chestDepositAll() {
  const depositables = ['carrot','corn','pumpkin','glowroot','tomato','dustwheat','sunblossom','pepper','melon','potato','lavender','cactusFruit','blueberry','garlic','strawberry','onion','watermelon','rosehip','moonshroom','stone','wood','herb','egg','wool','milk','pork','rabbitFur','goatMilk','horseshoe','banditScarf','wolfPelt','burrowerCarapace','raiderBadge','snakeFang','scorpionStinger','coyoteHide'];
  let moved = 0;
  for (const id of depositables) {
    let qty = countItem(id);
    while (qty > 0) {
      const added = chestAddItem(id, qty);
      if (added <= 0) break;
      removeItem(id, added);
      moved += added;
      qty -= added;
    }
  }
  if (moved > 0) { showMsg(`📦 Deposited ${moved} item${moved > 1 ? 's' : ''} into the chest.`); refreshChestUI(); refreshInvUI(); buildHotbar(); }
  else showMsg('Nothing to deposit.');
}