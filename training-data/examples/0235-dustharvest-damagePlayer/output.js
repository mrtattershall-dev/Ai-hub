function damagePlayer(amount, source) {
  if (deathScreenOpen) return;
  if (player.invincibleTimer > 0) return;
  const reduced = Math.round(amount * (1 - (player._armor || 0)));
  player.hp = Math.max(0, player.hp - reduced);
  player.invincibleTimer = 0.9;
  spawnParticles(player.x, player.y, '#e03020', 5, '-'+reduced);
  dSound('hurt');
  // Flash danger border
  const db = document.getElementById('dangerBorder');
  db.classList.add('pulse');
  setTimeout(() => db.classList.remove('pulse'), 300);

  if (player.hp <= 0) triggerDeath();
}