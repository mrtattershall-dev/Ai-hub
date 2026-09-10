function useBLCampfire() {
  if (player.stamina < 5) { showMsg('⚠️ Too tired even to rest.'); return; }
  player.hp = Math.min(player.maxHp, player.hp + 40);
  player.stamina = Math.min(player.maxStamina, player.stamina + 50);
  player.invincibleTimer = 3.0; // brief safety window
  blShelteredUntil = Date.now() + 4000;
  spawnParticles(player.x, player.y, '#e08030', 6, '🔥');
  showMsg('🔥 Outpost campfire — rested. +40 HP, +50 stamina. Enemies can\'t attack for 3s.');
}