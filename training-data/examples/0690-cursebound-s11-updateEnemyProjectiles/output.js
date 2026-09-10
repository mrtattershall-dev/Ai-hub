function updateEnemyProjectiles() {
  const md = G.currentZoneId ? ZONES[G.currentZoneId].mapData : null;
  const p  = G.player;
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const pr = enemyProjectiles[i];
    pr.life--;
    pr.x += pr.vx;
    pr.y += pr.vy;
    if (pr.life <= 0) { enemyProjectiles.splice(i, 1); continue; }
    if (md && tileIsSolid(tileAt(md, (pr.x / NES.TILE) | 0, (pr.y / NES.TILE) | 0))) {
      enemyProjectiles.splice(i, 1); continue;
    }
    if (p && p.hp > 0 && aabbOverlap(pr, p)) {
      damagePlayer(1, pr.x);
      enemyProjectiles.splice(i, 1);
    }
  }
}