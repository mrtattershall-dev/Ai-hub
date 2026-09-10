function _handleRanchInteraction(tx, ty, wx, wy) {
  // Pen repair
  for (const pen of pens) {
    if (pen.hp > 0) continue;
    const gateX = pen.x + Math.floor(pen.w/2);
    const gateY = pen.y + pen.h - 1;
    if (Math.abs(tx-gateX)<=1 && Math.abs(ty-gateY)<=1) { repairPen(pen); return true; }
  }

  // Treat sick animals — if player is near a pen with sick animals and has a poultice
  for (const pen of pens) {
    const nearPen = tx >= pen.x-1 && tx <= pen.x+pen.w && ty >= pen.y-1 && ty <= pen.y+pen.h;
    if (!nearPen) continue;
    const sick = animals.filter(a => a.penId===pen.id && a.sick && a.hp>0);
    if (sick.length > 0 && countItem('poultice') > 0) {
      removeItem('poultice', 1);
      sick.forEach(a => { a.sick=false; a._hungryDays=0; a.hp=Math.min(a.maxHp, a.hp+2); });
      spawnParticles(player.x, player.y, '#80e080', 5, '🌿');
      showMsg(`🌿 Treated ${sick.length} sick animal${sick.length>1?'s':''}. They'll recover fully with a full trough.`);
      return true;
    }
    // Iron Brand — brand all unbranded animals in pen for +15% production
    const unbranded = animals.filter(a => a.penId===pen.id && a.hp>0 && !a._branded);
    if (unbranded.length > 0 && countItem('ironBrand') > 0) {
      removeItem('ironBrand', 1);
      unbranded.forEach(a => { a._branded = true; });
      spawnParticles(player.x, player.y, '#e07030', 6, '🔥');
      showMsg(`🔥 Branded ${unbranded.length} animal${unbranded.length>1?'s':''} — +15% production permanently.`);
      return true;
    }
    // Copper Trough — upgrade pen trough capacity
    if (!pen._copperTrough && countItem('copperTrough') > 0) {
      removeItem('copperTrough', 1);
      pen._copperTrough = true;
      pen.troughFill = Math.min(130, (pen.troughFill||0) + 30); // top up on install
      spawnParticles(player.x, player.y, '#70b8d0', 5, '🪣');
      showMsg('🪣 Copper Trough installed — pen holds 30% more feed and drains 20% slower.');
      return true;
    }
  }

  // Barn zone -- check PLAYER tile position (not just clicked tile) so E-key works reliably from any facing
  const ptxR = Math.floor(player.x/T), ptyR = Math.floor(player.y/T);
  const nearBarn = (ptyR>=BARN_ZONE_TY_MIN-1 && ptyR<=BARN_ZONE_TY_MAX+1
                 && ptxR>=BARN_ZONE_TX_MIN-2 && ptxR<=BARN_ZONE_TX_MAX+2)
                || (ty>=BARN_ZONE_TY_MIN && ty<=BARN_ZONE_TY_MAX && tx>=BARN_ZONE_TX_MIN && tx<=BARN_ZONE_TX_MAX);
  if (nearBarn) {
    if (products.length > 0) {
      const ANIMAL_ITEM = { chicken:'egg', sheep:'wool', cow:'milk', pig:'pork', rabbit:'rabbitFur', goat:'goatMilk', horse:'horseshoe' };
      let collected = 0;
      for (const prod of [...products]) {
        if (inventory.totalWeight >= getEffectiveWeightCap()) break;
        const itemId = ANIMAL_ITEM[prod.type];
        if (itemId) { addItem(itemId, 1); stats.productsCollected = (stats.productsCollected||0)+1; products = products.filter(p => p.id !== prod.id); collected++; }
      }
      if (collected > 0) {
        spawnParticles(player.x, player.y, '#f0d060', 6, '🧺');
        showMsg(`🧺 Collected ${collected} product${collected>1?'s':''} from all animals!`);
        refreshInvUI(); updateRanchPanel(); return true;
      }
    }
    toggleBarn(); return true;
  }

  // Pen troughs
  for (const pen of pens) {
    const { tx: ptx2, ty: pty2 } = getPenTroughPos(pen);
    if (Math.abs(tx-ptx2)<=1 && Math.abs(ty-pty2)<=1) { fillPenTrough(pen); return true; }
  }

  // Legacy barn trough
  if (tx===LEGACY_TROUGH_TX && ty===LEGACY_TROUGH_TY) { fillTrough(); return true; }

  // Floating product collect
  const nearProd = products.find(p => Math.hypot(player.x-p.x, player.y-p.y) < T*1.5);
  if (nearProd) { collectProduct(nearProd); return true; }

  // Ranch well
  if ((tx===RANCH_WELL_TX || tx===RANCH_WELL_TX+1) && ty===RANCH_WELL_TY) {
    inventory.water = inventory.waterCap;
    spawnParticles(wx, wy, '#4090c0', 6, '💧');
    showMsg('💧 Ranch well — watering can refilled!'); refreshInvUI(); return true;
  }

  return false;
}