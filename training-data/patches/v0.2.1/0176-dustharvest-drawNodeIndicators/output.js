function drawNodeIndicators(cx, cy) {
  // Draw a small X on depleted nodes that are on screen
  ctx.save();
  for (const key in resourceNodes) {
    const n = resourceNodes[key];
    if (!n.depleted) continue;
    if (n.respawnDay === Infinity) continue; // stone nodes: tile still looks like rock, no marker needed
    const sx = n.x*T+T/2 - cx, sy = n.y*T+T/2 - cy;
    if (sx<-T||sx>canvas.width+T||sy<-T||sy>canvas.height+T) continue;
    ctx.globalAlpha=.4; ctx.fillStyle='#c06020';
    ctx.font='10px sans-serif'; ctx.textAlign='center';
    ctx.fillText('✕', sx, sy+4);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}