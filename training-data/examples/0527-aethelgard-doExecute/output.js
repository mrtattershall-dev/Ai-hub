function doExecute(){
  if(!G.nearExecutable) return;
  let target=null;
  G.enemies.forEach(en=>{
    if(!en.dead&&en.staggered&&en.hp<en.maxHp*0.32){
      const d=playerGroup.position.distanceTo(en.group.position);
      if(d<3.5) target=en;
    }
  });
  if(!target) return;
  ensureAudio();
  G.isExecuting=true; G.nearExecutable=false;
  SFX.execute();
  document.getElementById('exec-prompt').style.opacity='0';

  G.health=Math.min(G.maxHealth,G.health+G.maxHealth*0.18);
  G.stamina=Math.min(G.maxStamina,G.stamina*0.5+G.maxStamina*0.5);
  G.wyrd=Math.min(G.maxWyrd,G.wyrd+3);
  G.corruption=Math.max(0,G.corruption-20);
  G.combo+=3; G.comboTimer=4; updateComboRank();

  // Runic extraction — grant element effect
  if(target.type==='elite'){
    G.extractedElement='lightning'; G.extractedTimer=20;
    showStatusTag('LIGHTNING EXTRACTED','#aaff44');
  } else if(target.type==='boss'){
    G.extractedElement='fire'; G.extractedTimer=20;
    showStatusTag('DIVINE FIRE EXTRACTED','#ff6020');
  }

  spawnDmgNum('EXECUTE',target.group.position.clone().add(new THREE.Vector3(0,3,0)),'#c8b87a');
  killEnemy(target);

  if(G.bloodDrunk){ G.bloodDrunkTimer=G.bloodDrunkTimer>0?G.bloodDrunkTimer+15:0; G.corruption=0; }
  setTimeout(()=>{ G.isExecuting=false; updateHUD(); },550);
}