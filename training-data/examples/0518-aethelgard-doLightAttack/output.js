function doLightAttack(){
  if(G.stamina<12||G.isAttacking||G.isDodging||G.isExecuting||G.isRunicSlamming) return;
  ensureAudio();
  G.isAttacking=true; G.attackTimer=0.32; G.isHeavyAttacking=false;
  G.stamina=Math.max(0,G.stamina-12);
  axeGroup.rotation.z=0.75; setTimeout(()=>axeGroup.rotation.z=0,200);
  document.getElementById('cursor').className='attacking'; setTimeout(()=>document.getElementById('cursor').className='',300);

  let hit=false;
  G.enemies.forEach(en=>{
    if(en.dead) return;
    const dist=playerGroup.position.distanceTo(en.group.position);
    if(dist<2.6){
      const base=14+Math.random()*8;
      const dmg=base*(G.bloodDrunk?1.5:1)*(G.extractedElement?1.3:1);
      const isCrit=G.poise>G.maxPoise*0.8 && dist<2.0;
      damageEnemy(en,isCrit?dmg*1.5:dmg,15);
      if(isCrit) spawnDmgNum('CRIT',en.group.position.clone().add(new THREE.Vector3(0,2.2,0)),'#ffdd80',' crit');
      SFX.lightHit();
      hit=true;
      G.wyrd=Math.min(G.maxWyrd,G.wyrd+0.5);
    }
  });
  if(hit){ G.combo++; G.comboTimer=3.5; updateComboRank(); G.maxComboEver=Math.max(G.maxComboEver||0,G.combo); }
}