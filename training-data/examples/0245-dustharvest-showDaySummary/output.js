function showDaySummary(day) {
  writeJournalEntry();

  const goldNet = player.gold - _dayStartGold;
  _goldHistory.push(goldNet);
  if (_goldHistory.length > 7) _goldHistory.shift();

  const cropsReady   = Object.values(plots).filter(p => p.harvestReady).length;
  const cropsGrowing = Object.values(plots).filter(p => p.tilled && p.crop && !p.harvestReady).length;
  const wilted       = Object.values(plots).filter(p => p.wilted).length;
  const _todayCropDeaths = stats.cropsDiedToThirst - (_journalDaySnapshot?.cropsDiedToThirst || 0);
  const aliveAnimals = animals.filter(a => a.hp > 0);
  const productsReady = aliveAnimals.filter(a => a.productReady).length;
  const troughPct    = pens.length > 0
    ? Math.round(pens.reduce((s,p) => s+(p.troughFill||0),0)/pens.length)
    : Math.round(troughFill);
  const troughWarn   = pens.some(p => (p.troughFill||0) < 30);

  // Debt info
  const currentWeek  = Math.floor((day-1)/DEBT_WEEK_LENGTH) + 1;
  const daysUntilBill = DEBT_WEEK_LENGTH - ((day-1) % DEBT_WEEK_LENGTH);
  const nextBillAmt  = getWeeklyBillAmount(currentWeek + 1);
  const totalDebt    = getTotalDebt();
  const debtColor    = totalDebt <= 0 ? '#80d060' : player.gold >= nextBillAmt ? '#d4b060' : '#e06050';

  // Gold sparkline SVG
  const hist = _goldHistory;
  let sparkline = '';
  if (hist.length >= 2) {
    const max = Math.max(...hist.map(Math.abs), 1);
    const W = 80, H = 20, pad = 2;
    const pts = hist.map((v, i) => {
      const x = pad + (i / (hist.length-1)) * (W - pad*2);
      const y = H/2 - (v/max) * (H/2 - pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const lastPositive = hist[hist.length-1] >= 0;
    sparkline = `<svg width="${W}" height="${H}" style="overflow:visible;vertical-align:middle;">
      <line x1="${pad}" y1="${H/2}" x2="${W-pad}" y2="${H/2}" stroke="rgba(180,140,60,.2)" stroke-width="0.5"/>
      <polyline points="${pts}" fill="none" stroke="${lastPositive?'#80d060':'#e06050'}" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="${hist.map((v,i)=>pad+(i/(hist.length-1))*(W-pad*2)).pop().toFixed(1)}" cy="${(H/2-(hist[hist.length-1]/max)*(H/2-pad)).toFixed(1)}" r="2" fill="${lastPositive?'#80d060':'#e06050'}"/>
    </svg>`;
  }

  const goldNetStr = goldNet >= 0 ? `<span style="color:#80d060">+$${goldNet}</span>` : `<span style="color:#e06050">-$${Math.abs(goldNet)}</span>`;
  const row = (l,v,vc='#c8b880') => `<div class="ds-row"><span class="ds-lbl">${l}</span><span class="ds-val" style="color:${vc}">${v}</span></div>`;
  const divider = (t) => `<div style="font-size:8px;color:#6a5020;padding:4px 0 2px;letter-spacing:.06em;border-top:1px solid rgba(180,140,60,.1);margin-top:4px;">${t}</div>`;

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:1px solid rgba(180,140,60,.2);margin-bottom:6px;">
      <span style="font-size:14px;color:#d4b060;letter-spacing:.08em;">DAY ${day}</span>
      <span style="font-size:10px;color:#907050;">${getCurrentSeason()?.name||''} · Week ${currentWeek}</span>
    </div>
    ${divider('── GOLD')}
    <div class="ds-row"><span class="ds-lbl">Balance</span><span class="ds-val">$${player.gold.toLocaleString()}</span></div>
    <div class="ds-row"><span class="ds-lbl">Today</span><span class="ds-val">${goldNetStr}</span></div>
    ${hist.length >= 2 ? `<div class="ds-row"><span class="ds-lbl" style="font-size:7.5px;">7-day</span><span class="ds-val">${sparkline}</span></div>` : ''}
    ${divider('── DEBT')}
    <div class="ds-row"><span class="ds-lbl">Remaining</span><span class="ds-val" style="color:${debtColor}">${totalDebt<=0?'PAID OFF 🎉':'$'+Math.round(totalDebt).toLocaleString()}</span></div>
    ${totalDebt>0 ? `<div class="ds-row"><span class="ds-lbl">Next bill</span><span class="ds-val" style="color:${player.gold>=nextBillAmt?'#80d060':'#e06050'}">$${nextBillAmt} in ${daysUntilBill}d</span></div>` : ''}
    ${divider('── FARM')}
    ${row('Ready',''+cropsReady, cropsReady>0?'#80d060':'#c8b880')}
    ${row('Growing',''+cropsGrowing)}
    ${wilted>0?row('⚠ Wilting',''+wilted+' — water today!','#e09030'):''}
    ${_todayCropDeaths>0?row('☠ Died',''+_todayCropDeaths+' plot'+ (_todayCropDeaths>1?'s':''),'#e05030'):''}
    ${row('Carry',`${inventory.totalWeight}/${getEffectiveWeightCap()}kg`)}
  `;

  if (aliveAnimals.length > 0) {
    html += divider('── RANCH');
    html += row('Animals',''+aliveAnimals.length);
    if (productsReady>0) html += row('Products',''+productsReady,'#80d060');
    html += row('Trough'+(troughWarn?' ⚠':''),troughPct+'%',troughWarn?'#e06050':'#c8b880');
  }

  const lastEntry = stats.journalLog?.length > 0 ? stats.journalLog[stats.journalLog.length-1] : null;
  if (lastEntry) {
    html += `<div style="margin-top:8px;padding:8px 10px;background:rgba(255,255,255,.018);border-left:2px solid rgba(180,140,60,.35);">
      <div style="font-size:7.5px;color:#6a5020;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">${JOURNAL_DAYTYPE_ICONS[lastEntry.dayType]||'☀'} ${player.name||'Stranger'}'s journal — Day ${lastEntry.day}</div>
      <div style="font-size:9px;color:#b09060;line-height:1.7;font-style:italic;">${(lastEntry.entry||'').split('\n')[0]}</div>
    </div>`;
  }

  document.getElementById('daySummaryBody').innerHTML = html;
  document.getElementById('daySummary').style.display = 'block';
  daySummaryOpen = true;
  _dayStartGold = player.gold;
}