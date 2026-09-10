function _handleFarmTool(tx, ty, wx, wy, key) {
  // Only valid on the main overworld farm — never in other zones
  if (gameState.inOcean || gameState.inBadlands || gameState.inHoboCamp || gameState.inMine) return;
  // ── Sprinkler placement ──────────────────────────────────────────────────
  if (player.tool === 'sprinkler') {
    if (!isFarmTile(tx, ty)) { showMsg('⚠️ Sprinklers can only be placed on the farm dirt!'); return; }
    if (getT(tx, ty) === TL.SPRINKLER) { showMsg('Already a sprinkler here.'); return; }
    if (countItem('sprinkler') <= 0) { showMsg('⚠️ No sprinklers in bag.'); return; }
    if (plots[key] && plots[key].crop) { showMsg('⚠️ Can\'t place on a growing crop — use an empty tile.'); return; }
    // Must be on dirt or already-tilled soil
    const spTile = getT(tx, ty);
    if (spTile !== TL.DIRT && spTile !== TL.FARM_TILLED && spTile !== TL.FARM_WATERED) {
      showMsg('⚠️ Place on bare farm dirt.'); return;
    }
    setT(tx, ty, TL.SPRINKLER);
    removeItem('sprinkler', 1);
    invalidateSprinklerCache();
    spawnParticles(wx, wy, '#60c0e0', 6, '🚿');
    showMsg('🚿 Sprinkler placed! Waters the 4 adjacent plots at dawn.');
    refreshInvUI(); buildHotbar();
    player.actionCooldown = 0.3;
    return;
  }

  if (player.tool==='till') {
    if (!isFarmTile(tx,ty)) { showMsg('⚠️ Till only on the dirt inside the farm fence!'); return; }
    if (getT(tx,ty)===TL.SPRINKLER) { showMsg('⚠️ Remove the sprinkler first.'); return; }
    if (getT(tx,ty)!==TL.DIRT && getT(tx,ty)!==TL.FARM_TILLED && getT(tx,ty)!==TL.FARM_WATERED) { showMsg('⚠️ Can only till bare dirt.'); return; }
    if (!plots[key]) plots[key]={tilled:false,watered:false,crop:null,growthProgress:0,wateredToday:false,wilted:false,harvestReady:false};
    if (plots[key].tilled&&!plots[key].crop) { showMsg('Already tilled.'); return; }
    if (plots[key].crop) { showMsg('⚠️ Crop is here — harvest it first.'); return; }
    if (actionTimer.active && actionTimer._nodeKey === key+'_till') return;
    if (actionTimer.active) cancelAction('');
    const hW = getEffectiveHoeW(), hH = getEffectiveHoeH();
    const aoeLabel = hW>1 ? ` (${hW}×${hH})` : '';
    actionTimer._nodeKey = key+'_till';
    startAction('⛏ Tilling'+aoeLabel+'…', getTillDuration(), () => {
      dSound('tool');
      let tilled = 0;
      for (let dy=0; dy<hH; dy++) {
        for (let dx=0; dx<hW; dx++) {
          const ttx=tx+dx, tty=ty+dy, tkey=plotKey(ttx,tty);
          if (!isFarmTile(ttx,tty)) continue;
          const tileT = getT(ttx,tty);
          if (tileT !== TL.DIRT) continue; // only till bare dirt; skip already-tilled/watered/sprinkler
          if (!plots[tkey]) plots[tkey]={tilled:false,watered:false,crop:null,growthProgress:0,wateredToday:false,wilted:false,harvestReady:false};
          if (plots[tkey].tilled && !plots[tkey].crop) continue;
          if (plots[tkey].crop) continue;
          plots[tkey].tilled = true;
          setT(ttx, tty, TL.FARM_TILLED);
          tilled++;
        }
      }
      if (tilled > 0) {
        stats.tillsDone += tilled;
        spawnParticles(wx,wy,'#8a6030',Math.min(tilled*2,8),'✦');
        showMsg(`Tilled ${tilled} plot${tilled>1?'s':''}${aoeLabel}! Buy seeds at [M].`);
      } else {
        showMsg('Nothing to till here.');
      }
      player.actionCooldown = 0.1;
      player.stamina = Math.max(0, player.stamina - 3*Math.max(1,tilled));
      actionTimer._nodeKey = null;
    });

  } else if (player.tool==='water') {
    if (inventory.water<=0) { showMsg('⚠️ Can is empty — walk to the well to refill!'); return; }
    if (actionTimer.active && actionTimer._nodeKey === key+'_water') return;
    if (actionTimer.active) cancelAction('');
    const cW = getEffectiveCanW(), cH = getEffectiveCanH();
    const aoeWLabel = cW>1 ? ` (${cW}×${cH})` : '';
    actionTimer._nodeKey = key+'_water';
    startAction('💧 Watering'+aoeWLabel+'…', getWaterDuration(), () => {
      let watered = 0;
      for (let dy=0; dy<cH; dy++) {
        for (let dx=0; dx<cW; dx++) {
          if (inventory.water<=0) break;
          const ttx=tx+dx, tty=ty+dy, tkey=plotKey(ttx,tty);
          const p2 = plots[tkey];
          if (!p2||!p2.tilled||p2.wateredToday) continue;
          p2.watered = p2.wateredToday = true; p2.wilted = false;
          inventory.water--;
          setT(ttx, tty, TL.FARM_WATERED);
          watered++;
        }
      }
      if (watered > 0) {
        stats.tilesWatered += watered;
        spawnParticles(wx, wy, '#4090c0', Math.min(watered*2,8), '💧');
        showMsg(`💧 Watered ${watered} plot${watered>1?'s':''}${aoeWLabel}! (${inventory.water} left)`);
      } else {
        const p = plots[key];
        if (!p||!p.tilled) showMsg('⚠️ Till this soil first!');
        else showMsg('Already watered today.');
      }
      player.actionCooldown = 0.1;
      refreshInvUI();
      actionTimer._nodeKey = null;
    });

  } else if (player.tool==='plant') {
    const p = plots[key];
    if (!p||!p.tilled) { showMsg('⚠️ Till this soil first!'); return; }
    if (p.crop) { showMsg('Already planted here.'); return; }
    const sk = SEED_MAP[player.selectedSeed];
    if ((inventory.seeds[sk]||0)<=0) { showMsg(`⚠️ No ${CROPS[player.selectedSeed].name} seeds! Buy at market [M].`); return; }
    // Season restriction check
    const _plantTier = getCropSeasonTier(player.selectedSeed);
    if (_plantTier === 'banned') {
      showMsg(`✘ ${CROPS[player.selectedSeed].name} can't grow in ${getCurrentSeason().name} — wrong season.`);
      return;
    }
    p.crop=player.selectedSeed; p.growthProgress=0; p.wilted=false; p.harvestReady=false;
    inventory.seeds[sk]--;
    stats.plantingsDone++;
    setT(tx,ty, p.watered?TL.FARM_WATERED:TL.FARM_TILLED);
    spawnParticles(wx,wy,'#60a040',4,CROPS[player.selectedSeed].icon);
    if (_plantTier === 'slow') {
      showMsg(`${CROPS[player.selectedSeed].icon} ${CROPS[player.selectedSeed].name} planted — ⚠ slow this season (${getCropSeasonLabel(player.selectedSeed).text}).`);
    } else if (_plantTier === 'best') {
      showMsg(`${CROPS[player.selectedSeed].icon} ${CROPS[player.selectedSeed].name} planted — ★ peak season!`);
    } else {
      showMsg(`${CROPS[player.selectedSeed].icon} ${CROPS[player.selectedSeed].name} planted!`);
    }
    player.actionCooldown=.32; refreshInvUI(); buildHotbar();

  } else if (player.tool==='harvest') {
    const p = plots[key];
    if (!p||!p.crop) { showMsg('Nothing to harvest here.'); return; }
    if (!p.harvestReady) { showMsg(`${CROPS[p.crop].icon} ${Math.floor(p.growthProgress*100)}% grown — not ready yet.`); return; }
    if (inventory.totalWeight >= getEffectiveWeightCap()) { showMsg('⚠️ Bag too heavy to harvest! Sell goods or use the chest [M].'); return; }
    if (actionTimer.active && actionTimer._nodeKey === key+'_harvest') return;
    if (actionTimer.active) cancelAction('');
    const cropNow = p.crop;
    actionTimer._nodeKey = key+'_harvest';
    startAction(`🌾 Harvesting ${CROPS[cropNow].icon}…`, getHarvestDuration(), () => {
      if (!p.crop || !p.harvestReady) { showMsg('Plot changed.'); return; }
      const _harvestHour = gameState.timeOfDay / 60;
      const _dawnBonus = cropNow === 'sunblossom' && _harvestHour >= 6 && _harvestHour < 9;
      const _scytheBonus = cropNow === 'dustwheat' && (player._harvestBonus || 0) > 0;
      const qty = (p.wilted ? 1 : 2+Math.floor(Math.random()*2)) + getEffectiveHarvestBonus() + (_dawnBonus ? 2 : 0) + (_scytheBonus ? 1 : 0);
      const added = addItem(cropNow, qty);
      if (added<=0) { showMsg('⚠️ Bag full — open chest to store goods!'); return; }
      trackHarvest(cropNow, added);
      spawnParticles(wx,wy,CROPS[cropNow].color,6,CROPS[cropNow].icon);
      spawnParticles(wx,wy,'#f0d060',2,'+'+added);
      const _dawnNote = _dawnBonus ? ' 🌅 Dawn bonus!' : '';
      const _scytheNote = _scytheBonus ? ' ⚔️ Clean cut!' : '';
      showMsg(added<qty ? `🌾 ${added}/${qty} ${CROPS[cropNow].name} — bag too heavy for rest!` : `🌾 Harvested ${added}× ${CROPS[cropNow].name}!${_dawnNote}${_scytheNote} [M] to sell.`);
      p.crop=null; p.growthProgress=0; p.harvestReady=false; p.wateredToday=false;
      p.tilled=false; p.watered=false;
      dSound('harvest');
      setT(tx,ty,TL.DIRT);
      player.actionCooldown=0.1;
      player.stamina=Math.max(0, player.stamina-4);
      // Track harvest cooldown for HUD display
      const hcd = getHarvestDuration();
      player._harvestCooldownMax = hcd;
      player._harvestCooldownTimer = hcd;
      actionTimer._nodeKey=null;
    });
  }
}