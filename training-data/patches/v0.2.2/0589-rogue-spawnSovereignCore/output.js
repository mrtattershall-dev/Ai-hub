function spawnSovereignCore(){
  G.boss={
    type:'sovereign',
    name:'THE SOVEREIGN CORE',
    x:(COLS-6)*TILE, y:Math.floor(ROWS/2)*TILE,
    hp:1200, maxHp:1200,
    phase:1, sz:28, spd:44,
    // Per-phase timers
    summonT:0,    // phase 1: summon husks
    shiftT:0,     // phase 2: rouge-shift attacks
    stolenOrgs:[], // phase 3: organs it stole
    stealT:0,
    // Visual
    armAngs: Array.from({length:4},(_,i)=>i/4*Math.PI*2),
    rotSpd: 1.2,
    chargeT:0, charging:false, cdx:0, cdy:0,
  };
  G.bossPhase=1;
}