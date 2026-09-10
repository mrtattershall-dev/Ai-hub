function updateRanchPanel() {
  const el = document.getElementById('ranchPanelBody');
  if (!el) return;
  const alive = animals.filter(a => a.hp > 0);
  const chickens = alive.filter(a => a.type==='chicken').length;
  const sheep    = alive.filter(a => a.type==='sheep').length;
  const cows     = alive.filter(a => a.type==='cow').length;
  const pigs     = alive.filter(a => a.type==='pig').length;
  const rabbits  = alive.filter(a => a.type==='rabbit').length;
  const goats    = alive.filter(a => a.type==='goat').length;
  const horses   = alive.filter(a => a.type==='horse').length;
  const penSlots = `${pens.length}/${MAX_PENS}`;

  const readyCount = products.length;
  const happyCount = alive.filter(a => getAnimalMood(a).score === 3).length;
  const hungryCount = alive.filter(a => getAnimalMood(a).score <= 1).length;
  const moodSummary = hungryCount > 0
    ? `<span style="color:#e07040">😟 ${hungryCount} hungry</span>`
    : happyCount === alive.length && alive.length > 0
      ? `<span style="color:#80e060">😊 All happy</span>`
      : `<span style="color:#d4b870">😐 Content</span>`;

  // Per-pen trough rows
  let penRows = '';
  for (const pen of pens) {
    const penAnimals = animals.filter(a => a.penId === pen.id && a.hp > 0);
    const pct = Math.round(pen.troughFill || 0);
    const pctColor = pct < 30 ? '#e07040' : pct < 60 ? '#d4b870' : '#80e060';
    const dailyCost = penAnimals.reduce((s,a) => s + ANIMAL_DEFS[a.type].feedCost, 0);
    const daysLeft = dailyCost > 0 ? Math.floor((pen.troughFill||0) / dailyCost) : 99;
    const daysColor = daysLeft <= 1 ? '#e06040' : daysLeft <= 3 ? '#d4b040' : '#80c060';
    const icons = ANIMAL_ICONS;
    const label = `${icons[pen.type]||'🐾'} Trough`;
    penRows += `<div style="display:flex;justify-content:space-between"><span>${label}</span><span style="color:${pctColor}">${pct}% <span style="color:${daysColor}">(~${daysLeft}d)</span></span></div>`;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between"><span>Pens</span><span style="color:#d4b870">${penSlots}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Animals</span><span style="color:#d4b870">${alive.length} (🐔${chickens} 🐑${sheep} 🐄${cows} 🐷${pigs} 🐇${rabbits} 🐐${goats} 🐴${horses})</span></div>
    ${penRows}
    <div style="display:flex;justify-content:space-between"><span>Mood</span><span>${alive.length > 0 ? moodSummary : '<span style="color:#504030">—</span>'}</span></div>
    ${readyCount > 0 ? `<div style="color:#f0d060;margin-top:2px">🧺 ${readyCount} product${readyCount>1?'s':''} ready — [E] near barn</div>` : ''}
  `;
}