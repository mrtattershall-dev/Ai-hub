function getFlickDir() {
  const u = keys['ArrowUp']   || keys['KeyI'];
  const d = keys['ArrowDown'] || keys['KeyK'];
  const l = keys['ArrowLeft'] || keys['KeyJ'];
  const r = keys['ArrowRight']|| keys['KeyL'];
  if (u && l) return 'up-left';
  if (u && r) return 'up-right';
  if (d && l) return 'down-left';
  if (d && r) return 'down-right';
  if (u) return 'up';
  if (d) return 'down';
  if (l) return 'left';
  if (r) return 'right';
  return null;
}