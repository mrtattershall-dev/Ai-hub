function updateEnemyProjectiles() {
  const md = G.currentZoneId ? ZONES[G.currentZoneId].mapData : null;
  const p  = G.player;
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const _pr = enemyProjectiles[i];
    _pr.life--;
    _pr.x += _pr.vx;
    _pr.y += _pr.vy;
    if (_pr.life <= 0) { enemyProjectiles.splice(i, 1); continue; }
    if (md && tileIsSolid(tileAt(md, (_pr.x / NES.TILE) | 0, (_pr.y / NES.TILE) | 0))) {
      enemyProjectiles.splice(i, 1); continue;
    }
    if (p && p.hp > 0 && aabbOverlap(_pr, p)) {
      damagePlayer(1, _pr.x);
      enemyProjectiles.splice(i, 1);
    }
  }
}