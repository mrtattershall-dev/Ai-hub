function tickHunger(dt) {
  // Drain rate: 4 hunger per in-game hour. 1 real second = gameState.daySpeed in-game minutes.
  // daySpeed is in-game minutes per real second (slow=1.5, normal=2.5, fast=5).
  const inGameMinutesPerSec = gameState.daySpeed || 2.5;
  const seasonHungerMult = getCurrentSeason ? (getCurrentSeason().hungerMult || 1.0) : 1.0;
  const hungerPerSec = (4 / 60) * inGameMinutesPerSec * seasonHungerMult;
  player.hunger = Math.max(0, player.hunger - hungerPerSec * dt);

  // Warn transitions (once each, reset at dawn via onNewDay)
  if (player.hunger < 40 && player.hunger >= 20 && !_hungerWarnedHungry) {
    _hungerWarnedHungry = true;
    showMsg('🍽 Getting hungry — eat something to keep your stamina up.');
  }
  if (player.hunger < 20 && !_hungerWarnedStarving) {
    _hungerWarnedStarving = true;
    showMsg('⚠️ Starving — stamina crippled, health draining. Eat now!');
  }

  // Hunger → HP drain when starving
  if (player.hunger <= 0) {
    player.hp = Math.max(1, player.hp - 2 * dt);
  } else if (player.hunger < 20) {
    player.hp = Math.max(1, player.hp - 1 * dt);
  }

  // Update HUD bar color based on level
  const hBar = document.getElementById('hungerBar');
  const hVal = document.getElementById('hungerVal');
  if (hBar) {
    const pct = Math.round(player.hunger);
    hBar.style.width = pct + '%';
    hBar.style.background = pct > 60 ? '#c08030' : pct > 20 ? '#d06020' : '#c02020';
  }
  if (hVal) hVal.textContent = Math.round(player.hunger);
}