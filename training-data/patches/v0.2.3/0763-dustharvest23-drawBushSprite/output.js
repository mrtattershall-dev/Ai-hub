function drawBushSprite(sx, sy, tx, ty) {
  const seed = tx * 7 + ty * 13;
  // Base soil patch
  ctx.fillStyle='#3a2c14'; ctx.fillRect(sx+4,sy+T-8,T-8,8);
  // Main stem
  ctx.fillStyle='#3a5820';
  ctx.fillRect(sx+T/2-1,sy+T/2,2,T/2-4);
  // Branch left
  ctx.fillRect(sx+T/2-5,sy+T/2-2,5,1);
  ctx.fillRect(sx+T/2-5,sy+T/2-4,1,3);
  // Branch right
  ctx.fillRect(sx+T/2+1,sy+T/2-3,5,1);
  ctx.fillRect(sx+T/2+5,sy+T/2-5,1,3);
  // Leaf clusters — irregular, not circles
  ctx.fillStyle='#4a7028';
  ctx.fillRect(sx+T/2-6,sy+T/2-8,5,4);
  ctx.fillRect(sx+T/2+2,sy+T/2-9,5,4);
  ctx.fillRect(sx+T/2-3,sy+T/2-12,7,5);
  // Lighter leaf highlights
  ctx.fillStyle='#5a8830';
  ctx.fillRect(sx+T/2-5,sy+T/2-10,3,2);
  ctx.fillRect(sx+T/2+3,sy+T/2-11,3,2);
  ctx.fillRect(sx+T/2-1,sy+T/2-13,3,2);
  // Small herb flowers — white/pale
  if(seed%3===0){
    ctx.fillStyle='rgba(220,210,160,.8)';
    ctx.fillRect(sx+T/2-4,sy+T/2-9,2,2);
    ctx.fillRect(sx+T/2+4,sy+T/2-10,2,2);
  }
  // A few loose leaves fallen
  ctx.fillStyle='rgba(70,100,38,.5)';
  ctx.fillRect(sx+3,sy+T-10,3,2);
  if(seed%2===0) ctx.fillRect(sx+T-7,sy+T-9,3,2);
}