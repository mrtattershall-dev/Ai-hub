function enemyTakeDamage(enemy, amount, sourceX) {
  if (enemy.state === 'hurt' || enemy.state === 'dead') return;
  enemy.hp = Math.max(0, enemy.hp - amount);
  enemy.state    = 'hurt';
  enemy.stateTimer = 0;
  enemy.hurtTimer  = 20;
  const dir  = (enemy.x + enemy.w * 0.5) > sourceX ? 1 : -1;
  enemy.vx   = dir * 2.5;
  enemy.vy   = enemy.type === 'bat' ? -1.5 : -2.0;
}