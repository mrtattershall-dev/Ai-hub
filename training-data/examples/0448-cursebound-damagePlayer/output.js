function damagePlayer(amount, sourceX) {
  const p = G.player;
  if (!p || p.iFrames > 0) return;
  p.hp = Math.max(0, p.hp - amount);
  Shake.trigger();   /* screen shake on every hit */
  p.iFrames = PHYS.IFRAME_DUR;
  if (sourceX !== undefined) {
    const dir = p.x + p.w * 0.5 > sourceX ? 1 : -1;
    p.vx = dir * PHYS.KB_X;
    p.vy = PHYS.KB_Y;
    p.kbTimer = PHYS.KB_FRAMES;
  }
  if (p.hp === 0) setState(STATE.DEAD);
}