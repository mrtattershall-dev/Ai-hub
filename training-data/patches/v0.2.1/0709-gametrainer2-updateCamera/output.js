function updateCamera(s, keys) {
  const spd=4;
  if (keys['ArrowLeft']||keys['a']||keys['A']) s.player.vx=-spd;
  else if (keys['ArrowRight']||keys['d']||keys['D']) s.player.vx=spd;
  else s.player.vx*=0.8;
  if (keys['ArrowUp']||keys['w']||keys['W']) s.player.vy=-spd;
  else if (keys['ArrowDown']||keys['s']||keys['S']) s.player.vy=spd;
  else s.player.vy*=0.8;
  s.player.x=Math.max(s.player.r,Math.min(s.W-s.player.r, s.player.x+s.player.vx));
  s.player.y=Math.max(s.player.r,Math.min(s.H-s.player.r, s.player.y+s.player.vy));
  // Lerp cam to player
  const tx=s.player.x-canvas.width/2, ty=s.player.y-canvas.height/2;
  s.cam.x+=(tx-s.cam.x)*0.1;
  s.cam.y+=(ty-s.cam.y)*0.1;
  s.cam.x=Math.max(0,Math.min(s.W-canvas.width,s.cam.x));
  s.cam.y=Math.max(0,Math.min(s.H-canvas.height,s.cam.y));
  for (const g of s.gems) {
    if (!g.col && Math.hypot(s.player.x-g.x,s.player.y-g.y)<s.player.r+g.r) g.col=true;
  }
  if (s.gems.every(g=>g.col)&&!s.won) s.won=true;
}