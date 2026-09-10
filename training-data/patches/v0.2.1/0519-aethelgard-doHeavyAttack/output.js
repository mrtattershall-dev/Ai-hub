function doHeavyAttack(){
  // If a NEARBY enemy is telegraphing, treat RMB as a parry
  let nearbyTelegraph=false;
  G.enemies.forEach(en=>{
    if(!en.dead&&en.telegraphActive&&playerGroup.position.distanceTo(en.group.position)<6) nearbyTelegraph=true;
  });
  if(nearbyTelegraph&&!G.isAttacking){ doParry(); return; }

  if(G.stamina<30||G.isAttacking||G.isDodging||G.isExecuting||G.isRunicSlamming) return;
  ensureAudio();
  G.isAttacking=true; G.attackTimer=0.55; G.isHeavyAttacking=true;
  G.stamina=Math.max(0,G.stamina-30);
  axeGroup.rotation.z=1.5; setTimeout(()=>axeGroup.rotation.z=0,380);

  G.enemies.forEach(en=>{
    if(en.dead) return;
    const dist=playerGroup.position.distanceTo(en.group.position);
    if(dist<3.2){
      const dmg=(40+Math.random()*14)*(G.bloodDrunk?1.5:1);
      damageEnemy(en,dmg,48);
      SFX.heavyHit();
      G.wyrd=Math.min(G.maxWyrd,G.wyrd+1.5);
      G.combo++; G.comboTimer=3.5; updateComboRank();
    }
  });
}