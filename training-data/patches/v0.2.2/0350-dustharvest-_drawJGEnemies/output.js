function _drawJGEnemies(cx, cy, c) {
  for (const e of enemies) {
    if (!e._isJungle) continue;
    const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
    if (sx < -48 || sx > (document.getElementById('gameCanvas')?.width || 800) / ZOOM + 48) continue;
    if (sy < -48 || sy > (document.getElementById('gameCanvas')?.height || 600) / ZOOM + 48) continue;

    const flash = e.flashTimer > 0;
    c.globalAlpha = flash ? 0.5 : 1;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(sx, sy + 10, 10, 5, 0, 0, Math.PI * 2); c.fill();

    if (e.type === 'jungleBoar') {
      const body  = flash ? '#fff' : '#704030';
      const snout = flash ? '#fff' : '#904840';
      const tusk  = flash ? '#fff' : '#e8e0c0';
      // Body
      c.fillStyle = body;
      c.fillRect(sx - 14, sy - 10, 28, 16);
      // Head
      c.fillStyle = snout;
      const dir = e.facing === 'left' ? -1 : 1;
      c.fillRect(sx + dir * 10, sy - 8, dir * 10, 10);
      // Tusk
      c.fillStyle = tusk;
      c.fillRect(sx + dir * 18, sy - 4, dir * 5, 3);
      // HP bar
      if (e.hp < e.maxHp) {
        const pct = e.hp / e.maxHp;
        c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(sx - 14, sy - 16, 28, 4);
        c.fillStyle = pct > 0.5 ? '#60e040' : pct > 0.25 ? '#e0c040' : '#e04040';
        c.fillRect(sx - 14, sy - 16, Math.round(28 * pct), 4);
      }
    }
    c.globalAlpha = 1;
  }
}