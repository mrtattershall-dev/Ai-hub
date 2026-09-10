function renderJournalTab() {
  const log = stats.journalLog || [];
  if (log.length === 0) {
    return `<div style="padding:24px 0;text-align:center;font-size:9px;color:#504020;line-height:1.9;font-style:italic">
      No entries yet.<br>
      <span style="font-size:8px;color:#3a2a10">The journal writes itself at each new dawn.</span>
    </div>`;
  }

  // Show most recent first
  const entries = [...log].reverse();

  return entries.map(e => {
    const icon = JOURNAL_DAYTYPE_ICONS[e.dayType] || '☀';
    const goldColor = e.goldDelta >= 0 ? '#80d040' : '#e07050';
    const goldStr = e.goldDelta >= 0 ? `+$${e.goldDelta.toLocaleString()}` : `-$${Math.abs(e.goldDelta).toLocaleString()}`;
    const snap = e.snapshot || {};

    // Activity chips
    const chips = [];
    if (snap.cropsHarvested > 0) chips.push(`🌾 ${snap.cropsHarvested} harvested`);
    if (snap.planted > 0)        chips.push(`🌱 ${snap.planted} planted`);
    if (snap.oreMined > 0)       chips.push(`⛏ ${snap.oreMined} ore`);
    if (snap.fishCaught > 0)     chips.push(`🎣 ${snap.fishCaught} fish`);
    if (snap.kills > 0)          chips.push(`⚔ ${snap.kills} kills`);
    if (snap.crafted > 0)        chips.push(`⚒ ${snap.crafted} crafted`);
    if (snap.woodChopped > 0)    chips.push(`🪵 ${snap.woodChopped} wood`);
    if (snap.stoneGathered > 0)  chips.push(`🪨 ${snap.stoneGathered} stone`);
    if (snap.debtPaid > 0)       chips.push(`🏦 $${snap.debtPaid.toLocaleString()} to bank`);

    const chipHtml = chips.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;">${
          chips.map(c => `<span style="font-size:8px;background:rgba(255,255,255,.03);border:1px solid rgba(180,140,60,.15);padding:2px 6px;color:#907050;">${c}</span>`).join('')
        }</div>`
      : '';

    const entryLines = (e.entry || '').split('\n').map(line =>
      `<div style="margin-bottom:3px">${line}</div>`
    ).join('');

    const debtLine = e.totalDebt > 0
      ? `<span style="color:#c06030">$${e.totalDebt.toLocaleString()} owed</span>`
      : `<span style="color:#60d040">DEBT CLEAR</span>`;

    return `
      <div style="margin-bottom:14px;padding:11px 13px;background:rgba(255,255,255,.016);
                  border:1px solid rgba(180,140,60,.14);border-left:3px solid rgba(180,140,60,.4);
                  border-radius:0;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;">
          <div style="display:flex;align-items:center;gap:7px;">
            <span style="font-size:15px">${icon}</span>
            <span style="font-size:11px;color:#d4b870;font-family:'Rye','Special Elite',serif;letter-spacing:.05em;">Day ${e.day}</span>
            <span style="font-size:8px;color:#6a5020;letter-spacing:.04em;text-transform:uppercase">Wk ${e.weekNumber} · ${e.season || ''}</span>
          </div>
          <div style="text-align:right;font-size:9px;">
            <span style="color:#d4b870">$${(e.gold || 0).toLocaleString()}</span>
            <span style="color:${goldColor};margin-left:5px">${goldStr}</span>
          </div>
        </div>
        <div style="font-size:9.5px;color:#c8b080;line-height:1.75;font-style:italic;
                    border-left:2px solid rgba(180,140,60,.18);padding-left:8px;margin-bottom:4px;">
          ${entryLines}
        </div>
        <div style="font-size:8px;color:#504028;margin-top:5px">${debtLine}</div>
        ${chipHtml}
      </div>`;
  }).join('');
}