function removeItem(itemId, qty=1) {
  const _effSlotsR = getEffectiveSlotCount();
  for (let i=_effSlotsR-1;i>=0;i--) {
    if (inventory.slots[i] && inventory.slots[i].itemId===itemId) {
      const t = Math.min(inventory.slots[i].qty, qty);
      inventory.slots[i].qty -= t; qty -= t;
      if (inventory.slots[i].qty<=0) inventory.slots[i]=null;
      if (!qty) break;
    }
  }
  refreshInvUI(); buildHotbar();
}