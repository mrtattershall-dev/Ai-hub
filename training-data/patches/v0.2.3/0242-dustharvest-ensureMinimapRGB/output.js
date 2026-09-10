function ensureMinimapRGB() {
  // Always rebuild — handles tile type additions without stale cache
  for (const [k, hex] of Object.entries(MINIMAP_TILE_COLORS)) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    MINIMAP_RGB[parseInt(k)] = [r, g, b];
  }
}