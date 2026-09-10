function damageEnemy(en,dmg,poiseDmg){
  if(en.dead) return;
  en.hp-=dmg; en.poise-=poiseDmg;
  spawnDmgNum(dmg,en.group.position.clone().add(new THREE.Vector3(0,en.type==='boss'?2.8:2,0)));
  G.corruption=Math.min(100,G.corruption+3+(en.type==='boss'?2:0));
  updateCorruption();
  if(en.poise<=0){
    en.staggered=true; en.staggerTimer=en.type==='boss'?3:4;
    en.state='staggered'; en.poise=en.maxPoise;
    en.atkLight.intensity=0; en.telegraphActive=false;
  }
  if(!en.dead && en.hp<en.maxHp*0.28 && en.staggered) G.nearExecutable=true;
  // Boss phase transition — check BEFORE kill so en.dead is still false
  if(en.type==='boss' && en.hp>0){
    if(en.hp<en.maxHp*0.5 && en.phase===1){
      en.phase=2; en.speed*=1.3; en.dmg*=1.2; en.attackCooldown*=0.75;
      document.getElementById('boss-phase-label').textContent='Phase II — Unbridled Fury';
      showStatusTag('BOSS ENRAGED','#cc2020');
      SFX.bossRoar();
    }
    if(en.hp<en.maxHp*0.2 && en.phase===2){
      en.phase=3; en.speed*=1.2; en.dmg*=1.15;
      document.getElementById('boss-phase-label').textContent='Phase III — The Flayed God';
      showStatusTag('FINAL PHASE','#ff0040');
      SFX.bossRoar();
    }
  }
  if(en.hp<=0) killEnemy(en);
}