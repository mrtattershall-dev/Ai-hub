function _tickHollowedPresence(dt) {
  if (!gameState.inJungle) return;
  if (!gameState.isNight) return;
  if (getHollowedState() === 'allied') return;

  const pty = Math.floor(player.y / JG_T);
  if (pty < JG_ENTRY_DEEP) return;

  _hollowedPresenceTimer -= dt;
  if (_hollowedPresenceTimer > 0) return;
  _hollowedPresenceTimer = 8 + Math.random() * 12; // every 8-20s

  // Flash a shadow figure briefly
  const angle = Math.random() * Math.PI * 2;
  const dist  = 96 + Math.random() * 64;
  _hollowedPresenceX = player.x + Math.cos(angle) * dist;
  _hollowedPresenceY = player.y + Math.sin(angle) * dist;
  _hollowedPresenceActive = true;
  setTimeout(() => { _hollowedPresenceActive = false; }, 1200);
}