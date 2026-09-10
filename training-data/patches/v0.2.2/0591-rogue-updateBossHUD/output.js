function updateBossHUD(){
  const bar=document.getElementById('bossBar');
  const fill=document.getElementById('bossHpFill');
  const name=document.getElementById('bossName');
  const phase=document.getElementById('bossPhase');
  if(!G.boss){ bar.style.display='none'; return; }
  bar.style.display='flex';
  name.textContent=G.boss.name;
  fill.style.width=(Math.max(0,G.boss.hp/G.boss.maxHp)*100)+'%';
  const labels=['','PHASE I — SUMMONS','PHASE II — ROUGE-SHIFT','PHASE III — ORGAN THEFT'];
  phase.textContent=labels[G.bossPhase]||'';
}