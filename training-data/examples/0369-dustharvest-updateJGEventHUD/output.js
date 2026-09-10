function updateJGEventHUD() {
  const el = document.getElementById('jgEventHUD');
  if (!el) return;
  if (!gameState._jgEvent) { el.style.display = 'none'; return; }
  const ev = JG_MARKET_EVENTS.find(e => e.id === gameState._jgEvent);
  if (!ev) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.borderColor = ev.id === 'altaverde_audit' ? 'rgba(200,100,30,.5)'
    : ev.id === 'hollowed_raid' ? 'rgba(150,50,50,.5)'
    : 'rgba(80,180,80,.4)';
  el.innerHTML = `
    <div style="font-size:8px;color:#407040;letter-spacing:.07em;text-transform:uppercase;margin-bottom:2px">${ev.icon} EVENT</div>
    <div style="font-size:10px;font-weight:bold;color:#90d870;letter-spacing:.04em;line-height:1.2">${ev.name}</div>
    <div style="font-size:7.5px;color:#506040;margin-top:2px;">${gameState._jgEventDaysLeft}d remaining</div>`;
}