function showDaySummary(day) {
  // Write yesterday's journal entry before snapping today's numbers
  writeJournalEntry();

  const cropsReady = Object.values(plots).filter(p => p.harvestReady).length;
  const cropsGrowing = Object.values(plots).filter(p => p.tilled && p.crop && !p.harvestReady).length;
  const wilted = Object.values(plots).filter(p => p.wilted).length;
  const goldNet = player.gold - _dayStartGold;
  const goldStr = goldNet >= 0 ? `+$${goldNet}` : `-$${Math.abs(goldNet)}`;
  const aliveAnimals = animals.filter(a => a.hp > 0);
  const productsReady = aliveAnimals.filter(a => a.productReady).length;
  const troughPct = pens.length > 0 ? Math.round(pens.reduce((s,p) => s+(p.troughFill||0),0)/pens.length) : Math.round(troughFill);
  const troughWarn = pens.some(p => (p.troughFill||0) < 30) ? ' ⚠️' : '';
  const rows = [
    ['Day', `${day}`],
    ['Gold', `$${player.gold} (${goldStr})`],
    ['Crops ready', `${cropsReady}`],
    ['Crops growing', `${cropsGrowing}`],
    ['Wilted', `${wilted}`],
    ['Carry weight', `${inventory.totalWeight}/${getEffectiveWeightCap()}kg`],
    ['Water', `${inventory.water}/${inventory.waterCap}`],
  ];
  if (aliveAnimals.length > 0) {
    rows.push(['── Ranch ──', '']);
    rows.push(['Animals', `${aliveAnimals.length}`]);
    rows.push(['Products ready', `${productsReady}`]);
    rows.push([`Trough${troughWarn}`, `${troughPct}%`]);
  }

  // Pull the journal entry just written (for yesterday = day-1)
  const lastEntry = stats.journalLog && stats.journalLog.length > 0
    ? stats.journalLog[stats.journalLog.length - 1]
    : null;

  const body = document.getElementById('daySummaryBody');
  const statsHtml = rows.map(([l,v])=> l.startsWith('──')
    ? `<div style="font-size:8px;color:#6a5020;padding:4px 0 2px;letter-spacing:.05em">${l}</div>`
    : `<div class="ds-row"><span class="ds-lbl">${l}</span><span class="ds-val">${v}</span></div>`
  ).join('');

  const journalHtml = lastEntry ? `
    <div style="margin-top:10px;padding:9px 10px;background:rgba(255,255,255,.018);
                border-left:2px solid rgba(180,140,60,.35);border-top:1px solid rgba(180,140,60,.1);">
      <div style="font-size:7.5px;color:#6a5020;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">
        ${JOURNAL_DAYTYPE_ICONS[lastEntry.dayType] || '☀'} Elias's journal — Day ${lastEntry.day}
      </div>
      <div style="font-size:9px;color:#b09060;line-height:1.7;font-style:italic;">
        ${(lastEntry.entry || '').split('\n')[0]}
      </div>
    </div>` : '';

  body.innerHTML = statsHtml + journalHtml;
  document.getElementById('daySummary').style.display = 'block';
  daySummaryOpen = true;
  _dayStartGold = player.gold;
}