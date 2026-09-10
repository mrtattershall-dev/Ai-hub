function _jgHarvest(tx, ty, key, wx, wy) {
  const p = jgPlots[key];
  if (!p || !p.crop) { showMsg('Nothing to harvest here.'); return true; }
  if (!p.harvestReady) {
    showMsg(`${CROPS[p.crop].icon} ${Math.floor(p.growthProgress * 100)}% grown — not ready yet.`);
    return true;
  }
  if (inventory.totalWeight >= getEffectiveWeightCap()) {
    showMsg('⚠️ Bag too heavy to harvest!'); return true;
  }
  if (actionTimer.active && actionTimer._nodeKey === key + '_jgharvest') return true;
  if (actionTimer.active) cancelAction('');

  const cropNow = p.crop;
  actionTimer._nodeKey = key + '_jgharvest';
  startAction(`🌾 Harvesting ${CROPS[cropNow].icon}…`, getHarvestDuration(), () => {
    if (!p.crop || !p.harvestReady) { showMsg('Plot changed.'); actionTimer._nodeKey = null; return; }

    // Base yield
    const qty = p.wilted ? 1 : 2 + Math.floor(Math.random() * 2) + getEffectiveHarvestBonus();

    // ── Crop traits on harvest ────────────────────────────────────────────
    // Dawn bonus: Crimson Bloom × 3 if harvested 6–9am
    const harvestHour = gameState.timeOfDay / 60;
    const dawnBonus = cropNow === 'crimsonBloom' && harvestHour >= 6 && harvestHour < 9;
    const finalQty = dawnBonus ? qty * 3 : qty;

    const added = addItem(cropNow, finalQty);
    if (added <= 0) { showMsg('⚠️ Bag full!'); actionTimer._nodeKey = null; return; }

    trackHarvest(cropNow, added);
    spawnParticles(wx, wy, CROPS[cropNow].color, 6, CROPS[cropNow].icon);
    spawnParticles(wx, wy, '#f0d060', 2, '+' + added);

    // Heartleaf heal
    if (cropNow === 'heartleaf') {
      player.hp = Math.min(player.maxHp, player.hp + 5);
      spawnParticles(wx, wy, '#50e070', 3, '+5 HP');
    }

    // Ashgrain soil restoration — hook point (Slice 5 fills full logic)
    if (cropNow === 'ashgrain') _jgAshgrainHarvestHook(key, p);

    const note = dawnBonus ? ' 🌅 Dawn bonus ×3!' : '';
    showMsg(`${CROPS[cropNow].icon} Harvested ${added}× ${CROPS[cropNow].name}!${note}`);

    // Soil progression
    p.harvestCount = (p.harvestCount || 0) + 1;
    _advanceJGSoilTier(key, p);

    // Reset plot
    p.crop = null; p.growthProgress = 0; p.harvestReady = false;
    p.wateredToday = false; p.wilted = false; p.watered = false;
    p.tilled = true; // stays tilled after harvest
    setJGT(tx, ty, JG.FARM_PLOT);

    dSound('harvest');
    player.actionCooldown = 0.1;
    player.stamina = Math.max(0, player.stamina - 4);
    player._harvestCooldownMax   = getHarvestDuration();
    player._harvestCooldownTimer = getHarvestDuration();
    stats.totalCropsHarvested++;
    gainRep('jungle', 1);
    actionTimer._nodeKey = null;
  });
  return true;
}