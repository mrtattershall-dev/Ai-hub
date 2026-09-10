function triggerBioGenWave(wx, wy){
  boom(wx, wy, 30, C.gold, {spd:140, settles:false});
  const count = 2 + Math.floor(G.floor/3);
  for(let i=0; i<count; i++){
    const ang = (i/count)*Math.PI*2;
    const def = ETYPES.husk;
    G.enemies.push({
      ...def, type:'husk',
      x: wx+Math.cos(ang)*TILE*1.5,
      y: wy+Math.sin(ang)*TILE*1.5,
      hp: def.hp*(1+(G.floor-1)*0.1),
      maxHp: def.hp*(1+(G.floor-1)*0.1),
      charging:false, chargeWait:rng(0.5,1.5), chargeT:0, cdx:0, cdy:0,
      shotT:rng(1,2.5),
    });
  }
}