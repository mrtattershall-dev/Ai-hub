function tryPlacePen(type, tx, ty) {
  const size = PEN_SIZES[type];
  const { w, h } = size;

  // Must be in barn zone (y 36–70, x 0–33)
  if (tx < 1 || tx + w > 33 || ty < 36 || ty + h > 70) {
    showMsg('⚠️ Pens must be placed in the Ranch zone (south farm area).'); return;
  }
  if (pens.length >= MAX_PENS) {
    showMsg(`⚠️ Max ${MAX_PENS} pens already placed.`); ranchPlacementMode = false; return;
  }

  // Check no existing solid tiles overlap the footprint
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const t = getT(tx+dx, ty+dy);
      if (SOLID.has(t) && t !== TL.GRASS && t !== TL.DIRT && t !== TL.DIRT2) {
        showMsg('⚠️ Something is blocking that spot — try another location.'); return;
      }
    }
  }

  // Check no overlap with existing pens
  for (const p of pens) {
    const overlapX = tx < p.x+p.w && tx+w > p.x;
    const overlapY = ty < p.y+p.h && ty+h > p.y;
    if (overlapX && overlapY) { showMsg('⚠️ Too close to an existing pen.'); return; }
  }

  // Check player isn't standing inside the footprint
  const ptx = Math.floor(player.x/T), pty = Math.floor(player.y/T);
  if (ptx >= tx && ptx < tx+w && pty >= ty && pty < ty+h) {
    showMsg('⚠️ You\'re standing in the way — move clear of the pen area first.'); return;
  }

  // Write fence tiles to the map
  for (let dx = 0; dx < w; dx++) {
    setT(tx+dx, ty,   TL.FENCE);
    setT(tx+dx, ty+h-1, TL.FENCE);
  }
  for (let dy = 1; dy < h-1; dy++) {
    setT(tx,     ty+dy, TL.FENCE);
    setT(tx+w-1, ty+dy, TL.FENCE);
  }
  // Interior: dirt floor
  for (let dy = 1; dy < h-1; dy++)
    for (let dx = 1; dx < w-1; dx++)
      setT(tx+dx, ty+dy, TL.DIRT);
  // Gate on south face, centred
  const gateX = tx + Math.floor(w/2);
  setT(gateX, ty+h-1, TL.FENCE_GATE);

  // Register pen
  const maxHp = 30;
  const newPen = { id: penIdCounter++, x:tx, y:ty, w, h, hp:maxHp, maxHp, type, animals:[], troughFill:30 };
  pens.push(newPen);

  // Place trough tile inside pen
  setPenTroughTile(newPen);

  const icons = ANIMAL_ICONS;
  showMsg(`${icons[type]} ${type.charAt(0).toUpperCase()+type.slice(1)} pen built! Buy animals at the LIVESTOCK market tab.`);
  ranchPlacementMode = false;
  // Refresh farm panel ranch section if open
  updateRanchPanel();
}