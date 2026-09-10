function spawnAmalgam(){
  const room=G.rooms[G.rooms.length-1];
  G.boss={
    type:'amalgam',
    name:'THE AMALGAM',
    x:(room.x+Math.floor(room.w/2))*TILE, y:(room.y+Math.floor(room.h/2))*TILE,
    hp:400, maxHp:400,
    phase:1,           // 1: tendril pulls | 2: shed organs as projectiles
    sz:22, spd:52,
    pullT:0, shedT:0,
    // Amalgam-specific visuals
    tentacles: Array.from({length:6},(_,i)=>({ ang:(i/6)*Math.PI*2, len:rng(18,30), pulse:rng(0,Math.PI*2) })),
  };
  G.bossPhase=1;
}