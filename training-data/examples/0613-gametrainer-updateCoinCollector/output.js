function updateCoinCollector(s, keys, mouse) {
  const spd = 3.5;
  if (keys['ArrowLeft']||keys['a']||keys['A']) s.player.x -= spd;
  if (keys['ArrowRight']||keys['d']||keys['D']) s.player.x += spd;
  if (keys['ArrowUp']||keys['w']||keys['W']) s.player.y -= spd;
  if (keys['ArrowDown']||keys['s']||keys['S']) s.player.y += spd;
  if (mouse.active) {
    const dx = mouse.x - s.player.x, dy = mouse.y - s.player.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) { s.player.x += dx/d*spd; s.player.y += dy/d*spd; }
  }
  s.player.x = Math.max(14, Math.min(canvas.width-14, s.player.x));
  s.player.y = Math.max(14, Math.min(canvas.height-14, s.player.y));
  for (const c of s.coins) {
    if (!c.collected && Math.hypot(s.player.x-c.x, s.player.y-c.y) < s.player.r + c.r) {
      c.collected = true; s.score++;
    }
  }
  if (s.score >= 5 && !s.won) { s.won = true; return s; }
  return s;
}