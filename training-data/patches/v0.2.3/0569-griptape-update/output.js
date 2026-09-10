function update(dt) {
  tickGrounded(dt);
  tickDetention(dt);
  if (!gameRunning) return;

  periodTimer-=dt;
  if (periodTimer<=0) {
    periodIdx=(periodIdx+1)%periods.length;
    periodTimer=periods[periodIdx].duration;
    ringBell();
  }
  updateClock();

  if (player.busted) {
    player.bustedTimer-=dt;
    if (player.bustedTimer<=0) {
      player.busted=false;
      player.pos.set(0,0.5,8); player.vel.set(0,0,0); shopState.tuneUpActive=false;
    }
    skaterGroup.position.copy(player.pos);
    return;
  }

  const inFlow=player.flow>=80;
  const popBoost=inFlow?1.1:1.0;
  // Bruise reduces max speed AND pop height
  const bruisePenalty=player.bruise*0.003;
  const maxSpd=MAX_SPEED*(1-bruisePenalty)*(shopState.tuneUpActive?1.15:1.0);

  // ── Movement — only when wheels on ground ──
  // No steering, pushing, or braking mid-air. Momentum carries you.
  let pushing=false;
  if (player.onGround) {
    if (keys['KeyW']||keys['ArrowUp']) {
      player.vel.x+=-Math.sin(player.facing)*PUSH_FORCE*dt;
      player.vel.z+=-Math.cos(player.facing)*PUSH_FORCE*dt;
      pushing=true;
    }
    if (keys['KeyS']||keys['ArrowDown']) {
      player.vel.x*=0.90; player.vel.z*=0.90;
    }
    // Turning only on ground — carry spin momentum into air
    if (keys['KeyA']||keys['ArrowLeft'])  { player.facing+=TURN_SPEED*dt; player.spinVel= TURN_SPEED * 1.5; }
    else if (keys['KeyD']||keys['ArrowRight']) { player.facing-=TURN_SPEED*dt; player.spinVel=-TURN_SPEED * 1.5; }
    else { player.spinVel*=0.85; }
  } else {
    // In air — carry spin momentum, bleeds off naturally
    if (player.spinVel !== 0) {
      player.facing += player.spinVel * dt;
      player.spinVel *= 0.995;
      if (Math.abs(player.spinVel) < 0.01) player.spinVel = 0;
    }
  }

  const hspd=Math.sqrt(player.vel.x**2+player.vel.z**2);
  if (hspd>maxSpd) { player.vel.x=player.vel.x/hspd*maxSpd; player.vel.z=player.vel.z/hspd*maxSpd; }

  // ── Ollie — pop height reduced by bruise ──
  if (keys['Space']&&player.onGround&&player.ollieTime<=0) {
    const popHeight=7*(1-bruisePenalty*0.5)*popBoost;
    player.vel.y=popHeight;
    player.onGround=false; player.isOllying=true;
    player.airTime=0; player.ollieTime=0.5;
    player.comboScore=0; player.lastTricks=[];
    player.grinding=false; player.grindTime=0;
    // Show flick hint
    elFlickHint.textContent='FLICK ARROWS FOR TRICK';
    elFlickHint.style.opacity='1';
    setTimeout(()=>{elFlickHint.style.opacity='0';},800);
  }
  if (player.ollieTime>0) player.ollieTime-=dt;

  // ── Flick-It: register gesture mid-air ──
  if (player.isOllying && !player.trickAir && flickQueued) {
    const g=flickGestures[flickQueued];
    if (g && checkSkillGate(flickQueued)) {
      player.trickAir=flickQueued;
      player.trickAngle=0;
    }
    flickQueued=null;
  }
  // Also check live key combos each frame (held gesture)
  if (player.isOllying && !player.trickAir) {
    const dir=getFlickDir();
    if (dir && flickGestures[dir] && dir!==lastFlickDir) {
      if (checkSkillGate(dir)) {
        player.trickAir=dir;
        player.trickAngle=0;
      }
    }
    lastFlickDir=dir;
  } else {
    lastFlickDir=null;
    flickQueued=null;
  }

  // ── Grind ──
  if (player.grinding&&player.onGround&&hspd>1) {
    player.grindTime+=dt;
    const grindScore=Math.floor(player.grindTime*10)*5;
    elGrindIndicator.style.opacity='1';
    elComboScore.textContent='GRIND +'+grindScore;
    markClipReady(1); earnCash(1);
    player.flow=Math.min(100,player.flow+dt*6);
    updateFlow();
  } else {
    if (player.grindTime>0.3) showTrick('BOARDSLIDE',Math.floor(player.grindTime*50+50));
    if (!player.grinding) player.grindTime=0;
    elGrindIndicator.style.opacity='0';
  }

  // ── Ground check + edge detection ──
  let groundY=GROUND_Y;
  for (const ob of obstacles) {
    const nx=player.pos.x, nz=player.pos.z+player.vel.z*dt;
    if (nx>ob.minX&&nx<ob.maxX&&nz>ob.minZ&&nz<ob.maxZ) groundY=Math.max(groundY,ob.topY);
  }
  groundY=Math.max(groundY,GROUND_Y);
  // Edge detection: if standing but surface has dropped away, start falling
  if (player.onGround && player.pos.y > groundY + 0.08) player.onGround = false;

  // ── Gravity ──
  if (!player.onGround) { player.vel.y+=GRAVITY*dt; player.airTime+=dt; }

  // ── Friction ──
  if (player.onGround) {
    const fd=Math.pow(FRICTION,dt*60);
    player.vel.x*=fd; player.vel.z*=fd;
  }

  // ── Integrate ──
  player.pos.x+=player.vel.x*dt;
  player.pos.z+=player.vel.z*dt;
  player.pos.y+=player.vel.y*dt;

  // ── Land ──
  if (player.pos.y<=groundY&&!player.onGround) {
    player.pos.y=groundY;
    const impact=Math.abs(player.vel.y);
    player.vel.y=0; player.onGround=true;
    if (player.trickAir&&player.trickAngle<Math.PI*1.8) {
      bail();
    } else if (player.trickAir) {
      const g=flickGestures[player.trickAir];
      if (g) { showTrick(g.name,g.score); player.skate=Math.min(100,player.skate+1.5); }
    }
    if (impact>10&&!player.trickAir) bail();
    player.trickAir=null; player.trickAngle=0;
    player.isOllying=false; player.airTime=0;
    player.flow=Math.max(0,player.flow-3);
    updateFlow();
    lastFlickDir=null; flickQueued=null;
  }

  // ── Bounds ──
  player.pos.x=Math.max(-90,Math.min(90,player.pos.x));
  player.pos.z=Math.max(-90,Math.min(90,player.pos.z));

  // ── Skater mesh ──
  skaterGroup.position.copy(player.pos);
  skaterGroup.rotation.y=player.facing;
  boardMesh.rotation.z=player.vel.x*0.03*0.3;

  // ── Trick animation ──
  if (player.trickAir&&!player.onGround) {
    const g=flickGestures[player.trickAir];
    player.trickAngle+=dt*8;
    if (g && g.axis==='z') boardMesh.rotation.z=player.trickAngle*g.dir;
    if (g && g.axis==='y') skaterGroup.rotation.y=player.facing+player.trickAngle*g.dir;
  } else if (player.onGround) {
    boardMesh.rotation.z*=0.85;
  }

  // Wheel spin
  skaterGroup.children.forEach(c => {
    if (c.geometry&&c.geometry.type==='CylinderGeometry'&&c.position.y<-0.3) c.rotation.y+=hspd*dt*0.8;
  });

  // Push pump
  if (pushing&&player.onGround) boardMesh.position.y=0.245+Math.sin(Date.now()*0.012)*0.012;
  else if (player.onGround)     boardMesh.position.y=0.245;

  // Flow decay
  if (player.onGround&&!pushing&&!player.grinding) {
    player.flow=Math.max(0,player.flow-dt*4);
    updateFlow();
  }

  // ── Guard AI ──
  let guardAlerted=false;
  guards.forEach(guard=>{
    const g=guard.group;
    const tgt=guard.target===0?guard.patrolA:guard.patrolB;
    const dx=tgt.x-g.position.x, dz=tgt.z-g.position.z;
    const dist=Math.sqrt(dx*dx+dz*dz);
    if (dist<0.5) { guard.target=1-guard.target; }
    else { g.position.x+=(dx/dist)*guard.speed*dt; g.position.z+=(dz/dist)*guard.speed*dt; g.rotation.y=Math.atan2(dx,dz); }
    _v1.set(player.pos.x-g.position.x,0,player.pos.z-g.position.z);
    const toPlayerDist=_v1.length();
    _v2.set(Math.sin(g.rotation.y),0,Math.cos(g.rotation.y));
    const dot=toPlayerDist>0?_v1.normalize().dot(_v2):0;
    if ((dot>0.75&&toPlayerDist<8||toPlayerDist<2.5)&&hspd>0.5) {
      guard.alertLevel=Math.min(1,guard.alertLevel+dt*1.2);
    } else {
      guard.alertLevel=Math.max(0,guard.alertLevel-dt*0.5);
    }
    guard.coneMat.opacity=guard.alertLevel*0.25;
    guard.coneMat.color.setHex(guard.alertLevel>0.7?0xef5350:0xff9800);
    if (guard.alertLevel>=1.0) getBusted();
    if (guard.alertLevel>0.3) guardAlerted=true;
  });
  elGuardAlert.style.opacity=guardAlerted?'1':'0';

  // ── Vance AI ──
  updateVance(dt);

  // ── Chloe AI ──
  updateChloe(dt);

  // ── Speed & stats ──
  player.speed=hspd;
  elSpeedDisplay.textContent='SPEED: '+Math.round(hspd*2.2)+' MPH';
  updateStat('academics',player.academics);
  updateStat('clout',player.clout);
  updateStat('skate',player.skate);

  // ── Camera ──
  const camDist=10, camHeight=5+player.airTime*0.5;
  camera.position.x+=(player.pos.x+Math.sin(camYaw)*camDist-camera.position.x)*0.08;
  camera.position.z+=(player.pos.z+Math.cos(camYaw)*camDist-camera.position.z)*0.08;
  camera.position.y+=(player.pos.y+camHeight-camera.position.y)*0.08;
  camera.lookAt(player.pos.x,player.pos.y+0.8,player.pos.z);

  sculptureGeo.rotation.y+=dt*0.3; sculptureGeo.rotation.x+=dt*0.15;
  updateWarp();
  updateStickHud(hspd);
  statWarnTimer+=dt;
  if(statWarnTimer>0.25){ statWarnTimer=0; updateStatWarnings(); }
  updateFisheye(dt);
  // Shop proximity prompt
  if (!shopState.open) {
    const sdx=player.pos.x-SHOP_POS.x, sdz=player.pos.z-SHOP_POS.z;
    const shopDist=Math.sqrt(sdx*sdx+sdz*sdz);
    elShopPrompt.style.opacity = shopDist < SHOP_RADIUS ? '1' : '0';
  }
  drawMinimap();
}