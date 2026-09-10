function updateDodger(s, keys, mouse) {
  s.timer++;
  if (s.timer % 40 === 0) {
    s.asteroids.push({ x: Math.random()*(canvas.width-40)+20, y:-20, r:12+Math.random()*16, vy: 2+s.survived*0.3, vx:(Math.random()-0.5)*2 });
  }
  if (s.timer % 60 === 0 && !s.won) s.survived++;
  const spd = 4;
  if (keys['ArrowLeft']||keys['a']||keys['A']) s.player.x -= spd;
  if (keys['ArrowRight']||keys['d']||keys['D']) s.player.x += spd;
  s.player.x = Math.max(0, Math.min(canvas.width - s.player.w, s.player.x));
  for (const a of s.asteroids) { a.x += a.vx; a.y += a.vy; }
  s.asteroids = s.asteroids.filter(a => a.y < canvas.height + 40);
  for (const a of s.asteroids) {
    const cx = s.player.x + s.player.w/2, cy = s.player.y + s.player.h/2;
    if (Math.hypot(a.x - cx, a.y - cy) < a.r + 12) {
      initGame(); notify('💥 Hit! Try again.'); return s;
    }
  }
  if (s.survived >= 10 && !s.won) s.won = true;
  return s;
}