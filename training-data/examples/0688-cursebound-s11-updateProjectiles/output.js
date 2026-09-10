function updateProjectiles() {
  const zone = G.currentZoneId ? ZONES[G.currentZoneId] : null;
  const md   = zone ? zone.mapData : null;
  const p    = G.player;

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.life--;
    pr.x += pr.vx;
    pr.y += pr.vy;

    if (pr.type === 'axe') {
      pr.vy    += 0.22;   /* gravity on axe */
      pr.rotation = (pr.rotation || 0) + (pr.vx > 0 ? 0.2 : -0.2);
    }

    /* Remove if expired or hits solid tile */
    if (pr.life <= 0) { projectiles.splice(i, 1); continue; }
    if (md) {
      const tx = (pr.x / NES.TILE) | 0;
      const ty = (pr.y / NES.TILE) | 0;
      if (tileIsSolid(tileAt(md, tx, ty))) {
        projectiles.splice(i, 1); continue;
      }
    }

    /* Hit enemies */
    if (zone && zone.enemies) {
      for (const e of zone.enemies) {
        if (e.dead || e.state === 'hurt') continue;
        if (e.lastHitSwing === pr.swingId) continue;
        if (aabbOverlap(pr, e)) {
          e.lastHitSwing = pr.swingId;
          enemyTakeDamage(e, pr.damage, pr.x);
          projectiles.splice(i, 1); break;
        }
      }
    }

    /* Projectiles also hit The Hand */
    if (G.theHand && G.theHand.active && !G.theHand.stunTimer) {
      if (aabbOverlap(pr, G.theHand)) {
        G.theHand.stun();
        projectiles.splice(i, 1); continue;
      }
    }
  }
}