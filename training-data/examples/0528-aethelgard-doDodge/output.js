function doDodge(){
  if(G.stamina<20||G.isDodging||G.isExecuting) return;
  ensureAudio();
  G.isDodging=true; G.dodgeTimer=0.42; G.dodgeInvincible=true; G.stamina-=20;
  SFX.dodge();
  const dir=getInputDir();
  if(dir.lengthSq()<0.01) dir.set(-Math.sin(G.cameraYaw),0,-Math.cos(G.cameraYaw)).negate(); // back-dodge away from camera forward
  playerGroup.position.addScaledVector(dir,DODGE_DIST);
  setTimeout(()=>{ G.dodgeInvincible=false; },155);
}