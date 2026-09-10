function tickMineHazards(dt) {
  if (!gameState.inMine) { _mineHazard=null; _mineRumbleFlash=0; return; }
  if (_mineRumbleFlash > 0) _mineRumbleFlash -= dt*1.5;

  // Count down active hazard
  if (_mineHazard) {
    _mineHazard.countdown -= dt;
    if (_mineHazard.countdown <= 0) {
      MINE_HAZARDS[_mineHazard.type].resolve(gameState.mineFloor, _mineHazard.x, _mineHazard.y);
      _mineHazard = null;
      return;
    }
    // Show warning if just entered warning zone
    if (!_mineHazard.warned && _mineHazard.countdown < (_mineHazard.maxCountdown * 0.6)) {
      _mineHazard.warned = true;
      if (player._mineCanary && _mineHazard.type !== 'richvein') {
        _mineHazard.countdown += 5; // canary buys extra time
        showMsg('🐤 CANARY ALERT — ' + MINE_HAZARDS[_mineHazard.type].msg.slice(3), 4000);
      } else {
        showMsg(MINE_HAZARDS[_mineHazard.type].msg, 3000);
      }
      if (_mineHazard.type === 'cavein') { dSound('hurt'); _mineRumbleFlash = 1.2; }
    }
    return;
  }

  // Periodically roll for new hazard (faster on deeper floors)
  _mineHazardTimer -= dt;
  const fl = gameState.mineFloor;
  const baseInterval = MINE_FLOOR_CFG[fl].hazardInterval;
  if (_mineHazardTimer <= 0) {
    _mineHazardTimer = baseInterval + Math.random()*40;
    const roll = Math.random();
    const hazardChance = MINE_FLOOR_CFG[fl].hazardChance;
    if (roll < hazardChance) {
      // Pick a valid hazard for this floor
      const validHazards = Object.entries(MINE_HAZARDS).filter(([,h]) => fl >= h.minFloor);
      if (!validHazards.length) return;
      // Weight: richvein 40%, cavein 35%, gas 25% (gas only fl1+), singing 50% on fl3 (replaces others)
      const weights = validHazards.map(([k]) => {
        if (k==='singing') return fl===3 ? 0.50 : 0;
        if (k==='richvein') return fl===3 ? 0.20 : 0.40;
        if (k==='cavein')   return fl===3 ? 0.20 : 0.35;
        return fl===3 ? 0.10 : 0.25; // gas
      });
      const total = weights.reduce((a,b)=>a+b,0);
      let r = Math.random()*total, chosen = validHazards[0][0];
      for (let i=0;i<validHazards.length;i++) { r-=weights[i]; if(r<=0){chosen=validHazards[i][0];break;} }
      // Find a spawn position: random floor tile
      const candidates = [];
      for (let y=5;y<MINE_H-5;y++) for (let x=5;x<MINE_W-5;x++) {
        if (getMineT(fl,x,y)===TL.MINE_FLOOR) candidates.push({x,y});
      }
      if (!candidates.length) return;
      const pos = candidates[Math.floor(Math.random()*candidates.length)];
      const [cMin, cMax] = MINE_HAZARDS[chosen].countdownRange;
      const countdown = cMin + Math.random()*(cMax-cMin);
      _mineHazard = { type:chosen, x:pos.x, y:pos.y, countdown, maxCountdown:countdown, warned:false };
    }
  }
}