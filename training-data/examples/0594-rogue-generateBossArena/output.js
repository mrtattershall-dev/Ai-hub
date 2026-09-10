function generateBossArena(){
  G.map=[]; G.sat=[]; G.chasmed={}; G.doored={}; G.genAwake={}; G.ventActive={};
  for(let r=0;r<ROWS;r++){
    G.map.push(new Uint8Array(COLS).fill(T.WALL));
    G.sat.push(new Float32Array(COLS));
  }
  // Large open arena with 4-tile border wall
  for(let r=3;r<ROWS-3;r++)
    for(let c=3;c<COLS-3;c++)
      G.map[r][c]=T.FLOOR;
  // Corner pillars
  for(const [pr,pc] of [[4,4],[4,COLS-5],[ROWS-5,4],[ROWS-5,COLS-5]]){
    for(let dr=0;dr<2;dr++) for(let dc=0;dc<2;dc++) G.map[pr+dr][pc+dc]=T.WALL;
  }
  G.theme='singularity';
  G.rooms=[{x:3,y:3,w:COLS-6,h:ROWS-6}];
  G.secretRoom=null;
  // Player spawns left-centre; boss will spawn right-centre
  G.px=5*TILE+TILE/2; G.py=Math.floor(ROWS/2)*TILE;
  G.floorTransitioning=false;
}