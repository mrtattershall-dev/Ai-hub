function updateFSM(s, keys) {
  const spd=3.5;
  if (keys['ArrowLeft']||keys['a']||keys['A']) s.player.vx=-spd;
  else if (keys['ArrowRight']||keys['d']||keys['D']) s.player.vx=spd;
  else s.player.vx*=0.75;
  if (keys['ArrowUp']||keys['w']||keys['W']) s.player.vy=-spd;
  else if (keys['ArrowDown']||keys['s']||keys['S']) s.player.vy=spd;
  else s.player.vy*=0.75;
  s.player.x=Math.max(s.player.r,Math.min(canvas.width-s.player.r,s.player.x+s.player.vx));
  s.player.y=Math.max(s.player.r,Math.min(canvas.height-s.player.r,s.player.y+s.player.vy));

  for (const e of s.enemies) {
    if (e.flash>0) e.flash--;
    const d=fsmDist(e,s.player);
    switch(e.state) {
      case 'idle':
        e.timer++;
        if (e.timer%120<60) { e.x+=Math.sin(e.timer/20)*0.5; }
        if (d<140) { e.state='chase'; e.label='chase'; e.timer=0; }
        break;
      case 'chase':
        fsmMove(e,s.player.x,s.player.y,1.6);
        if (d<36) { e.state='attack'; e.label='attack'; e.timer=30; }
        if (d>260) { e.state='idle'; e.label='idle'; e.timer=0; }
        break;
      case 'attack':
        e.timer--;
        if (e.flash===0) e.flash=5;
        if (e.timer<=0) { e.state='chase'; e.label='chase'; }
        break;
      case 'flee':
        fsmMove(e,s.player.x*-1+e.x*2,s.player.y*-1+e.y*2,2.5);
        if (d>280) { e.state='idle'; e.label='idle'; e.timer=0; }
        e.x=Math.max(e.r,Math.min(canvas.width-e.r,e.x));
        e.y=Math.max(e.r,Math.min(canvas.height-e.r,e.y));
        break;
    }
    if (e.health<2&&e.state!=='flee') { e.state='flee'; e.label='flee'; }
    e.statesSeen.add(e.state);
    s.statesUnlocked.add(e.state);
  }
  // Player "attack" by pressing space near enemy
  if (keys[' ']) {
    for (const e of s.enemies) {
      if (fsmDist(e,s.player)<60&&e.health>0) { e.health=Math.max(0,e.health-0.02); e.flash=3; }
    }
  }
  const totalStates=new Set(s.enemies.flatMap(e=>[...e.statesSeen]));
  if (totalStates.size>=4&&!s.won) s.won=true;
}