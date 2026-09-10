function applySettings() {
  const speedMap = { slow:1.5, normal:2.5, fast:5 };
  gameState.daySpeed = speedMap[settings.daySpeed] || 2.5;
  const _ctrlEl = document.getElementById('controls'); if (_ctrlEl) _ctrlEl.style.display = settings.showControls ? 'flex' : 'none';
  const _wbEl = document.getElementById('weightBar'); if (_wbEl) _wbEl.style.display = settings.showWeight ? 'flex' : 'none';
  _soundVol = (settings.masterVol || 80) / 100;
  // Text size -- drives ALL text in the game
  const sizeMap = { small:'11px', normal:'13px', large:'16px' };
  const baseSize = sizeMap[settings.textSize] || '13px';
  document.documentElement.style.setProperty('--ui-font-size', baseSize);
  // Scale factor used by JS-rendered panels for their inline px sizes
  const scaleMap = { small: 0.85, normal: 1.0, large: 1.23 };
  window._uiScale = scaleMap[settings.textSize] || 1.0;
  document.documentElement.style.setProperty('--ui-scale', window._uiScale);
  // Set font-size on body so every element inherits the scaled base.
  document.body.style.fontSize = baseSize;
  // Also set explicitly on every overlay so dynamically-injected innerHTML
  // (which uses inline px) picks up the right scale via em/% inheritance.
  [
    '#marketOverlay','#invOverlay','#settingsOverlay','#encounterPanel',
    '#debtClock','#farmPanel','#chestOverlay','#farmhandOverlay','#pauseOverlay',
    '#daySummary','#msgBanner','#seasonTag','#gatherPrompt',
    '#topBar','#hotbar','#weightBar','#controls','#hud',
    '#statsOverlay','#npcTalkOverlay','#hcTalkOverlay','#minerOverlay',
    '#smeltOverlay','#blBountyOverlay','#blVendorOverlay','#blHeatHUD',
    '#controlsOverlay','#controlsBox','#deathScreen','#titleScreen',
    '#confirmModal','#mineHUD','#enemyHud','#interactPrompt','#saveNotif',
    '#endingContent',
  ].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.fontSize = baseSize;
  });
}