function refreshMarketUI() {
  document.getElementById('mktDay').textContent = gameState.day;
  const ev = economy.event;
  const eb = document.getElementById('eventBanner');
  if (ev) { eb.className='show'; eb.innerHTML=`📢 <b>${ev.name}</b> — ${ev.desc} <span style="color:#c07030">(${economy.evDaysLeft} day${economy.evDaysLeft!==1?'s':''} left)</span>`; }
  else eb.className = '';
  const body = document.getElementById('mktBody');
  if (mktTab==='buysell')        renderBuySell(body);
  else if (mktTab==='upgrades')  renderUpgrades(body);
  else if (mktTab==='contracts') renderContracts(body);
  else if (mktTab==='quests')    renderQuests(body);
  else if (mktTab==='livestock') renderLivestock(body);
  else if (mktTab==='mine')      renderMineTab(body);
  else if (mktTab==='bank')      renderBank(body);
  else if (mktTab==='crafting')  renderCrafting(body);
  else renderHistory(body);
}