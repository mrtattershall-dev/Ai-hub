function updateHUD() {
  const h=Math.floor(gameState.timeOfDay/60), m=Math.floor(gameState.timeOfDay%60);
  const hh=h%12||12, mm=String(m).padStart(2,'0'), ampm=h>=12?'PM':'AM';
  const ic = gameState.isNight?'🌙':h>=17?'🌅':h>=6?'☀':'🌄';
  const td = document.getElementById('timeDisp');
  td.textContent = `${ic} Day ${gameState.day} — ${hh}:${mm} ${ampm}`;
  // Color shift with time — warm gold at day, cool blue-grey at night
  const h24=gameState.timeOfDay/60;
  const isNightTime = h24>=20||h24<6;
  td.style.color = isNightTime ? '#7898c0' : h24>=17||h24<7 ? '#c8a060' : 'var(--tallow)';
  td.style.borderColor = isNightTime ? 'rgba(60,80,140,.35)' : '';

  document.getElementById('hpBar').style.width    = (player.hp/player.maxHp*100)+'%';
  document.getElementById('stBar').style.width    = (player.stamina/player.maxStamina*100)+'%';
  document.getElementById('hpVal').textContent    = Math.floor(player.hp);
  document.getElementById('stVal').textContent    = Math.floor(player.stamina);
  document.getElementById('goldDisp').textContent = '💰 $'+player.gold.toLocaleString();
  refreshDebtHUD();

  // Water bar
  const wtPct = inventory.waterCap > 0 ? inventory.water/inventory.waterCap : 0;
  document.getElementById('wtBar').style.width = (wtPct*100)+'%';
  document.getElementById('wtVal').textContent = inventory.water;

  if (gameState.inBadlands) {
    const px = Math.floor(player.x/T);
    const DEEP_X=25, MID_X=55;
    let tierLabel, tierColor, tierBorder;
    if (px < DEEP_X) {
      tierLabel='☠ DEEP BADLANDS'; tierColor='#e04030'; tierBorder='rgba(220,40,20,.6)';
    } else if (px < MID_X) {
      tierLabel='⚠ MIDLANDS'; tierColor='#e09030'; tierBorder='rgba(220,140,20,.5)';
    } else {
      tierLabel='🏜 BADLANDS ENTRY'; tierColor='#c0a050'; tierBorder='rgba(180,140,60,.35)';
    }
    const zd = document.getElementById('zoneDisp');
    zd.textContent = tierLabel; zd.style.color = tierColor; zd.style.borderColor = tierBorder;
  } else if (gameState.inHoboCamp) {
    const zd = document.getElementById('zoneDisp');
    zd.textContent = '🏕 Hobo Camp'; zd.style.color = '#a8c85c'; zd.style.borderColor = 'rgba(140,180,60,.35)';
  } else if (gameState.inOcean) {
    const zd = document.getElementById('zoneDisp');
    zd.textContent = '⚓ The Dock'; zd.style.color = '#4899d8'; zd.style.borderColor = 'rgba(60,130,210,.35)';
  } else {
    const zd = document.getElementById('zoneDisp');
    zd.textContent = '📍 '+gameState.zone; zd.style.color = ''; zd.style.borderColor = '';
  }
  updateMineHUD();
  const pd = document.getElementById('pistolDisp');
  if (player._hasPistol) {
    pd.style.display='block';
    pd.textContent = player._pistolMode ? '🔫 RANGED [Q]' : '🔪 MELEE [Q]';
    pd.style.borderColor = player._pistolMode ? 'rgba(255,140,40,.6)':'rgba(180,140,60,.3)';
    pd.style.color = player._pistolMode ? '#ff9040':'#a09060';
  } else { pd.style.display='none'; }

  const _curSeason = getCurrentSeason();
  const _hungerIcon = _curSeason.hungerMult >= 1.6 ? '🍽🍽' : _curSeason.hungerMult >= 1.2 ? '🍽' : _curSeason.hungerMult <= 0.85 ? '✓' : '';
  const _hungerNote = _curSeason.hungerMult >= 1.6 ? ' · hunger ×'+_curSeason.hungerMult.toFixed(1) : _curSeason.hungerMult <= 0.85 ? ' · hunger easy' : '';
  document.getElementById('seasonTag').textContent = _curSeason.icon+' '+_curSeason.name+' — Day '+gameState.day+_hungerNote;
  document.getElementById('seasonTag').style.color = _curSeason.color;

  // Harvest cooldown pill
  const hcd = document.getElementById('harvestCdDisp');
  if (player.tool === 'harvest') {
    hcd.style.display = 'block';
    const frac = player._harvestCooldownMax > 0
      ? Math.max(0, 1 - player._harvestCooldownTimer / player._harvestCooldownMax) : 1;
    const ready = player._harvestCooldownTimer <= 0;
    document.getElementById('harvestCdBar').style.width = (frac*100)+'%';
    document.getElementById('harvestCdBar').style.background = ready ? '#60d040' : '#d4b870';
    document.getElementById('harvestCdLabel').textContent = ready ? 'RDY' : player._harvestCooldownTimer.toFixed(1)+'s';
    document.getElementById('harvestCdLabel').style.color = ready ? '#80e060' : '#d4b870';
  } else {
    hcd.style.display = 'none';
  }

  // Night overlay — radial vignette, blended with seasonal sky tint
  const na = (()=>{
    if(h24>=20) return Math.min(.72,(h24-20)/2*.72);
    if(h24<6)   return .72-Math.min(.72,(h24/6)*.72);
    return 0;
  })();
  const season = getCurrentSeason ? getCurrentSeason() : null;
  const skyTint = season ? season.skyTint : null;
  if (na > 0 || skyTint) {
    const nightGrad = na > 0
      ? `radial-gradient(ellipse at 50% 42%, rgba(0,4,20,${na*.3}) 0%, rgba(0,0,28,${na*.7}) 55%, rgba(0,0,18,${na}) 100%)`
      : 'none';
    document.getElementById('nightOverlay').style.background = nightGrad;
    // Seasonal sky overlay — separate element or fallback to stacking on seasonTag color
    const skyEl = document.getElementById('seasonalSkyOverlay');
    if (skyEl) {
      skyEl.style.background = (skyTint && na <= 0) ? skyTint : 'none';
    }
  } else {
    document.getElementById('nightOverlay').style.background = 'none';
    const skyEl = document.getElementById('seasonalSkyOverlay');
    if (skyEl) skyEl.style.background = 'none';
  }

  const wp = Math.min(100, inventory.totalWeight/getEffectiveWeightCap()*100);
  document.getElementById('weightFill').style.width      = wp+'%';
  document.getElementById('weightFill').style.background = wp>80?'#e05030':wp>50?'#d0a030':'#d4b870';
  document.getElementById('weightLabel').textContent     = `${inventory.totalWeight}/${getEffectiveWeightCap()}kg`;
}