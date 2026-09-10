function killEnemy(en){
  if(en.dead) return;
  en.dead=true; en.state='dead';
  en.group.rotation.z=Math.PI/2; en.group.position.y=-0.3;
  en.atkLight.intensity=0; en.telegraphActive=false;
  SFX.enemyDie();
  G.wyrd=Math.min(G.maxWyrd,G.wyrd+2.5);
  G.kills++;
  updateEnemyCounter();
  if(en.type==='boss'){
    document.getElementById('boss-hud').style.opacity='0';
    // Victory stats
    const elapsed=Math.round(clock.getElapsedTime());
    const m=Math.floor(elapsed/60), s=elapsed%60;
    document.getElementById('victory-stats').innerHTML=
      `Kills <span>${G.kills}</span> &nbsp;|&nbsp; Time <span>${m}:${s.toString().padStart(2,'0')}</span> &nbsp;|&nbsp; Max Combo <span>${G.maxComboEver||0}</span>`;
    setTimeout(()=>{ document.getElementById('victory-screen').className='active'; },1500);
  }
  setTimeout(()=>{ scene.remove(en.group); G.enemies=G.enemies.filter(e=>e!==en); },3500);
}