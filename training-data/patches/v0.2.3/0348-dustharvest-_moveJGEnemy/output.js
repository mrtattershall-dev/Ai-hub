function _moveJGEnemy(e, nx, ny) {
  // Collision: use JG_SOLID + getJGT, with JG_T tile size
  const htx = Math.floor(nx / JG_T), hty = Math.floor(e.y / JG_T);
  const vtx = Math.floor(e.x / JG_T), vty = Math.floor(ny / JG_T);
  if (!getJGSolid(htx, hty)) e.x = Math.max(JG_T, Math.min((JG_W - 1) * JG_T, nx));
  if (!getJGSolid(vtx, vty)) e.y = Math.max(JG_T, Math.min((JG_H - 1) * JG_T, ny));
}