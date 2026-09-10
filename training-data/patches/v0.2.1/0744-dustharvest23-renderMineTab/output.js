function renderMineTab(body) {
  const fl = gameState.inMine ? gameState.mineFloor : -1;
  const flName = fl >= 0 ? MINE_FLOOR_CFG[fl].name : 'Surface';
  const isOpen = isMineOpen();
  const vis = getMineVisibility();

  let h = `<div style="font-size:9px;color:#6a5020;margin-bottom:10px;letter-spacing:.04em">
    ⛏ MINE STATUS &mdash;
    <span style="color:#c0a060">${flName}</span> &middot;
    ${isOpen ? '<span style="color:#80d060">OPEN</span>' : '<span style="color:#e06040">CLOSED (night)</span>'}
    ${gameState.inMine ? ` &middot; <span style="color:#90b0e8">Floor ${fl+1}/3</span>` : ''}
    ${gameState.inMine && vis < 1 ? ` &middot; <span style="color:#e0c040">👁 Visibility ${Math.round(vis*100)}%</span>` : ''}
  </div>`;

  // Active hazard warning
  if (gameState.inMine && _mineHazard) {
    h += `<div style="padding:7px 10px;background:rgba(200,60,30,.1);border:1px solid rgba(200,60,30,.4);border-radius:4px;font-size:9px;color:#e07040;margin-bottom:10px;">
      ⚠️ <b>HAZARD:</b> ${MINE_HAZARDS[_mineHazard.type]?.name||_mineHazard.type}
      &mdash; ${Math.ceil(_mineHazard.countdown)}s remaining! Move away from the ${_mineHazard.type==='cavein'?'cracked wall':'gas pocket'}.
    </div>`;
  }

  // Ore price table
  h += `<div style="font-size:9px;color:#6a5020;margin-bottom:6px;letter-spacing:.04em">ORE PRICES</div>`;
  const ores = [
    {id:'coal',      label:'F1'},
    {id:'copperOre', label:'F1'},
    {id:'ironOre',   label:'F2'},
    {id:'goldOre',   label:'F2'},
    {id:'crystal',   label:'F3'},
  ];
  for (const ore of ores) {
    const price = economy.prices[ore.id] || BASE_PRICES[ore.id] || 10;
    const base  = BASE_PRICES[ore.id] || 10;
    const held  = countItem(ore.id);
    const col   = price > base*1.15 ? '#60e060' : price < base*.85 ? '#e06060' : '#d4b870';
    const trend = price > base*1.1  ? '▲' : price < base*.9 ? '▼' : '─';
    const tCol  = price > base*1.1  ? '#60e060' : price < base*.9 ? '#e06060' : '#a09060';
    const it    = ITEMS[ore.id];
    h += `<div class="price-row">
      <span class="pr-icon">${it?.icon||'⛏'}</span>
      <span class="pr-name">${it?.name||ore.id} <span style="font-size:8px;color:#505040">[${ore.label}]</span></span>
      <span class="pr-held">${held} held</span>
      <span class="pr-price" style="color:${col}">$${price}</span>
      <span class="pr-trend" style="color:${tCol}">${trend}</span>
      ${held > 0 ? `<button class="btn-sell" onclick="sellItem('${ore.id}')">SELL ALL ($${held*price})</button>` : '<span style="width:60px"></span>'}
    </div>`;
  }

  // Smelted bars section — collapsible
  if (!window._mineCollapsed) window._mineCollapsed = {};
  const smeltCollapsed = !!window._mineCollapsed['smelt'];
  h += `<div onclick="window._mineCollapsed['smelt']=!window._mineCollapsed['smelt'];setMktTab('mine')"
    style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;
      font-size:9px;color:#e08030;margin:12px 0 4px;letter-spacing:.04em;
      padding:5px 8px;border-radius:3px;
      background:rgba(255,200,80,.04);border:1px solid rgba(200,140,40,.18);
      user-select:none;-webkit-user-select:none;">
    <span>🔥 SMELTED BARS
      ${player._mineForge ? '&mdash; <span style=\"color:#e08030\">Forge Ready</span>'
                          : '<span style=\"color:#504030\">(unlock Mine Forge upgrade)</span>'}
    </span>
    <span style="font-size:11px;color:#705030">${smeltCollapsed?'▶':'▼'}</span>
  </div>`;
  if (!smeltCollapsed) {
  for (const recipe of SMELT_RECIPES) {
    const price    = economy.prices[recipe.bar] || BASE_PRICES[recipe.bar] || 50;
    const orePrice = economy.prices[recipe.ore] || BASE_PRICES[recipe.ore] || 10;
    const held     = countItem(recipe.bar);
    const oreHeld  = countItem(recipe.ore);
    const canSmelt = oreHeld >= recipe.oreQty && player.stamina >= 5 && player._mineForge;
    h += `<div class="price-row">
      <span class="pr-icon">${recipe.icon}</span>
      <span class="pr-name">${recipe.name}</span>
      <span class="pr-held" style="color:#705030">${held} bars · ${oreHeld} ore</span>
      <span class="pr-price" style="color:#e0a030">$${price}</span>
      <span style="font-size:8px;color:#606040;flex:1">+$${price - orePrice*recipe.oreQty} vs raw</span>
      ${held > 0 ? `<button class="btn-sell" onclick="sellItem('${recipe.bar}')">SELL ($${held*price})</button>` : ''}
      ${canSmelt ? `<button class="btn-buy" onclick="smeltOre('${recipe.ore}','${recipe.bar}',${recipe.oreQty},1);setMktTab('mine')" style="margin-left:4px">SMELT</button>` : ''}
    </div>`;
  }

  } // end smelt collapsed

    // Mine upgrades quick-buy panel
  const mineUpgIds = ['mine_lantern','mine_canary','mine_hardhat','mine_cart','mine_forge','pick_diamond','geologist_eye','ore_press','deep_map'];
  const notOwned   = mineUpgIds.filter(id => !purchasedUpgrades.has(id));
  const owned      = mineUpgIds.filter(id =>  purchasedUpgrades.has(id));
  if (notOwned.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:12px 0 5px;letter-spacing:.04em">MINE UPGRADES</div>`;
    for (const id of notOwned.slice(0, 4)) {
      const upg      = UPGRADES.find(u => u.id === id);
      if (!upg) continue;
      const canAfford = player.gold >= upg.cost;
      const locked    = upg.requires && !purchasedUpgrades.has(upg.requires);
      h += `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:9px;color:${locked?'#504030':'#c0a060'};opacity:${locked ? '.45' : 1}">
        <span>${upg.icon}</span>
        <span style="flex:1">${upg.name}</span>
        <span style="font-size:8px;color:#706040">${upg.desc?.slice(0,48)||''}</span>
        <span style="color:${canAfford?'#f0d060':'#604030'};margin-left:6px">${locked?'🔒':'$'+upg.cost}</span>
        ${!locked && canAfford
          ? `<button class="btn-buy" onclick="buyUpgrade('${id}');setMktTab('mine')">BUY</button>`
          : ''}
      </div>`;
    }
  }
  if (owned.length > 0) {
    h += `<div style="font-size:8px;color:#403820;margin-top:8px;padding-top:6px;border-top:1px solid rgba(180,140,60,.1)">
      ✓ Owned: ${owned.map(id => UPGRADES.find(u=>u.id===id)?.name||id).join(' · ')}
    </div>`;
  }

  // Floor tips
  const tipIdx = gameState.inMine ? gameState.mineFloor : 0;
  const tips = [
    'Coal and copper near the entry hub. Safe for beginners — veins respawn every 3+ days.',
    'Iron and gold deeper east. Cave-ins start here. Hard Hat upgrade strongly recommended.',
    'Crystal chamber in the far SE corner. Very dark without a Lantern. Mine Cart fast-travels the floor.',
    'Floor 4: every vein branches. Dread fills even with a lantern. Pure ore concentration is highest here.',
  ];
  h += `<div style="margin-top:12px;padding:8px 10px;background:rgba(255,255,255,.02);border-radius:4px;font-size:8px;color:#605040;line-height:1.6">
    💡 <b style="color:#907050">Floor ${Math.min(tipIdx+1,4)}:</b> ${tips[Math.min(tipIdx,3)]}
  </div>`;

  // ── LAST HAUL QUALITY ──────────────────────────────────────────────
  const haul = gameState._mineLastHaul || {};
  const haulOres = Object.keys(haul).filter(k => haul[k].pure > 0 || haul[k].flawed > 0 || haul[k].standard > 0);
  if (haulOres.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:12px 0 5px;letter-spacing:.04em">LAST HAUL QUALITY</div>`;
    for (const oreId of haulOres) {
      const q = haul[oreId];
      const it = ITEMS[oreId];
      h += `<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;font-size:8px;color:#a09060;">
        <span>${it?.icon||'⛏'}</span>
        <span style="flex:1">${it?.name||oreId}</span>
        ${q.flawed  > 0 ? `<span style="color:#c07050">🔸 ${q.flawed} flawed</span>` : ''}
        ${q.standard > 0 ? `<span style="color:#909060">${q.standard} std</span>` : ''}
        ${q.pure    > 0 ? `<span style="color:#50c0b0">✨ ${q.pure} pure</span>` : ''}
      </div>`;
    }
    h += `<div style="font-size:8px;color:#504030;padding:2px 8px">Pure ore: sells at ×1.4 · Flawed: ×0.7 · Pure ore buyer contract available at Mine Rep 3.</div>`;
  }

  // ── ORE PRESS ──────────────────────────────────────────────────────
  if (player._orePress) {
    const ORE_IDS = ['coal','copperOre','ironOre','goldOre','silverOre'];
    h += `<div style="font-size:9px;color:#8070d0;margin:12px 0 5px;letter-spacing:.04em">⚙️ ORE PRESS — Convert flawed ore → standard</div>`;
    for (const oreId of ORE_IDS) {
      const it = ITEMS[oreId]; if (!it) continue;
      // Count flawed slots specifically
      let flawedCount = 0;
      const _eff = getEffectiveSlotCount();
      for (let i=0;i<_eff;i++) {
        const s = inventory.slots[i];
        if (s && s.itemId === oreId && s.quality === 'flawed') flawedCount += s.qty;
      }
      if (flawedCount < 3) continue; // need at least 3 to convert
      const batches = Math.floor(flawedCount / 3);
      h += `<div class="ore-press-row">
        <span>${it.icon}</span>
        <span style="flex:1">${it.name}</span>
        <span style="color:#c07050">🔸 ${flawedCount} flawed</span>
        <span style="color:#706040;margin-left:4px">→ up to ${batches*2} standard</span>
        <button class="btn-buy" onclick="pressOre('${oreId}',${batches});setMktTab('mine')" style="margin-left:6px;font-size:8px">PRESS ×${batches}</button>
      </div>`;
    }
    if (!ORE_IDS.some(id => {
      let c=0; const _e=getEffectiveSlotCount();
      for(let i=0;i<_e;i++){const s=inventory.slots[i];if(s&&s.itemId===id&&s.quality==='flawed')c+=s.qty;}
      return c>=3;
    })) {
      h += `<div style="font-size:8px;color:#504030;padding:3px 8px">No flawed ore batches ready (need 3+ of one type).</div>`;
    }
  }

  // ── BEESWAX CANDLE ─────────────────────────────────────────────────
  const candleCount = countItem('beeswaxCandle');
  const torchCount  = countItem('torch');
  if (gameState.inMine && gameState.mineFloor >= 1) {
    h += `<div style="font-size:9px;color:#d0a030;margin:12px 0 5px;letter-spacing:.04em">🕯️ LIGHT SOURCES</div>`;
    h += `<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:9px;color:#c0a050">
      <span>🕯️ Beeswax Candles: ${candleCount}</span>
      <span>🔦 Torches: ${torchCount}</span>
      ${gameState._candleBurnLeft > 0 ? `<span style="color:#e0d050">Burning: ${Math.ceil(gameState._candleBurnLeft)}s</span>` : ''}
      ${candleCount > 0 && !player._mineLantern ? `<button class="btn-buy" onclick="useBeeswaxCandle();setMktTab('mine')" style="font-size:8px">LIGHT CANDLE</button>` : ''}
    </div>`;
    h += `<div style="font-size:8px;color:#605040;padding:2px 8px;line-height:1.5">Craft candles: 1 herb + 1 cloth → 2 candles. Burns 90s. Slows dread meter. Lantern suppresses dread entirely.</div>`;
  }

  // ── MINE JOURNAL ───────────────────────────────────────────────────
  const journal = gameState._mineJournal || [];
  if (journal.length > 0) {
    h += `<div style="font-size:9px;color:#6a5020;margin:12px 0 5px;letter-spacing:.04em">📓 MINE JOURNAL (${journal.length} entries)</div>`;
    const recent = journal.slice(-8).reverse();
    for (const entry of recent) {
      h += `<div class="mine-journal-entry${entry.isSurveyor?' surveyor':''}">${entry.text}</div>`;
    }
    if (journal.length > 8) h += `<div style="font-size:7px;color:#504030;padding:2px 8px">${journal.length - 8} earlier entries…</div>`;
  }

  body.innerHTML = h;
}