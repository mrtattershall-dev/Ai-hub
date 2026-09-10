function respawn(){
  document.getElementById('death-screen').className='';
  // Remove remaining enemy meshes
  G.enemies.forEach(en=>{ if(!en.dead) scene.remove(en.group); else scene.remove(en.group); });
  G.enemies=[];
  G.boss=null; G.bossDetected=false;
  document.getElementById('boss-hud').style.opacity='0';
  document.getElementById('boss-phase-label').textContent='Phase I — The Crucible';

  G.dead=false; G.started=true;
  G.health=G.maxHealth*0.55; G.trailHealth=G.health/G.maxHealth*100;
  G.stamina=G.maxStamina; G.poise=G.maxPoise; G.combo=0; G.corruption=0;
  G.bloodDrunk=false; G.extractedElement=null;
  G.isAttacking=false; G.isDodging=false; G.isParrying=false;
  G.isExecuting=false; G.isRunicSlamming=false; G.isTethering=false;
  G.dodgeInvincible=false; G.parryWindow=0; G.staggered=false;
  G.maxComboEver=0;
  playerGroup.position.set(0,0,3);
  playerGroup.rotation.set(0,0,0);
  spawnEnemies();
  updateComboRank(); updateHUD(); updateCorruption();
  updateEnemyCounter();
  ensureAudio();
}