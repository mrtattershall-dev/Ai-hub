function doTetherHook(){
  if(G.wyrd<2||G.isTethering||G.tetherCD>0) return;
  ensureAudio();
  G.wyrd-=2; G.isTethering=true; G.tetherTimer=0.4; G.tetherCD=1.2;
  SFX.tether();
  let nearest=null,minDist=999;
  G.enemies.forEach(en=>{ if(en.dead) return; const d=playerGroup.position.distanceTo(en.group.position); if(d<18&&d<minDist){minDist=d;nearest=en;} });
  if(nearest){
    if(nearest.type!=='boss'){
      nearest.group.position.lerp(playerGroup.position.clone().add(new THREE.Vector3(0,0,-2)),0.75);
      nearest.staggered=true; nearest.staggerTimer=1.8; nearest.state='staggered';
      damageEnemy(nearest,28,28);
    } else {
      // Launch player toward boss
      const dir=nearest.group.position.clone().sub(playerGroup.position).normalize();
      playerGroup.position.addScaledVector(dir,minDist*0.55);
      G.wyrd=Math.min(G.maxWyrd,G.wyrd+2.5);
      spawnDmgNum('GAP CLOSED',playerGroup.position.clone().add(new THREE.Vector3(0,2.5,0)),'#c85a10');
    }
    showTetherBeam(playerGroup.position.clone(),nearest.group.position.clone());
  }
}