function updateEnemyPendulum(e, player) {
  /* Immune to hurt/dead states — environmental hazard, not an enemy */
  e.state = 'swing';
  e.hp    = 999;   /* re-enforce unkillable each frame */
  /* Swing */
  e.angle = (e.angle + e.angularVel) % (Math.PI * 2);
  /* Clamp to ±70° arc — realistic pendulum, not full rotation */
  const MAX_ANG = Math.PI * 0.38;
  if (Math.abs(e.angle) > MAX_ANG) {
    e.angularVel *= -0.98;   /* dampen slightly on reversal */
    e.angle = Math.sign(e.angle) * MAX_ANG;
  }
  /* Update bob position */
  e.x = e.anchorX + Math.sin(e.angle) * e.armLen - e.w * 0.5;
  e.y = e.anchorY + Math.cos(e.angle) * e.armLen;
  /* Contact — no aabbOverlap skip needed, handled in update dispatch */
}