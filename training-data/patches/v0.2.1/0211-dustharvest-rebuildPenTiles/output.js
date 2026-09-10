function rebuildPenTiles(pen) {
  const { x:tx, y:ty, w, h } = pen;
  for (let dx = 0; dx < w; dx++) {
    setT(tx+dx, ty,   TL.FENCE);
    setT(tx+dx, ty+h-1, TL.FENCE);
  }
  for (let dy = 1; dy < h-1; dy++) {
    setT(tx,     ty+dy, TL.FENCE);
    setT(tx+w-1, ty+dy, TL.FENCE);
  }
  for (let dy = 1; dy < h-1; dy++)
    for (let dx = 1; dx < w-1; dx++)
      setT(tx+dx, ty+dy, TL.DIRT);
  const gateX = tx + Math.floor(w/2);
  setT(gateX, ty+h-1, TL.FENCE_GATE);
  // Restore per-pen trough tile (only default to 0 if truly absent, patched on load)
  if (pen.troughFill === undefined) pen.troughFill = 30;
  setPenTroughTile(pen);
}