function showTrick(name, pts) {
  // Fisheye cam bonus — better framing = higher clip score
  const camBonus = fisheyeNPC.active ? (1 + fisheyeNPC.score * 0.5) : 1.0;
  // Chloe filming nearby: she might capture your trick (boost + she posts it)
  const chloeDx = player.pos.x - (chloe.active ? chloe.group.position.x : 999);
  const chloeDz = player.pos.z - (chloe.active ? chloe.group.position.z : 999);
  const chloeNear = chloe.active && chloe.state === 'filming' && Math.sqrt(chloeDx*chloeDx+chloeDz*chloeDz) < 5;
  pts = Math.round(pts * camBonus * (chloeNear ? 1.2 : 1.0));
  if (chloeNear) toast('Chloe caught that on camera! +20% score', '');
  trickDisplay.textContent=name;
  trickDisplay.style.opacity='1';
  clearTimeout(trickTimeout);
  trickTimeout=setTimeout(()=>{ trickDisplay.style.opacity='0'; },1500);
  player.skate=Math.min(100,player.skate+0.5);
  player.clout=Math.min(100,player.clout+0.2);
  player.comboScore+=pts;
  elComboScore.textContent='+'+player.comboScore+' PTS';
  player.flow=Math.min(100,player.flow+12);
  updateFlow();
  markClipReady(pts);
  addToEditBuffer(name, pts);
  earnCash(Math.ceil(pts / 20));  // tricks earn cash
  player.lastTricks.push(name);
  if (player.lastTricks.length>3) player.lastTricks.shift();
  if (player.lastTricks.length===3 &&
      player.lastTricks[0]===player.lastTricks[1] &&
      player.lastTricks[1]===player.lastTricks[2]) {
    player.flow=0; player.lastTricks=[]; updateFlow();
    trickDisplay.textContent='TRICK SPAM!';
    trickDisplay.style.textShadow='0 0 20px #ef5350';
    setTimeout(()=>{ trickDisplay.style.textShadow='0 0 20px #ffd600'; },1000);
  }
}