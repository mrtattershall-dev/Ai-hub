function chestDepositAll() {
  // Deposit everything that isn't a tool, food/consumable, or seed — includes fish, ore, crops, resources
  const skipTypes = new Set(['tool','food','seed']);
  let moved = 0;
  for (let i = 0; i < inventory.slots.length; i++) {
    const s = inventory.slots[i];
    if (!s || !s.itemId || !ITEMS[s.itemId]) continue;
    if (skipTypes.has(ITEMS[s.itemId].type)) continue;
    let qty = s.qty;
    while (qty > 0) {
      const added = chestAddItem(s.itemId, qty);
      if (added <= 0) break;
      removeItem(s.itemId, added);
      moved += added;
      qty -= added;
    }
  }
  if (moved > 0) { showMsg(`📦 Deposited ${moved} item${moved > 1 ? 's' : ''} into the chest.`); refreshChestUI(); refreshInvUI(); buildHotbar(); }
  else showMsg('Nothing to deposit (or chest is full).');
}