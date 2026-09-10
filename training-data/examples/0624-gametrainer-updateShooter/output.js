function updateShooter(s, keys, mouse) {
  const spd = 4;
  if (keys['ArrowLeft']||keys['a']||keys['A']) s.player.x -= spd;
  if (keys['ArrowRight']||keys['d']||keys['D']) s.player.x += spd;
  s.player.x = Math.max(0, Math.min(canvas.width-s.player.w, s.player.x));
  s.cooldown = Math.max(0, s.cooldown - 1);
  if ((keys[' '] || mouse.click) && s.cooldown === 0) {
    s.bullets.push({ x: s.player.x + s.player.w/2 - 3, y: s.player.y, w:6, h:12, vy:-8 });
    s.cooldown = 18;
    mouse.click = false;
  }
  for (const b of s.bullets) b.y += b.vy;
  s.bullets = s.bullets.filter(b => b.y > -20);
  for (const b of s.bullets) {
    for (const e of s.enemies) {
      if (!e.alive) continue;
      if (b.x < e.x+e.w && b.x+b.w > e.x && b.y < e.y+e.h && b.y+b.h > e.y) {
        e.alive = false; e.hit = 20; s.killed++;
        b.y = -999;
      }
    }
  }
  for (const e of s.enemies) if (e.hit > 0) e.hit--;
  if (s.killed >= 6 && !s.won) s.won = true;
  return s;
}