function drawSceneBtn(x,y,w,h,label,col) {
  ctx.fillStyle=col+'22'; ctx.strokeStyle=col; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(x,y,w,h,7); ctx.fill(); ctx.stroke();
  ctx.fillStyle=col; ctx.font='bold 13px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, x+w/2, y+h/2);
}