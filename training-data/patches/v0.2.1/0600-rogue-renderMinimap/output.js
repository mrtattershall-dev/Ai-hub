function renderMinimap(){
  if(!G.map||!G.map.length) return;
  mmCtx.clearRect(0,0,mmCanvas.width,mmCanvas.height);

  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const t=G.map[r][c], s=G.sat[r][c];
      const x=c*MM_TILE, y=r*MM_TILE;
      const k=r*1000+c;

      // Base tile colour
      if(t===T.WALL){
        // Walls lighten as saturation builds — foreshadowing dissolution
        const wb=Math.floor(58+s*0.4);
        mmCtx.fillStyle=`rgb(${wb},${Math.floor(wb*0.95)},${Math.floor(wb*1.05)})`;
      } else if(t===T.FLOOR){
        mmCtx.fillStyle='#2a2d35';
      } else if(t===T.CHASM){
        mmCtx.fillStyle=G.chasmed[k]?'#3a1020':'#0a0a0e';
      } else if(t===T.BIODOOR){
        mmCtx.fillStyle=G.doored[k]?'#2a2d35':'#3a3000';
      } else if(t===T.EXIT){
        mmCtx.fillStyle=G.boss?'#1a1a00':'#5a4800';
      } else if(t===T.BIO_GEN){
        mmCtx.fillStyle=G.genAwake[k]?'#3a0a0a':'#3a3000';
      } else if(t===T.CORPSE_PIT){
        mmCtx.fillStyle='#3a0d10';
      } else if(t===T.SPORE_VENT){
        mmCtx.fillStyle=G.ventActive[k]?'#1a2a10':'#161e10';
      } else {
        mmCtx.fillStyle='#111116';
      }
      mmCtx.fillRect(x,y,MM_TILE,MM_TILE);

      // Saturation rouge overlay on passable tiles
      if(t!==T.WALL && s>5){
        mmCtx.fillStyle=`rgba(186,4,28,${Math.min(s/100,0.75)})`;
        mmCtx.fillRect(x,y,MM_TILE,MM_TILE);
      }

      // Special tile accent pixels (1px dot in corner)
      if(t===T.EXIT){
        const pulse=G.ticks%20<10;
        mmCtx.fillStyle=pulse?'#ffb703':'#7a6000';
        mmCtx.fillRect(x+1,y+1,1,1);
      } else if(t===T.BIO_GEN && !G.genAwake[k]){
        mmCtx.fillStyle='#ffb703';
        mmCtx.fillRect(x+1,y+1,1,1);
      } else if(t===T.SPORE_VENT && G.ventActive[k]){
        mmCtx.fillStyle='#6aaa44';
        mmCtx.fillRect(x+1,y+1,1,1);
      } else if(t===T.CORPSE_PIT){
        mmCtx.fillStyle='#ff3333';
        mmCtx.fillRect(x+1,y+1,1,1);
      }
    }
  }

  // Enemy dots — gold for elites, red for standard
  const hasNeuronMM=(G.grafts&&(G.grafts[0]==='ORG-09'||G.grafts[1]==='ORG-09'));
  for(const e of G.enemies){
    const ex=Math.floor(e.x/TILE)*MM_TILE+1;
    const ey=Math.floor(e.y/TILE)*MM_TILE+1;
    mmCtx.fillStyle=e.elite?C.gold:'rgba(186,4,28,0.7)';
    mmCtx.fillRect(ex,ey,e.elite?2:1,e.elite?2:1);
  }

  // Player dot — white, blinks at critical rouge
  const rf=G.rouge/G.maxRouge;
  const playerVisible = rf>0.15 || G.ticks%10<7;
  if(playerVisible){
    const ppx=Math.floor(G.px/TILE)*MM_TILE;
    const ppy=Math.floor(G.py/TILE)*MM_TILE;
    mmCtx.fillStyle=rf>0.3?'#f0f0f8':'#ff3333';
    mmCtx.fillRect(ppx,ppy,MM_TILE,MM_TILE);
  }
}