function doRunicSlam(){
  if(G.wyrd<3||G.isRunicSlamming||G.runicSlamCD>0) return;
  ensureAudio();
  G.wyrd-=3; G.isRunicSlamming=true; G.runicSlamTimer=0.6; G.runicSlamCD=3.0;
  SFX.runicSlam();
  G.corruption=Math.min(100,G.corruption+12);
  updateCorruption();

  // Animate shockwave ring expanding
  slamRing.visible=true;
  slamRing.position.copy(playerGroup.position); slamRing.position.y=0.05;
  slamRingMat.opacity=0.9;
  let t=0;
  const expand=setInterval(()=>{
    t+=0.05;
    slamRing.scale.set(1+t*18,1+t*18,1);
    slamRingMat.opacity=Math.max(0,0.9-t*2.2);
    if(t>=0.45){ clearInterval(expand); slamRing.visible=false; }
  },16);

  G.enemies.forEach(en=>{
    if(en.dead) return;
    const dist=playerGroup.position.distanceTo(en.group.position);
    if(dist<5.5){
      const dmg=(45+Math.random()*20)*(G.bloodDrunk?1.5:1);
      damageEnemy(en,dmg,80);
      en.staggered=true; en.staggerTimer=3.0; en.state='staggered';
      G.combo++; G.comboTimer=3.5; updateComboRank();
    }
  });
}