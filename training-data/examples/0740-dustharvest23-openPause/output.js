function openPause() {
  pauseOpen = true;
  document.getElementById('pauseOverlay').classList.add('open');
  // Populate stats
  const el = document.getElementById('pauseStats');
  if (el) {
    const h = Math.floor(gameState.timeOfDay / 60);
    const m = Math.floor(gameState.timeOfDay % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const timeStr = `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
    const cropsGrowing = Object.values(plots).filter(p => p.crop && !p.harvestReady).length;
    const cropsReady   = Object.values(plots).filter(p => p.harvestReady).length;
    const aliveAnimals = animals.filter(a => a.hp > 0).length;
    el.innerHTML = `
      <div>📅 Day <b style="color:#d4b870">${gameState.day}</b> &nbsp;·&nbsp; 🕐 <b style="color:#d4b870">${timeStr}</b> &nbsp;·&nbsp; ${gameState.isNight?'🌙 Night':'☀ Day'}</div>
      <div>💰 Gold: <b style="color:#f0d060">$${player.gold}</b> &nbsp;·&nbsp; ❤ HP: <b style="color:#e06060">${player.hp}/${player.maxHp}</b> &nbsp;·&nbsp; 🍽 Hunger: <b style="color:${player.hunger<20?'#e06050':player.hunger<40?'#d09020':'#80c060'}">${Math.round(player.hunger||0)}/100</b></div>
      <div>🌱 Growing: <b style="color:#80c060">${cropsGrowing}</b> &nbsp;·&nbsp; 🌾 Ready: <b style="color:#f0d060">${cropsReady}</b> &nbsp;·&nbsp; 🐾 Animals: <b style="color:#d4b870">${aliveAnimals}</b></div>
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(180,140,60,.1)">👢 Boots fished out of the river: <b style="color:#a08050">${stats.junkBootsFished||0}</b></div>
      <div style="color:#504030;margin-top:4px">Season: ${gameState.season} &nbsp;·&nbsp; Kills: ${stats.totalKills||0}</div>
    `;
  }
}