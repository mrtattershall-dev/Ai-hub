function _drawJGNPC(npc, sx, sy, ctx) {
  const bob = Math.sin(Date.now() * 0.0018 + npc.tx * 0.1) * 1.5;
  const OL = '#181818';
  ctx.fillStyle = OL;
  ctx.fillRect(sx - 6, sy - 14 + bob, 13, 18);
  // Body
  ctx.fillStyle = npc.id === 'jg_kit' ? '#4a6030' : '#5a4a30';
  ctx.fillRect(sx - 5, sy - 13 + bob, 11, 10);
  // Head
  ctx.fillStyle = '#c8a070';
  ctx.fillRect(sx - 4, sy - 23 + bob, 9, 9);
  // Name tag on hover (proximity)
  const dist = Math.hypot(player.x - (npc.tx * JG_T + JG_T / 2), player.y - (npc.ty * JG_T + JG_T / 2));
  if (dist < 90) {
    ctx.fillStyle = 'rgba(10,20,10,.75)';
    ctx.fillRect(sx - 22, sy - 31 + bob, 45, 10);
    ctx.fillStyle = '#78c888';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, sx, sy - 23 + bob);
  }
}