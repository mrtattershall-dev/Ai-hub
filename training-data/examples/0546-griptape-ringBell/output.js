function ringBell() {
  elBellFlash.style.opacity='1';
  setTimeout(()=>{elBellFlash.style.opacity='0';},300);
  const p=periods[periodIdx];
  const bm=elBellMsg;
  bm.textContent=p.skate?'🛹 '+p.name+' — SKATE!':'🔔 '+p.name+' — GET TO CLASS!';
  bm.style.opacity='1';
  setTimeout(()=>bm.style.opacity='0',2500);
  // Spawn NPCs on any bell after their period threshold (not gated to skate periods)
  if (!vance.active && periodIdx >= 1) {
    vance.active = true;
    vance.group.visible = true;
    vance.state = 'patrol';
    toast('Principal Vance has entered the building.', 'danger');
  }
  if (!chloe.active && periodIdx >= 2) {
    chloe.active = true;
    chloe.group.visible = true;
    chloe.postTimer = 5;
    toast('Chloe just showed up. She already has her camera out.', '');
  }
  if (p.skate) {
    toast('Free time — skate!','success');
    guards.forEach(g=>g.speed=1.5+Math.random()*0.5);
  } else {
    toast('Bell rang — guards on patrol!','danger');
    guards.forEach(g=>g.speed=3.0+Math.random()*0.8);
    player.academics=Math.max(0,player.academics-8);
    // Sitting through a class period heals bruise
    player.bruise=Math.max(0,player.bruise-20);
    updateBruise();
    toast('Class healed some bruise','success');
  }
}