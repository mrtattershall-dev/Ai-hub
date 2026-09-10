function renderMinimap() {
  const mc = document.getElementById('minimapCanvas');
  if (!mc) return;
  if (mc.width !== MM_W) { mc.width = MM_W; mc.height = MM_H; }
  const mctx = mc.getContext('2d');

  if (gameState.inOcean) { renderOceanMinimap(mctx, mc.width, mc.height); return; }
  if (gameState.inHoboCamp) { renderHoboCampMinimap(); return; }

  if (gameState.inBadlands) {
    // ── Badlands mode ─────────────────────────────────────────────────────────
    const img = new ImageData(MM_W, MM_H);
    const mpx = img.data;
    const scaleX = MM_W / BL_W, scaleY = MM_H / BL_H;
    const BL_MM_COLOR = {
      [BL.CRACKED]:[160,104,64],[BL.REDROCK]:[192,80,48],[BL.DUSTFLOOR]:[200,168,112],
      [BL.DEADWOOD]:[122,96,64],[BL.SKULL_ROCK]:[96,80,80],[BL.MESA]:[176,72,40],
      [BL.CANYON]:[32,14,8],[BL.SULFUR]:[212,180,48],[BL.TUMBLEWEED]:[154,128,80],
      [BL.OUTPOST]:[128,96,80],[BL.OUTPOST_WALL]:[96,48,32],
      [BL.BL_COPPER]:[192,112,64],[BL.BL_IRON]:[96,144,160],[BL.BL_OBSIDIAN]:[40,24,64],
      [BL.BL_SILVER]:[192,200,216],[BL.BL_BONE]:[216,208,184],[BL.BL_EXIT]:[64,255,200],
      [BL.TOXIC_VENT]:[100,160,20],[BL.ASH]:[104,96,88],[BL.SETTLEMENT]:[80,64,56],[BL.SETTLEMENT_WALL]:[48,40,24],
      [BL.RAIL_TRACK]:[72,52,36],[BL.BL_MINE]:[20,16,28],
    };
    const blFog = [30,14,8];
    for (let my = 0; my < BL_H; my++) for (let mx = 0; mx < BL_W; mx++) {
      const px0=Math.floor(mx*scaleX), py0=Math.floor(my*scaleY);
      const px1=Math.min(MM_W,Math.floor((mx+1)*scaleX));
      const py1=Math.min(MM_H,Math.floor((my+1)*scaleY));
      const revealed = exploredBadlands[my*BL_W+mx];
      const rgb = revealed ? (BL_MM_COLOR[getBLT(mx,my)] || [160,104,64]) : blFog;
      for (let dy=py0;dy<py1;dy++) for (let dx=px0;dx<px1;dx++) {
        const idx=(dy*MM_W+dx)*4;
        mpx[idx]=rgb[0]; mpx[idx+1]=rgb[1]; mpx[idx+2]=rgb[2]; mpx[idx+3]=255;
      }
    }
    mctx.putImageData(img, 0, 0);
    mctx.font='bold 9px monospace'; mctx.textAlign='left';
    mctx.fillStyle='rgba(0,0,0,.65)'; mctx.fillRect(2,2,90,14);
    mctx.fillStyle='#e08030'; mctx.fillText('THE BADLANDS', 5, 12);
    // Enemies
    mctx.fillStyle='rgba(220,50,30,.9)';
    for (const en of badlandsEnemies) {
      mctx.fillRect((en.x/T)*scaleX-1,(en.y/T)*scaleY-1,3,3);
    }
    // Mine entrance landmark dot (always shown once placed)
    if (blMineEntranceX > 0) {
      const mex = blMineEntranceX * scaleX, mey = blMineEntranceY * scaleY;
      mctx.fillStyle='rgba(0,0,0,.6)'; mctx.fillRect(mex-1,mey-1,7,7);
      mctx.fillStyle='#6080c0'; mctx.fillRect(mex,mey,5,5);
      mctx.font='bold 7px monospace'; mctx.textAlign='center';
      mctx.fillStyle='#90b0e0'; mctx.fillText('⛏',mex+2.5,mey+6);
    }
    // Survivor landmark
    if (blDeepChestX > 0 && exploredBadlands[(blDeepChestY+3)*BL_W+(blDeepChestX+2)]) {
      const sx2 = (blDeepChestX+2)*scaleX, sy2 = (blDeepChestY+3)*scaleY;
      mctx.fillStyle='#c0a060'; mctx.font='7px monospace'; mctx.textAlign='center';
      mctx.fillText('👥',sx2+2,sy2+5);
    }
    // Player dot
    const bpx=(player.x/T)*scaleX, bpy=(player.y/T)*scaleY;
    mctx.fillStyle='#0e0808'; mctx.fillRect(bpx-2,bpy-2,6,6);
    mctx.fillStyle='#f0d060'; mctx.fillRect(bpx-1,bpy-1,4,4);

  } else if (gameState.inBLMine) {
    // ── BL Mine minimap ──────────────────────────────────────────────────────
    const fl = gameState.blMineFloor;
    const img2 = new ImageData(MM_W, MM_H);
    const mpx2 = img2.data;
    const sX = MM_W / MINE_W, sY = MM_H / MINE_H;
    const MMC2 = {
      [TL.MINE_FLOOR]:[50,38,34],[TL.MINE_WALL]:[20,16,18],
      [TL.COAL_VEIN]:[42,38,38],[TL.COPPER_VEIN]:[120,60,28],
      [TL.IRON_VEIN]:[60,70,85],[TL.GOLD_VEIN]:[130,94,28],
      [TL.CRYSTAL_VEIN]:[45,60,92],[TL.SILVER_VEIN]:[138,148,168],
      [TL.SINGING_VEIN]:[88,48,138],[TL.MINE_EXIT]:[38,70,38],
      [TL.MINE_SHAFT_DOWN]:[38,22,38],[TL.MINE_SHAFT_UP]:[22,38,54],
    };
    const fbg = [20,16,18];
    const blGrid = exploredBLMine ? exploredBLMine[fl] : null;
    for (let my=0;my<MINE_H;my++) for (let mx=0;mx<MINE_W;mx++) {
      const explored = blGrid ? blGrid[my*MINE_W+mx] : 0;
      const t = getBLMineT(fl,mx,my);
      const rgb = explored ? (MMC2[t]||fbg) : fbg;
      const px0=Math.floor(mx*sX),py0=Math.floor(my*sY);
      const px1=Math.min(MM_W,Math.floor((mx+1)*sX)),py1=Math.min(MM_H,Math.floor((my+1)*sY));
      for (let dy=py0;dy<py1;dy++) for (let dx=px0;dx<px1;dx++) {
        const i2=(dy*MM_W+dx)*4;
        mpx2[i2]=rgb[0];mpx2[i2+1]=rgb[1];mpx2[i2+2]=rgb[2];mpx2[i2+3]=255;
      }
    }
    mctx.putImageData(img2,0,0);
    mctx.font='bold 9px monospace'; mctx.textAlign='left';
    mctx.fillStyle='rgba(0,0,0,.65)'; mctx.fillRect(2,2,108,14);
    mctx.fillStyle='#6080c0'; mctx.fillText('COMPANY MINE L'+(fl+1)+'/5',5,12);
    // NPCs
    for (const npc of BL_MINE_NPCS) {
      if (npc.floor !== fl) continue;
      const nx=npc.tx*sX, ny=npc.ty*sY;
      mctx.fillStyle='#c0a060'; mctx.fillRect(nx-1,ny-1,4,4);
    }
    // Player dot
    const bp2x=(player.x/T)*sX, bp2y=(player.y/T)*sY;
    mctx.fillStyle='#0e0808'; mctx.fillRect(bp2x-2,bp2y-2,6,6);
    mctx.fillStyle='#f0d060'; mctx.fillRect(bp2x-1,bp2y-1,4,4);

  } else if (gameState.inMine) {
    // ── Mine mode: draw the current floor map ────────────────────────────────
    const fl  = gameState.mineFloor;
    const img = new ImageData(MM_W, MM_H);
    const mpx = img.data;
    const scaleX = MM_W / MINE_W;
    const scaleY = MM_H / MINE_H;
    const MMC = {
      [TL.MINE_FLOOR]: [58,48,40],    [TL.MINE_WALL]:   [26,22,21],
      [TL.COAL_VEIN]:  [42,40,40],    [TL.COPPER_VEIN]: [122,64,32],
      [TL.IRON_VEIN]:  [64,72,88],    [TL.GOLD_VEIN]:   [128,96,32],
      [TL.CRYSTAL_VEIN]:[48,64,96],   [TL.MINE_EXIT]:   [40,72,40],
      [TL.MINE_SHAFT_DOWN]:[40,24,40],[TL.MINE_SHAFT_UP]:[24,40,56],
      [TL.SILVER_VEIN]:[140,150,170], [TL.SINGING_VEIN]:[90,50,140],
    };
    const fb = [26,22,21]; // fog color
    const mineGrid = exploredMine[fl];
    for (let my = 0; my < MINE_H; my++) {
      for (let mx = 0; mx < MINE_W; mx++) {
        const explored = mineGrid[my * MINE_W + mx];
        const t   = getMineT(fl, mx, my);
        const rgb = explored ? (MMC[t] || fb) : fb;
        const px0 = Math.floor(mx * scaleX);
        const py0 = Math.floor(my * scaleY);
        const px1 = Math.min(MM_W, Math.floor((mx+1) * scaleX));
        const py1 = Math.min(MM_H, Math.floor((my+1) * scaleY));
        for (let dy = py0; dy < py1; dy++) {
          for (let dx = px0; dx < px1; dx++) {
            const idx = (dy * MM_W + dx) * 4;
            mpx[idx]=rgb[0]; mpx[idx+1]=rgb[1]; mpx[idx+2]=rgb[2]; mpx[idx+3]=255;
          }
        }
      }
    }
    mctx.putImageData(img, 0, 0);

    // Floor label — MINE_FLOORS is 4 (floor 4 is hidden/secret, show 3 to player)
    mctx.font = 'bold 9px monospace';
    mctx.textAlign = 'left';
    mctx.fillStyle = 'rgba(0,0,0,.65)';
    mctx.fillRect(2, 2, 72, 14);
    mctx.fillStyle = fl === 3 ? '#a060e0' : '#90b0e8';
    mctx.fillText(fl === 3 ? 'MINE — F4 ?' : 'MINE — F' + (fl+1) + '/3', 5, 12);

    // Enemies
    mctx.fillStyle = 'rgba(220,50,30,.9)';
    for (const en of enemies) {
      const sx = (en.x / T) * scaleX;
      const sy = (en.y / T) * scaleY;
      mctx.fillRect(sx-1, sy-1, 3, 3);
    }

    // Player dot
    const ppx = (player.x / T) * scaleX;
    const ppy = (player.y / T) * scaleY;
    mctx.fillStyle = '#0e0808'; mctx.fillRect(ppx-2, ppy-2, 6, 6);
    mctx.fillStyle = '#f0d060'; mctx.fillRect(ppx-1, ppy-1, 4, 4);

  } else {
    // ── Surface mode: draw the world tileMap ────────────────────────────────
    if (_minimapCacheDirty || !_minimapCache) buildMinimapCache();
    mctx.putImageData(_minimapCache, 0, 0);

    // Landmarks
    mctx.font = 'bold 8px monospace';
    mctx.textAlign = 'center';
    const lms = [
      { tx:13, ty:26, color:'#60b0ff', label:'💧' },
      { tx:53, ty:7,  color:'#f0d060', label:'M' },
      { tx:66, ty:19, color:'#f0d060', label:'S' },
      { tx:68, ty:59, color:'#c08060', label:'⛏' },
      { tx:17, ty:52, color:'#e0a040', label:'🐄' },
      { tx:4,  ty:75, color:'#e08030', label:'🏜' },
    ];
    for (const lm of lms) {
      const sx = lm.tx * MM_SCALE + MM_SCALE/2;
      const sy = lm.ty * MM_SCALE + MM_SCALE/2;
      mctx.fillStyle = 'rgba(0,0,0,.55)';
      mctx.fillText(lm.label, sx+1, sy+4);
      mctx.fillStyle = lm.color;
      mctx.fillText(lm.label, sx, sy+3);
    }

    // Enemies at night
    if (gameState.isNight) {
      mctx.fillStyle = 'rgba(220,50,30,.9)';
      for (const en of enemies) {
        const sx = (en.x / T) * MM_SCALE;
        const sy = (en.y / T) * MM_SCALE;
        mctx.fillRect(sx-1, sy-1, 3, 3);
      }
    }

    // Player dot
    const px2 = (player.x / T) * MM_SCALE;
    const py2 = (player.y / T) * MM_SCALE;
    mctx.fillStyle = '#0e0808'; mctx.fillRect(px2-2, py2-2, 6, 6);
    mctx.fillStyle = '#f0d060'; mctx.fillRect(px2-1, py2-1, 4, 4);

    // Viewport rectangle
    const vx = Math.max(0, (gameState.camera.x / T) * MM_SCALE);
    const vy = Math.max(0, (gameState.camera.y / T) * MM_SCALE);
    const vw = (canvas.width  / T) * MM_SCALE;
    const vh = (canvas.height / T) * MM_SCALE;
    mctx.strokeStyle = 'rgba(255,255,255,0.35)';
    mctx.lineWidth = 1;
    mctx.strokeRect(vx, vy, Math.min(vw, MM_W-vx), Math.min(vh, MM_H-vy));
  }
}