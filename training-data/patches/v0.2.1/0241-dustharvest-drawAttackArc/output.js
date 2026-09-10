function drawAttackArc(cx, cy) {
  if (player.attackFlash <= 0) return;
  const sx = player.x - cx, sy = player.y - cy;
  const facingAngle = { right:0, left:Math.PI, down:Math.PI/2, up:-Math.PI/2 }[player.facing] || 0;
  ctx.save();
  ctx.globalAlpha = player.attackFlash * 3.5;
  ctx.strokeStyle = '#f0d060';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, sy, ATTACK_RANGE, facingAngle - Math.PI*0.55, facingAngle + Math.PI*0.55);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}