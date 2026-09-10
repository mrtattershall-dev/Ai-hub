function updateEnemyCounter(){
  const alive=G.enemies.filter(e=>!e.dead).length;
  document.getElementById('ec-alive').textContent=alive||'—';
  document.getElementById('ec-kills').textContent=G.kills;
  // Check wave clear (all non-boss dead, boss not yet appeared)
  const nonBossAlive=G.enemies.filter(e=>!e.dead&&e.type!=='boss').length;
  if(nonBossAlive===0&&!G.bossDetected&&G.started&&!G.dead){
    showWaveBanner('Approach the General','The Flayed One awaits to the south');
  }
}