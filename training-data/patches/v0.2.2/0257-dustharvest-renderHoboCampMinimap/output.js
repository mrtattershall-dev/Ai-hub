function renderHoboCampMinimap() {
  const mc=document.getElementById('minimapCanvas');
  if(!mc) return;
  if(mc.width !== MM_W){ mc.width=MM_W; mc.height=MM_H; }
  const mctx=mc.getContext('2d');
  const mw=mc.width, mh=mc.height;
  mctx.fillStyle='#0a0806'; mctx.fillRect(0,0,mw,mh);

  const scx=mw/HC_W, scy=mh/HC_H;

  const colorMap={
    [TL.GRASS]:'#647645',  [TL.DIRT]:'#7a6251',   [TL.ROAD]:'#a38762',
    [TL.WATER]:'#246fa6',  [TL.WALL]:'#544b46',    [TL.STONE]:'#5b4b41',
    [TL.TOWN_FLOOR]:'#897762',[TL.CAMPFIRE]:'#e07820',[TL.WELL]:'#766a64',
    [TL.CRATE]:'#7a6251',  [TL.TREE]:'#276b1f',    [TL.ROCK]:'#5b4b41',
    [TL.BUSH]:'#426848',   [HC.EXIT]:'#c8b870',
  };

  for(let ty=0;ty<HC_H;ty++) for(let tx=0;tx<HC_W;tx++){
    if(!exploredHobo[ty*HC_W+tx]) continue;
    const t=getHCT(tx,ty);
    mctx.fillStyle=colorMap[t]||'#5b4b41';
    mctx.fillRect(Math.floor(tx*scx), Math.floor(ty*scy), Math.ceil(scx)+1, Math.ceil(scy)+1);
  }

  // Enemy dots
  mctx.fillStyle='rgba(220,50,30,.9)';
  for(const en of enemies){
    const etx=Math.floor(en.x/HC_T), ety=Math.floor(en.y/HC_T);
    if(ety>=0&&ety<HC_H&&etx>=0&&etx<HC_W&&exploredHobo[ety*HC_W+etx])
      mctx.fillRect((en.x/HC_T)*scx-1,(en.y/HC_T)*scy-1,3,3);
  }

  // Player dot
  const px=(player.x/HC_T)*scx;
  const py=(player.y/HC_T)*scy;
  mctx.fillStyle='#181818'; mctx.fillRect(px-2,py-2,5,5);
  mctx.fillStyle='#e8dfc8'; mctx.fillRect(px-1,py-1,3,3);

  // Zone label
  mctx.fillStyle='rgba(200,184,100,.6)';
  mctx.font='6px sans-serif'; mctx.textAlign='center';
  mctx.fillText('HOBO CAMP', mw/2, mh-2);
}