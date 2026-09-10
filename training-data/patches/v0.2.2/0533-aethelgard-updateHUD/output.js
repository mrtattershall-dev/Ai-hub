function updateHUD(){
  const hp=G.health/G.maxHealth*100;
  document.getElementById('health-fill').style.width=hp+'%';
  document.getElementById('stamina-fill').style.width=(G.stamina/G.maxStamina*100)+'%';
  document.getElementById('poise-fill').style.width=(Math.max(0,G.poise)/G.maxPoise*100)+'%';
  if(G.trailTimer>0){ if(G.trailHealth<hp) G.trailHealth=hp; }
  else G.trailHealth=hp;
  document.getElementById('health-trail').style.width=G.trailHealth+'%';
  document.getElementById('exec-prompt').style.opacity=G.nearExecutable?'1':'0';
  if(G.boss&&!G.boss.dead&&G.bossDetected){
    document.getElementById('boss-hud').style.opacity='1';
    document.getElementById('boss-bar-fill').style.width=(G.boss.hp/G.boss.maxHp*100)+'%';
  } else if(!G.boss||G.boss.dead){
    document.getElementById('boss-hud').style.opacity='0';
  }

  // Ability cooldown display
  const runicPct=Math.max(0,Math.min(1,G.runicSlamCD/3.0));
  const tetherPct=Math.max(0,Math.min(1,G.tetherCD/1.2));
  document.getElementById('cd-r').style.height=(runicPct*100)+'%';
  document.getElementById('cd-q').style.height=(tetherPct*100)+'%';
  document.getElementById('slot-r').className='ability-slot'+(G.wyrd>=3&&G.runicSlamCD<=0?' active-glow':'');
  document.getElementById('slot-q').className='ability-slot'+(G.wyrd>=2&&G.tetherCD<=0?' active-glow':'');
  document.getElementById('slot-e').className='ability-slot'+(G.nearExecutable?' active-glow':'');
}