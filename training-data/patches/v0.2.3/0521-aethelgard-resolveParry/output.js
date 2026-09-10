function resolveParry(en){
  // Called when enemy attacks during our parry window
  const timing=G.parryWindow; // higher = better
  const isPerfect=timing>0.22;
  if(isPerfect){
    spawnDmgNum('PERFECT PARRY',playerGroup.position.clone().add(new THREE.Vector3(0,2.5,0)),'#c8b87a',' parried');
    G.wyrd=Math.min(G.maxWyrd,G.wyrd+2);
    G.stamina=Math.min(G.maxStamina,G.stamina+20);
    SFX.parry();
    flashParry();
    document.getElementById('parry-prompt').style.opacity='1';
    setTimeout(()=>document.getElementById('parry-prompt').style.opacity='0',600);
    // Stagger enemy hard
    en.staggered=true; en.staggerTimer=5.0; en.state='staggered'; en.poise=en.maxPoise;
    en.atkLight.intensity=0;
    en.telegraphActive=false;
    G.nearExecutable=true;
  } else {
    spawnDmgNum('PARRY',playerGroup.position.clone().add(new THREE.Vector3(0,2.2,0)),'#c8b87a',' parried');
    SFX.parry();
    flashParry();
    en.staggered=true; en.staggerTimer=2.5; en.state='staggered'; en.poise=en.maxPoise;
    en.telegraphActive=false;
  }
  G.isParrying=false; G.parryWindow=0;
  return true;
}