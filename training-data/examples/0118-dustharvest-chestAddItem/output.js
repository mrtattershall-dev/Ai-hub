function chestAddItem(itemId, qty) {
  if (!ITEMS[itemId]) return 0;
  const item = ITEMS[itemId];
  let rem = qty;
  // Stack into existing
  for (let i = 0; i < getChestSize(); i++) {
    if (chestSlots[i] && chestSlots[i].itemId === itemId) {
      const sp = item.stack - chestSlots[i].qty;
      if (sp > 0) { const a = Math.min(sp, rem); chestSlots[i].qty += a; rem -= a; if (!rem) return qty; }
    }
  }
  // New slots
  for (let i = 0; i < getChestSize(); i++) {
    if (!chestSlots[i]) {
      const a = Math.min(item.stack, rem);
      chestSlots[i] = { itemId, qty: a }; rem -= a;
      if (!rem) return qty;
    }
  }
  return qty - rem; // how many fit
}