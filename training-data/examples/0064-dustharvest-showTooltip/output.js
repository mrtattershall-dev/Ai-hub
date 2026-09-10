function showTooltip(slot, e) {
  if (!slot) return;
  const item = ITEMS[slot.itemId]; if (!item) return;
  const tt = document.getElementById('invTooltip');
  const mktPrice = economy.prices[slot.itemId];
  const QUAL_MULT = { flawed: 0.7, standard: 1.0, pure: 1.4 };
  const qm = QUAL_MULT[slot.quality || 'standard'] || 1.0;
  const adjPrice = mktPrice ? Math.round(mktPrice * qm) : null;
  document.getElementById('ttName').textContent = item.icon+' '+item.name;
  document.getElementById('ttMeta').textContent = item.type.toUpperCase()+' • '+item.weight+'kg each • qty: '+slot.qty;
  document.getElementById('ttDesc').textContent = item.desc;
  // Quality line for ores
  let qualHtml = '';
  if (slot.quality && item.type === 'ore') {
    const labels = { flawed:'Flawed (×0.7 price)', standard:'Standard', pure:'Pure (×1.4 price)' };
    qualHtml = `<div class="tt-quality ${slot.quality}">${slot.quality === 'pure' ? '★' : slot.quality === 'flawed' ? '▲' : '●'} ${labels[slot.quality]}</div>`;
  }
  const valText = adjPrice ? `Today's price: $${adjPrice}/ea (total $${adjPrice*slot.qty})${slot.quality && slot.quality !== 'standard' ? ' — quality adjusted' : ''}` : item.type==='food'?'Click to use':'';
  document.getElementById('ttVal').innerHTML = qualHtml + (valText ? `<div>${valText}</div>` : '');
  tt.style.display = 'block';
  const r = document.getElementById('invOverlay').getBoundingClientRect();
  tt.style.left = Math.min(e.clientX-r.left+12, 370)+'px';
  tt.style.top  = (e.clientY-r.top+10)+'px';
}