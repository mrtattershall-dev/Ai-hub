function refreshFarmhandUI() {
  const plotList = Object.values(plots);
  const needWater   = plotList.filter(p => p.tilled && p.crop && !p.wateredToday && !p.harvestReady).length;
  const readyToHarv = plotList.filter(p => p.harvestReady).length;
  const wiltedCount = plotList.filter(p => p.wilted).length;
  const untilledFarm = (() => {
    let n = 0;
    for (let ty = 3; ty <= 21; ty++) for (let tx = 3; tx <= 21; tx++) {
      if (!isFarmTile(tx,ty)) continue;
      const k = plotKey(tx,ty);
      if (!plots[k] || !plots[k].tilled) n++;
    }
    return n;
  })();

  // Count tilled empty plots (ready to plant) and available seeds
  const tillEmptyCount = plotList.filter(p => p.tilled && !p.crop).length;
  const selectedSeed = player.selectedSeed;
  const seedCount = selectedSeed ? (inventory.seeds[SEED_MAP[selectedSeed]] || 0) : 0;
  const plantable = Math.min(tillEmptyCount, seedCount);

  // Harvest-and-sell: count crops in bag with market value
  const cropItemMap = {}; // id -> qty
  const _effSlots = getEffectiveSlotCount ? getEffectiveSlotCount() : 30;
  for (let _si = 0; _si < _effSlots; _si++) {
    const s = inventory.slots[_si];
    if (s && s.qty > 0 && CROPS[s.itemId]) {
      cropItemMap[s.itemId] = (cropItemMap[s.itemId] || 0) + s.qty;
    }
  }
  const cropItems = Object.entries(cropItemMap);
  const cropSellValue = cropItems.reduce((sum,[id,qty])=>sum+(economy.prices[id]||BASE_PRICES[id]||0)*qty,0);

  const dm = getDifficultyConfig().debtMult || 1;
  const waterCost  = Math.max(5, Math.round(needWater * 4 * dm));
  const harvCost   = Math.max(5, Math.round(readyToHarv * 6 * dm));
  const tillCost   = Math.max(10, Math.min(untilledFarm, 20) * Math.round(3 * dm));
  const reviveCost = Math.max(8, Math.round(wiltedCount * 8 * dm));
  const plantCost  = Math.max(5, Math.round(plantable * 3 * dm));
  const sellFee    = Math.max(3, Math.round(cropSellValue * 0.08)); // Jed takes 8% cut to sell
  const doAllCost  = Math.round((waterCost + harvCost + reviveCost) * 0.85); // 15% bundle discount
  const weekCost   = Math.round(40 * dm); // fixed 7-day retainer

  // Contextual tip — seasonal comment prepended
  const _jedBySeason = {
    'Dry Summer': [
      "Hot work today. Make sure things get watered early.",
      "This heat's tough on the crops. Wilting season if you're not careful.",
      "Summer's the kind of weather that makes you appreciate a well.",
      "Dust gets into everything. Even the seedbags.",
    ],
    'Harvest Fall': [
      "Good growing weather. Things are coming in fast.",
      "Fall mornings are the best time to be out here. Before it gets busy.",
      "Harvest season. Feels right to be working the land.",
      "Crops are fat this time of year. Good problem to have.",
    ],
    'Cold Winter': [
      "Cold this morning. Broke the ice on the trough before you were up.",
      "Winter's hard on the animals. Keep that barn closed at night.",
      "Storm came through last night. Checked the fences at dawn.",
      "Fewer crops to tend but the cold makes everything take longer.",
    ],
    'Wet Spring': [
      "Rain did a lot of the work for us today. Good season.",
      "Everything's growing whether you tend it or not right now. Spring's generous.",
      "Mud on everything, but the crops look happy.",
      "Best time of year to be a farmhand. Even I enjoy mornings like this.",
    ],
  };
  const _season = getCurrentSeason ? getCurrentSeason() : null;
  const _jedLines = _jedBySeason[_season?.name] || _jedBySeason['Dry Summer'];
  const _jedLine = _jedLines[gameState.day % _jedLines.length];

  const tips = [];
  if (_fhWeeksLeft > 0) tips.push(`On retainer — ${_fhWeeksLeft} day${_fhWeeksLeft>1?'s':''} left`);
  else if (needWater) tips.push(`${needWater} plot${needWater>1?'s':''} need watering`);
  if (readyToHarv) tips.push(`${readyToHarv} ready to harvest`);
  if (wiltedCount) tips.push(`${wiltedCount} wilted`);
  if (!tips.length) tips.push('Everything looks good. Nothing pressing right now.');
  document.getElementById('farmhandTip').textContent = _jedLine + ' — ' + tips.join(' · ');

  // Weekly badge
  const badge = document.getElementById('fhWeekBadge');
  if (badge) { badge.textContent = `${_fhWeeksLeft}d`; badge.style.display = _fhWeeksLeft > 0 ? 'inline-block' : 'none'; }

  const jobs = [
    {
      icon:'💧', name:'Water all crops',
      desc: needWater ? `${needWater} plot${needWater>1?'s':''} thirsty today` : 'All watered — good',
      cost: waterCost, disabled: needWater === 0,
      action: 'farmhandDoWater()',
    },
    {
      icon:'🌾', name:'Harvest ready crops',
      desc: readyToHarv ? `${readyToHarv} crop${readyToHarv>1?'s':''} ready to collect` : 'Nothing ready yet',
      cost: harvCost, disabled: readyToHarv === 0,
      action: 'farmhandDoHarvest()',
    },
    {
      icon:'⛏', name:'Till all farm plots',
      desc: untilledFarm ? `Up to 20 untilled plots` : 'All plots tilled',
      cost: tillCost, disabled: untilledFarm === 0,
      action: 'farmhandDoTill()',
    },
    {
      icon:'🌱', name:`Plant selected seed`,
      desc: selectedSeed
        ? (plantable > 0 ? `${plantable}× ${CROPS[selectedSeed]?.name||selectedSeed} into tilled plots` : (seedCount===0?'No seeds in bag for that crop':'No tilled empty plots'))
        : 'Pick a crop in Farm menu [F] first',
      cost: plantCost, disabled: plantable === 0 || !selectedSeed,
      action: 'farmhandDoPlant()',
    },
    {
      icon:'💊', name:'Revive wilted crops',
      desc: wiltedCount ? `${wiltedCount} wilted — saves them` : 'No wilted crops',
      cost: reviveCost, disabled: wiltedCount === 0,
      action: 'farmhandDoRevive()',
    },
    {
      icon:'🤝', name:'Do everything',
      desc: (needWater||readyToHarv||wiltedCount) ? `Water + harvest + revive — 15% off` : 'Nothing to bundle right now',
      cost: doAllCost, disabled: !(needWater||readyToHarv||wiltedCount),
      action: 'farmhandDoAll()',
    },
    {
      icon:'🏪', name:'Sell my harvest at market',
      desc: cropSellValue > 0 ? `${cropItems.length} crop type${cropItems.length>1?'s':''} · est. $${cropSellValue} (−${sellFee} fee)` : 'No crops in bag to sell',
      cost: sellFee, disabled: cropSellValue === 0,
      action: 'farmhandDoSell()',
      freeAction: true, // cost is a fee deducted from proceeds, not upfront
    },
    {
      icon:'📅', name:`Hire for the week${_fhWeeksLeft>0?' (active)':''}`,
      desc: _fhWeeksLeft > 0 ? `Auto waters & harvests each dawn — ${_fhWeeksLeft}d remaining` : 'Auto waters & harvests each dawn for 7 days',
      cost: weekCost, disabled: _fhWeeksLeft > 0,
      action: 'farmhandHireWeek()',
    },
  ];

  let h = '';
  for (const job of jobs) {
    const canAfford = player.gold >= job.cost;
    const off = job.disabled || (!job.freeAction && !canAfford);
    const costLabel = job.freeAction ? `$${job.cost} fee` : `$${job.cost}`;
    h += `<div class="fh-job" style="${job.disabled?'opacity:.45':''}">
      <span style="font-size:18px">${job.icon}</span>
      <div class="fh-job-info">
        <div class="fh-job-name">${job.name}</div>
        <div class="fh-job-desc">${job.desc}</div>
      </div>
      <span class="fh-job-cost">${costLabel}</span>
      <button class="fh-hire-btn" onclick="${job.action}" ${off?'disabled':''}>HIRE</button>
    </div>`;
  }
  document.getElementById('farmhandJobs').innerHTML = h;
}