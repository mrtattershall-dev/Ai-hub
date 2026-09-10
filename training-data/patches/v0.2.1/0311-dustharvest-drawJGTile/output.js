function drawJGTile(t, sx, sy) {
  const ctx = window.ctx || document.getElementById('gameCanvas').getContext('2d');
  switch (t) {
    case JG.WATER_DEEP: ctx.fillStyle = '#0e2c1c'; break;
    case JG.WATER:      ctx.fillStyle = '#183828'; break;
    case JG.SAND:       ctx.fillStyle = '#b09870'; break;
    case JG.DOCK:       ctx.fillStyle = '#6a5030'; break;
    case JG.PLANK:      ctx.fillStyle = '#7a6040'; break;
    case JG.GRASS:      ctx.fillStyle = '#2a5020'; break;
    case JG.JUNGLE_FLOOR:ctx.fillStyle= '#1e3c18'; break;
    case JG.MUD:        ctx.fillStyle = '#3c2c1a'; break;
    case JG.DIRT:       ctx.fillStyle = '#4a3420'; break;
    case JG.TREE:       ctx.fillStyle = '#183c10'; break;
    case JG.DENSE_TREE: ctx.fillStyle = '#0e2808'; break;
    case JG.ROCK:       ctx.fillStyle = '#3c3830'; break;
    case JG.WALL:       ctx.fillStyle = '#2c2820'; break;
    case JG.FLOOR:      ctx.fillStyle = '#3a3028'; break;
    case JG.ROAD:       ctx.fillStyle = '#5a4a38'; break;
    case JG.CAMPFIRE:   ctx.fillStyle = '#c06020'; break;
    case JG.FARM_PLOT:  ctx.fillStyle = '#4a3820'; break;
    case JG.EXIT:       ctx.fillStyle = '#c8b870'; break;
    case JG.BUSH:       ctx.fillStyle = '#204818'; break;
    default:            ctx.fillStyle = '#182c10'; break;
  }
  ctx.fillRect(sx, sy, JG_T + 1, JG_T + 1);

  // Campfire flicker
  if (t === JG.CAMPFIRE) {
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() * 0.004));
    ctx.fillStyle = `rgba(255,140,20,${flicker * 0.7})`;
    ctx.fillRect(sx + JG_T * 0.25, sy + JG_T * 0.25, JG_T * 0.5, JG_T * 0.5);
  }
}