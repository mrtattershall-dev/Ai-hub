function drawMinimap(){
  mmCtx.clearRect(0,0,MM_SIZE,MM_SIZE);
  // Background
  mmCtx.fillStyle='rgba(10,8,6,0.7)';
  mmCtx.fillRect(0,0,MM_SIZE,MM_SIZE);

  function worldToMM(wx,wz){
    return {
      x:(wx/MM_WORLD+0.5)*MM_SIZE,
      y:(wz/MM_WORLD+0.5)*MM_SIZE
    };
  }
  // Enemies
  G.enemies.forEach(en=>{
    if(en.dead) return;
    const p=worldToMM(en.group.position.x,en.group.position.z);
    mmCtx.beginPath();
    mmCtx.arc(p.x,p.y,en.type==='boss'?5:2.5,0,Math.PI*2);
    mmCtx.fillStyle=en.type==='boss'?'rgba(200,0,0,0.9)':
      en.telegraphActive?'rgba(255,120,20,0.9)':'rgba(180,80,20,0.65)';
    mmCtx.fill();
  });
  // Player
  const pp=worldToMM(playerGroup.position.x,playerGroup.position.z);
  mmCtx.beginPath();
  mmCtx.arc(pp.x,pp.y,3.5,0,Math.PI*2);
  mmCtx.fillStyle='rgba(200,184,122,0.95)';
  mmCtx.fill();
  // Player direction arrow
  const fwdX=Math.sin(playerGroup.rotation.y)*7;
  const fwdZ=Math.cos(playerGroup.rotation.y)*7;
  mmCtx.beginPath();
  mmCtx.moveTo(pp.x+fwdX,pp.y+fwdZ);
  mmCtx.lineTo(pp.x,pp.y);
  mmCtx.strokeStyle='rgba(200,184,122,0.5)';
  mmCtx.lineWidth=1;
  mmCtx.stroke();
  // Arena boundary
  mmCtx.strokeStyle='rgba(255,255,255,0.06)';
  mmCtx.lineWidth=1;
  mmCtx.strokeRect(2,2,MM_SIZE-4,MM_SIZE-4);
}