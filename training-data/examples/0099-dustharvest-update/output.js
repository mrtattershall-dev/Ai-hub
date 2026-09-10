function update(dt) {
  if (invOpen||marketOpen||settingsOpen||pauseOpen||daySummaryOpen||deathScreenOpen||chestOpen||farmhandOpen||npcTalkOpen||blBountyBoardOpen||blVendorOpen||minerOverlayOpen||hcTalkOpen||ocTalkOpen||statsOpen||guideOpen||(typeof jgTalkOpen!=='undefined'&&jgTalkOpen)||(typeof _tobiasPanelOpen!=='undefined'&&_tobiasPanelOpen)) return;

  // Auto zone transitions — fire every frame, no keypress needed
  if (!gameState.inMine && !gameState.inBLMine && !gameState.inBadlands && !gameState.inHoboCamp && !gameState.inOcean && !gameState.inJungle) {
    const ptx=Math.floor(player.x/T), pty=Math.floor(player.y/T);
    if (getT(ptx,pty)===TL.HOBO_PORTAL ||
        getT(ptx-1,pty)===TL.HOBO_PORTAL ||
        getT(ptx+1,pty)===TL.HOBO_PORTAL) {
      enterHoboCamp(); return;
    }
    if (getT(ptx,pty)===TL.OCEAN_PORTAL ||
        getT(ptx,pty-1)===TL.OCEAN_PORTAL ||
        getT(ptx,pty+1)===TL.OCEAN_PORTAL) {
      enterOcean(); return;
    }
  }
  if (gameState.inHoboCamp) {
    // Auto-exit when player reaches south edge
    if (player.y >= (HC_H-2)*HC_T) { exitHoboCamp(); return; }
  }
  if (gameState.inOcean) {
    // Auto-exit when player reaches west edge
    if (player.x <= OC_T*2) { exitOcean(); return; }
  }
  // Fog of war — reveal around player each frame
  if (gameState.inBLMine) {
    if (exploredBLMine && exploredBLMine[gameState.blMineFloor])
      revealAround(player.x, player.y, MINE_REVEAL_RADIUS, exploredBLMine[gameState.blMineFloor], MINE_W, MINE_H);
  } else if (gameState.inMine) {
    const _mineVis = getMineVisibility();
    const _mineReveal = Math.max(2, Math.round(MINE_REVEAL_RADIUS * (_mineVis + 0.5)));
    revealAround(player.x, player.y, _mineReveal, exploredMine[gameState.mineFloor], MINE_W, MINE_H);
  } else if (gameState.inBadlands) {
    revealAround(player.x, player.y, WORLD_REVEAL_RADIUS, exploredBadlands, BL_W, BL_H);
  } else if (gameState.inHoboCamp) {
    revealAround(player.x, player.y, WORLD_REVEAL_RADIUS+1, exploredHobo, HC_W, HC_H);
  } else if (gameState.inOcean) {
    revealAround(player.x, player.y, WORLD_REVEAL_RADIUS+2, exploredOcean, OC_W, OC_H);
  } else if (gameState.inJungle) {
    revealAround(player.x, player.y, WORLD_REVEAL_RADIUS+1, exploredJungle, JG_W, JG_H);
  } else {
    revealAround(player.x, player.y, WORLD_REVEAL_RADIUS, exploredWorld, MAP_W, MAP_H);
  }

  gameState.timeOfDay += dt*gameState.daySpeed;
  // 8am wilt check — crops that weren't watered yesterday wilt at 8am (grace period).
  // Night is cool; the heat of the morning is what finally does the damage.
  if (gameState.timeOfDay >= 8*60 && !gameState._wiltChecked) {
    gameState._wiltChecked = true;
    if (getDifficultyConfig().cropWilt !== false) {
      let newWilts = 0, newDeaths = 0;
      for (const key in plots) {
        const p = plots[key];
        if (!p.tilled || !p.crop || CROPS[p.crop]?.noWater) continue;
        if (!p.wateredToday) {
          if (p.wilted) {
            // Second consecutive unwattered day — crop dies, plot resets to bare dirt
            const [dx, dy] = key.split(',').map(Number);
            spawnParticles(dx * T + T/2, dy * T + T/2, '#5a3a1a', 4, '💀');
            p.crop = null; p.growthProgress = 0; p.harvestReady = false;
            p.wilted = false; p.watered = false; p.wateredToday = false; p.tilled = false;
            setT(dx, dy, TL.DIRT);
            stats.cropsDiedToThirst++;
            newDeaths++;
          } else {
            p.wilted = true; newWilts++;
          }
        } else {
          p.wilted = false; // watered this morning before 8am — safe
        }
      }
      if (newDeaths > 0) showMsg(`☠️ ${newDeaths} crop${newDeaths>1?'s':''} died from thirst — plot${newDeaths>1?'s':''} reset to bare dirt.`);
      else if (newWilts > 0 && settings.wiltNotify) showMsg(`🥀 The morning heat set in — ${newWilts} crop${newWilts>1?'s':''} wilting. Water today or lose them!`);
    }
  }
  // Noon product despawn — uncollected products vanish at 12:00
  if (gameState.timeOfDay >= 12*60 && !gameState._noonProductsDespawned) {
    gameState._noonProductsDespawned = true;
    const before = products.length;
    products = products.filter(p => p.despawnDay > gameState.day);
    const lost = before - products.length;
    if (lost > 0) showMsg(`⌛ ${lost} uncollected product${lost>1?'s':''} spoiled at noon.`);
  }
  if (gameState.timeOfDay >= gameState.dayLength) {
    gameState.timeOfDay -= gameState.dayLength; gameState.day++;
    gameState._noonProductsDespawned = false; // reset for next day
    gameState._wiltChecked = false;           // reset grace-period wilt check
    onNewDay();
  }

  // Real-time growth trickle: each crop grows at a fixed real-world rate
  // so slowing/speeding the day doesn't affect actual grow time.
  for (const key in plots) {
    const p = plots[key];
    if (!p.tilled || !p.crop || p.harvestReady || p.wilted) continue;
    const cropDef = CROPS[p.crop];
    if (!p.wateredToday && !cropDef?.noWater) continue; // must water before growth (except cactus)
    const growSecs = REAL_GROW_SECONDS[p.crop] / (getEffectiveGrowMult() * getCurrentSeason().cropMult * getCropSeasonGrowMult(p.crop));
    let ratePerSecond = 1 / growSecs;

    // Parse tile coords once — reused by lavender and glowroot traits
    const _ci = key.indexOf(',');
    const _ktx = parseInt(key, 10);
    const _kty = parseInt(key.slice(_ci + 1), 10);

    // Lavender trait: each adjacent lavender plot (cardinal) gives +15% growth rate
    if (p.crop !== 'lavender') {
      let lavCount = 0;
      for (const [ddx, ddy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nk = plotKey(_ktx+ddx, _kty+ddy);
        if (plots[nk] && plots[nk].crop === 'lavender' && !plots[nk].wilted) lavCount++;
      }
      if (lavCount > 0) ratePerSecond *= (1 + lavCount * 0.15);
    }

    // Moonshroom trait: grows 50% faster at night
    if (p.crop === 'moonshroom' && gameState.isNight) ratePerSecond *= 1.5;

    p.growthProgress = Math.min(1, p.growthProgress + ratePerSecond * dt);
    if (p.growthProgress >= 1) p.harvestReady = true;

    // Glowroot trait: illuminates fog around its tile while growing (throttled — once/sec)
    if (p.crop === 'glowroot' && !gameState.inMine && !gameState.inBadlands && !gameState.inHoboCamp && !gameState.inOcean && !gameState.inJungle) {
      p._glowRevealTimer = (p._glowRevealTimer || 0) - dt;
      if (p._glowRevealTimer <= 0) {
        p._glowRevealTimer = 1.0;
        revealAround(_ktx * T + T/2, _kty * T + T/2, 4, exploredWorld, MAP_W, MAP_H);
      }
    }
  }

  const h = gameState.timeOfDay/60;
  const wasNight = gameState.isNight;
  gameState.isNight = h>=20||h<6;
  if (!wasNight && gameState.isNight) {
    showMsg('🌙 Night falls — enemies stalk the wilderness. Head home or fight!');
    dSound('night');
    // Mine closes at nightfall — eject player with warning
    if (gameState.inMine) {
      showMsg('⚠️ The mine collapses at night! You were thrown out!');
      exitMine();
    }
    // Merchant packs up at nightfall
    if (merchantPresent) {
      merchantPresent = false;
      closeMerchantShop();
      merchantNextDay = gameState.day + 3 + Math.floor(Math.random() * 2);
      showMsg('🐪 The traveling merchant packed up and rode off into the night.');
    }
  }
  // 15-minute warning before mine closes
  if (gameState.inMine && Math.floor(h) === MINE_CLOSE_HOUR - 1 && Math.floor((gameState.timeOfDay % 60)) === 45) {
    showMsg(`⚠️ Mine closes in 15 minutes — head to the exit!`);
  }

  let dx=0,dy=0;
  if (keys['KeyW']||keys['ArrowUp'])    dy-=1;
  if (keys['KeyS']||keys['ArrowDown'])  dy+=1;
  if (keys['KeyA']||keys['ArrowLeft'])  dx-=1;
  if (keys['KeyD']||keys['ArrowRight']) dx+=1;
  const moving = dx||dy;
  player.sprinting = !!(moving&&(keys['ShiftLeft']||keys['ShiftRight'])&&player.stamina>5);
  if (dx&&dy){dx*=.707;dy*=.707;}

  const stormPenalty = (gameState.stormActive && !isStormsheltered()) ? (1 - gameState._stormIntensity * 0.6) : 1;
  const _speedBoost = (player._speedMult || 1) * (player._speedBoostTimer > 0 ? 1.3 : 1) * (player._debugSpeed ? 3.0 : 1);
  const _dreadSlow = (gameState._mineDread >= 100) ? 0.65 : 1.0;
  const spd = player.speed * _speedBoost * _dreadSlow * (player.sprinting?player.sprintMult:1) * (inventory.totalWeight>getEffectiveWeightCap()*0.8 ? 0.72 : 1) * stormPenalty;
  if (player.sprinting) player.stamina=Math.max(0,player.stamina-18*(player._sprintCostMult||1)*dt);
  else if (!moving)     player.stamina=Math.min(player.maxStamina,player.stamina+player.staminaRegen*getHungerStaminaMult()*getHomeCarpetBonus()*dt);
  else                  player.stamina=Math.min(player.maxStamina,player.stamina+player.staminaRegen*.2*getHungerStaminaMult()*getHomeCarpetBonus()*dt);
  // Rug bonus — extra max stamina while on farm
  const _rugBonus = (!gameState.inMine&&!gameState.inBadlands&&!gameState.inHoboCamp&&!gameState.inOcean&&!gameState.inJungle) ? getHomeRugBonus() : 0;
  player.maxStamina = (player._baseMaxStamina || 100) + _rugBonus;
  tickHunger(dt);
  tickStorm(dt);
  tickFishBite(dt);
  // Poison tick
  if (player._poisoned) {
    player._poisonTimer = (player._poisonTimer||0) - dt;
    if (player._poisonTimer <= 0) {
      player._poisoned = false; player._poisonTimer = 0;
      showMsg('🌿 The poison passed.');
    } else {
      player.hp = Math.max(1, player.hp - 2 * dt); // 2 HP/s
    }
  }
  const diffHpRegen = getDifficultyConfig().hpRegen || 0;
  if (diffHpRegen > 0) player.hp = Math.min(player.maxHp, player.hp + diffHpRegen * dt);
  // Food buff timers
  if (player._speedBoostTimer > 0) { player._speedBoostTimer -= dt; if (player._speedBoostTimer <= 0) showMsg('🌶 Pepper boost faded.'); }
  if (player._regenBoostTimer > 0) { player._regenBoostTimer -= dt; if (player._regenBoostTimer <= 0) showMsg('💜 Lavender regen faded.'); else player.stamina = Math.min(player.maxStamina, player.stamina + 8 * dt); }

  // ── Boat driving — replaces direct player movement when aboard ────────────
  if (gameState.inOcean && player._onBoat && hasBoat()) {
    const tier = getBoatTier();
    const tierIdx = BOAT_TIERS.findIndex(b=>b.id===tier.id);
    // Speed scales with tier: rowboat=55, sloop=75, schooner=95, barque=110
    const boatSpd = [55, 75, 95, 110][Math.min(tierIdx,3)] * _speedBoost * stormPenalty;
    const accel = boatSpd * 3.5;   // how fast it accelerates to top speed
    const drag  = 0.88;             // momentum — feels like water resistance

    if (dx) gameState.boatVX = Math.max(-boatSpd, Math.min(boatSpd, gameState.boatVX + dx*accel*dt));
    else    gameState.boatVX *= Math.pow(drag, dt*60);

    if (dy) gameState.boatVY = Math.max(-boatSpd, Math.min(boatSpd, gameState.boatVY + dy*accel*dt));
    else    gameState.boatVY *= Math.pow(drag, dt*60);

    // Stop dead if under threshold
    if (Math.abs(gameState.boatVX)<0.5) gameState.boatVX=0;
    if (Math.abs(gameState.boatVY)<0.5) gameState.boatVY=0;

    // Boat half-size for collision (hull footprint: ~2 tiles wide, 3 tall)
    const bhw = OC_T, bhh = OC_T*1.5;
    const bnx = gameState.boatX + gameState.boatVX*dt;
    const bny = gameState.boatY + gameState.boatVY*dt;

    // Check ocean tile at boat corners
    function boatSolid(bx,by) {
      const corners = [[bx-bhw,by-bhh],[bx+bhw,by-bhh],[bx-bhw,by+bhh],[bx+bhw,by+bhh]];
      return corners.some(([cx,cy]) => {
        const tx=Math.floor(cx/OC_T), ty=Math.floor(cy/OC_T);
        const t=getOCT(tx,ty);
        // Boat can go anywhere except solid land tiles and the dock structure
        return (t===OC.SAND||t===OC.ROCK||t===OC.WALL||t===OC.POST||t===OC.FLOOR||t===OC.CRATE||t===OC.TREE||
                t===OC.ROAD||t===OC.GRASS||t===OC.BOAT_HULL||
                tx<0||tx>=OC_W||ty<0||ty>=OC_H);
      });
    }

    if (!boatSolid(bnx, gameState.boatY)) gameState.boatX=Math.max(bhw,Math.min((OC_W-1)*OC_T-bhw,bnx));
    else gameState.boatVX*=-0.3;
    if (!boatSolid(gameState.boatX, bny)) gameState.boatY=Math.max(bhh,Math.min((OC_H-1)*OC_T-bhh,bny));
    else gameState.boatVY*=-0.3;

    // Player rides the boat — snap to its center
    player.x = gameState.boatX;
    player.y = gameState.boatY;

    // Facing from velocity
    const bspd2=gameState.boatVX*gameState.boatVX+gameState.boatVY*gameState.boatVY;
    if (bspd2>4) {
      if (Math.abs(gameState.boatVY)>Math.abs(gameState.boatVX))
        player.facing = gameState.boatVY<0?'up':'down';
      else
        player.facing = gameState.boatVX<0?'left':'right';
      player.walkTimer+=dt;
      if (player.walkTimer>.18){player.walkFrame=(player.walkFrame+1)%4;player.walkTimer=0;}
    }
  } else if (gameState.inJungle) {
    // Jungle on-foot movement — routed through zone-specific handler
    updateJungleMovement(dx, dy, dt, spd);
  } else {
    // Normal on-foot movement
    const nx=player.x+dx*spd*dt, ny=player.y+dy*spd*dt;

    const _curW=(gameState.inMine?MINE_W:gameState.inBadlands?BL_W:gameState.inHoboCamp?HC_W:gameState.inOcean?OC_W:MAP_W)*T;
    const _curH=(gameState.inMine?MINE_H:gameState.inBadlands?BL_H:gameState.inHoboCamp?HC_H:gameState.inOcean?OC_H:MAP_H)*T;
    if (!collideSolid(nx,player.y)) player.x=Math.max(0,Math.min(_curW,nx));
    if (!collideSolid(player.x,ny)) player.y=Math.max(0,Math.min(_curH,ny));

    if (moving) {
      if (dy<0) player.facing='up'; else if (dy>0) player.facing='down';
      else player.facing=dx<0?'left':'right';
      player.walkTimer+=dt;
      if (player.walkTimer>.13){player.walkFrame=(player.walkFrame+1)%4;player.walkTimer=0;}
    }
  }

  // Step sounds
  tickStepSound(dt, !!(moving));

  // Pirate skiff approach warning
  if (gameState.inOcean && gameState.isNight) {
    for (const e of enemies) {
      if (e.type !== 'pirateSkiff') continue;
      const distToDock = Math.hypot(e.x - 22 * OC_T, e.y - 38 * OC_T);
      if (distToDock < OC_T * 8 && !e._warnedApproach) {
        e._warnedApproach = true;
        showMsg('🏴‍☠️ Pirate skiff approaching the dock — defend your vessel!');
        gainRep('ocean', 0);
      }
    }
  }

  bgmPoll(dt);

  if (player.actionCooldown>0) player.actionCooldown-=dt;
  if (player._harvestCooldownTimer>0) player._harvestCooldownTimer=Math.max(0,player._harvestCooldownTimer-dt);

  const ct = {x:player.x-(canvas.width/ZOOM)/2,y:player.y-(canvas.height/ZOOM)/2};
  gameState.camera.x+=(ct.x-gameState.camera.x)*8*dt;
  gameState.camera.y+=(ct.y-gameState.camera.y)*8*dt;
  const mapW = gameState.inMine ? MINE_W*T : gameState.inBadlands ? BL_W*T : gameState.inHoboCamp ? HC_W*T : gameState.inOcean ? OC_W*T : MAP_W*T;
  const mapH = gameState.inMine ? MINE_H*T : gameState.inBadlands ? BL_H*T : gameState.inHoboCamp ? HC_H*T : gameState.inOcean ? OC_H*T : MAP_H*T;
  gameState.camera.x=Math.max(0,Math.min(mapW-canvas.width/ZOOM,gameState.camera.x));
  gameState.camera.y=Math.max(0,Math.min(mapH-canvas.height/ZOOM,gameState.camera.y));

  const prevZone = gameState.zone;
  gameState.zone = getZone(player.x,player.y);
  if (gameState.zone!==prevZone) {
    if (gameState.zone==='Town') { showMsg('📍 Town — press [M] to open market'); } else { showMsg('📍 Entering '+gameState.zone); }
  }

  updateParticles(dt);
  if (msgTimer2>0) { msgTimer2-=dt*1000; if(msgTimer2<=0) { const _mb=document.getElementById('msgBanner'); if(_msgQueue.length>0){_pumpMsgQueue();}else{_mb.style.opacity='0'; _mb.classList.remove('tip'); _msgShowing=false;} } }
  const isMoving = !!(
    keys['KeyW']||keys['ArrowUp']||keys['KeyS']||keys['ArrowDown']||
    keys['KeyA']||keys['ArrowLeft']||keys['KeyD']||keys['ArrowRight']
  );
  updateActionTimer(dt, isMoving);  // QoL: timed gather/farm actions
  updateGatherPrompt(); // Phase 5
  tickSprinklers();     // water adjacent plots immediately when needed
  spawnNightEnemies(dt); // Phase 6
  updateEnemies(dt);     // Phase 6
  if (gameState.inBadlands) updateBadlandsEnemies(dt);
  if (gameState.inBadlands && Math.random() < dt * 0.012) spawnBLEncounter();
  // Toxic vent damage — standing on a vent in the deep zone hurts
  if (gameState.inBadlands) {
    const ptx=Math.floor(player.x/T), pty=Math.floor(player.y/T);
    if(getBLT(ptx,pty)===BL.TOXIC_VENT) {
      // Use a dedicated vent timer so invincibility frames don't block DOT damage
      player._ventTimer = (player._ventTimer||0) - dt;
      if (player._ventTimer <= 0) {
        player._ventTimer = 0.6; // tick every 0.6s
        if (!deathScreenOpen) {
          const reduced = Math.round(8 * (1 - (player._armor || 0)));
          player.hp = Math.max(0, player.hp - reduced);
          spawnParticles(player.x, player.y, '#80c020', 3, '☠-'+reduced);
          dSound('hurt');
          const db = document.getElementById('dangerBorder');
          db.classList.add('pulse');
          setTimeout(() => db.classList.remove('pulse'), 300);
          if (player.hp <= 0) triggerDeath();
        }
      }
    } else {
      player._ventTimer = 0; // reset when off the vent
    }
  }
  if (player.attackCooldown > 0) player.attackCooldown -= dt;  // Phase 6
  if (player.invincibleTimer > 0) player.invincibleTimer -= dt; // Phase 6
  if (player.attackFlash > 0)    player.attackFlash    -= dt;  // Phase 6
  updateCombatHUD(); // Phase 6
  updateAnimals(dt);    // Phase 8: ranch
  tickMineHazards(dt);  // Mine hazards
  tickMineDread(dt);    // Mine dread meter
  if (gameState.inBLMine) tickBLMineHazards(dt); // Company mine hazards
  if (_mineEncounterCooldown > 0) _mineEncounterCooldown -= dt / 10;
  // Phase 8 QoL
  updateInteractPrompt();
  updateStaminaFlash();
  updateHUD();
  _tickTips(dt);
  _checkTutorialTriggers();
}