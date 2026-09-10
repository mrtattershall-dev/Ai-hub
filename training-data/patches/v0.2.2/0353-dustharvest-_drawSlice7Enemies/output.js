function _drawSlice7Enemies(cx, cy, c) {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const W = canvas.width / ZOOM, H = canvas.height / ZOOM;

  for (const e of enemies) {
    if (!e._isJungle) continue;
    if (e.type === 'jungleBoar') continue; // handled by Slice 6

    const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
    if (sx < -JG_T * 2 || sx > W + JG_T * 2) continue;
    if (sy < -JG_T * 2 || sy > H + JG_T * 2) continue;

    const flash = e.flashTimer > 0;

    // Reset stroke state at start of each enemy
    c.lineWidth = 1;
    c.lineCap = 'butt';

    // Vine Serpent: camouflaged until close
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (e.type === 'vineSerpent' && e.def?.camouflaged && dist > 120) {
      c.globalAlpha = 0.22;
    } else {
      c.globalAlpha = flash ? 0.5 : 0.92;
    }

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(sx, sy + 10, 9, 4, 0, 0, Math.PI * 2); c.fill();

    const dir = e.facing === 'left' ? -1 : 1;
    const col = flash ? '#fff' : (e.def?.color || '#888');

    if (e.type === 'jaguar') {
      // Lean feline body
      c.fillStyle = col;
      c.beginPath(); c.ellipse(sx, sy, 14, 9, 0, 0, Math.PI * 2); c.fill();
      // Head
      c.beginPath(); c.ellipse(sx + dir * 12, sy - 3, 8, 7, 0, 0, Math.PI * 2); c.fill();
      // Spots
      if (!flash) {
        c.fillStyle = 'rgba(0,0,0,0.3)';
        for (const [dx, dy] of [[-4,-2],[3,1],[-2,4],[6,-4]]) {
          c.beginPath(); c.ellipse(sx+dx, sy+dy, 2, 2, 0, 0, Math.PI*2); c.fill();
        }
      }
    } else if (e.type === 'harpyEagle') {
      // Wings spread
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(sx - 18, sy - 4); c.lineTo(sx, sy + 8); c.lineTo(sx + 18, sy - 4);
      c.lineTo(sx + 10, sy - 12); c.lineTo(sx, sy - 6); c.lineTo(sx - 10, sy - 12);
      c.closePath(); c.fill();
      // Head
      c.fillStyle = flash ? '#fff' : '#e0e0c0';
      c.beginPath(); c.ellipse(sx, sy - 8, 6, 5, 0, 0, Math.PI * 2); c.fill();
    } else if (e.type === 'canopySpider') {
      // Body
      c.fillStyle = col;
      c.beginPath(); c.ellipse(sx, sy, 9, 8, 0, 0, Math.PI * 2); c.fill();
      // Legs (4 each side)
      c.strokeStyle = col; c.lineWidth = 1.5;
      for (let leg = 0; leg < 4; leg++) {
        const legY = sy - 4 + leg * 3;
        c.beginPath(); c.moveTo(sx - 9, legY); c.lineTo(sx - 18, legY + 4); c.stroke();
        c.beginPath(); c.moveTo(sx + 9, legY); c.lineTo(sx + 18, legY + 4); c.stroke();
      }
    } else if (e.type === 'vineSerpent') {
      // S-curve body
      c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round';
      const t = Date.now() * 0.002;
      c.beginPath();
      c.moveTo(sx - 14, sy + 4);
      c.bezierCurveTo(
        sx - 6 + Math.sin(t) * 4, sy - 6,
        sx + 6 + Math.cos(t) * 4, sy + 6,
        sx + 14, sy - 4
      );
      c.stroke();
      // Head
      c.fillStyle = flash ? '#fff' : '#60a040';
      c.beginPath(); c.ellipse(sx + dir * 14, sy - 4, 5, 4, 0, 0, Math.PI * 2); c.fill();
    } else if (e.type === 'altaverdeGuard') {
      // Humanoid silhouette — upright rectangle with helmet
      c.fillStyle = col;
      c.fillRect(sx - 7, sy - 16, 14, 22); // body
      c.fillStyle = flash ? '#fff' : '#405080';
      c.beginPath(); c.ellipse(sx, sy - 20, 7, 8, 0, 0, Math.PI * 2); c.fill(); // helmet
      // Badge
      if (!flash) {
        c.fillStyle = '#a0c0e0';
        c.fillRect(sx - 3, sy - 12, 6, 5);
      }
    }

    // HP bar for tougher enemies
    if (e.hp < e.def?.hp * 0.85) {
      const pct = Math.max(0, e.hp / (e.def?.hp || 1));
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(sx - 14, sy - 28, 28, 4);
      c.fillStyle = pct > 0.5 ? '#60e040' : pct > 0.25 ? '#e0c040' : '#e04040';
      c.fillRect(sx - 14, sy - 28, Math.round(28 * pct), 4);
    }

    c.globalAlpha = 1;
    c.lineWidth = 1;
  }
}