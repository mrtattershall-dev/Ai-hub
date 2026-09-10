function triggerDeath() {
  stats.timesDied++;
  // Drop all carried items except tools (hoe, waterCan, scythe are permanent equipment)
  for (let i = 0; i < getEffectiveSlotCount(); i++) {
    const s = inventory.slots[i];
    if (s && ITEMS[s.itemId] && ITEMS[s.itemId].type === 'tool') continue;
    inventory.slots[i] = null;
  }
  enemies.length = 0;

  // Close every open overlay so update() isn't blocked after respawn
  if (marketOpen)  closeMarket();
  if (invOpen)     { invOpen = false; document.getElementById('invOverlay').style.display = 'none'; }
  if (pauseOpen)   closePause();
  if (settingsOpen) closeSettings();
  if (daySummaryOpen) closeDaySummary();
  if (chestOpen)   closeChest();
  if (farmhandOpen) closeFarmhand();
  if (npcTalkOpen)  closeNpcTalk();
  cancelAction(''); // cancel any pending timed action
  minimapVisible = false;
  document.getElementById('minimap').style.display = 'none';
  // Clear visual flash states
  document.getElementById('staminaFlash').classList.remove('warn');
  document.getElementById('dangerBorder').classList.remove('pulse');

  deathScreenOpen = true;
  document.getElementById('deathMsg').textContent = `${player.name||'Stranger'} went down on Day ${gameState.day}. Carried goods lost — seeds and gold remain.`;
  const ds = document.getElementById('deathScreen');
  ds.style.display = '';
  ds.classList.remove('hide');
  ds.classList.add('show');
}