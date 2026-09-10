function renderJungleMinimap() {
  const mc = document.getElementById('minimapCanvas');
  if (!mc) return;
  if (mc.width !== MM_W) { mc.width = MM_W; mc.height = MM_H; }
  const mctx = mc.getContext('2d');
  const scx = MM_W / JG_W, scy = MM_H / JG_H;
  const JG_COLOR = {};
  JG_COLOR[JG.WATER_DEEP]  = '#0e2c1c';
  JG_COLOR[JG.WATER]       = '#183828';
  JG_COLOR[JG.SAND]        = '#b09870';
  JG_COLOR[JG.DOCK]        = '#6a5030';
  JG_COLOR[JG.PLANK]       = '#7a6040';
  JG_COLOR[JG.GRASS]       = '#2a5020';
  JG_COLOR[JG.JUNGLE_FLOOR]= '#1e3c18';
  JG_COLOR[JG.MUD]         = '#3c2c1a';
  JG_COLOR[JG.DIRT]        = '#4a3420';
  JG_COLOR[JG.TREE]        = '#183c10';
  JG_COLOR[JG.DENSE_TREE]  = '#0e2808';
  JG_COLOR[JG.ROCK]        = '#3c3830';
  JG_COLOR[JG.WALL]        = '#2c2820';
  JG_COLOR[JG.ROAD]        = '#5a4a38';
  JG_COLOR[JG.CAMPFIRE]    = '#c06020';
  JG_COLOR[JG.FARM_PLOT]   = '#4a3820';
  JG_COLOR[JG.EXIT]        = '#c8b870';
  JG_COLOR[JG.BUSH]        = '#204818';
  mctx.fillStyle = '#060e04';
  mctx.fillRect(0, 0, MM_W, MM_H);
  for (let ty = 0; ty < JG_H; ty++) {
    for (let tx = 0; tx < JG_W; tx++) {
      if (!exploredJungle[ty * JG_W + tx]) continue;
      const t = getJGT(tx, ty);
      mctx.fillStyle = JG_COLOR[t] || '#1e3c18';
      mctx.fillRect(Math.floor(tx * scx), Math.floor(ty * scy), Math.ceil(scx) + 1, Math.ceil(scy) + 1);
    }
  }
  // NPCs
  JG_NPCS.forEach(npc => {
    if (!exploredJungle[npc.ty * JG_W + npc.tx]) return;
    const nx = Math.floor(npc.tx * scx), ny = Math.floor(npc.ty * scy);
    mctx.fillStyle = '#404040'; mctx.fillRect(nx - 1, ny - 1, 4, 4);
    mctx.fillStyle = '#78c888'; mctx.fillRect(nx, ny, 2, 2);
  });
  // Player dot
  const px = (player.x / JG_T) * scx, py = (player.y / JG_T) * scy;
  mctx.fillStyle = '#181818'; mctx.fillRect(px - 2, py - 2, 5, 5);
  mctx.fillStyle = '#f0d060'; mctx.fillRect(px - 1, py - 1, 3, 3);
  mctx.fillStyle = 'rgba(80,200,100,.65)';
  mctx.font = '6px sans-serif'; mctx.textAlign = 'center';
  mctx.fillText('THE EASTERN COAST', MM_W / 2, MM_H - 2);
}