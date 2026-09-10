function takeDamage(amount){
  if(G.dodgeInvincible||G.isExecuting) return;
  if(G.isParrying&&G.parryWindow>0) { SFX.parry(); flashParry(); G.isParrying=false; G.parryWindow=0; return; } // block with no specific enemy ref
  ensureAudio();
  G.trailHealth=G.health/G.maxHealth*100;
  G.health-=amount; G.health=Math.max(0,G.health);
  G.sessionDamageTaken=(G.sessionDamageTaken||0)+amount;
  G.trailTimer=0.9; G.poise-=32; G.lastDamageTime=performance.now()/1000;
  SFX.takeDmg(); flashHit();
  G.stamRegenCooldown=1.5;
  spawnDmgNum(Math.round(amount),playerGroup.position.clone().add(new THREE.Vector3(0,2.5,0)),'#cc4040');
  if(G.health<=0){ G.health=0; G.trailHealth=0; triggerDeath(); }
  updateHUD();
}