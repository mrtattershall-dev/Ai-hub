function updateEnemies() {
  const zone = ZONES[G.currentZoneId];
  if (!zone || !zone.enemies || zone.enemies.length === 0) return;
  const md      = zone.mapData;
  const p       = G.player;
  const hitbox  = getAttackHitbox(p);
  const wdef    = p ? getWeaponDef(p) : null;

  for (let i = zone.enemies.length - 1; i >= 0; i--) {
    const e = zone.enemies[i];

    /* Decrement visual hurt flash independently of AI state */
    if (e.hurtTimer > 0) e.hurtTimer--;

    /* Type-specific AI update */
    if (e.type === 'bat') {
      updateEnemyBat(e, p);
    } else {
      if (md) updateEnemyGround(e, md, p);
    }

    /* Remove fully dead enemies */
    if (e.dead) { zone.enemies.splice(i, 1); continue; }

    /* Skip interactions during hurt/dead states */
    if (e.state === 'dead' || e.state === 'hurt') continue;

    /* Player attack hitbox → enemy damage */
    if (hitbox && wdef && p && e.lastHitSwing !== p.swingId) {
      if (aabbOverlap(hitbox, e)) {
        e.lastHitSwing = p.swingId;
        enemyTakeDamage(e, wdef.damage, p.x + (p.facing === 1 ? p.w : 0));
      }
    }

    /* Enemy body contact → player damage */
    if (p && p.hp > 0 && aabbOverlap(e, p)) {
      damagePlayer(ENEMY_CFG[e.type].contactDamage, e.x + e.w * 0.5);
    }
  }
}