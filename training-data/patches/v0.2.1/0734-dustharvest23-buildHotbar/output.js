function buildHotbar() {
  const bar = document.getElementById('hotbar');
  bar.innerHTML = '';
  let idx = 0;
  const slots = [];

  // 1. Tools you own
  for (const toolId of TOOL_ORDER) {
    if (countItem(toolId) > 0) {
      slots.push({ icon:ITEMS[toolId].icon, name:ITEMS[toolId].name.replace(' Can','').replace('Harvest ',''), qty:null, active: player.tool===TOOL_ACTION[toolId], action:()=>{ selectTool(TOOL_ACTION[toolId]); } });
    }
  }

  // 1b. Sprinklers in inventory (placeable)
  const sprinklerHeld = countItem('sprinkler');
  if (sprinklerHeld > 0) {
    slots.push({ icon:'🚿', name:'Sprinkler', qty:sprinklerHeld, active: player.tool==='sprinkler', action:()=>{ selectTool('sprinkler'); } });
  }

  // 2. Seeds you own (from seed pouch)
  for (const crop of SEED_CROPS) {
    const qty = inventory.seeds[SEED_MAP[crop]] || 0;
    if (qty > 0) {
      slots.push({ icon:ITEMS[crop].icon, name:ITEMS[crop].name, qty, active: player.tool==='plant'&&player.selectedSeed===crop, action:()=>{ selectSeed(crop); } });
    }
  }

  // 3. Harvested crops/resources
  for (const id of SELL_ITEMS) {
    const qty = countItem(id);
    if (qty > 0) {
      slots.push({ icon:ITEMS[id].icon, name:ITEMS[id].name, qty, active:false, action:()=>{ openMarket(); setMktTab('buysell'); } });
    }
  }

  // 4. Food/consumables
  for (const id of FOOD_ITEMS) {
    const qty = countItem(id);
    if (qty > 0) {
      slots.push({ icon:ITEMS[id].icon, name:ITEMS[id].name, qty, active:false, action:()=>{ useConsumable(id); } });
    }
  }

  if (slots.length === 0) {
    bar.innerHTML = '<div id="hotbar-empty">Open market [M] to buy seeds and fill hotbar</div>';
    return;
  }

  slots.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'hb-slot' + (s.active ? ' active' : '');
    d.innerHTML = `<span class="hb-key">${i+1}</span><span class="hb-icon">${s.icon}</span><span class="hb-name">${s.name}</span>${s.qty!==null?`<span class="hb-qty">${s.qty}</span>`:''}`;
    d.onclick = s.action;
    bar.appendChild(d);
  });
}