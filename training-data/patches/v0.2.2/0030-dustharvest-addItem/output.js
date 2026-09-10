function addItem(itemId, qty=1, quality=null) {
  // Returns: number of items actually added (may be less than qty if overweight/full)
  if (!ITEMS[itemId]) return 0;
  const item = ITEMS[itemId];
  const originalQty = qty;
  // quality is only meaningful for ore type items
  const isOre = item.type === 'ore';
  const effectiveQuality = isOre ? (quality || 'standard') : null;

  // Weight cap — calculate how many actually fit by weight
  const cap = getEffectiveWeightCap();
  const currentWeight = inventory.totalWeight;
  if (item.weight > 0 && currentWeight >= cap) {
    showMsg(`⚠️ Bag full! ${item.name} won't fit. Sell goods or upgrade your saddlebag.`);
    return 0;
  }
  if (item.weight > 0) {
    const canFitByWeight = Math.floor((cap - currentWeight) / item.weight);
    if (canFitByWeight < qty) {
      qty = canFitByWeight;
      if (qty <= 0) {
        showMsg(`⚠️ Too heavy! ${item.name} won't fit. Sell goods or upgrade saddlebag.`);
        return 0;
      }
      // Don't show warning here — caller (gatherNode) will show a better message
    }
  }

  // Stack into existing slots first — match quality for ores
  const _effSlots = getEffectiveSlotCount();
  for (let i=0;i<_effSlots;i++) {
    if (inventory.slots[i] && inventory.slots[i].itemId===itemId) {
      // For ores, only stack with matching quality
      if (isOre && inventory.slots[i].quality !== effectiveQuality) continue;
      const sp = item.stack - inventory.slots[i].qty;
      if (sp>0) { const a=Math.min(sp,qty); inventory.slots[i].qty+=a; qty-=a; if(!qty){refreshInvUI();buildHotbar();return originalQty;} }
    }
  }
  // Fill empty slots
  for (let i=0;i<_effSlots;i++) {
    if (!inventory.slots[i]) {
      const a=Math.min(item.stack,qty);
      inventory.slots[i]={itemId,qty:a};
      if (effectiveQuality) inventory.slots[i].quality = effectiveQuality;
      qty-=a;
      if(!qty){refreshInvUI();buildHotbar();return originalQty;}
    }
  }
  // Slots full (not weight — actual slot count)
  if (qty>0) showMsg(`⚠️ No space in bag! ${qty}x ${item.name} lost. Sell items to make room.`);
  refreshInvUI(); buildHotbar();
  return originalQty - qty; // how many were actually added
}