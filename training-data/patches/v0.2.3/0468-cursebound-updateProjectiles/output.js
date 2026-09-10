function updateProjectiles() {
  const zone = G.currentZoneId ? ZONES[G.currentZoneId] : null;
  const md   = zone ? zone.mapData : null;
  const p    = G.player;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const _pr = projectiles[i];
    _pr.life--;
    _pr.x += _pr.vx;
    _pr.y += _pr.vy;

    if (_pr.gravity || _pr.type === 'axe') {
      _pr.vy    += 0.22;   /* gravity on axe or arc projectile */
      _pr.rotation = (_pr.rotation || 0) + (_pr.vx > 0 ? 0.2 : -0.2);
    }

    /* Remove if expired or hits solid tile */
    if (_pr.life <= 0) { projectiles.splice(i, 1); continue; }
    if (md) {
      const tx = (_pr.x / NES.TILE) | 0;
      const ty = (_pr.y / NES.TILE) | 0;
      if (tileIsSolid(tileAt(md, tx, ty))) {
        projectiles.splice(i, 1); continue;
      }
    }

    /* Hit enemies */
    if (zone && zone.enemies) {
      for (const e of zone.enemies) {
        if (e.dead || e.state === 'hurt') continue;
        if (e.lastHitSwing === _pr.swingId) continue;
        if (aabbOverlap(_pr, e)) {
          e.lastHitSwing = _pr.swingId;
          enemyTakeDamage(e, _pr.damage, _pr.x);
          projectiles.splice(i, 1); break;
        }
      }
    }

    /* Projectiles also hit The Hand */
    if (G.theHand && G.theHand.active && !G.theHand.stunTimer) {
      if (aabbOverlap(_pr, G.theHand)) {
        G.theHand.stun();
        projectiles.splice(i, 1); continue;
      }
    }
  }
}