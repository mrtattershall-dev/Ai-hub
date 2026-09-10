function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.1);
  const t=clock.getElapsedTime();

  // Torch flicker
  torchLights.forEach(fl=>{
    fl.intensity=fl.userData.base*(0.82+0.18*Math.sin(t*fl.userData.speed+fl.userData.phase));
  });

  if(!G.started){ renderer.render(scene,camera); return; }

  // Both lights track player position directly
  runeLight.position.set(playerGroup.position.x, playerGroup.position.y+1.3, playerGroup.position.z);
  runeLight.intensity=1.8+G.corruption/100*3.5+(G.bloodDrunk?2:0);
  runeLight.color.setHSL(0.04-G.corruption/100*0.04,1,0.38);
  playerLight.position.set(playerGroup.position.x, playerGroup.position.y+1.8, playerGroup.position.z);

  // Player movement
  if(!G.isAttacking&&!G.isDodging&&!G.isExecuting&&!G.staggered&&!G.isRunicSlamming){
    const dir=getInputDir();
    const speed=G.keys['shift']?SPRINT_SPEED:MOVE_SPEED;
    playerGroup.position.addScaledVector(dir,speed*dt);
    if(dir.lengthSq()>0.01){
      const angle=Math.atan2(dir.x,dir.z);
      playerGroup.rotation.y+=(angle-playerGroup.rotation.y)*0.2;
    }
    if(G.keys['shift']&&dir.lengthSq()>0.01) G.stamina=Math.max(0,G.stamina-5*dt);
  }
  playerGroup.position.x=Math.max(-ARENA_BOUND,Math.min(ARENA_BOUND,playerGroup.position.x));
  playerGroup.position.z=Math.max(-ARENA_BOUND,Math.min(ARENA_BOUND,playerGroup.position.z));
  playerGroup.position.y=0;

  // Timers
  if(G.isAttacking){ G.attackTimer-=dt; if(G.attackTimer<=0){G.isAttacking=false;G.isHeavyAttacking=false;} }
  if(G.isDodging){ G.dodgeTimer-=dt; if(G.dodgeTimer<=0) G.isDodging=false; }
  if(G.isTethering){ G.tetherTimer-=dt; if(G.tetherTimer<=0) G.isTethering=false; }
  if(G.isRunicSlamming){ G.runicSlamTimer-=dt; if(G.runicSlamTimer<=0) G.isRunicSlamming=false; }
  if(G.isParrying){ G.parryTimer-=dt; G.parryWindow-=dt; if(G.parryTimer<=0){G.isParrying=false;G.parryWindow=0;} }
  if(G.tetherCD>0) G.tetherCD-=dt;
  if(G.runicSlamCD>0) G.runicSlamCD-=dt;
  if(G.extractedTimer>0){ G.extractedTimer-=dt; if(G.extractedTimer<=0){G.extractedElement=null;} }
  if(G.combo>0){ G.comboTimer-=dt; if(G.comboTimer<=0){G.combo=0;updateComboRank();} }

  // Stamina regen
  G.stamRegenCooldown=Math.max(0,G.stamRegenCooldown-dt);
  if(!G.keys['shift']&&G.stamRegenCooldown<=0) G.stamina=Math.min(G.maxStamina,G.stamina+26*dt);

  // Poise regen
  const now=performance.now()/1000;
  if(now-G.lastDamageTime>2.8) G.poise=Math.min(G.maxPoise,G.poise+38*dt);

  // Corruption decay
  G.corruption=Math.max(0,G.corruption-1.8*dt);
  if(G.bloodDrunk){
    G.bloodDrunkTimer-=dt;
    G.health-=3*dt*G.maxHealth/100;
    G.health=Math.max(1,G.health);
    if(G.bloodDrunkTimer<=0){G.bloodDrunk=false;G.corruption=0;} 
  }

  // Trail
  G.trailTimer-=dt;

  // Enemy AI
  updateEnemies(dt,t);

  // Camera
  const comboBoost=G.comboRank==='S'?0.6:0;
  const camDist=5.0+comboBoost;
  const tx=playerGroup.position.x+Math.sin(G.cameraYaw)*Math.cos(G.cameraPitch)*camDist;
  const ty=playerGroup.position.y+Math.sin(G.cameraPitch)*camDist+1.3;
  const tz=playerGroup.position.z+Math.cos(G.cameraYaw)*Math.cos(G.cameraPitch)*camDist;
  camera.position.lerp(new THREE.Vector3(tx,ty,tz),0.11);
  camera.lookAt(playerGroup.position.x,playerGroup.position.y+1.5,playerGroup.position.z);

  // Axe idle / attack animation
  if(!G.isAttacking) axeGroup.rotation.y=Math.sin(t*1.1)*0.05;

  // Wyrd-Grip vein glow
  veinMeshes.forEach((v,i)=>{
    v.material.emissiveIntensity=(0.5+G.corruption/100*1.0)*(0.85+0.15*Math.sin(t*3.5+i));
    if(G.bloodDrunk) v.material.emissiveIntensity*=2.5;
    v.material.color.setHSL(0.04-G.corruption/100*0.04,1,0.3);
    v.material.emissive.copy(v.material.color);
  });

  // Axe rune glow
  axeRune.material.emissiveIntensity=G.extractedElement?2:0.8+G.corruption/100*0.8;

  updateHUD(); updateCorruption();
  drawMinimap();
  renderer.render(scene,camera);
}