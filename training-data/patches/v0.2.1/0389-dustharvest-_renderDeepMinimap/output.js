function _renderDeepMinimap() {
  const mm = document.getElementById('minimapCanvas');
  if (!mm) return;
  const c = mm.getContext('2d');
  const mw = mm.width, mh = mm.height;
  const scaleX = mw / (DJ_W * DJ_T), scaleY = mh / (DJ_H * DJ_T);

  c.fillStyle = '#030805'; c.fillRect(0, 0, mw, mh);

  for (let ty = 0; ty < DJ_H; ty++) {
    for (let tx = 0; tx < DJ_W; tx++) {
      if (!exploredDeep[ty * DJ_W + tx]) continue;
      const t = getDJT(tx, ty);
      const mx = Math.round(tx * DJ_T * scaleX);
      const my = Math.round(ty * DJ_T * scaleY);
      const mw2= Math.max(1, Math.round(DJ_T * scaleX));
      const mh2= Math.max(1, Math.round(DJ_T * scaleY));
      c.fillStyle =
        t === JG.FORMATION    ? '#c87010' :
        t === JG.BIOLUM       ? '#20b090' :
        t === JG.ANCIENT_FLOOR? '#282a38' :
        t === JG.ANCIENT_WALL ? '#1c1e28' :
        t === JG.DARK_WATER   ? '#040c08' :
        t === JG.CANOPY_BREAK ? '#4a7028' :
        t === JG.MOSS         ? '#183820' :
        t === JG.ROOT         ? '#2a1e08' :
        t === JG.VINE         ? '#1a3010' :
        t === JG.DENSE_TREE   ? '#0a1808' :
        t === JG.TREE         ? '#122010' :
        t === JG.ASCEND       ? '#70c050' :
        '#121810';
      c.fillRect(mx, my, mw2, mh2);
    }
  }

  // Player dot
  const px = Math.round(player.x * scaleX), py = Math.round(player.y * scaleY);
  c.fillStyle = '#f0e080'; c.fillRect(px - 1, py - 1, 3, 3);
}