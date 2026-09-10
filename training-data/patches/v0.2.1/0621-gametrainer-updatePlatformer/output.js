function updatePlatformer(s, keys, mouse) {
  const p = s.player;
  const GRAV = 0.45, MAX_FALL = 10;
  if (keys[' ']||keys['ArrowUp']||keys['w']||keys['W']) {
    if (p.onGround) { p.vy = -9.5; p.onGround = false; }
  }
  p.vy = Math.min(p.vy + GRAV, MAX_FALL);
  p.x += p.vx; p.y += p.vy;
  p.onGround = false;
  for (let i=0; i<s.platforms.length; i++) {
    const pl = s.platforms[i];
    if (p.x+p.w > pl.x && p.x < pl.x+pl.w && p.y+p.h > pl.y && p.y+p.h < pl.y+pl.h+16 && p.vy>=0) {
      p.y = pl.y - p.h; p.vy = 0; p.onGround = true;
      s.platformsTouched.add(i);
    }
  }
  if (p.y > canvas.height) { p.y = canvas.height*0.7 - 30; p.x = 80; p.vy = 0; }
  p.x = Math.max(0, Math.min(canvas.width - p.w, p.x));
  if (keys['ArrowLeft']||keys['a']||keys['A']) p.vx = -3.5;
  else if (keys['ArrowRight']||keys['d']||keys['D']) p.vx = 3.5;
  else p.vx *= 0.7;
  if (s.platformsTouched.size === 3 && !s.won) s.won = true;
  return s;
}