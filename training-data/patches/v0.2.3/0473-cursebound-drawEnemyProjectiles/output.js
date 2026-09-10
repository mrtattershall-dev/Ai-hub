function drawEnemyProjectiles(ctx) {
  for (const _pr of enemyProjectiles) {
    const sx = (_pr.x - Camera.x) | 0;
    const sy = (_pr.y - Camera.y) | 0;
    ctx.fillStyle = PAL.FIRE_RED;
    ctx.fillRect(sx, sy, 4, 4);
    ctx.fillStyle = PAL.PALE_GOLD;
    ctx.fillRect(sx + 1, sy + 1, 2, 2);
  }
}