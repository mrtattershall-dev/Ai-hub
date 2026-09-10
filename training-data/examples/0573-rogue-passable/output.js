function passable(px,py){
  const t=tileAt(px,py), c=Math.floor(px/TILE), r=Math.floor(py/TILE), k=r*1000+c;
  if(t===T.WALL)    return false;
  if(t===T.CHASM)   return !!G.chasmed[k];
  if(t===T.BIODOOR) return !!G.doored[k];
  // BIO_GEN, CORPSE_PIT, SPORE_VENT are all passable floor tiles
  return true;
}