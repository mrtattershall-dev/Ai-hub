function collectProduct(prod) {
  const itemMap = { chicken:'egg', sheep:'wool', cow:'milk', pig:'pork', rabbit:'rabbitFur', goat:'goatMilk', horse:'horseshoe' };
  const itemId = itemMap[prod.type];
  if (!itemId) return;
  if (inventory.totalWeight >= getEffectiveWeightCap()) {
    showMsg(`⚠️ Bag too heavy to collect ${itemId}! Sell goods first [M].`);
    return;
  }
  addItem(itemId, 1);
  products = products.filter(p => p.id !== prod.id);
  // Mark animal product as collected
  const a = getAnimalById(prod.animalId);
  if (a) a.productReady = false;
  spawnParticles(prod.x, prod.y, '#f0d060', 4, ANIMAL_DEFS[prod.type].productIcon);
  showMsg(`${ANIMAL_DEFS[prod.type].productIcon} Collected ${ANIMAL_DEFS[prod.type].name} product!`);
  updateRanchPanel();
}