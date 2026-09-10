function revealAround(px, py, radius, grid, gw, gh) {
  const tx = Math.floor(px / T);
  const ty = Math.floor(py / T);
  const r2 = radius * radius;
  let revealed = false;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx*dx + dy*dy > r2) continue;
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
      if (!grid[ny * gw + nx]) {
        grid[ny * gw + nx] = 1;
        revealed = true;
      }
    }
  }
  if (revealed) _minimapCacheDirty = true;
}