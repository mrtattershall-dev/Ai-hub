function buildMinimapCache() {
  ensureMinimapRGB();
  const img = new ImageData(MM_W, MM_H);
  const px = img.data;
  const fallback = [100, 118, 69]; // Mana Seed grass #647645
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const t = getT(tx, ty);
      const explored = exploredWorld[ty * MAP_W + tx] === 1;
      const rgb = explored ? (MINIMAP_RGB[t] || fallback) : [8, 7, 5];
      // Paint MM_SCALE × MM_SCALE block
      for (let dy = 0; dy < MM_SCALE; dy++) {
        for (let dx = 0; dx < MM_SCALE; dx++) {
          const i = ((ty * MM_SCALE + dy) * MM_W + (tx * MM_SCALE + dx)) * 4;
          px[i]   = rgb[0];
          px[i+1] = rgb[1];
          px[i+2] = rgb[2];
          px[i+3] = 255;
        }
      }
    }
  }
  _minimapCache = img;
  _minimapCacheDirty = false;
}