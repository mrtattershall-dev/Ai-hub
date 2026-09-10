function createEnemy(type, tx, ty) {
  const cfg  = ENEMY_CFG[type];
  const wx   = tx * NES.TILE;
  const wy   = cfg.gravity ? ty * NES.TILE - cfg.h : ty * NES.TILE;
  const e = {
    type, x: wx, y: wy, w: cfg.w, h: cfg.h,
    vx: 0, vy: 0, facing: 1,
    hp: cfg.hp, maxHp: cfg.hp,
    state: 'patrol', stateTimer: 0,
    hurtTimer: 0, dead: false,
    animFrame: 0, animTimer: 0,
    lastHitSwing: -1,
  };
  if (type === 'bat') {
    e.baseX     = wx;
    e.baseY     = wy;
    e.animPhase = (tx * 0.37 + ty * 0.19) % (Math.PI * 2);
  }
  return e;
}