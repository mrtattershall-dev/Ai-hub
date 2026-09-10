function renderTiles(){
  const th=THEMES[G.theme]||THEMES.lab;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const t=G.map[r][c], s=G.sat[r][c];
      const x=c*TILE, y=r*TILE;
      ctx.textAlign='center';
      if(t===T.WALL){
        // Secret room entry wall: faint gold shimmer to hint at hidden room
        const isSecretWall = G.secretRoom && c===G.secretRoom.entryC && r===G.secretRoom.entryR;
        ctx.fillStyle=isSecretWall ? '#1a1500' : th.wall; ctx.fillRect(x,y,TILE,TILE);
        if(isSecretWall&&s<80){ ctx.fillStyle=`rgba(255,183,3,${0.06+0.08*Math.sin(G.time*2+c)})`; ctx.fillRect(x,y,TILE,TILE); }
        if(s>0){  ctx.fillStyle=`rgba(186,4,28,${Math.min(s/160,0.6)})`; ctx.fillRect(x,y,TILE,TILE); }
        if(s>60){ ctx.strokeStyle=`rgba(255,51,51,${(s-60)/80})`; ctx.lineWidth=0.5; ctx.strokeRect(x+1,y+1,TILE-2,TILE-2); }
        // Singularity: white grid lines on walls
        if(G.theme==='singularity'){ ctx.strokeStyle='rgba(248,249,250,0.08)'; ctx.lineWidth=0.5; ctx.strokeRect(x,y,TILE,TILE); }
      } else if(t===T.FLOOR){
        ctx.fillStyle=th.floor; ctx.fillRect(x,y,TILE,TILE);
        // Organic: faint living-wall texture pulse
        if(G.theme==='organic'){ ctx.fillStyle=`rgba(80,10,10,${0.06+0.04*Math.sin(G.time*0.8+r+c)})`; ctx.fillRect(x,y,TILE,TILE); }
        // Core: glowing red vein lines
        if(G.theme==='core' && (r+c)%7===0){ ctx.fillStyle='rgba(186,4,28,0.07)'; ctx.fillRect(x,y,TILE,TILE); }
        // Singularity: white grid
        if(G.theme==='singularity'){ ctx.strokeStyle='rgba(248,249,250,0.06)'; ctx.lineWidth=0.5; ctx.strokeRect(x,y,TILE,TILE); }
        if(s>0){  ctx.fillStyle=`rgba(186,4,28,${Math.min(s/120,0.65)})`; ctx.fillRect(x,y,TILE,TILE); }
        if(s>20){ ctx.fillStyle='rgba(255,80,80,0.09)'; ctx.fillRect(x,y+TILE-3,TILE,3); }
      } else if(t===T.CHASM){
        const bridged=G.chasmed[r*1000+c];
        ctx.fillStyle=bridged?'#240818':C.dark; ctx.fillRect(x,y,TILE,TILE);
        if(bridged){ ctx.fillStyle='rgba(186,4,28,0.38)'; ctx.fillRect(x,y,TILE,TILE); }
        else if(s>20){ ctx.fillStyle=`rgba(186,4,28,${s/600})`; ctx.fillRect(x,y,TILE,TILE); }
        // Chasm inner shadow
        if(!bridged){ ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=2; ctx.strokeRect(x+2,y+2,TILE-4,TILE-4); }
      } else if(t===T.BIODOOR){
        const open=G.doored[r*1000+c];
        if(open){ ctx.fillStyle=C.floor; ctx.fillRect(x,y,TILE,TILE); }
        else{
          ctx.fillStyle='#100e00'; ctx.fillRect(x,y,TILE,TILE);
          ctx.fillStyle=C.gold;    ctx.fillRect(x+4,y+4,TILE-8,TILE-8);
          ctx.fillStyle='#100e00'; ctx.fillRect(x+10,y+10,TILE-20,TILE-20);
          if(s>25){ ctx.fillStyle=`rgba(255,183,3,${(s-25)/90})`; ctx.fillRect(x,y,TILE,TILE); }
        }
      } else if(t===T.EXIT){
        ctx.fillStyle=C.floor; ctx.fillRect(x,y,TILE,TILE);
        const pulse=0.45+0.55*Math.sin(G.time*3.5);
        // Dim exit if boss is alive
        const exitBlocked = !!G.boss;
        ctx.fillStyle=exitBlocked?'#2a2a00':C.gold;
        ctx.globalAlpha=exitBlocked?0.2:(0.35+pulse*0.55);
        ctx.fillRect(x+5,y+5,TILE-10,TILE-10);
        ctx.globalAlpha=1;
        ctx.fillStyle=exitBlocked?'rgba(100,100,0,0.5)':'rgba(0,0,0,0.75)';
        ctx.font='6px Courier New';
        ctx.fillText(exitBlocked?'LOCKED':'EXIT',x+TILE/2,y+TILE/2+3);

      } else if(t===T.BIO_GEN){
        const awake=G.genAwake[r*1000+c];
        ctx.fillStyle=C.floor; ctx.fillRect(x,y,TILE,TILE);
        // Pulsing ring — gold when dormant, red when awake
        const gp=0.4+0.6*Math.sin(G.time*(awake?6:2));
        ctx.strokeStyle=awake?C.rouge:C.gold;
        ctx.lineWidth=2; ctx.globalAlpha=0.4+gp*0.5;
        ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,11,0,Math.PI*2); ctx.stroke();
        ctx.globalAlpha=1;
        // Core dot
        ctx.fillStyle=awake?C.bright:C.gold;
        ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.font='6px Courier New';
        ctx.fillText(awake?'SPENT':'GEN',x+TILE/2,y+TILE-5);

      } else if(t===T.CORPSE_PIT){
        ctx.fillStyle='#1a0d0d'; ctx.fillRect(x,y,TILE,TILE);
        // Dark pool with slow rouge shimmer
        const cp=0.3+0.2*Math.sin(G.time*1.2+c+r);
        ctx.fillStyle=`rgba(186,4,28,${cp})`; ctx.fillRect(x+3,y+3,TILE-6,TILE-6);
        ctx.strokeStyle='#3a0a10'; ctx.lineWidth=1;
        ctx.strokeRect(x+1,y+1,TILE-2,TILE-2);
        ctx.fillStyle='rgba(255,51,51,0.3)'; ctx.font='7px Courier New';
        ctx.fillText('POOL',x+TILE/2,y+TILE/2+3);

      } else if(t===T.SPORE_VENT){
        const active=G.ventActive[r*1000+c];
        ctx.fillStyle=C.floor; ctx.fillRect(x,y,TILE,TILE);
        // Vent grate
        ctx.strokeStyle=active?'#6aaa44':'#2a3a2a'; ctx.lineWidth=1;
        for(let gi=1;gi<4;gi++){
          ctx.beginPath(); ctx.moveTo(x+gi*10,y+2); ctx.lineTo(x+gi*10,y+TILE-2); ctx.stroke();
        }
        // Spore puff when active
        if(active){
          const sp=0.3+0.3*Math.sin(G.time*4+c);
          ctx.fillStyle=`rgba(106,170,68,${sp})`; ctx.globalAlpha=0.7;
          ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,8+sp*4,0,Math.PI*2); ctx.fill();
          ctx.globalAlpha=1;
        }
        ctx.fillStyle=active?'#6aaa44':'#2a3a2a'; ctx.font='6px Courier New';
        ctx.fillText('VENT',x+TILE/2,y+TILE-5);
      }
    }
  }
}