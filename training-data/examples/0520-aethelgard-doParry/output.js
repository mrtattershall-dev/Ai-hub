function doParry(){
  if(G.isAttacking||G.isDodging||G.stamina<15) return;
  ensureAudio();
  G.isParrying=true; G.parryTimer=0.45; G.parryWindow=0.35; // first 0.35s is parry-active
  G.perfectParry=false;
  G.stamina=Math.max(0,G.stamina-15);
  // Shield-up animation
  wyrdArm.rotation.z=-0.5; setTimeout(()=>wyrdArm.rotation.z=0,300);
}