function refreshInvUI() {
  const grid = document.getElementById('invGrid');
  const effSlots = getEffectiveSlotCount();
  const scLbl = document.querySelector('#invOverlay .inv-section-title');
  if (scLbl) scLbl.textContent = `📦 Carried Items (${effSlots} slots)`;

  // Rebuild DOM only when slot count changes
  if (grid.children.length !== effSlots) {
    grid.innerHTML = '';
    for (let i = 0; i < effSlots; i++) {
      const cell = document.createElement('div');
      cell.dataset.slot = i;
      cell.addEventListener('mouseenter', e => {
        const idx = +e.currentTarget.dataset.slot;
        showTooltip(inventory.slots[idx], e);
      });
      cell.addEventListener('mouseleave', hideTooltip);
      cell.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.slot;
        const slot = inventory.slots[idx];
        if (!slot) return;
        const item = ITEMS[slot.itemId];
        const edible = item && (item.type==='food' || HUNGER_RESTORE[slot.itemId] > 0);
        if (edible) { useConsumable(slot.itemId); refreshInvUI(); }
      });
      grid.appendChild(cell);
    }
  }

  // Update content in-place
  for (let i = 0; i < effSlots; i++) {
    const cell = grid.children[i];
    const slot = inventory.slots[i];
    cell.className = 'inv-cell' + (slot ? ' filled' : '');
    if (slot) {
      const qualBadge = (slot.quality && slot.quality !== 'standard')
        ? `<span class="cqual ${slot.quality}">${slot.quality === 'pure' ? '★' : '▲'}</span>` : '';
      cell.innerHTML = `${qualBadge}<span class="ci">${(ITEMS[slot.itemId] && ITEMS[slot.itemId].icon)||'?'}</span>`
        + `<span class="cn">${((ITEMS[slot.itemId] && ITEMS[slot.itemId].name)||''). split(' ')[0]}</span>`
        + `<span class="cq">${slot.qty}</span>`;
    } else {
      cell.innerHTML = '';
    }
  }

  const sg = document.getElementById('seedGrid');
  sg.innerHTML = '';
  const seedDisplay = [
    ['carrotSeed','🪵','Carrot'],['cornSeed','🌰','Corn'],['pumpkinSeed','🟠','Pumpkin'],['glowrootSeed','🔮','Glowroot'],
    ['tomatoSeed','🔴','Tomato'],['dustwheatSeed','🟡','Dustwheat'],['sunblossomSeed','🌼','Sunblossom'],
    ['garlicSeed','🧄','Garlic'],['strawberrySeed','🍓','Strawberry'],['onionSeed','🧅','Onion'],
    ['watermelonSeed','🍉','Watermelon'],['rosehipSeed','🌹','Rosehip'],['moonshroomSeed','🍄','Moonshroom'],
  ];
  for (const [sid, ic, nm] of seedDisplay) {
    const qty = inventory.seeds[sid] || 0;
    const cell = document.createElement('div');
    cell.className = 'inv-cell' + (qty>0?' filled':'');
    cell.innerHTML = `<span class="ci">${ic}</span><span class="cn">${nm}</span><span class="cq">${qty}</span>`;
    sg.appendChild(cell);
  }
  document.getElementById('invWeightLabel').textContent = `${inventory.totalWeight}/${getEffectiveWeightCap()} kg · ${effSlots} slots`;
  document.getElementById('invGoldLabel').textContent   = '$'+player.gold;
  document.getElementById('wcLeft').textContent = inventory.water+' left';
  document.getElementById('wtVal').textContent  = inventory.water;
  document.getElementById('wtBar').style.width  = (inventory.water/inventory.waterCap*100)+'%';
  updateFarmPanelPrices();
}