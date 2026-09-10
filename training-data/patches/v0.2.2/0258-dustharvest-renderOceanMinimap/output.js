function renderOceanMinimap(mctxIn, mwIn, mhIn) {
  const mc = document.getElementById('minimapCanvas');
  if (!mc) return;
  if (mc.width !== MM_W) { mc.width = MM_W; mc.height = MM_H; }
  const mctx = mctxIn || mc.getContext('2d');
  const mw = mwIn || mc.width;
  const mh = mhIn || mc.height;
  const scx = mw / OC_W, scy = mh / OC_H;
  const OC_COLOR = {};
  OC_COLOR[OC.WATER]    = '#1a4868';
  OC_COLOR[OC.DEEP]     = '#0e2c48';
  OC_COLOR[OC.SAND]     = '#c8a878';
  OC_COLOR[OC.DOCK]     = '#7a6040';
  OC_COLOR[OC.GANGPLANK]= '#6e5c44';
  OC_COLOR[OC.BOAT_DECK]= '#5a3a1c';
  OC_COLOR[OC.BOAT_HULL]= '#3a2210';
  OC_COLOR[OC.ROCK]     = '#4a4040';
  OC_COLOR[OC.WALL]     = '#504040';
  OC_COLOR[OC.FLOOR]    = '#7a6a5a';
  OC_COLOR[OC.ROAD]     = '#908070';
  OC_COLOR[OC.GRASS]    = '#4a6830';
  OC_COLOR[OC.TREE]     = '#2a4820';
  OC_COLOR[OC.CRATE]    = '#786040';
  OC_COLOR[OC.POST]     = '#6a5030';
  OC_COLOR[OC.SEAGRASS] = '#1e6040';
  OC_COLOR[OC.EXIT]     = '#c8b870';
  mctx.fillStyle = '#070f14';
  mctx.fillRect(0, 0, mw, mh);
  for (let ty = 0; ty < OC_H; ty++) {
    for (let tx = 0; tx < OC_W; tx++) {
      if (!exploredOcean[ty * OC_W + tx]) continue;
      const t = getOCT(tx, ty);
      mctx.fillStyle = OC_COLOR[t] || '#1a4868';
      mctx.fillRect(Math.floor(tx*scx), Math.floor(ty*scy), Math.ceil(scx)+1, Math.ceil(scy)+1);
    }
  }
  if (hasBoat()) {
    const btx = (gameState.boatX / OC_T) * scx;
    const bty = (gameState.boatY / OC_T) * scy;
    mctx.fillStyle = '#181818'; mctx.fillRect(btx-3, bty-3, 7, 7);
    mctx.fillStyle = '#80c8f0'; mctx.fillRect(btx-2, bty-2, 5, 5);
  }
  if (gameState.isNight) {
    mctx.fillStyle = 'rgba(220,50,30,.9)';
    for (const en of enemies) {
      const etx = Math.floor(en.x/OC_T), ety = Math.floor(en.y/OC_T);
      if (ety>=0&&ety<OC_H&&etx>=0&&etx<OC_W&&exploredOcean[ety*OC_W+etx])
        mctx.fillRect((en.x/OC_T)*scx-1,(en.y/OC_T)*scy-1,3,3);
    }
  }
  const px = (player.x/OC_T)*scx, py = (player.y/OC_T)*scy;
  mctx.fillStyle = '#181818'; mctx.fillRect(px-2,py-2,5,5);
  mctx.fillStyle = '#f0d060'; mctx.fillRect(px-1,py-1,3,3);
  mctx.fillStyle = 'rgba(130,190,220,.65)';
  mctx.font = '6px sans-serif'; mctx.textAlign = 'center';
  mctx.fillText('THE OCEAN', mw/2, mh-2);
}